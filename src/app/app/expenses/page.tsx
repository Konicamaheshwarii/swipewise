import type { Metadata } from "next";
import { ExpensesView, type ExpenseRow } from "@/components/expenses/expenses-view";
import type { CreditRow } from "@/components/expenses/rewards-received";
import { consume, evaluate, rankCards, toDate, type CapState } from "@/engine";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RewardKind } from "@/lib/format";
import { loadStatementCatalog, loadWallet } from "@/lib/wallet";

export const metadata: Metadata = { title: "Expenses" };

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const KINDS = new Set<RewardKind>(["cashback", "points", "miles"]);

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  // Full history (20 years) so caps replay correctly and nothing is hidden from the list.
  const [{ cardViews, engineCards, expenses, txns }, creditRows, catalog] = await Promise.all([
    loadWallet(user.id, 240),
    db.rewardCredit.findMany({ where: { userId: user.id }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    loadStatementCatalog(user.id),
  ]);
  const credits: CreditRow[] = creditRows.map((c) => {
    const day = dayKey(c.date);
    return {
      id: c.id, day, month: day.slice(0, 7), cardId: c.userCardId,
      kind: KINDS.has(c.kind as RewardKind) ? (c.kind as RewardKind) : "cashback",
      amount: c.amount, points: c.points, note: c.note, source: c.source === "import" ? "import" : "manual",
    };
  });

  // ?tab=rewards&add=<cardId>&for=YYYY-MM (from the dashboard's "Add" action). Only the user's own cards.
  const tab = sp.tab === "rewards" ? "rewards" : "expenses";
  const addCard = typeof sp.add === "string" ? cardViews.find((c) => c.id === sp.add) : undefined;
  const forMonth = typeof sp.for === "string" && /^\d{4}-\d{2}$/.test(sp.for) ? sp.for : null;

  /*
   * One chronological pass that mirrors simulateActual: each expense is evaluated on the
   * card actually used (consuming its caps), and ranked across all cards against the same
   * cap snapshot to find the best card at that moment.
   */
  const cardById = new Map(engineCards.map((c) => [c.id, c]));
  const caps: CapState = new Map();
  const rewards = new Map<string, { earned: number | null; best: ExpenseRow["best"] }>();
  const chronological = [...txns].sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime());
  for (const txn of chronological) {
    const top = engineCards.length ? rankCards(engineCards, txn, caps)[0] : null;
    const card = txn.cardId ? cardById.get(txn.cardId) : undefined;
    let earned: number | null = null;
    if (card) {
      const ev = evaluate(card, txn, caps);
      consume(caps, card, txn, ev);
      earned = ev.net;
    }
    rewards.set(txn.id!, { earned, best: top ? { cardId: top.cardId, net: top.net, reason: top.reason } : null });
  }

  const rows: ExpenseRow[] = expenses.map((e) => {
    const day = dayKey(e.date);
    const r = rewards.get(e.id);
    return {
      id: e.id,
      amount: e.amount,
      date: e.date.toISOString(),
      day,
      month: day.slice(0, 7),
      category: e.category,
      subcategory: e.subcategory,
      merchant: e.merchant,
      channel: e.channel as ExpenseRow["channel"],
      note: e.note,
      cardId: e.userCardId,
      earned: r?.earned ?? null,
      best: r?.best ?? null,
    };
  });

  return (
    <ExpensesView
      key={addCard ? `${addCard.id}-${forMonth}` : tab}
      rows={rows}
      credits={credits}
      cards={cardViews}
      catalog={catalog}
      engineCards={engineCards}
      initialTab={addCard ? "rewards" : tab}
      initialAdd={addCard ? { cardId: addCard.id, forMonth } : null}
    />
  );
}
