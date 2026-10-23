/** Serialisable catalog shapes passed from the catalog page to client components. */

export interface CatalogRuleView {
  id: string;
  label: string;
  categories: string[];
  merchants: string[];
  channels: string[];
  rateType: "percent" | "points";
  rate: number;
  perAmount: number;
  /** Effective % of spend in ₹ value. */
  pct: number;
  capValue: number | null;
  capPeriod: string | null;
  capGroup: string | null;
  /** True when other rules on the card share this cap. */
  capShared: boolean;
  minTxn: number | null;
  priority: number;
}

export interface CatalogProduct {
  id: string;
  bank: string;
  name: string;
  network: string;
  tier: string;
  annualFee: number;
  joiningFee: number;
  feeWaiverSpend: number | null;
  forexMarkup: number;
  pointValue: number;
  rewardUnit: string;
  excluded: string[];
  benefits: { label: string; value: number }[];
  colorFrom: string;
  colorTo: string;
  sourceUrl: string;
  lastVerified: string;
  /** Plain-language caveats about how this card is modelled. */
  notes: string | null;
  rules: CatalogRuleView[];
}
