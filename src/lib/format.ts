import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** ₹12,345 · compact: ₹1.2L, ₹3.4K */
export function inr(n: number, opts: { compact?: boolean; decimals?: number } = {}) {
  const sign = n < 0 ? "−" : "";
  const v = Math.abs(n);
  if (opts.compact) {
    if (v >= 1e7) return `${sign}₹${trim(v / 1e7)}Cr`;
    if (v >= 1e5) return `${sign}₹${trim(v / 1e5)}L`;
    if (v >= 1e3) return `${sign}₹${trim(v / 1e3)}K`;
  }
  return `${sign}₹${v.toLocaleString("en-IN", { maximumFractionDigits: opts.decimals ?? 0, minimumFractionDigits: opts.decimals ?? 0 })}`;
}

const trim = (n: number) => Number(n.toFixed(1)).toString();

export function pct(n: number, decimals = 1) {
  return `${Number(n.toFixed(decimals))}%`;
}

export function fmtDate(d: Date | string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Date(d).toLocaleDateString("en-IN", opts);
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function cardTitle(c: { bank: string; name: string; nickname?: string | null }) {
  return c.nickname || `${c.bank} ${c.name}`;
}

export type RewardKind = "cashback" | "points" | "miles";

/** Cashback is credited as money; points and miles need redeeming, so their ₹ value is an estimate. */
export function rewardKind(rewardUnit: string, pointValue: number): RewardKind {
  if (/mile|skywards|bluchip|edge miles|avios|krisflyer/i.test(rewardUnit)) return "miles";
  if (/cash|balance|statement credit/i.test(rewardUnit) && pointValue === 1) return "cashback";
  return "points";
}

/** "₹100 cashback" or "400 Reward points (≈ ₹100)". */
export function describeReward(value: number, rewardUnit: string, pointValue: number) {
  if (rewardKind(rewardUnit, pointValue) === "cashback") return `${inr(value, { decimals: value < 100 && value % 1 ? 2 : 0 })} cashback`;
  const units = pointValue > 0 ? value / pointValue : 0;
  return `${Math.round(units).toLocaleString("en-IN")} ${rewardUnit} (≈ ${inr(value)})`;
}

export const REWARD_KIND_LABEL: Record<RewardKind, string> = { cashback: "Cashback", points: "Points", miles: "Miles" };

/** Points/miles count for a ₹ value (0 when the card has no point value). */
export const rewardUnits = (value: number, pointValue: number) => (pointValue > 0 ? value / pointValue : 0);

/** Compact reward hint: "+₹12 cashback", "+48 pts ≈ ₹12", "+48 miles ≈ ₹12". */
export function rewardHint(value: number, rewardUnit: string, pointValue: number) {
  const kind = rewardKind(rewardUnit, pointValue);
  if (kind === "cashback") return `+${inr(value)} cashback`;
  const units = Math.round(rewardUnits(value, pointValue)).toLocaleString("en-IN");
  return `+${units} ${kind === "miles" ? "miles" : "pts"} ≈ ${inr(value)}`;
}

/** Reward ₹ totals split by type; points/miles also keep their unit count. */
export interface RewardSplit {
  cashback: number;
  points: number;
  pointsValue: number;
  miles: number;
  milesValue: number;
}

export const emptySplit = (): RewardSplit => ({ cashback: 0, points: 0, pointsValue: 0, miles: 0, milesValue: 0 });

/** Adds a ₹ reward earned on a card to the split (mutates and returns it). */
export function addToSplit(split: RewardSplit, value: number, rewardUnit: string, pointValue: number) {
  const kind = rewardKind(rewardUnit, pointValue);
  if (kind === "cashback") split.cashback += value;
  else if (kind === "miles") {
    split.miles += rewardUnits(value, pointValue);
    split.milesValue += value;
  } else {
    split.points += rewardUnits(value, pointValue);
    split.pointsValue += value;
  }
  return split;
}

/** "₹8.2K cashback · 3,400 pts ≈ ₹1.7K" (only the parts that are non-zero). */
export function describeSplit(s: RewardSplit) {
  const n = (v: number) => Math.round(v).toLocaleString("en-IN");
  const parts = [
    Math.abs(s.cashback) >= 0.5 ? `${inr(s.cashback, { compact: Math.abs(s.cashback) >= 1e4 })} cashback` : "",
    s.points >= 0.5 ? `${n(s.points)} pts ≈ ${inr(s.pointsValue, { compact: s.pointsValue >= 1e4 })}` : "",
    s.miles >= 0.5 ? `${n(s.miles)} miles ≈ ${inr(s.milesValue, { compact: s.milesValue >= 1e4 })}` : "",
  ];
  return parts.filter(Boolean).join(" · ");
}
