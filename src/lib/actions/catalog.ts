"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export type ActionResult = { ok: true } | { error: string };

const blankToNull = (v: unknown) => (v === "" || v == null ? null : v);
const amount = (label: string) => z.coerce.number({ error: `${label} must be a number` }).min(0, `${label} can't be negative`);
const optAmount = (label: string) => z.preprocess(blankToNull, amount(label).nullable());

const ProductSchema = z.object({
  id: z.string().min(1),
  annualFee: amount("Annual fee"),
  joiningFee: amount("Joining fee"),
  feeWaiverSpend: optAmount("Fee waiver spend"),
  forexMarkup: amount("Forex markup").max(10, "Forex markup looks too high"),
  pointValue: amount("Point value").positive("Point value must be above 0"),
  lastVerified: z.string().trim().regex(/^\d{4}-\d{2}(-\d{2})?$/, "Last verified must look like 2026-10"),
});

const RuleSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().trim().min(1, "Rule label is required").max(80),
    rateType: z.enum(["percent", "points"], { error: "Pick a rate type" }),
    rate: amount("Rate"),
    perAmount: amount("Per amount").positive("Per amount must be above 0"),
    capValue: optAmount("Cap"),
    capPeriod: z.preprocess(blankToNull, z.enum(["month", "quarter", "year"]).nullable()),
    minTxn: optAmount("Minimum transaction"),
  })
  .refine((r) => r.capValue == null || r.capPeriod != null, { error: "Choose a cap period for the cap", path: ["capPeriod"] })
  .refine((r) => r.rateType !== "percent" || r.rate <= 100, { error: "A percent rate can't exceed 100", path: ["rate"] });

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input";

/** Admin: edit a catalog product's fees and point value. */
export async function updateProduct(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = ProductSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { id, ...data } = parsed.data;
  // Only public catalog cards; users' custom cards are theirs to edit.
  const { count } = await db.cardProduct.updateMany({ where: { id, ownerId: null }, data });
  if (!count) return { error: "Card not found" };
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Admin: edit one reward rule. A cleared cap also clears its period. */
export async function updateRule(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = RuleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { id, capPeriod, ...rest } = parsed.data;
  const { count } = await db.rewardRule.updateMany({
    where: { id, cardProduct: { ownerId: null } },
    data: { ...rest, capPeriod: rest.capValue == null ? null : capPeriod },
  });
  if (!count) return { error: "Rule not found" };
  revalidatePath("/app", "layout");
  return { ok: true };
}
