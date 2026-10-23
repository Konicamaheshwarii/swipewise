/** Shared by the custom-card form (client) and the cards server actions. */

export const NETWORKS = ["Visa", "Mastercard", "RuPay", "Amex", "Diners"] as const;
export type Network = (typeof NETWORKS)[number];

/** Rewards are excluded on these by default, as on most Indian cards. */
export const DEFAULT_EXCLUDED = ["rent", "fuel", "wallet", "government"];

/** Curated dark gradients for custom cards. */
const PALETTE: [string, string][] = [
  ["#0f172a", "#334155"], // slate
  ["#1a1033", "#5b3fa0"], // violet
  ["#05211f", "#0f766e"], // teal
  ["#2a0f14", "#8a1f2d"], // garnet
  ["#0b1a33", "#1e4fa3"], // sapphire
  ["#1c1407", "#8a6a1f"], // bronze
  ["#111827", "#4b5563"], // graphite
  ["#2b0b2a", "#86307e"], // plum
  ["#06231a", "#166534"], // emerald
  ["#1f1208", "#9a3412"], // copper
];

/** Deterministic gradient for a bank name, so the same bank always gets the same colours. */
export function gradientFor(bank: string): { colorFrom: string; colorTo: string } {
  const s = bank.trim().toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  const [colorFrom, colorTo] = PALETTE[(h >>> 0) % PALETTE.length];
  return { colorFrom, colorTo };
}

/** A custom card's reward setup, as edited in the form. */
export interface CustomCardSetup {
  bank: string;
  name: string;
  network: Network;
  annualFee: number;
  feeWaiverSpend: number | null;
  forexMarkup: number;
  baseRate: number;
  bonuses: { category: string; rate: number; monthlyCap: number | null }[];
  excluded: string[];
}

/** A user's custom product plus its setup, passed to the wallet for editing. */
export interface CustomProduct extends CustomCardSetup {
  id: string;
}
