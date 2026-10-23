"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { IMPORT_MAX_ROWS, type RawImportRow } from "@/app/app/expenses/import-utils";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveWalletCard, type WalletCardRef } from "@/lib/statement-parser";
import { importCredits } from "./credits";
import { importExpenses } from "./expenses";

const MAX_STATEMENTS = 50;
const MAX_ROWS = 10_000;

export type StatementImportResult =
  | {
      ok: true;
      cardsAdded: number;
      cardsMatched: number;
      imported: number;
      duplicates: number;
      skipped: number;
      rewards: number;
      rewardAmount: number;
      rewardDuplicates: number;
      errors: string[];
    }
  | { error: string };

const Row = z.record(z.string(), z.unknown());

const Statement = z
  .object({
    /** An existing wallet card the user picked. */
    cardId: z.string().min(1).max(100).optional().nullable(),
    /** Otherwise a catalog product (matched to a wallet card or added). */
    cardProductId: z.string().min(1).max(100).optional().nullable(),
    last4: z
      .string()
      .optional()
      .nullable()
      .refine((v) => v == null || /^\d{4}$/.test(v), "Card digits must be the last 4 only"),
    expenses: z.array(Row).max(MAX_ROWS),
    credits: z.array(Row).max(MAX_ROWS),
  })
  .refine((s) => !!(s.cardId || s.cardProductId), "Pick a card for every statement");

const Input = z
  .array(Statement)
  .min(1, "Nothing to import")
  .max(MAX_STATEMENTS, `Import up to ${MAX_STATEMENTS} statements at a time`)
  .refine((list) => list.reduce((n, s) => n + s.expenses.length + s.credits.length, 0) <= MAX_ROWS, `Import up to ${MAX_ROWS.toLocaleString("en-IN")} rows at a time`);

export type StatementImportInput = z.input<typeof Input>;

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input";

/** Keeps only the row fields importExpenses / importCredits read, as strings, and pins the card. */
function pin(rows: Record<string, unknown>[], fields: readonly string[], cardId: string): RawImportRow[] {
  return rows.map((raw) => {
    const row: Record<string, string> = {};
    for (const f of fields) {
      const v = raw[f];
      if (typeof v === "string" || typeof v === "number") row[f] = String(v);
    }
    row.card = cardId;
    return row as RawImportRow;
  });
}

const EXPENSE_FIELDS = ["date", "amount", "category", "subcategory", "merchant", "channel", "note"] as const;
const CREDIT_FIELDS = ["date", "amount", "note"] as const;

/**
 * Imports rows parsed from statement PDFs in the browser (the PDFs and passwords never reach the server).
 * Each statement's card is an owned wallet card, or a catalog product that is matched to a wallet card
 * (by last 4, then product) or added to the wallet (needsDetails). Rows then go through the regular
 * expense and cashback import paths, which validate every row and skip ones already saved.
 */
export async function importStatements(input: StatementImportInput): Promise<StatementImportResult> {
  const user = await requireUser();
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const statements = parsed.data;

  const owned = await db.userCard.findMany({
    where: { userId: user.id },
    select: { id: true, last4: true, cardProductId: true, cardProduct: { select: { bank: true } } },
    orderBy: { createdAt: "asc" },
  });
  const wallet: WalletCardRef[] = owned.map((c) => ({ id: c.id, productId: c.cardProductId, bank: c.cardProduct.bank, last4: c.last4 }));

  const productIds = [...new Set(statements.flatMap((s) => (s.cardId ? [] : [s.cardProductId!])))];
  const products = await db.cardProduct.findMany({
    where: { id: { in: productIds }, OR: [{ ownerId: null }, { ownerId: user.id }] },
    select: { id: true, bank: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));
  if (products.length !== productIds.length) return { error: "Some of those cards aren't in the catalog" };
  for (const s of statements) if (s.cardId && !wallet.some((c) => c.id === s.cardId)) return { error: "Card not found" };

  // Resolve (and create) cards first, so later statements of the same card reuse it.
  const cardFor: string[] = [];
  let cardsAdded = 0;
  const matched = new Set<string>();
  const anniversaryMonth = new Date().getMonth() + 1;
  for (const s of statements) {
    if (s.cardId) {
      cardFor.push(s.cardId);
      matched.add(s.cardId);
      continue;
    }
    const product = productById.get(s.cardProductId!)!;
    const last4 = s.last4 ?? null;
    const hit = resolveWalletCard(wallet, product, last4);
    if (hit) {
      if (hit.setLast4) {
        await db.userCard.updateMany({ where: { id: hit.card.id, userId: user.id }, data: { last4 } });
        hit.card.last4 = last4;
      }
      cardFor.push(hit.card.id);
      matched.add(hit.card.id);
      continue;
    }
    const created = await db.userCard.create({
      data: { userId: user.id, cardProductId: product.id, last4, anniversaryMonth, needsDetails: true },
      select: { id: true },
    });
    wallet.push({ id: created.id, productId: product.id, bank: product.bank, last4 });
    cardFor.push(created.id);
    cardsAdded++;
  }
  const createdIds = new Set(wallet.slice(owned.length).map((c) => c.id));

  const expenses = statements.flatMap((s, i) => pin(s.expenses, EXPENSE_FIELDS, cardFor[i]));
  const credits = statements.flatMap((s, i) => pin(s.credits, CREDIT_FIELDS, cardFor[i]));

  const result = {
    ok: true as const,
    cardsAdded,
    cardsMatched: [...matched].filter((id) => !createdIds.has(id)).length,
    imported: 0, duplicates: 0, skipped: 0, rewards: 0, rewardAmount: 0, rewardDuplicates: 0,
    errors: [] as string[],
  };
  for (let i = 0; i < expenses.length; i += IMPORT_MAX_ROWS) {
    const res = await importExpenses(expenses.slice(i, i + IMPORT_MAX_ROWS), i);
    if ("error" in res) return { error: res.error };
    result.imported += res.imported;
    result.duplicates += res.duplicates;
    result.skipped += res.skipped;
    result.errors.push(...res.errors.slice(0, Math.max(0, 10 - result.errors.length)));
  }
  for (let i = 0; i < credits.length; i += IMPORT_MAX_ROWS) {
    const res = await importCredits(credits.slice(i, i + IMPORT_MAX_ROWS));
    if ("error" in res) return { error: res.error };
    result.rewards += res.imported;
    result.rewardAmount += res.amount;
    result.rewardDuplicates += res.duplicates;
    result.skipped += res.skipped;
    result.errors.push(...res.errors.slice(0, Math.max(0, 10 - result.errors.length)));
  }
  revalidatePath("/app", "layout");
  return result;
}
