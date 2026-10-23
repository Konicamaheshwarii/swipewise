import { allocate, monthsSpanned } from "./optimize";
import type { EngineCard, Txn } from "./types";

export type Verdict = "keep" | "keep_free" | "push" | "downgrade" | "close";

export interface CardReview {
  cardId: string;
  /** Annualised spend the optimal strategy puts on this card. */
  spend: number;
  /** Annualised rewards earned on this card under the optimal strategy. */
  rewards: number;
  /** What the wallet loses (₹/yr) if this card is removed. */
  marginal: number;
  perks: number;
  fee: number;
  feeWaived: boolean;
  /** Extra annual spend needed to waive the fee, null if no waiver exists. */
  waiverGap: number | null;
  nav: number;
  verdict: Verdict;
  headline: string;
  topCategories: { category: string; reward: number }[];
}

export interface WalletReview {
  cards: CardReview[];
  annualRewards: number;
  annualFees: number;
  annualPerks: number;
  net: number;
  months: number;
}

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function topCategories(assignments: ReturnType<typeof allocate>["assignments"], cardId: string, factor: number) {
  const m = new Map<string, number>();
  for (const a of assignments) {
    if (a.cardId !== cardId || !a.evaluation || a.evaluation.net <= 0) continue;
    m.set(a.txn.category, (m.get(a.txn.category) ?? 0) + a.evaluation.net * factor);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([category, reward]) => ({ category, reward }));
}

export function feeFor(card: EngineCard, annualSpend: number) {
  const feeWaived = card.annualFee > 0 && card.feeWaiverSpend != null && annualSpend >= card.feeWaiverSpend;
  const fee = card.annualFee === 0 || feeWaived ? 0 : card.annualFee;
  const waiverGap = card.feeWaiverSpend != null && card.annualFee > 0 ? Math.max(0, card.feeWaiverSpend - annualSpend) : null;
  return { fee, feeWaived, waiverGap };
}

export function reviewWallet(cards: EngineCard[], txns: Txn[]): WalletReview {
  const months = monthsSpanned(txns);
  const factor = 12 / months;
  const full = allocate(cards, txns);

  const reviews = cards.map<CardReview>((card) => {
    const others = cards.filter((c) => c.id !== card.id);
    const without = allocate(others, txns);
    const marginal = Math.max(0, (full.total - without.total) * factor);
    const totals = full.byCard.get(card.id);
    const spend = (totals?.spend ?? 0) * factor;
    const rewards = (totals?.net ?? 0) * factor;
    const { fee, feeWaived, waiverGap } = feeFor(card, spend);
    const perks = card.perksValue;
    const nav = marginal + perks - fee;
    const valueIfWaived = marginal + perks;

    let verdict: Verdict;
    let headline: string;
    if (card.annualFee === 0) {
      verdict = "keep_free";
      headline = marginal > 0
        ? `Free card adding ${inr(marginal)}/yr. Keep it.`
        : "Free card. Keep it for credit history and total limit.";
    } else if (nav >= 0) {
      verdict = "keep";
      headline = feeWaived
        ? `Fee waived. Adds ${inr(nav)}/yr.`
        : `Earns ${inr(nav)}/yr more than its ${inr(card.annualFee)} fee.`;
    } else if (waiverGap != null && card.feeWaiverSpend && waiverGap <= card.feeWaiverSpend * 0.35 && valueIfWaived > 0) {
      verdict = "push";
      headline = `Spend ${inr(waiverGap)} more this year to waive the ${inr(card.annualFee)} fee.`;
    } else if (valueIfWaived > 0) {
      verdict = "downgrade";
      headline = `Adds only ${inr(valueIfWaived)} but costs ${inr(card.annualFee)}. Ask for a fee waiver or downgrade.`;
    } else {
      verdict = "close";
      headline = `Your other cards already cover it. Its ${inr(card.annualFee)} fee is wasted.`;
    }

    return {
      cardId: card.id, spend, rewards, marginal, perks, fee, feeWaived, waiverGap, nav, verdict, headline,
      topCategories: topCategories(full.assignments, card.id, factor),
    };
  });

  const annualRewards = full.total * factor;
  const annualFees = reviews.reduce((s, r) => s + r.fee, 0);
  const annualPerks = reviews.reduce((s, r) => s + r.perks, 0);
  return {
    cards: reviews.sort((a, b) => b.nav - a.nav),
    annualRewards, annualFees, annualPerks,
    net: annualRewards + annualPerks - annualFees,
    months,
  };
}
