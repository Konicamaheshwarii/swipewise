import { consume, evaluate, rankCards, toDate } from "./evaluate";
import type { CapState, EngineCard, Evaluation, Txn } from "./types";

export interface Assignment {
  txn: Txn;
  cardId: string | null;
  evaluation: Evaluation | null;
}

export interface CardTotals {
  spend: number;
  reward: number;
  net: number;
  count: number;
}

export interface Allocation {
  assignments: Assignment[];
  total: number;
  byCard: Map<string, CardTotals>;
  caps: CapState;
}

const byDate = (a: Txn, b: Txn) => toDate(a.date).getTime() - toDate(b.date).getTime();

function addTotals(byCard: Map<string, CardTotals>, cardId: string, txn: Txn, ev: Evaluation) {
  const t = byCard.get(cardId) ?? { spend: 0, reward: 0, net: 0, count: 0 };
  t.spend += txn.amount;
  t.reward += ev.reward;
  t.net += ev.net;
  t.count += 1;
  byCard.set(cardId, t);
}

/**
 * Greedy optimal allocation: walk expenses chronologically and put each on the
 * card with the best net return given caps consumed so far.
 */
export function allocate(cards: EngineCard[], txns: Txn[], caps: CapState = new Map()): Allocation {
  const byCard = new Map<string, CardTotals>();
  const assignments: Assignment[] = [];
  let total = 0;
  for (const txn of [...txns].sort(byDate)) {
    if (!cards.length) {
      assignments.push({ txn, cardId: null, evaluation: null });
      continue;
    }
    const best = rankCards(cards, txn, caps)[0];
    // Spend that earns and costs nothing anywhere (e.g. rent) isn't "routed" to any card,
    // so it doesn't inflate a card's spend or count towards fee waivers.
    if (best.reward === 0 && best.forexCost === 0) {
      assignments.push({ txn, cardId: null, evaluation: best });
      continue;
    }
    const card = cards.find((c) => c.id === best.cardId)!;
    consume(caps, card, txn, best);
    addTotals(byCard, card.id, txn, best);
    total += best.net;
    assignments.push({ txn, cardId: card.id, evaluation: best });
  }
  return { assignments, total, byCard, caps };
}

/** Replays expenses on the card actually used. Expenses without a known card are skipped. */
export function simulateActual(cards: EngineCard[], txns: Txn[], caps: CapState = new Map()): Allocation {
  const byCard = new Map<string, CardTotals>();
  const assignments: Assignment[] = [];
  let total = 0;
  for (const txn of [...txns].sort(byDate)) {
    const card = txn.cardId ? cards.find((c) => c.id === txn.cardId) : undefined;
    if (!card) continue;
    const ev = evaluate(card, txn, caps);
    consume(caps, card, txn, ev);
    addTotals(byCard, card.id, txn, ev);
    total += ev.net;
    assignments.push({ txn, cardId: card.id, evaluation: ev });
  }
  return { assignments, total, byCard, caps };
}

/** Rewards earned vs. what the optimal strategy would have earned on the same expenses. */
export function missedRewards(cards: EngineCard[], txns: Txn[]) {
  const tracked = txns.filter((t) => t.cardId && cards.some((c) => c.id === t.cardId));
  const actual = simulateActual(cards, tracked);
  const optimal = allocate(cards, tracked);
  return { actual: actual.total, optimal: optimal.total, missed: Math.max(0, optimal.total - actual.total), tracked: tracked.length };
}

/** Calendar months covered by the expenses, inclusive (1..12), used to annualise. */
export function monthsSpanned(txns: Txn[]): number {
  if (!txns.length) return 1;
  const idx = txns.map((t) => {
    const d = toDate(t.date);
    return d.getFullYear() * 12 + d.getMonth();
  });
  return Math.min(12, Math.max(...idx) - Math.min(...idx) + 1);
}
