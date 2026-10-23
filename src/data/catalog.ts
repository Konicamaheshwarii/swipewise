/**
 * Seed card catalog. Reward rules are approximations of each issuer's published
 * terms as of the `lastVerified` month. Banks change these often: verify on the
 * issuer's site and update via the Catalog admin screen.
 *
 * BASE holds the original entries; files in ./catalog-extra add cards per bank group.
 * Entries are merged by id, and a later entry replaces an earlier one with the same id.
 */
import { NO_REWARDS, STRICT, type CatalogCard } from "./catalog-types";
import { EXTRA_CARDS } from "./catalog-extra";

export type { CatalogCard, CatalogRule } from "./catalog-types";

const BASE: CatalogCard[] = [
  // ───────────────────────────── HDFC Bank ─────────────────────────────
  {
    id: "hdfc-millennia", bank: "HDFC Bank", name: "Millennia", network: "Mastercard", tier: "Entry",
    annualFee: 1000, joiningFee: 1000, feeWaiverSpend: 100000, forexMarkup: 3.5, pointValue: 1, rewardUnit: "CashPoints",
    excludedCategories: NO_REWARDS,
    benefits: [{ label: "8 domestic lounge visits / yr", value: 4000 }],
    colorFrom: "#1b1f5e", colorTo: "#d6336c", sourceUrl: "https://www.hdfcbank.com", lastVerified: "2026-10",
    rules: [
      {
        label: "10 partner brands", merchants: ["Amazon", "Flipkart", "Myntra", "Swiggy", "Zomato", "BookMyShow", "Uber", "Tata CLiQ", "Cult.fit"],
        rateType: "percent", rate: 5, capValue: 1000, capPeriod: "month", capGroup: "m5",
      },
      { label: "Everything else", rateType: "percent", rate: 1, capValue: 1000, capPeriod: "month", capGroup: "m1", minTxn: 100 },
    ],
  },
  {
    id: "swiggy-hdfc", bank: "HDFC Bank", name: "Swiggy", network: "Mastercard", tier: "Entry",
    annualFee: 500, joiningFee: 500, feeWaiverSpend: 200000, forexMarkup: 3.5, pointValue: 1, rewardUnit: "Cashback",
    excludedCategories: STRICT,
    benefits: [{ label: "Swiggy One membership (3 months)", value: 500 }],
    colorFrom: "#c2410c", colorTo: "#fc8019", sourceUrl: "https://www.hdfcbank.com", lastVerified: "2026-10",
    rules: [
      { label: "Swiggy (food, Instamart, Dineout)", merchants: ["Swiggy"], rateType: "percent", rate: 10, capValue: 1500, capPeriod: "month", capGroup: "swiggy" },
      { label: "Online shopping & entertainment", categories: ["shopping", "entertainment", "health"], channels: ["online"], rateType: "percent", rate: 5, capValue: 1500, capPeriod: "month", capGroup: "online" },
      { label: "Everything else", rateType: "percent", rate: 1, capValue: 500, capPeriod: "month", capGroup: "base" },
    ],
  },
  {
    id: "tata-neu-infinity", bank: "HDFC Bank", name: "Tata Neu Infinity", network: "RuPay", tier: "Mid",
    annualFee: 1499, joiningFee: 1499, feeWaiverSpend: 300000, forexMarkup: 2, pointValue: 1, rewardUnit: "NeuCoins",
    excludedCategories: NO_REWARDS,
    benefits: [{ label: "8 domestic lounge visits / yr", value: 4000 }],
    colorFrom: "#2a0b3f", colorTo: "#8b3dd6", sourceUrl: "https://www.hdfcbank.com", lastVerified: "2026-10",
    rules: [
      { label: "Tata Neu brands", merchants: ["BigBasket", "Croma", "Tata CLiQ", "1mg", "Air India", "Westside"], rateType: "percent", rate: 5 },
      { label: "Everything else", rateType: "percent", rate: 1.5 },
    ],
  },
  {
    id: "hdfc-regalia-gold", bank: "HDFC Bank", name: "Regalia Gold", network: "Visa", tier: "Premium",
    annualFee: 2500, joiningFee: 2500, feeWaiverSpend: 400000, forexMarkup: 2, pointValue: 0.5, rewardUnit: "Reward points",
    excludedCategories: NO_REWARDS,
    benefits: [{ label: "12 domestic lounge visits / yr", value: 6000 }, { label: "6 international lounge visits", value: 9000 }],
    colorFrom: "#2b200f", colorTo: "#c9a45c", sourceUrl: "https://www.hdfcbank.com", lastVerified: "2026-10",
    rules: [
      { label: "5X at Myntra, Nykaa, Reliance Digital", merchants: ["Myntra", "Nykaa", "Reliance Digital"], rateType: "points", rate: 20, perAmount: 150, capValue: 2500, capPeriod: "month", capGroup: "x5" },
      { label: "Everything else", rateType: "points", rate: 4, perAmount: 150 },
    ],
  },
  {
    id: "hdfc-infinia", bank: "HDFC Bank", name: "Infinia Metal", network: "Visa", tier: "Super Premium",
    annualFee: 12500, joiningFee: 12500, feeWaiverSpend: 1000000, forexMarkup: 2, pointValue: 1, rewardUnit: "Reward points",
    excludedCategories: NO_REWARDS,
    benefits: [{ label: "Unlimited lounge access worldwide", value: 20000 }, { label: "Complimentary golf", value: 5000 }],
    colorFrom: "#050505", colorTo: "#3f3f46", sourceUrl: "https://www.hdfcbank.com", lastVerified: "2026-10",
    rules: [{ label: "All spends (redeemed for flights/hotels)", rateType: "points", rate: 5, perAmount: 150 }],
  },
  {
    id: "hdfc-diners-black", bank: "HDFC Bank", name: "Diners Club Black Metal", network: "Diners Club", tier: "Super Premium",
    annualFee: 10000, joiningFee: 10000, feeWaiverSpend: 800000, forexMarkup: 2, pointValue: 1, rewardUnit: "Reward points",
    excludedCategories: NO_REWARDS,
    benefits: [
      { label: "Unlimited lounge access worldwide", value: 15000 },
      { label: "Quarterly memberships (Swiggy One, Prime, etc.) on spend", value: 4000 },
      { label: "Complimentary golf", value: 3000 },
    ],
    colorFrom: "#0c0c0f", colorTo: "#6b5a3a", sourceUrl: "https://www.hdfcbank.com", lastVerified: "2026-10",
    rules: [{ label: "All spends (redeemed for flights/hotels)", rateType: "points", rate: 5, perAmount: 150 }],
  },
  {
    id: "hdfc-moneyback-plus", bank: "HDFC Bank", name: "MoneyBack+", network: "Visa", tier: "Entry",
    annualFee: 500, joiningFee: 500, feeWaiverSpend: 50000, forexMarkup: 3.5, pointValue: 0.25, rewardUnit: "CashPoints",
    excludedCategories: NO_REWARDS,
    benefits: [{ label: "₹500 voucher per ₹50k quarterly spend", value: 1000 }],
    colorFrom: "#0b2447", colorTo: "#19a7ce", sourceUrl: "https://www.hdfcbank.com", lastVerified: "2026-10",
    rules: [
      {
        label: "10X at Amazon, Flipkart, BigBasket, Swiggy, Reliance", merchants: ["Amazon", "Flipkart", "BigBasket", "Swiggy", "Reliance Digital"],
        rateType: "points", rate: 20, perAmount: 150, capValue: 625, capPeriod: "month", capGroup: "x10",
      },
      { label: "Everything else", rateType: "points", rate: 2, perAmount: 150 },
    ],
  },
  {
    id: "hdfc-pixel-play", bank: "HDFC Bank", name: "Pixel Play", network: "Visa", tier: "Entry",
    annualFee: 500, joiningFee: 500, feeWaiverSpend: 100000, forexMarkup: 3.5, pointValue: 1, rewardUnit: "CashPoints",
    excludedCategories: STRICT,
    benefits: [{ label: "Digital-first card in PayZapp", value: 0 }],
    colorFrom: "#111827", colorTo: "#7c3aed", sourceUrl: "https://www.hdfcbank.com", lastVerified: "2026-10",
    // User-picked categories; modelled with the popular Dining & Entertainment + Amazon/Flipkart picks.
    rules: [
      { label: "Chosen pack: Zomato, Swiggy & BookMyShow", merchants: ["Zomato", "Swiggy", "BookMyShow"], rateType: "percent", rate: 5, capValue: 500, capPeriod: "month", capGroup: "pack" },
      { label: "Chosen e-commerce: Amazon / Flipkart", merchants: ["Amazon", "Flipkart"], rateType: "percent", rate: 3, capValue: 500, capPeriod: "month", capGroup: "ecom" },
      { label: "Everything else", rateType: "percent", rate: 1, capValue: 500, capPeriod: "month", capGroup: "base" },
    ],
  },
  {
    id: "indianoil-hdfc", bank: "HDFC Bank", name: "IndianOil", network: "Visa", tier: "Entry",
    annualFee: 500, joiningFee: 500, feeWaiverSpend: 50000, forexMarkup: 3.5, pointValue: 1, rewardUnit: "Fuel Points",
    excludedCategories: ["rent", "wallet", "government"],
    benefits: [{ label: "1% fuel surcharge waiver", value: 600 }],
    colorFrom: "#0a2463", colorTo: "#f37021", sourceUrl: "https://www.hdfcbank.com", lastVerified: "2026-10",
    rules: [
      { label: "IndianOil fuel", merchants: ["Indian Oil"], rateType: "points", rate: 5, perAmount: 100, capValue: 150, capPeriod: "month", capGroup: "iocl" },
      { label: "Other fuel", categories: ["fuel"], rateType: "percent", rate: 0 },
      { label: "Groceries", categories: ["groceries"], rateType: "points", rate: 5, perAmount: 100, capValue: 100, capPeriod: "month", capGroup: "grocery" },
      { label: "Bill payments", categories: ["utilities"], rateType: "points", rate: 5, perAmount: 100, capValue: 100, capPeriod: "month", capGroup: "bills" },
      { label: "Everything else", rateType: "points", rate: 1, perAmount: 150 },
    ],
  },
  {
    id: "marriott-bonvoy-hdfc", bank: "HDFC Bank", name: "Marriott Bonvoy", network: "Diners Club", tier: "Premium",
    annualFee: 3000, joiningFee: 3000, feeWaiverSpend: null, forexMarkup: 3.5, pointValue: 0.5, rewardUnit: "Marriott Bonvoy points",
    excludedCategories: NO_REWARDS,
    benefits: [
      { label: "1 Free Night Award (up to 15k points) each year", value: 8000 },
      { label: "Marriott Bonvoy Silver Elite + 10 elite night credits", value: 0 },
      { label: "12 domestic + 12 international lounge visits", value: 8000 },
    ],
    colorFrom: "#1a1a1a", colorTo: "#a0522d", sourceUrl: "https://www.hdfcbank.com", lastVerified: "2026-10",
    rules: [
      { label: "Marriott hotels", merchants: ["Marriott"], rateType: "points", rate: 8, perAmount: 150 },
      { label: "Travel, dining & entertainment", categories: ["travel", "dining", "entertainment"], rateType: "points", rate: 4, perAmount: 150 },
      { label: "Everything else", rateType: "points", rate: 2, perAmount: 150 },
    ],
  },

  // ───────────────────────────── SBI Card ─────────────────────────────
  {
    id: "sbi-cashback", bank: "SBI Card", name: "Cashback", network: "Visa", tier: "Mid",
    annualFee: 999, joiningFee: 999, feeWaiverSpend: 200000, forexMarkup: 3.5, pointValue: 1, rewardUnit: "Cashback",
    excludedCategories: STRICT,
    benefits: [{ label: "1% fuel surcharge waiver", value: 0 }],
    colorFrom: "#1d1336", colorTo: "#6d3fc0", sourceUrl: "https://www.sbicard.com", lastVerified: "2026-10",
    rules: [
      { label: "Online spends", channels: ["online"], rateType: "percent", rate: 5, capValue: 5000, capPeriod: "month", capGroup: "all" },
      { label: "Offline spends", rateType: "percent", rate: 1, capValue: 5000, capPeriod: "month", capGroup: "all" },
    ],
  },
  {
    id: "sbi-simplyclick", bank: "SBI Card", name: "SimplyCLICK", network: "Visa", tier: "Entry",
    annualFee: 499, joiningFee: 499, feeWaiverSpend: 100000, forexMarkup: 3.5, pointValue: 0.25, rewardUnit: "Reward points",
    excludedCategories: NO_REWARDS,
    benefits: [{ label: "Amazon voucher on joining", value: 500 }],
    colorFrom: "#06163a", colorTo: "#1e6bd6", sourceUrl: "https://www.sbicard.com", lastVerified: "2026-10",
    rules: [
      {
        label: "10X on partner sites", merchants: ["Amazon", "Cleartrip", "BookMyShow", "Apollo", "Netmeds", "Myntra", "Yatra", "Dominos"],
        rateType: "points", rate: 10, perAmount: 100, capValue: 2500, capPeriod: "month", capGroup: "x10",
      },
      { label: "5X other online", channels: ["online"], rateType: "points", rate: 5, perAmount: 100, capValue: 2500, capPeriod: "month", capGroup: "x5" },
      { label: "Offline spends", rateType: "points", rate: 1, perAmount: 100 },
    ],
  },
  {
    id: "bpcl-sbi-octane", bank: "SBI Card", name: "BPCL Octane", network: "Visa", tier: "Mid",
    annualFee: 1499, joiningFee: 1499, feeWaiverSpend: 200000, forexMarkup: 3.5, pointValue: 0.25, rewardUnit: "Reward points",
    excludedCategories: ["rent", "wallet", "government", "insurance"],
    benefits: [{ label: "1% fuel surcharge waiver at BPCL", value: 600 }, { label: "4 domestic lounge visits / yr", value: 2000 }],
    colorFrom: "#0a2d55", colorTo: "#e3b505", sourceUrl: "https://www.sbicard.com", lastVerified: "2026-10",
    rules: [
      { label: "BPCL fuel", merchants: ["BPCL"], rateType: "points", rate: 25, perAmount: 100, capValue: 625, capPeriod: "month", capGroup: "bpcl" },
      { label: "Dining, groceries & movies", categories: ["dining", "groceries", "entertainment"], rateType: "points", rate: 10, perAmount: 100, capValue: 1875, capPeriod: "month", capGroup: "x10" },
      { label: "Everything else", rateType: "points", rate: 1, perAmount: 100 },
    ],
  },
  {
    id: "sbi-elite", bank: "SBI Card", name: "SBI Card ELITE", network: "Visa", tier: "Premium",
    annualFee: 4999, joiningFee: 4999, feeWaiverSpend: 1000000, forexMarkup: 1.99, pointValue: 0.25, rewardUnit: "Reward points",
    excludedCategories: NO_REWARDS,
    benefits: [
      { label: "Free movie tickets (₹6,000 / yr)", value: 6000 },
      { label: "Milestone bonus points (up to 50k RP)", value: 5000 },
      { label: "Domestic + Priority Pass international lounges", value: 6000 },
    ],
    colorFrom: "#16181d", colorTo: "#8a8f98", sourceUrl: "https://www.sbicard.com", lastVerified: "2026-10",
    rules: [
      { label: "5X on dining, groceries & departmental stores", categories: ["dining", "groceries"], rateType: "points", rate: 10, perAmount: 100 },
      { label: "Everything else", rateType: "points", rate: 2, perAmount: 100 },
    ],
  },
  {
    id: "sbi-prime", bank: "SBI Card", name: "SBI Card PRIME", network: "Visa", tier: "Mid",
    annualFee: 2999, joiningFee: 2999, feeWaiverSpend: 300000, forexMarkup: 3.5, pointValue: 0.25, rewardUnit: "Reward points",
    excludedCategories: NO_REWARDS,
    benefits: [
      { label: "Pizza Hut voucher per ₹50k quarterly spend", value: 2000 },
      { label: "₹7,000 travel voucher on ₹5L annual spend", value: 3500 },
      { label: "Domestic + international lounge visits", value: 4000 },
    ],
    colorFrom: "#0f2027", colorTo: "#2c7a7b", sourceUrl: "https://www.sbicard.com", lastVerified: "2026-10",
    rules: [
      { label: "10X on dining, groceries, departmental stores & movies", categories: ["dining", "groceries", "entertainment"], rateType: "points", rate: 10, perAmount: 100 },
      { label: "Everything else", rateType: "points", rate: 2, perAmount: 100 },
    ],
  },
  {
    id: "irctc-sbi-rupay", bank: "SBI Card", name: "IRCTC RuPay", network: "RuPay", tier: "Entry",
    annualFee: 300, joiningFee: 500, feeWaiverSpend: null, forexMarkup: 3.5, pointValue: 1, rewardUnit: "Reward points",
    excludedCategories: NO_REWARDS,
    benefits: [{ label: "1% IRCTC transaction charge waiver", value: 200 }, { label: "Railway lounge visits", value: 500 }],
    colorFrom: "#1a1446", colorTo: "#2b6cb0", sourceUrl: "https://www.sbicard.com", lastVerified: "2026-10",
    rules: [
      { label: "IRCTC AC train tickets (10% value back)", merchants: ["IRCTC"], rateType: "points", rate: 10, perAmount: 100 },
      { label: "Everything else", rateType: "points", rate: 1, perAmount: 125 },
    ],
  },
  {
    id: "air-india-sbi-signature", bank: "SBI Card", name: "Air India Signature", network: "Visa", tier: "Premium",
    annualFee: 4999, joiningFee: 4999, feeWaiverSpend: null, forexMarkup: 3.5, pointValue: 0.5, rewardUnit: "Reward points",
    excludedCategories: NO_REWARDS,
    benefits: [{ label: "Welcome + milestone bonus points", value: 5000 }, { label: "Priority Pass international lounges", value: 4000 }],
    colorFrom: "#4a0d12", colorTo: "#d22630", sourceUrl: "https://www.sbicard.com", lastVerified: "2026-10",
    rules: [
      { label: "Air India tickets (website/app)", merchants: ["Air India"], rateType: "points", rate: 30, perAmount: 100 },
      { label: "Everything else", rateType: "points", rate: 4, perAmount: 100 },
    ],
  },

  // ───────────────────────────── ICICI Bank ─────────────────────────────
  {
    id: "amazon-icici", bank: "ICICI Bank", name: "Amazon Pay", network: "Visa", tier: "Entry",
    annualFee: 0, joiningFee: 0, feeWaiverSpend: null, forexMarkup: 1.99, pointValue: 1, rewardUnit: "Amazon Pay balance",
    excludedCategories: ["fuel", "wallet", "rent"],
    benefits: [{ label: "Lifetime free", value: 0 }],
    colorFrom: "#0f1111", colorTo: "#37475a", sourceUrl: "https://www.icicibank.com", lastVerified: "2026-10",
    rules: [
      { label: "Amazon (Prime)", merchants: ["Amazon"], rateType: "percent", rate: 5 },
      { label: "Amazon Pay partners", merchants: ["Swiggy", "BookMyShow", "Cleartrip", "Yatra"], rateType: "percent", rate: 2 },
      { label: "Everything else", rateType: "percent", rate: 1 },
    ],
  },
  {
    id: "icici-coral", bank: "ICICI Bank", name: "Coral", network: "Visa", tier: "Entry",
    annualFee: 500, joiningFee: 500, feeWaiverSpend: 150000, forexMarkup: 3.5, pointValue: 0.25, rewardUnit: "Reward points",
    excludedCategories: NO_REWARDS,
    benefits: [{ label: "BookMyShow buy-1-get-1 (₹100 off, 2x / month)", value: 1200 }, { label: "Domestic lounge visit per quarter (on spend)", value: 2000 }],
    colorFrom: "#5c1a1b", colorTo: "#f2715a", sourceUrl: "https://www.icicibank.com", lastVerified: "2026-10",
    rules: [
      { label: "Utilities & insurance", categories: ["utilities", "insurance"], rateType: "points", rate: 1, perAmount: 100 },
      { label: "Everything else", rateType: "points", rate: 2, perAmount: 100 },
    ],
  },
  {
    id: "icici-emeralde-private-metal", bank: "ICICI Bank", name: "Emeralde Private Metal", network: "Visa", tier: "Super Premium",
    annualFee: 12499, joiningFee: 12499, feeWaiverSpend: 1000000, forexMarkup: 2, pointValue: 1, rewardUnit: "Reward points",
    excludedCategories: NO_REWARDS,
    benefits: [
      { label: "Unlimited domestic + international lounge access", value: 15000 },
      { label: "Taj Epicure / EazyDiner Prime memberships", value: 3000 },
      { label: "Complimentary golf", value: 3000 },
    ],
    colorFrom: "#062a23", colorTo: "#2f8f6f", sourceUrl: "https://www.icicibank.com", lastVerified: "2026-10",
    rules: [
      { label: "Utilities, insurance & groceries (capped)", categories: ["utilities", "insurance", "groceries"], rateType: "points", rate: 6, perAmount: 200, capValue: 1000, capPeriod: "month", capGroup: "capped" },
      { label: "All other spends", rateType: "points", rate: 6, perAmount: 200 },
    ],
  },
  {
    id: "makemytrip-icici", bank: "ICICI Bank", name: "MakeMyTrip Signature", network: "Mastercard", tier: "Mid",
    annualFee: 2500, joiningFee: 2500, feeWaiverSpend: null, forexMarkup: 0.99, pointValue: 1, rewardUnit: "myCash",
    excludedCategories: NO_REWARDS,
    benefits: [{ label: "MMTBLACK membership + welcome voucher", value: 2500 }, { label: "Domestic + international lounge visits", value: 4000 }],
    colorFrom: "#0b1d3a", colorTo: "#e8432f", sourceUrl: "https://www.icicibank.com", lastVerified: "2026-10",
    rules: [
      { label: "MakeMyTrip hotels & flights (blended)", merchants: ["MakeMyTrip"], rateType: "percent", rate: 3 },
      { label: "Everything else", rateType: "percent", rate: 1 },
    ],
  },
  {
    id: "hpcl-super-saver-icici", bank: "ICICI Bank", name: "HPCL Super Saver", network: "Visa", tier: "Entry",
    annualFee: 500, joiningFee: 500, feeWaiverSpend: 150000, forexMarkup: 3.5, pointValue: 0.25, rewardUnit: "Reward points",
    excludedCategories: ["rent", "wallet", "government"],
    benefits: [{ label: "1% fuel surcharge waiver at HPCL", value: 500 }],
    colorFrom: "#0b2a5b", colorTo: "#d7262e", sourceUrl: "https://www.icicibank.com", lastVerified: "2026-10",
    rules: [
      { label: "HPCL fuel (4% back)", merchants: ["HPCL"], rateType: "points", rate: 16, perAmount: 100, capValue: 200, capPeriod: "month", capGroup: "hpcl" },
      { label: "Other fuel", categories: ["fuel"], rateType: "percent", rate: 0 },
      { label: "Utility bills", categories: ["utilities"], rateType: "points", rate: 20, perAmount: 100, capValue: 100, capPeriod: "month", capGroup: "bills" },
      { label: "Groceries & departmental stores", categories: ["groceries"], rateType: "points", rate: 20, perAmount: 100, capValue: 100, capPeriod: "month", capGroup: "grocery" },
      { label: "Everything else", rateType: "points", rate: 2, perAmount: 100 },
    ],
  },

  // ───────────────────────────── Axis Bank ─────────────────────────────
  {
    id: "flipkart-axis", bank: "Axis Bank", name: "Flipkart", network: "Mastercard", tier: "Entry",
    annualFee: 500, joiningFee: 500, feeWaiverSpend: 350000, forexMarkup: 3.5, pointValue: 1, rewardUnit: "Cashback",
    excludedCategories: STRICT,
    benefits: [{ label: "4 domestic lounge visits / yr", value: 2000 }],
    colorFrom: "#0b2a6f", colorTo: "#2874f0", sourceUrl: "https://www.axisbank.com", lastVerified: "2026-10",
    rules: [
      { label: "Flipkart", merchants: ["Flipkart"], rateType: "percent", rate: 5, capValue: 4000, capPeriod: "quarter", capGroup: "flipkart" },
      { label: "Myntra", merchants: ["Myntra"], rateType: "percent", rate: 7.5, capValue: 4000, capPeriod: "quarter", capGroup: "myntra" },
      { label: "Preferred partners", merchants: ["Swiggy", "Uber", "PVR", "Cult.fit"], rateType: "percent", rate: 4 },
      { label: "Everything else", rateType: "percent", rate: 1 },
    ],
  },
  {
    id: "airtel-axis", bank: "Axis Bank", name: "Airtel", network: "Mastercard", tier: "Entry",
    annualFee: 500, joiningFee: 500, feeWaiverSpend: 200000, forexMarkup: 3.5, pointValue: 1, rewardUnit: "Cashback",
    excludedCategories: NO_REWARDS.concat(["insurance", "education"]),
    benefits: [{ label: "4 domestic lounge visits / yr", value: 2000 }],
    colorFrom: "#141414", colorTo: "#e40000", sourceUrl: "https://www.axisbank.com", lastVerified: "2026-10",
    rules: [
      { label: "Airtel bills & recharges", merchants: ["Airtel"], rateType: "percent", rate: 25, capValue: 250, capPeriod: "month", capGroup: "airtel" },
      { label: "Utility bills via Airtel Thanks", categories: ["utilities"], rateType: "percent", rate: 10, capValue: 250, capPeriod: "month", capGroup: "utility" },
      { label: "Swiggy, Zomato & BigBasket", merchants: ["Swiggy", "Zomato", "BigBasket"], rateType: "percent", rate: 10, capValue: 500, capPeriod: "month", capGroup: "food" },
      { label: "Everything else", rateType: "percent", rate: 1 },
    ],
  },
  {
    id: "axis-atlas", bank: "Axis Bank", name: "Atlas", network: "Visa", tier: "Premium",
    annualFee: 5000, joiningFee: 5000, feeWaiverSpend: null, forexMarkup: 3.5, pointValue: 1, rewardUnit: "EDGE Miles",
    excludedCategories: STRICT,
    benefits: [{ label: "8 domestic + 4 international lounge visits", value: 10000 }],
    colorFrom: "#3a0a17", colorTo: "#9b2c3f", sourceUrl: "https://www.axisbank.com", lastVerified: "2026-10",
    rules: [
      { label: "Travel (airlines, hotels, OTAs)", categories: ["travel"], rateType: "points", rate: 5, perAmount: 100 },
      { label: "Everything else", rateType: "points", rate: 2, perAmount: 100 },
    ],
  },
  {
    id: "axis-magnus", bank: "Axis Bank", name: "Magnus", network: "Visa", tier: "Super Premium",
    annualFee: 12500, joiningFee: 12500, feeWaiverSpend: 2500000, forexMarkup: 2, pointValue: 0.4, rewardUnit: "EDGE Reward points",
    excludedCategories: STRICT,
    benefits: [{ label: "Unlimited domestic + international lounge access", value: 15000 }, { label: "Buy-1-get-1 movie tickets", value: 3000 }],
    colorFrom: "#1f0a10", colorTo: "#7d2a3a", sourceUrl: "https://www.axisbank.com", lastVerified: "2026-10",
    // Base tier; 35 RP/₹200 above ₹1.5L monthly spend not modelled. Value assumes 5:2 miles transfer.
    rules: [{ label: "All spends", rateType: "points", rate: 12, perAmount: 200 }],
  },
  {
    id: "axis-horizon", bank: "Axis Bank", name: "Horizon", network: "Visa", tier: "Premium",
    annualFee: 3000, joiningFee: 3000, feeWaiverSpend: null, forexMarkup: 3.5, pointValue: 1, rewardUnit: "EDGE Miles",
    excludedCategories: STRICT,
    benefits: [{ label: "Domestic + international lounge visits", value: 6000 }],
    colorFrom: "#10213d", colorTo: "#4d7cc4", sourceUrl: "https://www.axisbank.com", lastVerified: "2026-10",
    rules: [
      { label: "Airlines & Axis Travel EDGE", categories: ["travel"], rateType: "points", rate: 5, perAmount: 100 },
      { label: "Everything else", rateType: "points", rate: 2, perAmount: 100 },
    ],
  },
  {
    id: "indianoil-axis", bank: "Axis Bank", name: "IndianOil", network: "RuPay", tier: "Entry",
    annualFee: 500, joiningFee: 500, feeWaiverSpend: 50000, forexMarkup: 3.5, pointValue: 0.2, rewardUnit: "EDGE Reward points",
    excludedCategories: ["rent", "wallet", "government", "insurance", "education"],
    benefits: [{ label: "1% fuel surcharge waiver", value: 500 }],
    colorFrom: "#0f2459", colorTo: "#f58220", sourceUrl: "https://www.axisbank.com", lastVerified: "2026-10",
    rules: [
      { label: "IndianOil fuel (4% back)", merchants: ["Indian Oil"], rateType: "points", rate: 20, perAmount: 100, capValue: 200, capPeriod: "month", capGroup: "iocl" },
      { label: "Other fuel", categories: ["fuel"], rateType: "percent", rate: 0 },
      { label: "Online shopping (1% back)", channels: ["online"], rateType: "points", rate: 5, perAmount: 100 },
      { label: "Everything else", rateType: "points", rate: 1, perAmount: 100 },
    ],
  },

  // ───────────────────────────── IDFC FIRST Bank ─────────────────────────────
  {
    id: "idfc-first-millennia", bank: "IDFC FIRST Bank", name: "Millennia", network: "Visa", tier: "Entry",
    annualFee: 0, joiningFee: 0, feeWaiverSpend: null, forexMarkup: 3.5, pointValue: 0.25, rewardUnit: "Reward points",
    excludedCategories: NO_REWARDS.concat(["insurance"]),
    benefits: [{ label: "Lifetime free", value: 0 }, { label: "Railway lounge visits", value: 500 }],
    colorFrom: "#3b0a0a", colorTo: "#9c1d27", sourceUrl: "https://www.idfcfirstbank.com", lastVerified: "2026-10",
    // 3X up to ₹20k/month, 10X above: approximated as a blended ~5X.
    rules: [
      { label: "Utility bills (1X)", categories: ["utilities"], rateType: "points", rate: 1, perAmount: 150 },
      { label: "All spends (blended 3X/10X)", rateType: "points", rate: 5, perAmount: 150 },
    ],
  },
  {
    id: "idfc-first-wealth", bank: "IDFC FIRST Bank", name: "Wealth", network: "Visa", tier: "Premium",
    annualFee: 0, joiningFee: 0, feeWaiverSpend: null, forexMarkup: 1.5, pointValue: 0.25, rewardUnit: "Reward points",
    excludedCategories: NO_REWARDS.concat(["insurance"]),
    benefits: [
      { label: "Lifetime free", value: 0 },
      { label: "Domestic + international lounge visits", value: 6000 },
      { label: "Complimentary golf", value: 2000 },
    ],
    colorFrom: "#141414", colorTo: "#7a1f2b", sourceUrl: "https://www.idfcfirstbank.com", lastVerified: "2026-10",
    // 3X up to ₹20k/month, 10X above: approximated as a blended ~6X.
    rules: [
      { label: "Utility bills (1X)", categories: ["utilities"], rateType: "points", rate: 1, perAmount: 150 },
      { label: "All spends (blended 3X/10X)", rateType: "points", rate: 6, perAmount: 150 },
    ],
  },

  // ───────────────────────────── Kotak Mahindra Bank ─────────────────────────────
  {
    id: "myntra-kotak", bank: "Kotak Mahindra Bank", name: "Myntra", network: "Mastercard", tier: "Entry",
    annualFee: 500, joiningFee: 500, feeWaiverSpend: 200000, forexMarkup: 3.5, pointValue: 1, rewardUnit: "Cashback",
    excludedCategories: STRICT,
    benefits: [{ label: "Myntra Insider + ₹500 Myntra voucher", value: 500 }],
    colorFrom: "#3a0d2e", colorTo: "#ff3f6c", sourceUrl: "https://www.kotak.com", lastVerified: "2026-10",
    rules: [
      { label: "Myntra", merchants: ["Myntra"], rateType: "percent", rate: 7.5, capValue: 750, capPeriod: "month", capGroup: "myntra" },
      { label: "Swiggy, PVR & Cult.fit", merchants: ["Swiggy", "PVR", "Cult.fit"], rateType: "percent", rate: 5, capValue: 1000, capPeriod: "month", capGroup: "partners" },
      { label: "Everything else", rateType: "percent", rate: 1.25 },
    ],
  },
  {
    id: "kotak-league-platinum", bank: "Kotak Mahindra Bank", name: "League Platinum", network: "Visa", tier: "Entry",
    annualFee: 499, joiningFee: 499, feeWaiverSpend: 50000, forexMarkup: 3.5, pointValue: 0.2, rewardUnit: "Reward points",
    excludedCategories: NO_REWARDS,
    benefits: [{ label: "10,000 bonus points per ₹1L half-yearly spend", value: 2000 }],
    colorFrom: "#0a1a3f", colorTo: "#e3263b", sourceUrl: "https://www.kotak.com", lastVerified: "2026-10",
    rules: [{ label: "All spends", rateType: "points", rate: 8, perAmount: 150 }],
  },

  // ───────────────────────────── AU Small Finance Bank ─────────────────────────────
  {
    id: "au-altura-plus", bank: "AU Small Finance Bank", name: "Altura Plus", network: "Visa", tier: "Entry",
    annualFee: 499, joiningFee: 499, feeWaiverSpend: 80000, forexMarkup: 3.5, pointValue: 0.25, rewardUnit: "Reward points",
    excludedCategories: NO_REWARDS,
    benefits: [{ label: "4 railway lounge visits / yr", value: 500 }],
    colorFrom: "#3d1a00", colorTo: "#f28c28", sourceUrl: "https://www.aubank.in", lastVerified: "2026-10",
    rules: [
      { label: "In-store spends (1.5% cashback)", channels: ["offline"], rateType: "points", rate: 6, perAmount: 100, capValue: 100, capPeriod: "month", capGroup: "pos" },
      { label: "Everything else", rateType: "points", rate: 2, perAmount: 100 },
    ],
  },

  // ───────────────────────────── RBL Bank ─────────────────────────────
  {
    id: "rbl-world-safari", bank: "RBL Bank", name: "World Safari", network: "Mastercard", tier: "Premium",
    annualFee: 3000, joiningFee: 3000, feeWaiverSpend: 500000, forexMarkup: 0, pointValue: 0.25, rewardUnit: "Travel points",
    excludedCategories: STRICT,
    benefits: [{ label: "Zero forex markup", value: 0 }, { label: "MakeMyTrip voucher on joining", value: 3000 }, { label: "Domestic + international lounge visits", value: 4000 }],
    colorFrom: "#10302a", colorTo: "#b08d57", sourceUrl: "https://www.rblbank.com", lastVerified: "2026-10",
    rules: [
      { label: "Travel", categories: ["travel"], rateType: "points", rate: 5, perAmount: 100 },
      { label: "Everything else", rateType: "points", rate: 2, perAmount: 100 },
    ],
  },

  // ───────────────────────────── Yes Bank ─────────────────────────────
  {
    id: "yes-marquee", bank: "Yes Bank", name: "Marquee", network: "Mastercard", tier: "Super Premium",
    annualFee: 9999, joiningFee: 9999, feeWaiverSpend: 1000000, forexMarkup: 1, pointValue: 0.25, rewardUnit: "Reward points",
    excludedCategories: STRICT,
    benefits: [{ label: "Unlimited domestic + international lounge access", value: 10000 }, { label: "Buy-1-get-1 movie tickets", value: 3000 }],
    colorFrom: "#0a0a14", colorTo: "#3b4a8c", sourceUrl: "https://www.yesbank.in", lastVerified: "2026-10",
    rules: [
      { label: "Online spends", channels: ["online"], rateType: "points", rate: 36, perAmount: 200 },
      { label: "Offline & international spends", rateType: "points", rate: 18, perAmount: 200 },
    ],
  },

  // ───────────────────────────── American Express ─────────────────────────────
  {
    id: "amex-mrcc", bank: "American Express", name: "Membership Rewards", network: "Amex", tier: "Mid",
    annualFee: 1500, joiningFee: 1000, feeWaiverSpend: 150000, forexMarkup: 3.5, pointValue: 0.5, rewardUnit: "MR points",
    excludedCategories: ["fuel", "utilities", "insurance", "rent", "wallet", "government"],
    benefits: [{ label: "Monthly 1,000-point bonus (4 txns of ₹1,500)", value: 6000 }],
    colorFrom: "#0b4f8a", colorTo: "#5aa9e6", sourceUrl: "https://www.americanexpress.com/in", lastVerified: "2026-10",
    rules: [{ label: "All spends", rateType: "points", rate: 1, perAmount: 50 }],
  },
  {
    id: "amex-smartearn", bank: "American Express", name: "SmartEarn", network: "Amex", tier: "Entry",
    annualFee: 495, joiningFee: 495, feeWaiverSpend: 40000, forexMarkup: 3.5, pointValue: 0.25, rewardUnit: "MR points",
    excludedCategories: ["fuel", "utilities", "insurance", "rent", "wallet", "government"],
    benefits: [{ label: "₹500 Amazon voucher on ₹10k in first 90 days", value: 0 }],
    colorFrom: "#0a3d62", colorTo: "#3fa7d6", sourceUrl: "https://www.americanexpress.com/in", lastVerified: "2026-10",
    rules: [
      { label: "10X at Flipkart & Uber", merchants: ["Flipkart", "Uber"], rateType: "points", rate: 10, perAmount: 50, capValue: 500, capPeriod: "month", capGroup: "x10" },
      { label: "5X at Amazon, Swiggy & Zomato", merchants: ["Amazon", "Swiggy", "Zomato"], rateType: "points", rate: 5, perAmount: 50, capValue: 250, capPeriod: "month", capGroup: "x5" },
      { label: "Everything else", rateType: "points", rate: 1, perAmount: 50 },
    ],
  },
  {
    id: "amex-platinum-travel", bank: "American Express", name: "Platinum Travel", network: "Amex", tier: "Premium",
    annualFee: 5000, joiningFee: 3500, feeWaiverSpend: null, forexMarkup: 3.5, pointValue: 0.5, rewardUnit: "MR points",
    excludedCategories: ["fuel", "utilities", "insurance", "rent", "wallet", "government"],
    benefits: [
      { label: "Milestone MR points (₹1.9L & ₹4L)", value: 8750 },
      { label: "₹10,000 Taj voucher on ₹4L spend", value: 10000 },
      { label: "8 domestic lounge visits / yr", value: 4000 },
    ],
    colorFrom: "#2b2d33", colorTo: "#a7adb7", sourceUrl: "https://www.americanexpress.com/in", lastVerified: "2026-10",
    rules: [{ label: "All spends", rateType: "points", rate: 1, perAmount: 50 }],
  },
  {
    id: "amex-gold-charge", bank: "American Express", name: "Gold Charge", network: "Amex", tier: "Premium",
    annualFee: 4500, joiningFee: 1000, feeWaiverSpend: null, forexMarkup: 3.5, pointValue: 0.5, rewardUnit: "MR points",
    excludedCategories: ["fuel", "utilities", "insurance", "rent", "wallet", "government"],
    benefits: [{ label: "Monthly 1,000-point bonus (6 txns of ₹1,000)", value: 6000 }],
    colorFrom: "#3d2b0a", colorTo: "#d4a843", sourceUrl: "https://www.americanexpress.com/in", lastVerified: "2026-10",
    rules: [{ label: "All spends", rateType: "points", rate: 1, perAmount: 50 }],
  },

  // ───────────────────────────── HSBC ─────────────────────────────
  {
    id: "hsbc-live-plus", bank: "HSBC", name: "Live+", network: "Visa", tier: "Mid",
    annualFee: 999, joiningFee: 999, feeWaiverSpend: 200000, forexMarkup: 3.5, pointValue: 1, rewardUnit: "Cashback",
    excludedCategories: STRICT,
    benefits: [{ label: "4 domestic lounge visits / yr", value: 2000 }],
    colorFrom: "#1c1c1c", colorTo: "#b3000f", sourceUrl: "https://www.hsbc.co.in", lastVerified: "2026-10",
    rules: [
      { label: "Dining, groceries & food delivery", categories: ["dining", "groceries", "food_delivery"], rateType: "percent", rate: 10, capValue: 1000, capPeriod: "month", capGroup: "live" },
      { label: "Everything else", rateType: "percent", rate: 1.5 },
    ],
  },
  {
    id: "hsbc-travelone", bank: "HSBC", name: "TravelOne", network: "Mastercard", tier: "Premium",
    annualFee: 4999, joiningFee: 4999, feeWaiverSpend: 800000, forexMarkup: 3.5, pointValue: 0.5, rewardUnit: "Reward points",
    excludedCategories: STRICT,
    benefits: [{ label: "Domestic + international lounge visits", value: 6000 }, { label: "Welcome travel vouchers", value: 2000 }],
    colorFrom: "#0d1b2a", colorTo: "#3a6ea5", sourceUrl: "https://www.hsbc.co.in", lastVerified: "2026-10",
    rules: [
      { label: "Flights, hotels & travel agencies", categories: ["travel"], rateType: "points", rate: 4, perAmount: 100 },
      { label: "Everything else", rateType: "points", rate: 2, perAmount: 100 },
    ],
  },

  // ───────────────────────────── Standard Chartered ─────────────────────────────
  {
    id: "sc-smart", bank: "Standard Chartered", name: "Smart", network: "Visa", tier: "Entry",
    annualFee: 499, joiningFee: 499, feeWaiverSpend: 120000, forexMarkup: 3.5, pointValue: 1, rewardUnit: "Cashback",
    excludedCategories: STRICT,
    benefits: [{ label: "Low-cost EMI conversions", value: 0 }],
    colorFrom: "#003b5c", colorTo: "#38d430", sourceUrl: "https://www.sc.com/in", lastVerified: "2026-10",
    rules: [
      { label: "Online spends", channels: ["online"], rateType: "percent", rate: 2, capValue: 1000, capPeriod: "month", capGroup: "online" },
      { label: "Everything else", rateType: "percent", rate: 1, capValue: 500, capPeriod: "month", capGroup: "offline" },
    ],
  },
  {
    id: "sc-ultimate", bank: "Standard Chartered", name: "Ultimate", network: "Visa", tier: "Premium",
    annualFee: 5000, joiningFee: 5000, feeWaiverSpend: null, forexMarkup: 2, pointValue: 1, rewardUnit: "Reward points",
    excludedCategories: STRICT,
    benefits: [{ label: "Lifestyle vouchers worth ₹5,000 on joining/renewal", value: 5000 }, { label: "International lounge visits", value: 4000 }],
    colorFrom: "#0b0f1a", colorTo: "#4a5a7a", sourceUrl: "https://www.sc.com/in", lastVerified: "2026-10",
    rules: [{ label: "All spends", rateType: "points", rate: 5, perAmount: 150 }],
  },

  // ───────────────────────────── Fintech / co-branded ─────────────────────────────
  {
    id: "scapia-federal", bank: "Federal Bank", name: "Scapia", network: "Visa", tier: "Entry",
    annualFee: 0, joiningFee: 0, feeWaiverSpend: null, forexMarkup: 0, pointValue: 0.2, rewardUnit: "Scapia coins",
    excludedCategories: STRICT,
    benefits: [{ label: "Zero forex markup", value: 0 }, { label: "Unlimited domestic lounge (on ₹20k/mo spend)", value: 3000 }],
    colorFrom: "#0c3b2e", colorTo: "#36b37e", sourceUrl: "https://scapia.cards", lastVerified: "2026-10",
    rules: [{ label: "All spends (redeemed for travel)", rateType: "points", rate: 10, perAmount: 100 }],
  },
  {
    id: "onecard", bank: "OneCard", name: "OneCard Metal", network: "Visa", tier: "Entry",
    annualFee: 0, joiningFee: 0, feeWaiverSpend: null, forexMarkup: 1, pointValue: 0.1, rewardUnit: "Reward points",
    excludedCategories: NO_REWARDS,
    benefits: [{ label: "Lifetime free metal card", value: 0 }],
    colorFrom: "#0a0a0a", colorTo: "#5b5f66", sourceUrl: "https://www.getonecard.app", lastVerified: "2026-10",
    // 5X auto-applies to your top 2 categories each month; approximated as shopping & food delivery.
    rules: [
      { label: "5X on top-2 categories (shopping, food delivery)", categories: ["shopping", "food_delivery"], rateType: "points", rate: 5, perAmount: 50 },
      { label: "Everything else", rateType: "points", rate: 1, perAmount: 50 },
    ],
  },
];


export const CATALOG: CatalogCard[] = [...new Map([...BASE, ...EXTRA_CARDS].map((c) => [c.id, c])).values()];

export const CATALOG_MAP = Object.fromEntries(CATALOG.map((c) => [c.id, c])) as Record<string, CatalogCard>;
