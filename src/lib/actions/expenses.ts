"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CATEGORY_MAP } from "@/data/categories";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { IMPORT_FIELDS, IMPORT_MAX_ROWS, normalizeRow, parseDate, type RawImportRow } from "@/app/app/expenses/import-utils";

export type ActionResult = { ok: true } | { error: string };
export type ImportResult =
  | { ok: true; imported: number; skipped: number; unmatchedCards: number; duplicates: number; errors: string[] }
  | { error: string };

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .optional()
    .nullable()
    .transform((v) => v || null);

const ExpenseFields = z.object({
  amount: z.coerce.number().finite().positive("Enter an amount above ₹0").max(1e8, "Amount is too large"),
  /** YYYY-MM-DD */
  date: z.string().transform((v, ctx) => {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? parseDate(v) : null;
    if (!d) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date" });
      return z.NEVER;
    }
    return d;
  }),
  category: z.string().refine((v) => !!CATEGORY_MAP[v], "Pick a category"),
  subcategory: optText(60),
  merchant: optText(80),
  channel: z.enum(["online", "offline", "international"], { message: "Pick a channel" }),
  note: optText(280),
  userCardId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v || null),
});

const UpdateExpense = ExpenseFields.extend({ id: z.string().min(1) });

export type ExpenseInput = z.input<typeof ExpenseFields>;

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input";

function done(): ActionResult {
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** A card id from the client is only accepted if it belongs to this user. */
async function ownsCard(userId: string, cardId: string | null) {
  if (!cardId) return true;
  return !!(await db.userCard.findFirst({ where: { id: cardId, userId }, select: { id: true } }));
}

export async function addExpense(input: ExpenseInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = ExpenseFields.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  if (!(await ownsCard(user.id, parsed.data.userCardId))) return { error: "Card not found" };

  await db.expense.create({ data: { ...parsed.data, userId: user.id } });
  return done();
}

export async function updateExpense(input: z.input<typeof UpdateExpense>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = UpdateExpense.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { id, ...data } = parsed.data;
  if (!(await ownsCard(user.id, data.userCardId))) return { error: "Card not found" };

  const { count } = await db.expense.updateMany({ where: { id, userId: user.id }, data });
  if (!count) return { error: "Expense not found" };
  return done();
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (typeof id !== "string" || !id) return { error: "Expense not found" };
  const { count } = await db.expense.deleteMany({ where: { id, userId: user.id } });
  if (!count) return { error: "Expense not found" };
  return done();
}

const ImportRows = z
  .array(z.record(z.string(), z.unknown()))
  .min(1, "The file has no rows")
  .max(IMPORT_MAX_ROWS, `Import up to ${IMPORT_MAX_ROWS.toLocaleString("en-IN")} rows at a time`);

const Lines = z.array(z.number().int().min(1).max(1e7)).optional();
const CHANNEL_SET = new Set(["online", "offline", "international"]);

/** Same local day + amount (paise) + merchant/note text. */
function expenseKey(e: { date: Date | string; amount: number; merchant?: string | null; note?: string | null }) {
  const d = new Date(e.date);
  const day = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const text = (e.merchant || e.note || "").trim().toLowerCase();
  return `${day}|${Math.round(e.amount * 100)}|${text}`;
}

/**
 * Bulk import of rows already mapped to our fields (see import-utils). Bad rows are skipped and reported.
 * `offset` is the index of rows[0] in the whole file, so error row numbers stay right when the client sends chunks.
 * `lines` optionally gives each row's spreadsheet line number (used when the client dropped credits/charges).
 */
export async function importExpenses(rows: RawImportRow[], offset = 0, lines?: number[]): Promise<ImportResult> {
  const user = await requireUser();
  const parsed = ImportRows.safeParse(rows);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const lineNos = Lines.safeParse(lines);
  const lineOf = (i: number) =>
    lineNos.success && lineNos.data && lineNos.data.length === parsed.data.length
      ? lineNos.data[i]
      : (Number.isInteger(offset) && offset > 0 ? offset : 0) + i + 2;

  const cards = (
    await db.userCard.findMany({
      where: { userId: user.id },
      select: { id: true, nickname: true, last4: true, cardProduct: { select: { bank: true, name: true } } },
      orderBy: { createdAt: "asc" },
    })
  ).map((c) => ({ id: c.id, nickname: c.nickname, last4: c.last4, bank: c.cardProduct.bank, name: c.cardProduct.name }));

  const data: Prisma.ExpenseCreateManyInput[] = [];
  const errors: string[] = [];
  let skipped = 0;
  let unmatchedCards = 0;

  parsed.data.forEach((raw, i) => {
    // Keep only known fields, as strings.
    const row: RawImportRow = {};
    for (const f of IMPORT_FIELDS) {
      const v = raw[f];
      if (typeof v === "string" || typeof v === "number") row[f] = String(v);
    }
    const res = normalizeRow(row, cards);
    if ("error" in res) {
      skipped++;
      // Row numbers as the user sees them in a spreadsheet (header is row 1).
      if (errors.length < 10) errors.push(`Row ${lineOf(i)}: ${res.error}`);
      return;
    }
    const { cardUnmatched, ...rest } = res.row;
    // Belt and braces: never store an unknown category or channel.
    if (!CATEGORY_MAP[rest.category] || !CHANNEL_SET.has(rest.channel)) {
      skipped++;
      if (errors.length < 10) errors.push(`Row ${lineOf(i)}: invalid category or channel`);
      return;
    }
    if (cardUnmatched) unmatchedCards++;
    data.push({ ...rest, userId: user.id });
  });

  // Skip rows already saved (re-importing the same statement). Count-aware, so two identical
  // orders on the same day in one file still both import the first time.
  const fresh: Prisma.ExpenseCreateManyInput[] = [];
  let duplicates = 0;
  if (data.length) {
    const times = data.map((d) => new Date(d.date).getTime());
    const from = new Date(Math.min(...times));
    from.setHours(0, 0, 0, 0);
    const to = new Date(Math.max(...times));
    to.setHours(23, 59, 59, 999);
    const existing = await db.expense.findMany({
      where: { userId: user.id, date: { gte: from, lte: to } },
      select: { date: true, amount: true, merchant: true, note: true },
    });
    const seen = new Map<string, number>();
    for (const e of existing) seen.set(expenseKey(e), (seen.get(expenseKey(e)) ?? 0) + 1);
    for (const d of data) {
      const key = expenseKey(d);
      const left = seen.get(key) ?? 0;
      if (left > 0) {
        seen.set(key, left - 1);
        duplicates++;
      } else fresh.push(d);
    }
  }

  if (fresh.length) await db.expense.createMany({ data: fresh });
  if (fresh.length) revalidatePath("/app", "layout");
  return { ok: true, imported: fresh.length, skipped, unmatchedCards, duplicates, errors };
}
