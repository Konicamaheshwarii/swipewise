import { allocate, monthsSpanned } from "./optimize";
import { feeFor } from "./review";
import type { EngineCard, Txn } from "./types";

export interface Suggestion {
  productId: string;
  /** Extra rewards per year if added to the wallet. */
  gain: number;
  fee: number;
  feeWaived: boolean;
  /** gain − fee */
  netGain: number;
  /** Annual spend the card would take over. */
  spend: number;
  topCategories: { category: string; reward: number }[];
}

/** Ranks catalog cards by how much each one would add to the current wallet. */
export function discover(wallet: EngineCard[], candidates: EngineCard[], txns: Txn[]): Suggestion[] {
  const factor = 12 / monthsSpanned(txns);
  const base = allocate(wallet, txns).total;
  const out: Suggestion[] = [];
  for (const c of candidates) {
    const withC = allocate([...wallet, c], txns);
    const gain = Math.max(0, (withC.total - base) * factor);
    const spend = (withC.byCard.get(c.id)?.spend ?? 0) * factor;
    const { fee, feeWaived } = feeFor(c, spend);
    const cats = new Map<string, number>();
    for (const a of withC.assignments) {
      if (a.cardId === c.id && a.evaluation) cats.set(a.txn.category, (cats.get(a.txn.category) ?? 0) + a.evaluation.net * factor);
    }
    out.push({
      productId: c.productId, gain, fee, feeWaived, netGain: gain - fee, spend,
      topCategories: [...cats.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([category, reward]) => ({ category, reward })),
    });
  }
  return out.sort((a, b) => b.netGain - a.netGain);
}
