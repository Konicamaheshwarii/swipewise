import { describe, expect, it } from "vitest";
import { allocate, discover, evaluate, missedRewards, periodKey, rankCards, reviewWallet, simulateActual } from ".";
import type { EngineCard, EngineRule, Txn } from ".";

const rule = (r: Partial<EngineRule> & Pick<EngineRule, "id" | "pct">): EngineRule => ({
  label: r.id, categories: [], merchants: [], channels: [], priority: 0, ...r,
});

const card = (c: Partial<EngineCard> & Pick<EngineCard, "id" | "rules">): EngineCard => ({
  productId: c.id, name: c.id, bank: "Bank", annualFee: 0, feeWaiverSpend: null, forexMarkup: 3.5,
  excludedCategories: [], perksValue: 0, ...c,
});

const txn = (t: Partial<Txn>): Txn => ({
  amount: 1000, date: "2026-05-10", category: "other", channel: "offline", ...t,
});

const cashback = card({
  id: "cashback",
  annualFee: 999,
  feeWaiverSpend: 200000,
  excludedCategories: ["rent", "fuel"],
  rules: [
    rule({ id: "online", pct: 5, channels: ["online"], capValue: 500, capPeriod: "month", capGroup: "all", priority: 1 }),
    rule({ id: "base", pct: 1, capValue: 500, capPeriod: "month", capGroup: "all" }),
  ],
});

const amazon = card({
  id: "amazon",
  forexMarkup: 1.99,
  rules: [
    rule({ id: "amz", pct: 5, merchants: ["Amazon"], priority: 3 }),
    rule({ id: "base", pct: 1 }),
  ],
});

const dining = card({
  id: "dining",
  rules: [
    rule({ id: "dine", pct: 10, categories: ["dining"], priority: 2, minTxn: 200 }),
    rule({ id: "base", pct: 0.5 }),
  ],
});

describe("periodKey", () => {
  it("buckets by month, quarter and year", () => {
    expect(periodKey("2026-05-10", "month")).toBe("2026-05");
    expect(periodKey("2026-05-10", "quarter")).toBe("2026-Q2");
    expect(periodKey("2026-05-10", "year")).toBe("2026");
  });
});

describe("evaluate", () => {
  it("prefers merchant rule over base", () => {
    const ev = evaluate(amazon, txn({ merchant: "amazon", channel: "online" }));
    expect(ev.rule?.id).toBe("amz");
    expect(ev.reward).toBe(50);
  });

  it("merchant rule does not match other merchants", () => {
    expect(evaluate(amazon, txn({ merchant: "Flipkart" })).rule?.id).toBe("base");
  });

  it("returns zero on excluded categories", () => {
    const ev = evaluate(cashback, txn({ category: "rent", amount: 25000 }));
    expect(ev.excluded).toBe(true);
    expect(ev.net).toBe(0);
  });

  it("respects minimum transaction", () => {
    const ev = evaluate(dining, txn({ category: "dining", amount: 150 }));
    expect(ev.belowMin).toBe(true);
    expect(ev.reward).toBe(0);
  });

  it("caps rewards against shared cap group", () => {
    const caps = new Map([["cashback|all|2026-05", 480]]);
    const ev = evaluate(cashback, txn({ channel: "online" }), caps);
    expect(ev.reward).toBe(20);
    expect(ev.capped).toBe(true);
  });

  it("subtracts forex markup on international spend", () => {
    const ev = evaluate(amazon, txn({ channel: "international", amount: 10000 }));
    expect(ev.reward).toBe(100);
    expect(ev.forexCost).toBeCloseTo(199);
    expect(ev.net).toBeCloseTo(-99);
  });
});

describe("rankCards", () => {
  it("ranks by net return", () => {
    const ranked = rankCards([cashback, amazon, dining], txn({ category: "dining", amount: 1000 }));
    expect(ranked.map((r) => r.cardId)).toEqual(["dining", "cashback", "amazon"]);
  });
});

describe("allocate", () => {
  it("moves spend to the next best card once a cap is exhausted", () => {
    const txns = Array.from({ length: 3 }, (_, i) =>
      txn({ id: `t${i}`, amount: 5000, channel: "online", date: `2026-05-0${i + 1}` }),
    );
    const res = allocate([cashback, amazon], txns);
    // first two fill the ₹500 cap (250 + 250), third goes to amazon base 1%
    expect(res.assignments.map((a) => a.cardId)).toEqual(["cashback", "cashback", "amazon"]);
    expect(res.total).toBe(550);
  });

  it("leaves zero-reward spend unassigned", () => {
    const res = allocate([cashback], [txn({ category: "rent", amount: 25000 }), txn({ amount: 1000 })]);
    expect(res.assignments[0].cardId).toBeNull();
    expect([...res.byCard.values()].reduce((s, t) => s + t.spend, 0)).toBe(1000);
  });

  it("resets caps each month", () => {
    const txns = [txn({ amount: 10000, channel: "online", date: "2026-05-01" }), txn({ amount: 10000, channel: "online", date: "2026-06-01" })];
    expect(allocate([cashback], txns).total).toBe(1000);
  });
});

describe("actual vs optimal", () => {
  it("computes missed rewards", () => {
    const txns = [txn({ category: "dining", amount: 2000, cardId: "amazon" })];
    const actual = simulateActual([amazon, dining], txns);
    expect(actual.total).toBe(20);
    const m = missedRewards([amazon, dining], txns);
    expect(m.optimal).toBe(200);
    expect(m.missed).toBe(180);
  });
});

describe("reviewWallet", () => {
  const months = Array.from({ length: 12 }, (_, m) => m);
  const txns: Txn[] = months.flatMap((m) => {
    const date = new Date(2025, m, 15);
    return [
      txn({ date, category: "dining", amount: 3000 }),
      txn({ date, category: "shopping", merchant: "Amazon", channel: "online", amount: 4000 }),
    ];
  });

  it("flags a fee card that adds nothing as close", () => {
    const useless = card({ id: "useless", annualFee: 2500, feeWaiverSpend: 500000, rules: [rule({ id: "b", pct: 0.2 })] });
    const r = reviewWallet([amazon, dining, useless], txns);
    const u = r.cards.find((c) => c.cardId === "useless")!;
    expect(u.marginal).toBe(0);
    expect(u.verdict).toBe("close");
  });

  it("marks lifetime-free cards as keep_free and values the marginal contribution", () => {
    const r = reviewWallet([amazon, dining], txns);
    const d = r.cards.find((c) => c.cardId === "dining")!;
    // dining 10% vs amazon 1% on 36k/yr dining = 3600 - 360
    expect(d.marginal).toBeCloseTo(3240);
    expect(d.verdict).toBe("keep_free");
    expect(r.annualRewards).toBeCloseTo(3600 + 2400);
  });
});

describe("discover", () => {
  it("ranks the candidate that adds most first", () => {
    const txns = [txn({ category: "dining", amount: 5000, date: "2026-01-01" }), txn({ category: "dining", amount: 5000, date: "2026-12-01" })];
    const s = discover([amazon], [cashback, dining], txns);
    expect(s[0].productId).toBe("dining");
    expect(s[0].gain).toBeGreaterThan(0);
  });
});
