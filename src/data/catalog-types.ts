import type { CapPeriod, Channel } from "../engine/types";

export interface CatalogRule {
  label: string;
  categories?: string[];
  merchants?: string[];
  channels?: Channel[];
  rateType: "percent" | "points";
  /** percent, or points earned per `perAmount` ₹ */
  rate: number;
  perAmount?: number;
  /** Cap expressed in ₹ of reward value. */
  capValue?: number;
  capPeriod?: CapPeriod;
  capGroup?: string;
  minTxn?: number;
}

export interface CatalogCard {
  id: string;
  bank: string;
  name: string;
  network: string;
  tier: "Entry" | "Mid" | "Premium" | "Super Premium";
  annualFee: number;
  joiningFee: number;
  feeWaiverSpend: number | null;
  forexMarkup: number;
  /** ₹ value of one point (1 for cashback). */
  pointValue: number;
  rewardUnit: string;
  excludedCategories: string[];
  benefits: { label: string; value: number }[];
  colorFrom: string;
  colorTo: string;
  sourceUrl: string;
  lastVerified: string;
  /** Plain-language caveats, e.g. spend-threshold rates that were blended. Shown in the catalog. */
  notes?: string;
  rules: CatalogRule[];
}

export const NO_REWARDS = ["rent", "fuel", "wallet", "government"];
export const STRICT = [...NO_REWARDS, "insurance", "education", "utilities"];
