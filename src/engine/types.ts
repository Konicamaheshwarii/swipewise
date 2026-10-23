export type Channel = "online" | "offline" | "international";
export type CapPeriod = "month" | "quarter" | "year";

/** A reward rule with its rate already expressed as effective % of spend in ₹ value. */
export interface EngineRule {
  id: string;
  label: string;
  /** Empty array = matches any. */
  categories: string[];
  merchants: string[];
  channels: Channel[];
  pct: number;
  capValue?: number | null;
  capPeriod?: CapPeriod | null;
  /** Rules sharing a capGroup share one cap. Defaults to the rule id. */
  capGroup?: string | null;
  minTxn?: number | null;
  priority: number;
}

export interface EngineCard {
  /** Unique within a simulation (user card id, or product id for catalog cards). */
  id: string;
  productId: string;
  name: string;
  bank: string;
  annualFee: number;
  feeWaiverSpend: number | null;
  /** Percent, e.g. 3.5 */
  forexMarkup: number;
  excludedCategories: string[];
  rules: EngineRule[];
  /** ₹/year the user gets from perks (lounges, fuel surcharge, etc.). */
  perksValue: number;
}

export interface Txn {
  id?: string;
  amount: number;
  date: Date | string;
  category: string;
  merchant?: string | null;
  channel: Channel;
  /** Card actually used, if known. */
  cardId?: string | null;
}

/** key: `${cardId}|${capGroup}|${periodKey}` → ₹ reward already earned. */
export type CapState = Map<string, number>;

export interface Evaluation {
  cardId: string;
  reward: number;
  forexCost: number;
  net: number;
  /** Nominal rate of the matched rule. */
  pct: number;
  /** net / amount × 100 */
  effectivePct: number;
  rule: EngineRule | null;
  excluded: boolean;
  belowMin: boolean;
  capped: boolean;
  /** Remaining cap (₹) before this transaction, null = uncapped. */
  capRemaining: number | null;
  reason: string;
}
