"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CATEGORIES, categoryLabel } from "@/data/categories";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { NETWORKS, gradientFor } from "@/components/wallet/custom-shared";

export type ActionResult = { ok: true } | { error: string };

const day = (label: string) => z.coerce.number().int().min(1, `${label} must be 1–31`).max(31, `${label} must be 1–31`);

const CardFields = z.object({
  nickname: z
    .string()
    .trim()
    .max(40, "Nickname is too long")
    .optional()
    .nullable()
    .transform((v) => v || null),
  // Only ever the last four digits. Anything longer (e.g. a full card number) is rejected.
  last4: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => v || null)
    .refine((v) => v == null || /^\d{4}$/.test(v), "Enter only the last 4 digits of the card"),
  creditLimit: z.coerce.number().finite().min(0, "Credit limit can't be negative").max(1e9, "Credit limit is too large"),
  statementDay: day("Statement day"),
  dueDay: day("Due day"),
  anniversaryMonth: z.coerce.number().int().min(1, "Pick a month").max(12, "Pick a month"),
  perksValue: z.coerce.number().finite().min(0, "Perks value can't be negative").max(1e7, "Perks value is too large"),
});

const AddCard = CardFields.extend({ cardProductId: z.string().min(1, "Pick a card") });
const UpdateCard = CardFields.extend({ id: z.string().min(1) });

export type CardInput = z.input<typeof CardFields>;

const MAX_QUICK_ADD = 30;
const AddCards = z
  .array(z.string().min(1).max(100))
  .min(1, "Pick at least one card")
  .transform((ids) => [...new Set(ids)])
  .refine((ids) => ids.length <= MAX_QUICK_ADD, `Add up to ${MAX_QUICK_ADD} cards at a time`);

/* ---------- Custom ("not listed") cards ---------- */

const categoryKey = z.enum(CATEGORIES.map((c) => c.key) as [string, ...string[]], { error: "Unknown category" });
const rate = (label: string) =>
  z.number({ error: `${label} must be a number` }).finite().min(0, `${label} must be 0–40%`).max(40, `${label} must be 0–40%`);
const rupees = (label: string, max = 1e8) =>
  z.number({ error: `${label} must be a number` }).finite().min(0, `${label} can't be negative`).max(max, `${label} is too large`);

const CustomCard = z
  .object({
    bank: z.string().trim().min(1, "Enter the bank").max(40, "Bank name is too long (40 max)"),
    name: z.string().trim().min(1, "Enter the card name").max(40, "Card name is too long (40 max)"),
    network: z.enum(NETWORKS, { error: "Pick a network" }),
    annualFee: rupees("Annual fee", 1e6),
    feeWaiverSpend: rupees("Fee waiver spend").nullable(),
    forexMarkup: z.number({ error: "Forex markup must be a number" }).finite().min(0, "Forex markup must be 0–10%").max(10, "Forex markup must be 0–10%"),
    baseRate: rate("Base reward"),
    bonuses: z
      .array(z.object({ category: categoryKey, rate: rate("Bonus reward"), monthlyCap: rupees("Monthly cap", 1e7).nullable() }))
      .max(3, "Up to 3 bonus categories"),
    excluded: z.array(categoryKey).max(CATEGORIES.length),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    for (const b of v.bonuses) {
      if (seen.has(b.category)) ctx.addIssue({ code: "custom", message: `${categoryLabel(b.category)} is listed twice` });
      if (v.excluded.includes(b.category))
        ctx.addIssue({ code: "custom", message: `${categoryLabel(b.category)} can't be both a bonus and excluded` });
      seen.add(b.category);
    }
  });

export type CustomCardInput = z.input<typeof CustomCard>;
const UpdateCustomCard = z.object({ productId: z.string().min(1), card: CustomCard });

/** Product + rule rows for a custom card. Rates are plain percentages of spend. */
function customProductData(c: z.output<typeof CustomCard>) {
  const { colorFrom, colorTo } = gradientFor(c.bank);
  return {
    bank: c.bank,
    name: c.name,
    network: c.network,
    annualFee: c.annualFee,
    feeWaiverSpend: c.feeWaiverSpend || null,
    forexMarkup: c.forexMarkup,
    excludedCategories: [...new Set(c.excluded)].join(","),
    colorFrom,
    colorTo,
    lastVerified: new Date().toISOString().slice(0, 7),
  };
}

function customRules(c: z.output<typeof CustomCard>) {
  return [
    { label: "All spends", rateType: "percent", rate: c.baseRate, priority: 0 },
    ...c.bonuses.map((b, i) => ({
      label: `${categoryLabel(b.category)} bonus`,
      categories: b.category,
      rateType: "percent",
      rate: b.rate,
      priority: 2,
      capValue: b.monthlyCap || null,
      capPeriod: b.monthlyCap ? "month" : null,
      capGroup: `bonus-${i + 1}`,
    })),
  ];
}

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input";

function done(): ActionResult {
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Public catalog cards, plus the user's own custom cards. */
const visibleTo = (userId: string) => ({ OR: [{ ownerId: null }, { ownerId: userId }] });

export async function addCard(input: z.input<typeof AddCard>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = AddCard.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { cardProductId, ...fields } = parsed.data;

  const product = await db.cardProduct.findFirst({ where: { id: cardProductId, ...visibleTo(user.id) }, select: { id: true } });
  if (!product) return { error: "That card isn't in the catalog" };

  await db.userCard.create({ data: { ...fields, cardProductId, userId: user.id } });
  return done();
}

/** Quick add: many cards at once with default details, flagged to complete later. */
export async function addCards(productIds: string[]): Promise<{ ok: true; added: number } | { error: string }> {
  const user = await requireUser();
  const parsed = AddCards.safeParse(productIds);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const ids = parsed.data;

  const [products, owned] = await Promise.all([
    db.cardProduct.findMany({ where: { id: { in: ids }, ...visibleTo(user.id) }, select: { id: true } }),
    db.userCard.findMany({ where: { userId: user.id, cardProductId: { in: ids } }, select: { cardProductId: true } }),
  ]);
  if (products.length !== ids.length) return { error: "Some of those cards aren't in the catalog" };

  // Already-owned cards are skipped rather than duplicated.
  const ownedIds = new Set(owned.map((o) => o.cardProductId));
  const fresh = ids.filter((id) => !ownedIds.has(id));
  const anniversaryMonth = new Date().getMonth() + 1;
  if (fresh.length) {
    await db.userCard.createMany({
      data: fresh.map((cardProductId) => ({ userId: user.id, cardProductId, anniversaryMonth, needsDetails: true })),
    });
  }
  revalidatePath("/app", "layout");
  return { ok: true, added: fresh.length };
}

export async function updateCard(input: z.input<typeof UpdateCard>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = UpdateCard.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { id, ...fields } = parsed.data;

  const { count } = await db.userCard.updateMany({ where: { id, userId: user.id }, data: { ...fields, needsDetails: false } });
  if (!count) return { error: "Card not found" };
  return done();
}

/** Creates the user's own card product (visible only to them) and adds it to their wallet. */
export async function addCustomCard(input: CustomCardInput): Promise<{ ok: true; cardId: string; productId: string } | { error: string }> {
  const user = await requireUser();
  const parsed = CustomCard.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const c = parsed.data;

  const productId = `custom-${crypto.randomUUID()}`;
  const card = await db.userCard.create({
    data: {
      user: { connect: { id: user.id } },
      anniversaryMonth: new Date().getMonth() + 1,
      needsDetails: true,
      cardProduct: {
        create: {
          id: productId,
          ...customProductData(c),
          tier: "Custom",
          joiningFee: 0,
          pointValue: 1,
          rewardUnit: "Rewards",
          sourceUrl: "",
          owner: { connect: { id: user.id } },
          rules: { create: customRules(c) },
        },
      },
    },
    select: { id: true },
  });
  revalidatePath("/app", "layout");
  return { ok: true, cardId: card.id, productId };
}

/** Edits the reward setup of one of the user's own custom cards. */
export async function updateCustomCard(input: z.input<typeof UpdateCustomCard>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = UpdateCustomCard.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { productId, card: c } = parsed.data;

  const product = await db.cardProduct.findFirst({ where: { id: productId, ownerId: user.id }, select: { id: true } });
  if (!product) return { error: "Card not found" };

  await db.cardProduct.update({
    where: { id: productId },
    data: { ...customProductData(c), rules: { deleteMany: {}, create: customRules(c) } },
  });
  return done();
}

/**
 * Removes a card from the wallet. Its expenses stay, with no card attached (onDelete: SetNull).
 * Removing the last copy of a custom card also deletes the custom product.
 */
export async function removeCard(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (typeof id !== "string" || !id) return { error: "Card not found" };
  const card = await db.userCard.findFirst({
    where: { id, userId: user.id },
    select: { cardProductId: true, cardProduct: { select: { ownerId: true } } },
  });
  if (!card) return { error: "Card not found" };

  await db.$transaction(async (tx) => {
    await tx.userCard.delete({ where: { id } });
    if (card.cardProduct.ownerId === user.id) {
      const left = await tx.userCard.count({ where: { cardProductId: card.cardProductId } });
      if (!left) await tx.cardProduct.delete({ where: { id: card.cardProductId } });
    }
  });
  return done();
}
