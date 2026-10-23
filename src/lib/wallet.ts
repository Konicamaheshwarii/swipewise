import "server-only";
import type { CardProduct, Expense, Prisma, RewardRule, UserCard } from "@prisma/client";
import type { CapPeriod, Channel, EngineCard, EngineRule, Txn } from "@/engine/types";
import { db } from "./db";

export type ProductWithRules = CardProduct & { rules: RewardRule[] };
export type UserCardFull = UserCard & { cardProduct: ProductWithRules };

export const splitList = (s: string | null | undefined) =>
  (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

/** Effective % of spend in ₹ value. */
export function rulePct(rule: Pick<RewardRule, "rateType" | "rate" | "perAmount">, pointValue: number) {
  return rule.rateType === "percent" ? rule.rate : (rule.rate / (rule.perAmount || 100)) * pointValue * 100;
}

export function toEngineRule(rule: RewardRule, pointValue: number): EngineRule {
  return {
    id: rule.id,
    label: rule.label,
    categories: splitList(rule.categories),
    merchants: splitList(rule.merchants),
    channels: splitList(rule.channels) as Channel[],
    pct: rulePct(rule, pointValue),
    capValue: rule.capValue,
    capPeriod: (rule.capPeriod as CapPeriod | null) ?? null,
    capGroup: rule.capGroup,
    minTxn: rule.minTxn,
    priority: rule.priority,
  };
}

export function toEngineCard(product: ProductWithRules, opts: { id?: string; perksValue?: number } = {}): EngineCard {
  return {
    id: opts.id ?? product.id,
    productId: product.id,
    name: `${product.bank} ${product.name}`,
    bank: product.bank,
    annualFee: product.annualFee,
    feeWaiverSpend: product.feeWaiverSpend,
    forexMarkup: product.forexMarkup,
    excludedCategories: splitList(product.excludedCategories),
    rules: product.rules.map((r) => toEngineRule(r, product.pointValue)),
    perksValue: opts.perksValue ?? 0,
  };
}

export function toTxn(e: Expense): Txn {
  return {
    id: e.id,
    amount: e.amount,
    date: e.date,
    category: e.category,
    merchant: e.merchant,
    channel: e.channel as Channel,
    cardId: e.userCardId,
  };
}

export function parseBenefits(json: string): { label: string; value: number }[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

/** Display info for a user's card that is safe to pass to client components. */
export interface CardView {
  id: string;
  productId: string;
  bank: string;
  name: string;
  network: string;
  tier: string;
  nickname: string | null;
  last4: string | null;
  colorFrom: string;
  colorTo: string;
  annualFee: number;
  feeWaiverSpend: number | null;
  rewardUnit: string;
  /** ₹ per point (1 for cashback). */
  pointValue: number;
  creditLimit: number;
  statementDay: number;
  dueDay: number;
  anniversaryMonth: number;
  perksValue: number;
  /** Added via Quick add; limit and billing days still to fill in. */
  needsDetails: boolean;
  /** The user's own "not listed" card rather than a catalog card. */
  isCustom: boolean;
}

export function toCardView(uc: UserCardFull): CardView {
  const p = uc.cardProduct;
  return {
    id: uc.id, productId: p.id, bank: p.bank, name: p.name, network: p.network, tier: p.tier,
    nickname: uc.nickname, last4: uc.last4, colorFrom: p.colorFrom, colorTo: p.colorTo,
    annualFee: p.annualFee, feeWaiverSpend: p.feeWaiverSpend, rewardUnit: p.rewardUnit, pointValue: p.pointValue,
    creditLimit: uc.creditLimit, statementDay: uc.statementDay, dueDay: uc.dueDay,
    anniversaryMonth: uc.anniversaryMonth, perksValue: uc.perksValue,
    needsDetails: uc.needsDetails, isCustom: p.ownerId != null,
  };
}

const withProduct = { cardProduct: { include: { rules: true } } } satisfies Prisma.UserCardInclude;

/**
 * Everything the engine needs for one user: their cards (as engine cards keyed by
 * UserCard id) and expenses from the last `months` months (default 12).
 */
export async function loadWallet(userId: string, months = 12) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const [userCards, expenses] = await Promise.all([
    db.userCard.findMany({ where: { userId }, include: withProduct, orderBy: { createdAt: "asc" } }),
    db.expense.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "desc" } }),
  ]);

  const engineCards = userCards.map((uc) => toEngineCard(uc.cardProduct, { id: uc.id, perksValue: uc.perksValue }));
  return {
    userCards,
    cardViews: userCards.map(toCardView),
    engineCards,
    expenses,
    txns: expenses.map(toTxn),
  };
}

/** Public catalog only (excludes users' custom cards). */
export async function loadCatalog(): Promise<ProductWithRules[]> {
  return db.cardProduct.findMany({
    where: { ownerId: null },
    include: { rules: { orderBy: { priority: "desc" } } },
    orderBy: [{ bank: "asc" }, { name: "asc" }],
  });
}

/** Cards the user can pick for an imported statement: the public catalog plus their own custom cards. */
export async function loadStatementCatalog(userId: string) {
  return db.cardProduct.findMany({
    where: { OR: [{ ownerId: null }, { ownerId: userId }] },
    select: { id: true, bank: true, name: true, network: true, colorFrom: true, colorTo: true },
    orderBy: [{ bank: "asc" }, { name: "asc" }],
  });
}
