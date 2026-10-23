// Pure CSV-import helpers shared by the import modal (client) and importExpenses (server).
// No DB or framework imports so they can be unit tested in isolation.
// Relative imports (not "@/") so Vitest can load this without a path-alias config.
import { CATEGORIES, CATEGORY_MAP, MERCHANTS } from "../../../data/categories";
import type { Channel } from "../../../engine/types";
import { categorize, isRewardCredit, normalizeDescriptor, prettifyDescriptor, type CategorizeResult } from "../../../lib/categorize";

export const IMPORT_MAX_ROWS = 5000;

/** Fields the server accepts (one already-resolved expense per row). */
export const IMPORT_FIELDS = ["date", "amount", "category", "subcategory", "merchant", "channel", "card", "note"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Everything we can read from a CSV, including raw bank statement columns. Resolved client-side into ImportFields. */
export const STATEMENT_FIELDS = [
  "date", "description", "merchant", "amount", "debit", "credit", "drcr", "category", "subcategory", "channel", "card", "mcc", "currency", "note",
] as const;
export type StatementField = (typeof STATEMENT_FIELDS)[number];
export type ColumnMapping = Record<StatementField, string | null>;

/** One CSV row mapped to our fields, still as raw strings. */
export type RawImportRow = Partial<Record<ImportField, string>>;

// Exact header names, in priority order (first synonym present in the file wins).
const SYNONYMS: Record<StatementField, string[]> = {
  date: ["date", "txn date", "transaction date", "tran date", "posting date", "post date", "value date", "day", "date time", "transaction date time"],
  description: [
    "transaction details", "narration", "description", "particulars", "details", "transaction description",
    "transaction narration", "transaction remarks", "remarks", "merchant details",
  ],
  merchant: ["merchant", "merchant name", "payee", "payee name", "store", "vendor", "counterparty", "to"],
  amount: ["amount", "amt", "amount inr", "amount in rs", "amount rs", "transaction amount", "txn amount", "billing amount", "value", "spend", "inr", "price", "total"],
  debit: ["debit", "debit amount", "debit amt", "debit inr", "withdrawal", "withdrawal amt", "withdrawal amount", "withdrawals", "dr amount", "dr"],
  credit: ["credit", "credit amount", "credit amt", "credit inr", "deposit", "deposit amt", "deposit amount", "deposits", "cr amount", "cr"],
  drcr: ["dr/cr", "cr/dr", "dr / cr", "debit/credit", "debit / credit", "credit/debit", "dr cr", "d/c", "c/d", "txn type", "transaction type", "type", "indicator"],
  category: ["category", "cat", "tag", "tags", "label", "labels", "type of spend", "spend category"],
  subcategory: ["subcategory", "sub category", "sub-category", "subcat", "sub tag"],
  channel: ["channel", "mode", "online/offline", "medium"],
  card: ["card", "card used", "card last4", "last4", "last 4", "card number", "card no", "account", "account name", "account number", "source"],
  mcc: ["mcc", "merchant category code", "mcc code"],
  currency: ["currency", "txn currency", "transaction currency", "original currency", "ccy"],
  note: ["note", "notes", "memo", "comment", "comments", "remarks"],
};

// Loose fallbacks when no exact header matched: header contains this word.
const CONTAINS: Partial<Record<StatementField, string[]>> = {
  date: ["date"],
  description: ["narration", "description", "particular", "details"],
  amount: ["amount", "amt"],
  debit: ["debit", "withdrawal"],
  credit: ["credit", "deposit"],
  currency: ["currency"],
};

const normHeader = (h: string) => h.trim().toLowerCase().replace(/[()_.:#]+/g, " ").replace(/\s+/g, " ").trim();

/** Maps each field to a CSV header (or null). */
export function detectColumns(headers: string[]): ColumnMapping {
  const out = {} as ColumnMapping;
  const used = new Set<string>();
  const norm = new Map(headers.map((h) => [h, normHeader(h)]));
  for (const field of STATEMENT_FIELDS) {
    let hit: string | undefined;
    for (const syn of SYNONYMS[field]) {
      hit = headers.find((h) => !used.has(h) && norm.get(h) === syn);
      if (hit) break;
    }
    out[field] = hit ?? null;
    if (hit) used.add(hit);
  }
  for (const field of STATEMENT_FIELDS) {
    if (out[field] || !CONTAINS[field]) continue;
    const hit = headers.find((h) => !used.has(h) && CONTAINS[field]!.some((w) => norm.get(h)!.includes(w)));
    if (hit) {
      out[field] = hit;
      used.add(hit);
    }
  }
  // A lone Debit column is the amount.
  if (!out.amount && out.debit && !out.credit) [out.amount, out.debit] = [out.debit, null];
  return out;
}

/** Plain mapping for the simple template (server contract). */
export function applyMapping(row: Record<string, string>, mapping: Partial<Record<ImportField, string | null>>): RawImportRow {
  const out: RawImportRow = {};
  for (const field of IMPORT_FIELDS) {
    const col = mapping[field];
    if (col && row[col] != null) out[field] = String(row[col]);
  }
  return out;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/**
 * Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YY, DD.MM.YYYY (Indian order), DD-MMM-YY, DD MMM YYYY, MMM DD, YYYY,
 * optionally followed by a time. Falls back to anything Date can parse.
 */
export function parseDate(input: string | undefined): Date | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let match: RegExpMatchArray | null;
  if ((match = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[ T,])/))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:$|[ T,])/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[-/ .]?([A-Za-z]{3,9})[-/ .,]+(\d{2,4})(?:$|[ T,])/))) {
    const mon = MONTHS[match[2].toLowerCase().slice(0, match[2].toLowerCase().startsWith("sept") ? 4 : 3)];
    if (!mon) return null;
    [d, m, y] = [Number(match[1]), mon, Number(match[3])];
  } else if ((match = s.match(/^([A-Za-z]{3,9})[ .-](\d{1,2}),?[ -](\d{4})(?:$|[ T,])/))) {
    const mon = MONTHS[match[1].toLowerCase().slice(0, 3)];
    if (!mon) return null;
    [d, m, y] = [Number(match[2]), mon, Number(match[3])];
  } else {
    const t = Date.parse(s);
    if (Number.isNaN(t)) return null;
    const dt = new Date(t);
    [y, m, d] = [dt.getFullYear(), dt.getMonth() + 1, dt.getDate()];
  }
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const date = new Date(y, m - 1, d, 12);
  // Reject rollovers like 31/02.
  if (date.getMonth() !== m - 1) return null;
  return date;
}

/** "₹1,23,456.50", "Rs. 500", "1200" → number; null when not a positive amount. */
export function parseAmount(input: string | undefined): number | null {
  const s = (input ?? "").replace(/(₹|rs\.?|inr|,|\s)/gi, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Statement amounts: "1,234.50", "-1,234.50", "(1,234.50)", "1,234.50 Cr", "Dr 500", "USD 15.49".
 * Returns the absolute value, its sign and an explicit Dr/Cr marker when present.
 */
export function parseStatementAmount(input: string | undefined): { value: number; negative: boolean; credit: boolean | null } | null {
  let s = (input ?? "").trim().toUpperCase();
  if (!s) return null;
  let credit: boolean | null = null;
  if (/\bCR\.?$|^CR\b/.test(s)) credit = true;
  else if (/\bDR\.?$|^DR\b/.test(s)) credit = false;
  const negative = /^\(.*\)$/.test(s) || /-\s*[\d.]/.test(s) || /[\d.]\s*-$/.test(s);
  s = s.replace(/[^\d.]/g, "");
  const n = Number(s);
  if (!s || !Number.isFinite(n) || n <= 0) return null;
  return { value: Math.round(n * 100) / 100, negative, credit };
}

/** "Cr", "CREDIT", "C" → credit; "Dr", "DEBIT", "D" → debit; anything else (e.g. "UPI") → null. */
export function parseDrCr(input: string | undefined): "credit" | "debit" | null {
  const s = (input ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (["cr", "c", "credit", "credited", "refund", "reversal", "payment"].includes(s)) return "credit";
  if (["dr", "d", "debit", "debited", "purchase", "spend", "expense", "withdrawal"].includes(s)) return "debit";
  return null;
}

// Credits that sometimes arrive without any sign or Dr/Cr marker.
const CREDIT_TEXT_RE = /\b(PAYMENT RECEIVED|PAYMENT - THANK YOU|THANK YOU FOR (?:YOUR )?PAYMENT|PAYMENT THANK YOU|REFUND|REVERSAL|CASHBACK|CASH BACK|REWARDS? REDEMPTION|AUTOPAY PAYMENT|BBPS PAYMENT RECEIVED|NEFT CR|IMPS CR)\b/i;

const merchantDef = (merchant: string | undefined) => {
  const m = (merchant ?? "").trim().toLowerCase();
  return m ? MERCHANTS.find((x) => x.name.toLowerCase() === m) : undefined;
};

// Tags from apps like Fold, Walnut, Money Manager and bank exports → our keys.
const CATEGORY_SYNONYMS: Record<string, string> = {
  grocery: "groceries", groceries: "groceries", supermarket: "groceries", "daily needs": "groceries", household: "groceries", essentials: "groceries",
  food: "dining", "food dining": "dining", "food and dining": "dining", dining: "dining", restaurant: "dining", restaurants: "dining", eating_out: "dining", "eating out": "dining", cafe: "dining", drinks: "dining",
  "food delivery": "food_delivery", delivery: "food_delivery", "online food": "food_delivery", takeaway: "food_delivery",
  shopping: "shopping", clothing: "shopping", apparel: "shopping", fashion: "shopping", electronics: "shopping", gadgets: "shopping", "personal care": "shopping", gifts: "shopping", beauty: "shopping",
  travel: "travel", transport: "travel", transportation: "travel", commute: "travel", cab: "travel", cabs: "travel", taxi: "travel", flights: "travel", flight: "travel", hotel: "travel", hotels: "travel", vacation: "travel", holiday: "travel", trip: "travel",
  fuel: "fuel", petrol: "fuel", diesel: "fuel", "fuel petrol": "fuel", automobile: "fuel", vehicle: "fuel",
  bills: "utilities", bill: "utilities", utilities: "utilities", utility: "utilities", "bills utilities": "utilities", "bills and utilities": "utilities", recharge: "utilities", "mobile recharge": "utilities", electricity: "utilities", internet: "utilities", phone: "utilities", subscriptions: "utilities", subscription: "utilities",
  entertainment: "entertainment", movies: "entertainment", movie: "entertainment", ott: "entertainment", streaming: "entertainment", games: "entertainment", gaming: "entertainment", fun: "entertainment", leisure: "entertainment",
  health: "health", medical: "health", medicine: "health", medicines: "health", pharmacy: "health", healthcare: "health", fitness: "health", gym: "health", wellness: "health", doctor: "health",
  rent: "rent", housing: "rent", "house rent": "rent",
  insurance: "insurance",
  education: "education", fees: "education", school: "education", learning: "education", courses: "education",
  wallet: "wallet", "wallet load": "wallet", "wallet topup": "wallet", "add money": "wallet",
  tax: "government", taxes: "government", government: "government", govt: "government", "govt tax": "government",
  other: "other", others: "other", misc: "other", miscellaneous: "other", general: "other",
};

/** Category key from a key, label or common app tag (case-insensitive). null when unrecognised ("Personal", "Untagged"). */
export function categoryFromTag(input: string | undefined): string | null {
  const s = (input ?? "").trim().toLowerCase();
  if (!s) return null;
  const key = s.replace(/[\s&-]+/g, "_");
  if (CATEGORY_MAP[key]) return key;
  const byLabel = CATEGORIES.find((c) => c.label.toLowerCase() === s);
  if (byLabel) return byLabel.key;
  const plain = s.replace(/[&/,_-]+/g, " ").replace(/\s+/g, " ").trim();
  return CATEGORY_SYNONYMS[plain] ?? CATEGORY_SYNONYMS[plain.replace(/ and /g, " ")] ?? null;
}

/**
 * Category for an imported row: a valid key/label/tag wins, then the known merchant's category,
 * then the categoriser on the merchant text, then "other".
 */
export function normCategory(input: string | undefined, merchant?: string): string {
  const tag = categoryFromTag(input);
  if (tag) return tag;
  const known = merchantDef(merchant);
  if (known) return known.category;
  if (merchant?.trim()) {
    const auto = categorize({ description: merchant });
    if (auto.confidence !== "low") return auto.category;
  }
  return "other";
}

export function normChannel(input: string | undefined, category: string, merchant?: string): Channel {
  const s = (input ?? "").trim().toLowerCase();
  if (s.startsWith("on")) return "online";
  if (s.startsWith("off") || s === "pos" || s === "in-store" || s === "store") return "offline";
  if (s.startsWith("int") || s === "foreign" || s === "forex") return "international";
  return merchantDef(merchant)?.channel ?? CATEGORY_MAP[category]?.defaultChannel ?? "offline";
}

export interface MatchableCard {
  id: string;
  bank: string;
  name: string;
  nickname: string | null;
  last4: string | null;
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const bankWord = (bank: string) => squash(bank.replace(/\s+(bank|card|banking corporation)$/i, ""));

/**
 * Finds the user's card from a free-text CSV value: the card id, last 4 digits (also "XX1188", "HDFC Credit Card XX1188"),
 * nickname, "bank name", just the product name, or a bank name when the user has only one card from that bank.
 * Case-insensitive. null = no match.
 */
export function matchCard(value: string | undefined, cards: MatchableCard[]): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const byId = cards.find((c) => c.id === raw);
  if (byId) return byId.id;
  const digits = raw.match(/(\d{4})\D*$/);
  if (digits) {
    const hit = cards.find((c) => c.last4 && c.last4 === digits[1]);
    if (hit) return hit.id;
  }
  const v = squash(raw);
  if (!v) return null;
  const tests: ((c: MatchableCard) => boolean)[] = [
    (c) => !!c.nickname && squash(c.nickname) === v,
    (c) => squash(`${c.bank} ${c.name}`) === v,
    (c) => squash(c.name) === v,
    // "HDFC Millennia" vs bank "HDFC Bank": drop a trailing "bank"/"card" word from the bank.
    (c) => squash(`${c.bank.replace(/\s+(bank|card)$/i, "")} ${c.name}`) === v,
    // "HDFC Millennia Credit Card" or "Axis Ace card": contains bank and product name.
    (c) => v.includes(bankWord(c.bank)) && squash(c.name).length >= 3 && v.includes(squash(c.name)),
  ];
  for (const t of tests) {
    const hit = cards.find(t);
    if (hit) return hit.id;
  }
  // "HDFC Credit Card": only safe when exactly one of the user's cards is from that bank.
  const sameBank = cards.filter((c) => bankWord(c.bank).length >= 2 && v.startsWith(bankWord(c.bank)));
  return sameBank.length === 1 ? sameBank[0].id : null;
}

export interface NormalizedRow {
  amount: number;
  date: Date;
  category: string;
  subcategory: string | null;
  merchant: string | null;
  channel: Channel;
  note: string | null;
  userCardId: string | null;
  /** Card text was given but didn't match any of the user's cards. */
  cardUnmatched: boolean;
}

const clip = (s: string | undefined, max: number) => {
  const t = (s ?? "").trim();
  return t ? t.slice(0, max) : null;
};

/** Validates and normalises one mapped row. */
export function normalizeRow(row: RawImportRow, cards: MatchableCard[]): { row: NormalizedRow } | { error: string } {
  const amount = parseAmount(row.amount);
  if (amount == null) return { error: `invalid amount "${row.amount ?? ""}"` };
  if (amount > 1e8) return { error: "amount too large" };
  const date = parseDate(row.date);
  if (!date) return { error: `invalid date "${row.date ?? ""}"` };
  const merchant = clip(row.merchant, 80);
  const category = normCategory(row.category, merchant ?? undefined);
  const channel = normChannel(row.channel, category, merchant ?? undefined);
  const userCardId = matchCard(row.card, cards);
  return {
    row: {
      amount, date, category, channel, merchant, userCardId,
      subcategory: clip(row.subcategory, 60),
      note: clip(row.note, 280),
      cardUnmatched: !!(row.card ?? "").trim() && !userCardId,
    },
  };
}

export interface NormalizedCredit {
  amount: number;
  date: Date;
  note: string | null;
  userCardId: string | null;
  cardUnmatched: boolean;
}

/** Validates one imported cashback credit row (date, amount, card, note). */
export function normalizeCredit(row: RawImportRow, cards: MatchableCard[]): { row: NormalizedCredit } | { error: string } {
  const amount = parseAmount(row.amount);
  if (amount == null) return { error: `invalid amount "${row.amount ?? ""}"` };
  if (amount > 1e7) return { error: "amount too large" };
  const date = parseDate(row.date);
  if (!date) return { error: `invalid date "${row.date ?? ""}"` };
  const userCardId = matchCard(row.card, cards);
  return { row: { amount, date, userCardId, note: clip(row.note, 280), cardUnmatched: !!(row.card ?? "").trim() && !userCardId } };
}

/** Same local day + amount (paise) + card: one cashback credit per key. */
export function creditKey(c: { date: Date | string; amount: number; userCardId: string | null }) {
  const d = new Date(c.date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}|${Math.round(c.amount * 100)}|${c.userCardId ?? ""}`;
}

/* ---------- Raw bank statements ---------- */

export interface StatementOptions {
  /** Use this card id for every row (a statement belongs to one card). Empty = use the card column. */
  cardId?: string;
  /** Single signed amount column where purchases are negative (bank-account style). */
  negativeIsDebit?: boolean;
}

/** Auto-categorisation details for the preview. */
export interface AutoInfo extends CategorizeResult {
  /** Rows with the same key are "similar" (same merchant or same cleaned descriptor). */
  key: string;
}

export type StatementRow =
  | { kind: "credit" | "charge"; descriptor: string }
  /** Cashback / redeemed rewards credited by the bank: saved as a reward received, not an expense. */
  | { kind: "reward"; row: RawImportRow; descriptor: string }
  | { kind: "expense"; row: RawImportRow; descriptor: string; auto: AutoInfo | null };

/**
 * For a single amount column without Dr/Cr markers: are purchases the negative numbers?
 * Card exports usually list purchases as positive and payments as negative; bank-account style exports the reverse.
 */
export function detectNegativeIsDebit(rows: Record<string, string>[], mapping: ColumnMapping): boolean {
  if (!mapping.amount || mapping.debit || mapping.credit || mapping.drcr) return false;
  let neg = 0;
  let pos = 0;
  for (const r of rows) {
    const a = parseStatementAmount(r[mapping.amount]);
    if (!a || a.credit != null) continue;
    if (a.negative) neg++;
    else pos++;
  }
  return neg > pos;
}

const cell = (row: Record<string, string>, col: string | null) => (col && row[col] != null ? String(row[col]).trim() : "");

/** Turns one raw CSV row into an importable expense, or marks it as a credit / card charge to skip. */
export function resolveStatementRow(raw: Record<string, string>, mapping: ColumnMapping, opts: StatementOptions = {}): StatementRow {
  const description = cell(raw, mapping.description);
  const merchantCol = cell(raw, mapping.merchant);
  const text = description || merchantCol;
  const descriptor = text;

  // Direction and amount
  let amount = "";
  let isCredit = false;
  const debit = parseStatementAmount(cell(raw, mapping.debit));
  const credit = parseStatementAmount(cell(raw, mapping.credit));
  if (debit) amount = String(debit.value);
  else if (credit) {
    isCredit = true;
    amount = String(credit.value);
  }
  else {
    const amtText = cell(raw, mapping.amount);
    const a = parseStatementAmount(amtText);
    const flag = parseDrCr(cell(raw, mapping.drcr));
    if (a) {
      amount = String(a.value);
      if (flag) isCredit = flag === "credit";
      else if (a.credit != null) isCredit = a.credit;
      else isCredit = (a.negative !== !!opts.negativeIsDebit) || (!a.negative && !opts.negativeIsDebit && (CREDIT_TEXT_RE.test(text) || isRewardCredit(text)));
    } else {
      amount = amtText; // invalid; normalizeRow reports it
    }
  }
  if (isCredit) {
    if (!isRewardCredit(text)) return { kind: "credit", descriptor };
    return {
      kind: "reward",
      descriptor,
      row: { date: cell(raw, mapping.date), amount, card: opts.cardId || cell(raw, mapping.card) || undefined, note: text || undefined },
    };
  }

  const tag = cell(raw, mapping.category);
  const tagKey = categoryFromTag(tag);
  const result = text ? categorize({ description: text, mcc: cell(raw, mapping.mcc), currency: cell(raw, mapping.currency) }) : null;
  if (result?.charge) return { kind: "charge", descriptor };

  const merchant = merchantCol && !description ? (result?.merchant ?? merchantCol) : merchantCol || result?.merchant || prettifyDescriptor(text) || "";
  let category = tagKey;
  // "Food" tags: let the categoriser tell delivery from dining out.
  if (tagKey === "dining" && result?.category === "food_delivery") category = "food_delivery";
  const auto: AutoInfo | null =
    !category && result ? { ...result, key: (result.merchant ?? normalizeDescriptor(text)) || text.toUpperCase() } : null;
  if (!category) category = result?.category ?? "other";

  const channelCol = cell(raw, mapping.channel);
  const foreign = result?.channel === "international";
  const channel = channelCol || (foreign ? "international" : auto ? auto.channel : merchantDef(merchant)?.channel ?? result?.channel ?? CATEGORY_MAP[category]?.defaultChannel ?? "offline");

  return {
    kind: "expense",
    descriptor,
    auto,
    row: {
      date: cell(raw, mapping.date),
      amount,
      category,
      subcategory: cell(raw, mapping.subcategory) || undefined,
      merchant: merchant || undefined,
      channel,
      card: opts.cardId || cell(raw, mapping.card) || undefined,
      note: cell(raw, mapping.note) || undefined,
    },
  };
}

export const TEMPLATE_CSV = [
  "date,amount,category,merchant,channel,card,note",
  "2026-10-02,1249,food_delivery,Swiggy,online,4821,Friday dinner",
  "2026-10-05,3560,groceries,DMart,offline,Millennia,Monthly stock-up",
  "2026-10-09,18400,travel,MakeMyTrip,international,HDFC Bank Regalia,Singapore hotel",
].join("\n");

/** A realistic raw credit card statement export (Narration + Dr/Cr, dd/mm/yyyy), dated over the last few weeks. */
export function sampleStatementCsv(today = new Date()): string {
  const rows: [daysAgo: number, narration: string, amount: string, drcr: "Dr" | "Cr"][] = [
    [28, "UPI/SWIGGY/BANGALORE/412398765432", "486.00", "Dr"],
    [27, "POS 4521XXXXXXXX1188 BPCL COCO KORAMANGALA", "2,500.00", "Dr"],
    [26, "AMAZON PAY INDIA PRIVATE LIMITED", "1,899.00", "Dr"],
    [25, "DMART AVENUE SUPERMARTS LTD BANGALORE", "3,412.75", "Dr"],
    [24, "NETFLIX.COM LOS GATOS USD 15.49", "1,302.40", "Dr"],
    [23, "BESCOM ELECTRICITY BILL BILLDESK", "2,184.00", "Dr"],
    [21, "PAYMENT RECEIVED - THANK YOU", "25,000.00", "Cr"],
    [20, "CAFE COFFEE DAY INDIRANAGAR", "420.00", "Dr"],
    [19, "ZOMATO LTD GURGAON", "642.00", "Dr"],
    [18, "INDIGO AIRLINES 6E WEB BOOKING", "7,845.00", "Dr"],
    [16, "APOLLO PHARMACY HSR LAYOUT", "765.20", "Dr"],
    [15, "PVR CINEMAS FORUM MALL", "980.00", "Dr"],
    [14, "HDFC LIFE INSURANCE PREMIUM", "12,000.00", "Dr"],
    [12, "UBER INDIA SYSTEMS PVT LTD", "356.00", "Dr"],
    [11, "MYNTRA DESIGNS PVT LTD", "2,149.00", "Dr"],
    [10, "AMAZON PAY INDIA PRIVATE LIMITED REFUND", "499.00", "Cr"],
    [9, "CASHBACK CREDIT", "312.40", "Cr"],
    [8, "SWIGGY INSTAMART BANGALORE", "1,128.00", "Dr"],
    [7, "AIRTEL PREPAID RECHARGE", "349.00", "Dr"],
    [6, "SRI SAGAR VEG RESTAURANT", "310.00", "Dr"],
    [4, "NOBROKER RENT PAYMENT", "28,000.00", "Dr"],
    [3, "KUMAR TRADERS 88219934", "1,150.00", "Dr"],
    [2, "IGST @18% ON LATE FEE", "106.20", "Dr"],
  ];
  const pad = (n: number) => String(n).padStart(2, "0");
  const lines = rows.map(([ago, narration, amount, drcr], i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ago);
    const ref = `7${String(41029384 + i * 7919).padStart(10, "0")}`;
    return [`${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, `"${narration}"`, ref, `"${amount}"`, drcr].join(",");
  });
  return ["Transaction Date,Narration,Reference No,Amount (INR),Dr/Cr", ...lines].join("\n");
}
