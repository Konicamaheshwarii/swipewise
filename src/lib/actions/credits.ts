"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { IMPORT_MAX_ROWS, creditKey, normalizeCredit, parseDate, type RawImportRow } from "@/app/app/expenses/import-utils";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export type ActionResult = { ok: true } | { error: string };
export type CreditImportResult =
  | { ok: true; imported: number; amount: number; duplicates: number; skipped: number; withoutCard: number; errors: string[] }
  | { error: string };

const CreditFields = z.object({
  userCardId: z.string().min(1, "Pick a card"),
  /** YYYY-MM-DD */
  date: z.string().transform((v, ctx) => {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? parseDate(v) : null;
    if (!d) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date" });
      return z.NEVER;
    }
    return d;
  }),
  kind: z.enum(["cashback", "points", "miles"], { message: "Pick a reward type" }),
  /** ₹ credited (cashback). */
  amount: z.coerce.number().finite().optional().nullable(),
  /** Points or miles posted (points/miles). */
  points: z.coerce.number().finite().optional().nullable(),
  note: z
    .string()
    .trim()
    .max(280, "Keep it under 280 characters")
    .optional()
    .nullable()
    .transform((v) => v || null),
});

const UpdateCredit = CreditFields.extend({ id: z.string().min(1) });

export type CreditInput = z.input<typeof CreditFields>;

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input";

function done(): ActionResult {
  revalidatePath("/app", "layout");
  return { ok: true };
}

/**
 * Resolves the ₹ value: cashback is the amount itself; points/miles are converted with the
 * card's point value (never trusted from the client). The card must belong to the user.
 */
async function resolve(
  userId: string,
  data: z.output<typeof CreditFields>,
): Promise<{ error: string } | { amount: number; points: number | null }> {
  const card = await db.userCard.findFirst({
    where: { id: data.userCardId, userId },
    select: { id: true, cardProduct: { select: { pointValue: true } } },
  });
  if (!card) return { error: "Card not found" };
  if (data.kind === "cashback") {
    const amount = data.amount ?? 0;
    if (!(amount > 0)) return { error: "Enter an amount above ₹0" };
    if (amount > 1e7) return { error: "Amount is too large" };
    return { amount: Math.round(amount * 100) / 100, points: null };
  }
  const points = data.points ?? 0;
  if (!(points > 0)) return { error: `Enter the ${data.kind} credited` };
  if (points > 1e9) return { error: "That's too many points" };
  const amount = Math.round(points * card.cardProduct.pointValue * 100) / 100;
  if (!(amount > 0)) return { error: "This card has no point value set" };
  return { amount, points: Math.round(points * 100) / 100 };
}

export async function addCredit(input: CreditInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = CreditFields.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const value = await resolve(user.id, parsed.data);
  if ("error" in value) return value;

  const { userCardId, date, kind, note } = parsed.data;
  await db.rewardCredit.create({ data: { userId: user.id, userCardId, date, kind, note, ...value, source: "manual" } });
  return done();
}

export async function updateCredit(input: z.input<typeof UpdateCredit>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = UpdateCredit.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const value = await resolve(user.id, parsed.data);
  if ("error" in value) return value;

  const { id, userCardId, date, kind, note } = parsed.data;
  const { count } = await db.rewardCredit.updateMany({ where: { id, userId: user.id }, data: { userCardId, date, kind, note, ...value } });
  if (!count) return { error: "Reward not found" };
  return done();
}

export async function deleteCredit(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (typeof id !== "string" || !id) return { error: "Reward not found" };
  const { count } = await db.rewardCredit.deleteMany({ where: { id, userId: user.id } });
  if (!count) return { error: "Reward not found" };
  return done();
}

const ImportRows = z
  .array(z.record(z.string(), z.unknown()))
  .min(1, "No cashback rows to save")
  .max(IMPORT_MAX_ROWS, `Import up to ${IMPORT_MAX_ROWS.toLocaleString("en-IN")} rows at a time`);

/**
 * Cashback credits found in a statement import (see resolveStatementRow). Saved as kind "cashback",
 * source "import". Rows already saved (same day + amount + card) are skipped, count-aware.
 */
export async function importCredits(rows: RawImportRow[]): Promise<CreditImportResult> {
  const user = await requireUser();
  const parsed = ImportRows.safeParse(rows);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const cards = (
    await db.userCard.findMany({
      where: { userId: user.id },
      select: { id: true, nickname: true, last4: true, cardProduct: { select: { bank: true, name: true } } },
      orderBy: { createdAt: "asc" },
    })
  ).map((c) => ({ id: c.id, nickname: c.nickname, last4: c.last4, bank: c.cardProduct.bank, name: c.cardProduct.name }));

  const data: Prisma.RewardCreditCreateManyInput[] = [];
  const errors: string[] = [];
  let skipped = 0;
  for (const raw of parsed.data) {
    const row: RawImportRow = {};
    for (const f of ["date", "amount", "card", "note"] as const) {
      const v = raw[f];
      if (typeof v === "string" || typeof v === "number") row[f] = String(v);
    }
    const res = normalizeCredit(row, cards);
    if ("error" in res) {
      skipped++;
      if (errors.length < 10) errors.push(`Cashback row: ${res.error}`);
      continue;
    }
    const { amount, date, note, userCardId } = res.row;
    data.push({ userId: user.id, userCardId, date, amount, note, kind: "cashback", source: "import" });
  }

  const fresh: Prisma.RewardCreditCreateManyInput[] = [];
  let duplicates = 0;
  if (data.length) {
    const times = data.map((d) => new Date(d.date).getTime());
    const from = new Date(Math.min(...times));
    from.setHours(0, 0, 0, 0);
    const to = new Date(Math.max(...times));
    to.setHours(23, 59, 59, 999);
    const existing = await db.rewardCredit.findMany({
      where: { userId: user.id, date: { gte: from, lte: to } },
      select: { date: true, amount: true, userCardId: true },
    });
    const seen = new Map<string, number>();
    for (const e of existing) seen.set(creditKey(e), (seen.get(creditKey(e)) ?? 0) + 1);
    for (const d of data) {
      const key = creditKey({ date: d.date, amount: d.amount, userCardId: d.userCardId ?? null });
      const left = seen.get(key) ?? 0;
      if (left > 0) {
        seen.set(key, left - 1);
        duplicates++;
      } else fresh.push(d);
    }
  }

  if (fresh.length) {
    await db.rewardCredit.createMany({ data: fresh });
    revalidatePath("/app", "layout");
  }
  return {
    ok: true,
    imported: fresh.length,
    amount: fresh.reduce((s, d) => s + d.amount, 0),
    duplicates,
    skipped,
    withoutCard: fresh.filter((d) => !d.userCardId).length,
    errors,
  };
}
