import {
  allocate, consume, evaluate, rankCards, reviewWallet, simulateActual, toDate,
  type CapState, type EngineCard, type Evaluation, type Txn,
} from "@/engine";
import { CATEGORIES, CATEGORY_MAP, MERCHANTS } from "@/data/categories";
import { MONTHS, addToSplit, emptySplit, rewardKind, type RewardKind, type RewardSplit } from "@/lib/format";

/* Pure dashboard computations. Everything returned is plain JSON-safe data. */

export interface MonthPoint {
  key: string;
  label: string;
  spend: number;
  actual: number;
  optimal: number;
  /** `actual` split by reward type (₹). */
  cashback: number;
  pointsValue: number;
  milesValue: number;
}

export interface CategorySlice {
  category: string;
  label: string;
  color: string;
  spend: number;
  share: number;
}

export interface CheatRow {
  key: string;
  label: string;
  /** Category key used for the icon. */
  category: string;
  cardId: string | null;
  effectivePct: number;
  reason: string;
  runnerUpPct: number | null;
}

export interface WaiverRow {
  cardId: string;
  fee: number;
  target: number;
  spent: number;
  since: string;
  resets: string;
}

export interface RecentRow {
  id: string;
  date: string;
  category: string;
  merchant: string | null;
  amount: number;
  channel: string;
  cardId: string | null;
  earned: number | null;
  missed: number;
  betterCardId: string | null;
}

export interface DashboardModel {
  kpis: {
    spendThisMonth: number;
    spendSamePeriodLastMonth: number;
    lastMonthLabel: string;
    changePct: number | null;
    actualRewards: number;
    optimalRewards: number;
    missed: number;
    tracked: number;
    walletNet: number;
    /** actualRewards split into cashback / points / miles. */
    split: RewardSplit;
  };
  months: MonthPoint[];
  categories: CategorySlice[];
  totalSpend: number;
  cheatCategories: CheatRow[];
  cheatMerchants: CheatRow[];
  waivers: WaiverRow[];
  recent: RecentRow[];
  rewardCheck: RewardCheck;
}

/* ---- Expected vs received ---- */

/** Banks credit a statement month's cashback on the next statement, so month M is matched with credits in M + this. */
export const CREDIT_LAG_MONTHS = 1;
/** Statement months shown (the most recent complete ones). */
export const CHECK_MONTHS = 3;
/** Received at least this share of expected counts as on track (rounding, small exclusions). */
export const ON_TRACK_RATIO = 0.95;

export type CheckStatus = "on-track" | "short" | "not-logged" | "none";

export interface CheckCell {
  /** Statement month YYYY-MM (spend). */
  month: string;
  /** Month the credit is expected in, YYYY-MM. */
  creditMonth: string;
  /** ₹ the reward rules pay on that month's spend on this card (after caps, before forex markup). */
  expected: number;
  /** ₹ value of credits logged in creditMonth. */
  received: number;
  /** Points/miles: expected and received unit counts (received is null when nothing was logged). */
  expectedUnits: number;
  receivedUnits: number | null;
  credits: number;
  status: CheckStatus;
  /** expected − received when short, else 0. */
  gap: number;
}

export interface CheckRow {
  cardId: string;
  kind: RewardKind;
  cells: CheckCell[];
  expected: number;
  received: number;
}

export interface RewardCheck {
  months: { key: string; label: string; creditLabel: string }[];
  rows: CheckRow[];
  /** Expected over the months that have credits logged, so missing logs don't read as a shortfall. */
  expectedLogged: number;
  received: number;
  short: number;
  shortBy: number;
  notLogged: number;
}

export interface CreditLike {
  userCardId: string | null;
  date: Date;
  amount: number;
  points: number | null;
}

export interface CardMeta {
  rewardUnit: string;
  pointValue: number;
}

interface ExpenseLike {
  id: string;
  amount: number;
  date: Date;
  category: string;
  merchant: string | null;
  channel: string;
  userCardId: string | null;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const CHEAT_SKIP = new Set(["rent", "wallet", "government"]);
const CHEAT_MERCHANTS = ["Amazon", "Flipkart", "Swiggy", "Zomato", "BigBasket", "Uber", "BookMyShow", "MakeMyTrip", "Myntra", "BPCL"];

function bestFor(cards: EngineCard[], txn: Txn, caps: CapState, key: string, label: string): CheatRow {
  const ranked = rankCards(cards, txn, caps);
  const best = ranked[0];
  const has = best && best.net > 0;
  return {
    key, label, category: txn.category,
    cardId: has ? best.cardId : null,
    effectivePct: has ? best.effectivePct : 0,
    reason: best?.reason ?? "No cards",
    runnerUpPct: ranked[1] && ranked[1].net > 0 ? ranked[1].effectivePct : null,
  };
}

export function buildDashboard(
  cards: EngineCard[],
  txns: Txn[],
  expenses: ExpenseLike[],
  /** Card id → anniversary month (1-12), from the card views. */
  anniversaries: Map<string, number>,
  now = new Date(),
  /** Reward unit per card (for the cashback/points split) and rewards actually received. */
  extra: { meta?: Map<string, CardMeta>; credits?: CreditLike[] } = {},
): DashboardModel {
  const meta = extra.meta ?? new Map<string, CardMeta>();
  const kindOf = (cardId: string) => {
    const m = meta.get(cardId);
    return m ? rewardKind(m.rewardUnit, m.pointValue) : "cashback";
  };
  const tracked = txns.filter((t) => t.cardId && cards.some((c) => c.id === t.cardId));
  const actual = simulateActual(cards, tracked);
  const optimal = allocate(cards, tracked);

  /* ---- monthly series (last 12 calendar months incl. current) ---- */
  const months: MonthPoint[] = [];
  const idx = new Map<string, MonthPoint>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const p = {
      key: monthKey(d), label: `${MONTHS[d.getMonth()]}${d.getMonth() === 0 || i === 11 ? ` ’${String(d.getFullYear()).slice(2)}` : ""}`,
      spend: 0, actual: 0, optimal: 0, cashback: 0, pointsValue: 0, milesValue: 0,
    };
    months.push(p);
    idx.set(p.key, p);
  }
  for (const t of txns) {
    const p = idx.get(monthKey(toDate(t.date)));
    if (p) p.spend += t.amount;
  }
  for (const a of actual.assignments) {
    const p = idx.get(monthKey(toDate(a.txn.date)));
    if (!p || !a.evaluation) continue;
    p.actual += a.evaluation.net;
    const kind = a.cardId ? kindOf(a.cardId) : "cashback";
    if (kind === "cashback") p.cashback += a.evaluation.net;
    else if (kind === "miles") p.milesValue += a.evaluation.net;
    else p.pointsValue += a.evaluation.net;
  }

  /* ---- earned rewards split by type (adds up to actual.total) ---- */
  const split = emptySplit();
  for (const [cardId, t] of actual.byCard) {
    const m = meta.get(cardId);
    addToSplit(split, t.net, m?.rewardUnit ?? "Cashback", m?.pointValue ?? 1);
  }
  for (const a of optimal.assignments) {
    const p = idx.get(monthKey(toDate(a.txn.date)));
    if (p && a.evaluation) p.optimal += a.evaluation.net;
  }

  /* ---- month-to-date vs same period last month ---- */
  const day = now.getDate();
  const thisStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastEnd = new Date(now.getFullYear(), now.getMonth() - 1, day, 23, 59, 59, 999);
  let spendThisMonth = 0;
  let spendSamePeriodLastMonth = 0;
  for (const t of txns) {
    const d = toDate(t.date);
    if (d >= thisStart) spendThisMonth += t.amount;
    else if (d >= lastStart && d <= lastEnd && d.getMonth() === lastStart.getMonth()) spendSamePeriodLastMonth += t.amount;
  }
  const changePct = spendSamePeriodLastMonth > 0 ? ((spendThisMonth - spendSamePeriodLastMonth) / spendSamePeriodLastMonth) * 100 : null;

  /* ---- spend by category ---- */
  const catTotals = new Map<string, number>();
  let totalSpend = 0;
  for (const t of txns) {
    catTotals.set(t.category, (catTotals.get(t.category) ?? 0) + t.amount);
    totalSpend += t.amount;
  }
  const categories = [...catTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, spend]) => ({
      category,
      label: CATEGORY_MAP[category]?.label ?? category,
      color: CATEGORY_MAP[category]?.color ?? CATEGORY_MAP.other.color,
      spend,
      share: totalSpend ? spend / totalSpend : 0,
    }));

  /* ---- cheat sheet: best card right now, given caps used this year ---- */
  const yearTxns = tracked.filter((t) => toDate(t.date).getFullYear() === now.getFullYear());
  const caps = simulateActual(cards, yearTxns).caps;
  const cheatCategories = cards.length
    ? CATEGORIES.filter((c) => !CHEAT_SKIP.has(c.key)).map((c) =>
        bestFor(cards, { amount: 1000, date: now, category: c.key, channel: c.defaultChannel }, caps, c.key, c.label))
    : [];
  const cheatMerchants = cards.length
    ? CHEAT_MERCHANTS.map((name) => MERCHANTS.find((m) => m.name === name)!)
        .filter(Boolean)
        .map((m) => bestFor(cards, { amount: 1000, date: now, category: m.category, merchant: m.name, channel: m.channel }, caps, m.name, m.name))
    : [];

  /* ---- fee waiver progress (card year starts on the anniversary month) ---- */
  const waivers: WaiverRow[] = [];
  for (const c of cards) {
    if (!(c.annualFee > 0 && c.feeWaiverSpend)) continue;
    const anniv = anniversaries.get(c.id) ?? 1;
    let start = new Date(now.getFullYear(), anniv - 1, 1);
    if (start > now) start = new Date(now.getFullYear() - 1, anniv - 1, 1);
    const resets = new Date(start.getFullYear() + 1, start.getMonth(), 1);
    const spent = expenses
      .filter((e) => e.userCardId === c.id && e.date >= start)
      .reduce((s, e) => s + e.amount, 0);
    waivers.push({
      cardId: c.id, fee: c.annualFee, target: c.feeWaiverSpend, spent,
      since: start.toISOString(), resets: resets.toISOString(),
    });
  }
  waivers.sort((a, b) => b.spent / b.target - a.spent / a.target);

  /* ---- recent transactions, with what a better card would have earned ---- */
  const recentExp = [...expenses].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);
  const recentIds = new Set(recentExp.map((e) => e.id));
  const verdicts = new Map<string, { used: Evaluation; best: Evaluation }>();
  const replayCaps: CapState = new Map();
  for (const t of [...tracked].sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime())) {
    const card = cards.find((c) => c.id === t.cardId)!;
    const used = evaluate(card, t, replayCaps);
    if (t.id && recentIds.has(t.id)) verdicts.set(t.id, { used, best: rankCards(cards, t, replayCaps)[0] });
    consume(replayCaps, card, t, used);
  }
  const recent: RecentRow[] = recentExp.map((e) => {
    const v = verdicts.get(e.id);
    const gap = v ? v.best.net - v.used.net : 0;
    const missed = gap >= 1 ? gap : 0;
    return {
      id: e.id, date: e.date.toISOString(), category: e.category, merchant: e.merchant,
      amount: e.amount, channel: e.channel, cardId: v ? e.userCardId : null,
      earned: v ? v.used.net : null, missed,
      betterCardId: missed ? v!.best.cardId : null,
    };
  });

  const review = cards.length ? reviewWallet(cards, txns) : null;
  const rewardCheck = buildRewardCheck(cards, actual.assignments, extra.credits ?? [], meta, now);

  return {
    kpis: {
      spendThisMonth, spendSamePeriodLastMonth,
      lastMonthLabel: MONTHS[lastStart.getMonth()],
      changePct,
      actualRewards: actual.total,
      optimalRewards: optimal.total,
      missed: Math.max(0, optimal.total - actual.total),
      tracked: tracked.length,
      walletNet: review?.net ?? 0,
      split,
    },
    months, categories, totalSpend, cheatCategories, cheatMerchants, waivers, recent, rewardCheck,
  };
}

/**
 * Expected vs received for the last CHECK_MONTHS complete statement months (a statement month is
 * approximated as a calendar month). Expected comes from the same simulateActual run as the
 * dashboard's earned rewards; received is what the user logged or imported CREDIT_LAG_MONTHS later.
 */
export function buildRewardCheck(
  cards: EngineCard[],
  assignments: { cardId: string | null; txn: Txn; evaluation: Evaluation | null }[],
  credits: CreditLike[],
  meta: Map<string, CardMeta>,
  now = new Date(),
): RewardCheck {
  const months = Array.from({ length: CHECK_MONTHS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - CHECK_MONTHS + i, 1);
    const c = new Date(d.getFullYear(), d.getMonth() + CREDIT_LAG_MONTHS, 1);
    return { key: monthKey(d), label: MONTHS[d.getMonth()], creditKey: monthKey(c), creditLabel: MONTHS[c.getMonth()] };
  });
  const monthSet = new Set(months.map((m) => m.key));
  const creditSet = new Set(months.map((m) => m.creditKey));

  // Gross reward (before forex markup, which the bank charges separately) per card per statement month.
  const expected = new Map<string, number>();
  for (const a of assignments) {
    if (!a.cardId || !a.evaluation) continue;
    const key = monthKey(toDate(a.txn.date));
    if (!monthSet.has(key)) continue;
    const k = `${a.cardId}|${key}`;
    expected.set(k, (expected.get(k) ?? 0) + a.evaluation.reward);
  }
  const received = new Map<string, { amount: number; units: number; withUnits: number; count: number }>();
  for (const c of credits) {
    if (!c.userCardId) continue;
    const key = monthKey(c.date);
    if (!creditSet.has(key)) continue;
    const k = `${c.userCardId}|${key}`;
    const r = received.get(k) ?? { amount: 0, units: 0, withUnits: 0, count: 0 };
    r.amount += c.amount;
    if (c.points != null) {
      r.units += c.points;
      r.withUnits++;
    }
    r.count++;
    received.set(k, r);
  }

  const rows: CheckRow[] = [];
  let expectedLogged = 0, receivedTotal = 0, short = 0, shortBy = 0, notLogged = 0;
  for (const card of cards) {
    const m = meta.get(card.id);
    const pv = m?.pointValue ?? 1;
    const kind = m ? rewardKind(m.rewardUnit, m.pointValue) : "cashback";
    const cells: CheckCell[] = months.map((mo) => {
      const exp = expected.get(`${card.id}|${mo.key}`) ?? 0;
      const rec = received.get(`${card.id}|${mo.creditKey}`);
      const got = rec?.amount ?? 0;
      let status: CheckStatus;
      if (rec) status = got >= exp * ON_TRACK_RATIO ? "on-track" : "short";
      else status = exp >= 1 ? "not-logged" : "none";
      return {
        month: mo.key, creditMonth: mo.creditKey, expected: exp, received: got,
        expectedUnits: pv > 0 ? exp / pv : 0,
        // Prefer the posted point counts; otherwise convert the ₹ value back.
        receivedUnits: rec ? (rec.withUnits === rec.count ? rec.units : pv > 0 ? got / pv : null) : null,
        credits: rec?.count ?? 0, status,
        gap: status === "short" ? exp - got : 0,
      };
    });
    if (cells.every((c) => c.status === "none")) continue;
    for (const c of cells) {
      if (c.credits) {
        expectedLogged += c.expected;
        receivedTotal += c.received;
      }
      if (c.status === "short") {
        short++;
        shortBy += c.gap;
      }
      if (c.status === "not-logged") notLogged++;
    }
    rows.push({ cardId: card.id, kind, cells, expected: cells.reduce((s, c) => s + c.expected, 0), received: cells.reduce((s, c) => s + c.received, 0) });
  }
  rows.sort((a, b) => b.expected - a.expected);

  return {
    months: months.map(({ key, label, creditLabel }) => ({ key, label, creditLabel })),
    rows, expectedLogged, received: receivedTotal, short, shortBy, notLogged,
  };
}
