import type { CapPeriod, CapState, EngineCard, EngineRule, Evaluation, Txn } from "./types";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

export function periodKey(date: Date | string, period: CapPeriod): string {
  const d = toDate(date);
  const y = d.getFullYear();
  if (period === "year") return `${y}`;
  if (period === "quarter") return `${y}-Q${Math.floor(d.getMonth() / 3) + 1}`;
  return `${y}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function capKey(cardId: string, rule: EngineRule, date: Date | string): string | null {
  if (rule.capValue == null || !rule.capPeriod) return null;
  return `${cardId}|${rule.capGroup ?? rule.id}|${periodKey(date, rule.capPeriod)}`;
}

const norm = (s: string) => s.trim().toLowerCase();

export function ruleMatches(rule: EngineRule, txn: Txn): boolean {
  if (rule.categories.length && !rule.categories.includes(txn.category)) return false;
  if (rule.merchants.length) {
    if (!txn.merchant) return false;
    const m = norm(txn.merchant);
    if (!rule.merchants.some((x) => norm(x) === m)) return false;
  }
  if (rule.channels.length && !rule.channels.includes(txn.channel)) return false;
  return true;
}

/** Highest priority matching rule; ties go to the higher rate. */
export function matchRule(card: EngineCard, txn: Txn): EngineRule | null {
  let best: EngineRule | null = null;
  for (const r of card.rules) {
    if (!ruleMatches(r, txn)) continue;
    if (!best || r.priority > best.priority || (r.priority === best.priority && r.pct > best.pct)) best = r;
  }
  return best;
}

export function evaluate(card: EngineCard, txn: Txn, caps: CapState = new Map()): Evaluation {
  const amount = Math.max(0, txn.amount);
  const forexCost = txn.channel === "international" ? (amount * card.forexMarkup) / 100 : 0;
  const base = { cardId: card.id, forexCost, capped: false, capRemaining: null as number | null };

  const finish = (e: Omit<Evaluation, "net" | "effectivePct" | "cardId" | "forexCost">): Evaluation => {
    const net = e.reward - forexCost;
    return { ...base, ...e, net, effectivePct: amount ? (net / amount) * 100 : 0 };
  };

  if (card.excludedCategories.includes(txn.category)) {
    return finish({
      reward: 0, pct: 0, rule: null, excluded: true, belowMin: false, capped: false, capRemaining: null,
      reason: "No rewards on this category",
    });
  }

  const rule = matchRule(card, txn);
  if (!rule) {
    return finish({
      reward: 0, pct: 0, rule: null, excluded: false, belowMin: false, capped: false, capRemaining: null,
      reason: "No matching reward rule",
    });
  }

  if (rule.minTxn && amount < rule.minTxn) {
    return finish({
      reward: 0, pct: rule.pct, rule, excluded: false, belowMin: true, capped: false, capRemaining: null,
      reason: `Below ${inr(rule.minTxn)} minimum`,
    });
  }

  const raw = (amount * rule.pct) / 100;
  const key = capKey(card.id, rule, txn.date);
  if (key == null) {
    return finish({
      reward: raw, pct: rule.pct, rule, excluded: false, belowMin: false, capped: false, capRemaining: null,
      reason: `${fmtPct(rule.pct)} · ${rule.label}`,
    });
  }

  const remaining = Math.max(0, (rule.capValue ?? 0) - (caps.get(key) ?? 0));
  const reward = Math.min(raw, remaining);
  const capped = reward < raw;
  const per = rule.capPeriod === "month" ? "month" : rule.capPeriod === "quarter" ? "quarter" : "year";
  let reason: string;
  if (remaining <= 0) reason = `${rule.label}: ${inr(rule.capValue ?? 0)}/${per} cap used up`;
  else if (capped) reason = `${fmtPct(rule.pct)} · ${rule.label}, only ${inr(remaining)} cap left`;
  else reason = `${fmtPct(rule.pct)} · ${rule.label} (${inr(remaining)} cap left this ${per})`;

  return finish({
    reward, pct: rule.pct, rule, excluded: false, belowMin: false, capped, capRemaining: remaining, reason,
  });
}

/** Record an evaluation's reward against the cap state (mutates). */
export function consume(caps: CapState, card: EngineCard, txn: Txn, ev: Evaluation) {
  if (!ev.rule || ev.reward <= 0) return;
  const key = capKey(card.id, ev.rule, txn.date);
  if (key) caps.set(key, (caps.get(key) ?? 0) + ev.reward);
}

export function rankCards(cards: EngineCard[], txn: Txn, caps: CapState = new Map()): Evaluation[] {
  return cards.map((c) => evaluate(c, txn, caps)).sort((a, b) => b.net - a.net);
}

export function fmtPct(p: number): string {
  return `${Number(p.toFixed(2))}%`;
}
