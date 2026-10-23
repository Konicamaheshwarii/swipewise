// Credit card statement PDF parsing. Pure: no DB, framework or pdf.js imports, so it runs in the browser
// (on text pdf.js extracted on the user's device) and in unit tests.
// Relative imports (not "@/") so Vitest can load this without a path-alias config.
import { resolveStatementRow, type AutoInfo, type ColumnMapping, type RawImportRow } from "../app/app/expenses/import-utils";

/* ---------- Text lines from positioned text ---------- */

/** One text run from pdf.js: x/y in PDF points (y grows upwards), width and font height. */
export interface TextItemPos {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A run of text separated from its neighbours by a wide gap (≈ a table column). */
export interface Cell {
  x: number;
  text: string;
}

export interface Line {
  page: number;
  /** Top-down position: larger = further down the page. */
  y: number;
  h: number;
  cells: Cell[];
  /** Cells joined with two spaces. */
  text: string;
}

/**
 * Groups text runs into lines by y, sorts each line by x and splits it into cells at wide gaps.
 * `pages[i]` holds page i's items.
 */
export function buildLines(pages: TextItemPos[][]): Line[] {
  const out: Line[] = [];
  pages.forEach((items, page) => {
    const usable = items
      .filter((i) => i.str && i.str.trim())
      .map((i) => ({ ...i, h: i.h > 0 ? i.h : 8, top: -i.y }))
      .sort((a, b) => a.top - b.top || a.x - b.x);
    const groups: (typeof usable)[] = [];
    for (const it of usable) {
      const g = groups[groups.length - 1];
      if (g) {
        const ref = g[0];
        if (Math.abs(it.top - ref.top) <= Math.max(1.5, 0.45 * Math.max(it.h, ref.h))) {
          g.push(it);
          continue;
        }
      }
      groups.push([it]);
    }
    for (const g of groups) {
      g.sort((a, b) => a.x - b.x);
      const h = Math.max(...g.map((i) => i.h));
      const cells: Cell[] = [];
      let cur: Cell | null = null;
      let end = 0;
      for (const it of g) {
        const gap = it.x - end;
        const str = it.str.replace(/\s+/g, " ");
        if (!cur || gap > Math.max(5, 1.0 * h)) {
          cur = { x: it.x, text: str.trim() };
          cells.push(cur);
        } else {
          const needsSpace = gap > 0.12 * h && !cur.text.endsWith(" ") && !str.startsWith(" ");
          cur.text = (cur.text + (needsSpace ? " " : "") + str).replace(/\s+/g, " ");
        }
        end = Math.max(end, it.x + Math.max(0, it.w));
      }
      for (const c of cells) c.text = c.text.trim();
      const kept = cells.filter((c) => c.text);
      if (!kept.length) continue;
      out.push({ page, y: g[0].top, h, cells: kept, text: kept.map((c) => c.text).join("  ") });
    }
  });
  return out;
}

/** Test/debug helper: plain text where 2+ spaces separate columns. One line per row; a form feed starts a new page. */
export function linesFromText(text: string): Line[] {
  const out: Line[] = [];
  let page = 0;
  let row = 0;
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    if (raw.includes("\f")) {
      page++;
      row = 0;
      continue;
    }
    row++;
    if (!raw.trim()) continue;
    const cells: Cell[] = [];
    const re = /\S+(?: \S+)*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) cells.push({ x: m.index * 5, text: m[0] });
    out.push({ page, y: row * 12, h: 10, cells, text: cells.map((c) => c.text).join("  ") });
  }
  return out;
}

/* ---------- Dates ---------- */

const MONTH_NUM: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};
const MON = "(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUNE?|JULY?|AUG(?:UST)?|SEP(?:T(?:EMBER)?)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)";

interface DateParts {
  d: number;
  m: number;
  y: number | null;
  /** Characters consumed from the start of the string. */
  len: number;
}

const DATE_PATTERNS: { re: RegExp; get: (m: RegExpMatchArray) => [d: number, mo: number, y: number | null] }[] = [
  { re: /^(\d{4})-(\d{2})-(\d{2})(?![\d])/, get: (m) => [+m[3], +m[2], +m[1]] },
  { re: /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?![\d])/, get: (m) => [+m[1], +m[2], +m[3]] },
  {
    re: new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?[\\s/-]*${MON}\\.?(?:[\\s,/-]+(\\d{4}|\\d{2}))?(?![A-Z\\d])`, "i"),
    get: (m) => [+m[1], MONTH_NUM[m[2].slice(0, 3).toUpperCase()], m[3] ? +m[3] : null],
  },
  {
    re: new RegExp(`^${MON}\\.?\\s*(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?(?![\\d])`, "i"),
    get: (m) => [+m[2], MONTH_NUM[m[1].slice(0, 3).toUpperCase()], m[3] ? +m[3] : null],
  },
];

/** A date at the very start of `s`, in any common Indian statement format. The year may be missing (HSBC, Amex). */
export function leadingDate(s: string): DateParts | null {
  for (const p of DATE_PATTERNS) {
    const m = s.match(p.re);
    if (!m) continue;
    let [d, mo, y] = p.get(m);
    // US-style 09/25/2025: swap when the month can't be right.
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
    if (y != null && y < 100) y += 2000;
    if (!mo || mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    if (y != null && (y < 1990 || y > 2100)) continue;
    if (y != null && new Date(y, mo - 1, d).getMonth() !== mo - 1) continue;
    return { d, m: mo, y, len: m[0].length };
  }
  return null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const toTime = (isoDate: string) => new Date(`${isoDate}T12:00:00`).getTime();

/** Picks the year for a date printed without one: the latest year that isn't more than a month after `ref`. */
function withYear(p: DateParts, ref: Date): string | null {
  let y = p.y ?? ref.getFullYear();
  if (p.y == null && new Date(y, p.m - 1, p.d).getTime() > ref.getTime() + 31 * 864e5) y--;
  const dt = new Date(y, p.m - 1, p.d);
  if (dt.getMonth() !== p.m - 1) return null;
  return iso(y, p.m, p.d);
}

/** Every full date (with a year) anywhere in a string. */
export function findDates(s: string): { iso: string; index: number }[] {
  const out: { iso: string; index: number }[] = [];
  const re = new RegExp(
    `\\b(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/.-]\\d{1,2}[/.-](?:\\d{4}|\\d{2})|\\d{1,2}(?:st|nd|rd|th)?[\\s/-]*${MON}\\.?[\\s,/-]+\\d{2,4}|${MON}\\.?\\s*\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4})\\b`,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const p = leadingDate(m[0]);
    if (p && p.y != null) out.push({ iso: iso(p.y, p.m, p.d), index: m.index });
  }
  return out;
}

/* ---------- Amounts ---------- */

const NUM_TOKEN = /^(\()?([+-])?(?:₹|RS\.?|INR|`)?([+-])?(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+\.\d{1,2}|\d+)(\))?(CR|DR|C|D|-)?$/i;
const MARKER_TOKEN = /^(CR|DR|C|D)\.?$/i;
const PREFIX_TOKEN = /^(₹|RS\.?|INR|`|C)$/i;
const SIGN_TOKEN = /^[+-]$/;
const FX_CODES = new Set(
  "USD EUR GBP SGD AED AUD CAD JPY CHF HKD THB MYR NZD SAR QAR OMR KWD BHD CNY LKR NPR IDR VND ZAR SEK NOK DKK KRW PHP MXN BRL TWD".split(" "),
);

interface TailAmount {
  value: number;
  decimal: boolean;
  /** Explicit credit/debit marker (Cr/Dr, C/D suffix, sign). null = none. */
  credit: boolean | null;
  currency: string | null;
  index: number;
}

const parseNum = (s: string) => Number(s.replace(/,/g, ""));

/**
 * Reads amount columns from the end of a transaction line: "1,234.00", "1,234.00 Cr", "500.00 D" (SBI),
 * "+ C 500.00" (HDFC: C is the ₹ glyph), "(1,234.00)", "1,234.00-", reward points (integers, ignored),
 * and foreign-currency amounts ("USD 15.49").
 */
function readTail(tokens: string[], start: number): { amounts: TailAmount[]; descEnd: number; currency: string | null } {
  const amounts: TailAmount[] = [];
  const currencies: { code: string; index: number }[] = [];
  let i = tokens.length - 1;
  let pendingMarker: boolean | null = null;
  let lastNumIndex = -1;
  while (i >= start) {
    const t = tokens[i];
    const leftIsNum = i - 1 >= start && NUM_TOKEN.test(tokens[i - 1]);
    // A lone "C" right before an amount is HDFC's ₹ glyph, not a credit marker.
    if (MARKER_TOKEN.test(t) && leftIsNum && !(/^C$/i.test(t) && lastNumIndex === i + 1)) {
      pendingMarker = /^C/i.test(t);
      i--;
      continue;
    }
    const m = t.match(NUM_TOKEN);
    if (m) {
      const body = m[4];
      const decimal = /\.\d/.test(body) || /,/.test(body);
      let credit: boolean | null = null;
      const suffix = (m[6] ?? "").toUpperCase();
      if (suffix === "CR" || suffix === "C" || suffix === "-") credit = true;
      else if (suffix === "DR" || suffix === "D") credit = false;
      if (credit == null && pendingMarker != null) credit = pendingMarker;
      if (m[2] === "-" || m[3] === "-" || (m[1] && m[5])) credit = true;
      if (m[2] === "+" || m[3] === "+") credit = true;
      pendingMarker = null;
      if (decimal || (credit != null && /^(CR|DR)$/.test(suffix))) {
        amounts.unshift({ value: Math.round(parseNum(body) * 100) / 100, decimal, credit, currency: null, index: i });
      }
      lastNumIndex = i;
      i--;
      continue;
    }
    if (SIGN_TOKEN.test(t) && lastNumIndex > i) {
      const target = amounts.find((a) => a.index === lastNumIndex);
      if (target) target.credit = true;
      i--;
      continue;
    }
    if (PREFIX_TOKEN.test(t) && lastNumIndex === i + 1) {
      i--;
      continue;
    }
    if (/^(₹|RS\.?|INR)$/i.test(t)) {
      i--;
      continue;
    }
    if (FX_CODES.has(t.toUpperCase())) {
      currencies.push({ code: t.toUpperCase(), index: i });
      i--;
      continue;
    }
    break;
  }
  // A currency code belongs to the amount right after it (or right before it).
  for (const c of currencies) {
    const after = amounts.find((a) => a.index > c.index && a.currency == null);
    const target = after && after.index - c.index <= 2 ? after : [...amounts].reverse().find((a) => a.index < c.index && a.currency == null);
    if (target) target.currency = c.code;
  }
  return { amounts, descEnd: i + 1, currency: currencies[0]?.code ?? null };
}

/** "12,345.67", "12,345.67 Cr", "₹ 12,345.67", "-500.00": signed values found in a string (Cr = negative). */
function amountsIn(s: string): { value: number; x: number }[] {
  const out: { value: number; x: number }[] = [];
  const re = /(-)?(?:₹|Rs\.?|INR|`)?\s?(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+\.\d{2})(?!\d)(\s?(?:CR|Cr|cr)\b)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const v = parseNum(m[2]);
    out.push({ value: m[1] || m[3] ? -v : v, x: m.index });
  }
  return out;
}

/* ---------- Issuers ---------- */

export type IssuerKey =
  | "sbi" | "hdfc" | "icici" | "axis" | "hsbc" | "kotak" | "idfc" | "au" | "amex" | "sc" | "indusind" | "yes" | "rbl" | "bob"
  | "federal" | "onecard" | "csb" | "utkarsh";

export interface IssuerDef {
  key: IssuerKey;
  /** Exactly as CardProduct.bank in the catalog. */
  bank: string;
  re: RegExp;
  strong: RegExp;
  /** Matched against a file name before the PDF is unlocked. */
  file: RegExp;
}

export const ISSUERS: IssuerDef[] = [
  { key: "sbi", bank: "SBI Card", re: /\bSBI\s?CARDS?\b|\bSBICARD\b/gi, strong: /sbicard\.com|SBI Cards and Payment Services/gi, file: /sbi/i },
  { key: "hdfc", bank: "HDFC Bank", re: /\bHDFC\s?BANK\b/gi, strong: /hdfcbank\.(?:com|net)|HDFC Bank (?:Ltd|Limited)/gi, file: /hdfc/i },
  { key: "icici", bank: "ICICI Bank", re: /\bICICI\s?BANK\b/gi, strong: /icicibank\.com|ICICI Bank (?:Ltd|Limited)/gi, file: /icici/i },
  { key: "axis", bank: "Axis Bank", re: /\bAXIS\s?BANK\b/gi, strong: /axisbank\.com|axis\.bank\.in|Axis Bank (?:Ltd|Limited)/gi, file: /axis/i },
  { key: "hsbc", bank: "HSBC", re: /\bHSBC\b/gi, strong: /hsbc\.co\.in|Hongkong and Shanghai Banking/gi, file: /hsbc/i },
  { key: "kotak", bank: "Kotak Mahindra Bank", re: /\bKOTAK\b/gi, strong: /kotak\.com|Kotak Mahindra Bank/gi, file: /kotak/i },
  { key: "idfc", bank: "IDFC FIRST Bank", re: /\bIDFC\s?FIRST\b/gi, strong: /idfcfirstbank\.com|IDFC FIRST Bank (?:Ltd|Limited)/gi, file: /idfc/i },
  { key: "au", bank: "AU Small Finance Bank", re: /\bAU\s+SMALL\s+FINANCE\b|\bAU\s+BANK\b/gi, strong: /aubank\.in|AU Small Finance Bank (?:Ltd|Limited)/gi, file: /(?:^|[^a-z])au(?:[^a-z]|$)|aubank/i },
  { key: "amex", bank: "American Express", re: /\bAMERICAN\s+EXPRESS\b/gi, strong: /americanexpress\.(?:com|co\.in)|American Express Banking Corp/gi, file: /amex|american/i },
  { key: "sc", bank: "Standard Chartered", re: /\bSTANDARD\s+CHARTERED\b/gi, strong: /sc\.com\/in/gi, file: /standard|stanchart|(?:^|[^a-z])sc(?:[^a-z]|$)/i },
  { key: "indusind", bank: "IndusInd Bank", re: /\bINDUSIND\b/gi, strong: /indusind\.com/gi, file: /indusind/i },
  { key: "yes", bank: "Yes Bank", re: /\bYES\s+BANK\b/gi, strong: /yesbank\.in/gi, file: /yes/i },
  { key: "rbl", bank: "RBL Bank", re: /\bRBL\s+BANK\b/gi, strong: /rblbank\.com/gi, file: /rbl/i },
  { key: "bob", bank: "Bank of Baroda", re: /\bBOBCARD\b|\bBANK\s+OF\s+BARODA\b|\bBOB\s+FINANCIAL\b/gi, strong: /bobcard\.co\.in|bobfinancial\.com/gi, file: /bob|baroda/i },
  { key: "federal", bank: "Federal Bank", re: /\bFEDERAL\s+BANK\b/gi, strong: /federalbank\.co\.in/gi, file: /federal|scapia/i },
  { key: "onecard", bank: "OneCard", re: /\bONE\s?CARD\b/gi, strong: /getonecard\.app|FPL Technologies/gi, file: /onecard/i },
  { key: "csb", bank: "CSB Bank", re: /\bCSB\s+BANK\b/gi, strong: /csb\.co\.in/gi, file: /csb|jupiter/i },
  { key: "utkarsh", bank: "Utkarsh Small Finance Bank", re: /\bUTKARSH\b/gi, strong: /utkarsh\.bank/gi, file: /utkarsh/i },
];

const ISSUER_BY_KEY = new Map(ISSUERS.map((i) => [i.key, i]));
export const issuerByBank = (bank: string | null | undefined) => ISSUERS.find((i) => i.bank === bank) ?? null;

const count = (re: RegExp, s: string) => (s.match(re) ?? []).length;

/** The card issuer from the statement's non-transaction text (header, summary, footer). */
export function detectIssuer(headerText: string, firstLines = ""): IssuerDef | null {
  let best: { def: IssuerDef; score: number } | null = null;
  for (const def of ISSUERS) {
    const score = count(def.re, headerText) + 5 * count(def.strong, headerText) + 2 * count(def.re, firstLines);
    if (score > 0 && (!best || score > best.score)) best = { def, score };
  }
  return best?.def ?? null;
}

/** Best guess of the issuer from a file name, before the PDF is unlocked. */
export function issuerFromFileName(name: string): IssuerDef | null {
  const base = name.replace(/\.pdf$/i, "");
  return ISSUERS.find((i) => i.file.test(base)) ?? null;
}

/**
 * Password format hints per issuer. These are common formats reported online, not verified:
 * the bank's statement email states the exact format.
 */
export const PASSWORD_HINTS: Partial<Record<IssuerKey, string[]>> = {
  sbi: ["Date of birth (DDMMYYYY) + last 4 digits of the card, e.g. 150819901234"],
  hdfc: ["First 4 letters of your name in CAPITALS + last 4 card digits, e.g. RAJE1234", "Some cards: first 4 letters of name + DOB as DDMM"],
  icici: ["First 4 letters of your name (lowercase) + DOB as DDMM, e.g. raje1508"],
  axis: ["First 4 letters of your name in CAPITALS + DOB as DDMM, e.g. RAJE1508"],
  hsbc: ["Date of birth as DDMMYY + last 6 digits of the card"],
  kotak: ["First 4 letters of your name + DOB as DDMM"],
  idfc: ["First 4 letters of your name + DOB as DDMM"],
  amex: ["Often not password protected"],
  au: ["First 4 letters of your name + DOB as DDMM"],
};
export const GENERIC_PASSWORD_HINTS = [
  "Often the first 4 letters of your name + date of birth (DDMM) or the last 4 card digits",
  "Your statement email usually says the exact format",
];

/* ---------- Card number ---------- */

/** Last 4 digits of the card from masked numbers ("XXXX XXXX XXXX 1234", "4375XXXXXXXX1234", "ending 1234"). Most frequent first. */
export function detectLast4(text: string): string[] {
  const hits = new Map<string, number>();
  const add = (d: string, w: number) => hits.set(d, (hits.get(d) ?? 0) + w);
  const masked = /(?<![\dXx*•])((?:[\dXx*•]{4,6}[ -]?){2,3}[\dXx*•]{0,6}?)(\d{4})(?![\dXx*•])/g;
  let m: RegExpExecArray | null;
  while ((m = masked.exec(text))) {
    if ((m[1].match(/[Xx*•]/g) ?? []).length >= 4) add(m[2], 3);
  }
  const ending = /\b(?:ending(?:\s+(?:in|with))?|last\s+4\s+digits?|card\s+(?:no|number)\.?\s*:?\s*(?:[.Xx*•\s]{2,}))\s*:?\s*[.Xx*•\s]*(\d{4})\b/gi;
  while ((m = ending.exec(text))) add(m[1], 2);
  return [...hits].sort((a, b) => b[1] - a[1]).map(([d]) => d);
}

/* ---------- Product matching ---------- */

export interface CatalogEntry {
  id: string;
  bank: string;
  name: string;
}

export type MatchConfidence = "high" | "medium" | "low";
export interface ProductMatch {
  id: string;
  score: number;
  confidence: MatchConfidence;
}

const PRODUCT_STOP = new Set([
  "SBI", "CARD", "CARDS", "CREDIT", "BANK", "HDFC", "ICICI", "AXIS", "KOTAK", "IDFC", "FIRST", "AU", "HSBC", "THE", "METAL",
  "RUPAY", "VISA", "MASTERCARD", "AMEX", "AMERICAN", "EXPRESS", "BOBCARD", "RBL", "YES", "INDUSIND", "FEDERAL", "CSB",
]);
const normText = (s: string) =>
  ` ${s.toUpperCase().replace(/\+/g, " PLUS ").replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim()} `;
const productTokens = (name: string) => {
  const all = normText(name).trim().split(" ").filter(Boolean);
  const core = all.filter((t) => !PRODUCT_STOP.has(t));
  return core.length ? core : all;
};

/**
 * Ranks catalog products by how clearly the statement text names them ("MY ZONE CREDIT CARD", "LIVE+",
 * "CASHBACK SBI CARD"). Only products of `bank` when it is known. Unmatched products are left out.
 */
export function matchProducts(text: string, bank: string | null, catalog: CatalogEntry[]): ProductMatch[] {
  const hay = normText(text);
  const pool = bank ? catalog.filter((c) => c.bank === bank) : catalog;
  const out: ProductMatch[] = [];
  for (const p of pool) {
    const tokens = productTokens(p.name);
    const phrase = new RegExp(` ${tokens.join(" ")} `, "g");
    const occ = (hay.match(phrase) ?? []).length;
    const present = tokens.filter((t) => hay.includes(` ${t} `)).length;
    if (!occ && present < tokens.length) continue;
    // Next to the word CARD or the bank's own name: "CASHBACK SBI CARD", "MY ZONE CREDIT CARD", "AXIS BANK MY ZONE".
    const near = new RegExp(`(?: ${tokens.join(" ")} (?:[A-Z]+ ){0,2}CARD )|(?: (?:CARD|BANK|SBI|HDFC|ICICI|AXIS|HSBC|KOTAK) (?:[A-Z]+ ){0,1}${tokens.join(" ")} )`);
    const adjacent = occ > 0 && near.test(hay);
    const score = (occ ? 40 : 15) + tokens.length * 8 + (adjacent ? 25 : 0) + Math.min(occ, 3);
    const confidence: MatchConfidence = occ && (adjacent || tokens.length >= 2) ? "high" : occ ? "medium" : "low";
    out.push({ id: p.id, score, confidence });
  }
  return out.sort((a, b) => b.score - a.score);
}

/* ---------- Transactions ---------- */

export interface ParsedTxn {
  /** YYYY-MM-DD */
  date: string;
  description: string;
  amount: number;
  credit: boolean;
  /** Foreign currency code printed on the row (USD…), if any. */
  currency: string | null;
  /** Index of the (first) source line. */
  line: number;
}

const SUMMARY_DESC = /^(TOTAL|SUB ?TOTAL|OPENING BALANCE|CLOSING BALANCE|PREVIOUS BALANCE|MINIMUM|MIN\.? AMOUNT|PAYMENT DUE|STATEMENT DATE|CREDIT LIMIT|AVAILABLE)/i;
const CONT_STOP = /\b(TOTAL|PAGE \d|STATEMENT|BALANCE|AMOUNT DUE|CONTINUED|IMPORTANT|SUMMARY|REWARD POINTS? SUMMARY|GSTIN|CUSTOMER CARE|TERMS|PLEASE)\b/i;

/** Rows whose credit/debit side was printed explicitly (Cr/Dr, sign). Kept aside so ParsedTxn stays plain data. */
const explicit = new WeakSet<ParsedTxn>();
const splitDate = leadingDate;

/** Strips a time ("| 14:32", "14:32:11") and a second (posting) date after the transaction date. */
function afterDate(text: string, len: number): string {
  let rest = text.slice(len);
  rest = rest.replace(/^[\s|,]*\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?/i, "");
  const second = leadingDate(rest.trimStart());
  if (second) rest = rest.trimStart().slice(second.len).replace(/^[\s|,]*\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?/i, "");
  return rest.trim();
}

interface RowParse {
  description: string;
  amount: TailAmount;
  currency: string | null;
}

function parseRest(rest: string, issuer: IssuerKey | null): RowParse | null {
  const tokens = rest.split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  const { amounts, descEnd, currency } = readTail(tokens, 0);
  const inr = amounts.filter((a) => a.decimal && !a.currency);
  if (!inr.length) return null;
  let pick: TailAmount;
  if (issuer === "axis" && inr.length > 1) pick = inr[0]; // Axis: AMOUNT column comes before CASHBACK EARNED
  else {
    const nonZero = inr.filter((a) => a.value > 0);
    pick = nonZero[nonZero.length - 1] ?? inr[inr.length - 1];
  }
  if (!(pick.value > 0)) return null;
  const descTokens = tokens.slice(0, descEnd);
  // Leading reference / serial numbers (ICICI "SerNo.") never identify the merchant.
  while (descTokens.length > 1 && /^\d{6,}$/.test(descTokens[0])) descTokens.shift();
  const description = descTokens.join(" ").trim();
  if ((description.match(/[A-Za-z]/g) ?? []).length < 2) return null;
  if (SUMMARY_DESC.test(description)) return null;
  return { description, amount: pick, currency: currency ?? amounts.find((a) => a.currency)?.currency ?? null };
}

export interface StatementSummary {
  totalDue: number | null;
  minDue: number | null;
  opening: number | null;
  debits: number | null;
  credits: number | null;
  fees: number | null;
}

const SUMMARY_LABELS: [keyof StatementSummary, RegExp][] = [
  ["minDue", /\bmin(?:imum)?\.?\s+(?:amount\s+|amt\.?\s+)?(?:due|payable)\b/i],
  ["totalDue", /\b(?:total\s+(?:amount\s+)?dues?|total\s+payment\s+due|(?<!minimum\s)(?<!min\.?\s)amount\s+due|total\s+outstanding|closing\s+balance|new\s+balance|current\s+outstanding)\b/i],
  ["opening", /\b(?:previous\s+(?:statement\s+)?balance|opening\s+balance|last\s+statement\s+balance|balance\s+b\/?f)\b/i],
  ["debits", /\b(?:purchases?\s*(?:&|and|\/|,)?\s*(?:other\s+)?(?:debits|charges)|total\s+(?:debits|purchases|spends?)|new\s+(?:purchases|debits|spends?)|purchase\/debits)\b/i],
  ["credits", /\b(?:payments?\s*,?\s*(?:reversals\s*)?(?:&|and|\/)\s*(?:other\s+)?credits|total\s+(?:credits|payments)|payment\/credits)\b/i],
  ["fees", /\b(?:fees?\s*,?\s*(?:taxes?\s*)?(?:&|and)\s*(?:interest\s*)?charges|finance\s+charges|total\s+fees)\b/i],
];

function labelsIn(cellText: string): (keyof StatementSummary)[] {
  const found: (keyof StatementSummary)[] = [];
  for (const [key, re] of SUMMARY_LABELS) {
    if (!re.test(cellText)) continue;
    if (key === "totalDue" && found.includes("minDue") && !/total/i.test(cellText)) continue;
    found.push(key);
  }
  return found.slice(0, 1);
}

/** Summary figures from a label with its value on the same line, or in a header row with values on the next lines. */
export function detectSummary(lines: Line[]): StatementSummary {
  const out: StatementSummary = { totalDue: null, minDue: null, opening: null, debits: null, credits: null, fees: null };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const labelled = line.cells.map((c, j) => ({ c, j, keys: labelsIn(c.text) })).filter((l) => l.keys.length);
    if (!labelled.length) continue;
    const lineAmounts = line.cells.flatMap((c, j) => amountsIn(c.text).map((a) => ({ ...a, j, cx: c.x })));
    const headerRow = labelled.length >= 2 && !lineAmounts.length;
    for (const { c, j, keys } of labelled) {
      const key = keys[0];
      if (out[key] != null) continue;
      let value: number | null = null;
      if (!headerRow) {
        const inCell = amountsIn(c.text.slice(c.text.search(SUMMARY_LABELS.find(([k]) => k === key)![1])));
        const right = lineAmounts.filter((a) => a.j > j);
        const nextLabel = labelled.find((l) => l.j > j)?.j ?? Infinity;
        if (inCell.length) value = inCell[0].value;
        else if (right.length && right[0].j < nextLabel) value = right[0].value;
      }
      if (value == null) {
        // Header-row layout: the value sits below the label, nearest by x.
        for (let k = i + 1; k <= Math.min(i + 3, lines.length - 1) && value == null; k++) {
          if (lines[k].page !== line.page) break;
          const cand = lines[k].cells.flatMap((cc) => amountsIn(cc.text).map((a) => ({ ...a, cx: cc.x })));
          if (!cand.length) continue;
          const width = Math.max(40, (line.cells[j + 1]?.x ?? c.x + 160) - c.x);
          const best = cand
            .map((a) => ({ a, dist: Math.abs(a.cx - c.x) }))
            .filter((x) => x.dist <= width)
            .sort((a, b) => a.dist - b.dist)[0];
          if (best) value = best.a.value;
          else if (!headerRow && cand.length === 1) value = cand[0].value;
        }
      }
      if (value != null) out[key] = value;
    }
  }
  return out;
}

export interface StatementPeriod {
  from: string | null;
  to: string | null;
}

/** Statement period ("13 Aug 2025 to 12 Sep 2025") or, failing that, the statement date. */
export function detectPeriod(lines: Line[]): StatementPeriod {
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].text;
    if (!/period|from|cycle/i.test(t)) continue;
    const window = [t, lines[i + 1]?.text ?? ""].join("  ");
    const dates = findDates(window);
    if (dates.length >= 2 && /\b(to|till|-|–)\b|\sto\s|–|-/i.test(window.slice(dates[0].index, dates[1].index + 1))) {
      const [a, b] = [dates[0].iso, dates[1].iso].sort();
      if (toTime(b) - toTime(a) < 70 * 864e5) return { from: a, to: b };
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].text;
    const at = t.search(/statement\s+date|bill(?:ing)?\s+date|statement\s+generation\s+date/i);
    if (at < 0) continue;
    const same = findDates(t.slice(at));
    if (same.length) return { from: null, to: same[0].iso };
    // Header row with the value below.
    const next = lines[i + 1] ? findDates(lines[i + 1].text) : [];
    if (next.length) {
      const labelX = lines[i].cells.find((c) => /statement\s+date|bill(?:ing)?\s+date/i.test(c.text))?.x ?? 0;
      const cells = lines[i + 1].cells.flatMap((c) => findDates(c.text).map((d) => ({ d, x: c.x })));
      const best = cells.sort((a, b) => Math.abs(a.x - labelX) - Math.abs(b.x - labelX))[0];
      return { from: null, to: (best?.d ?? next[0]).iso };
    }
  }
  return { from: null, to: null };
}

/** Transaction rows: a date at the start, a description, and an amount at the end. Wrapped descriptions are merged. */
export function parseTransactions(lines: Line[], opts: { issuer?: IssuerKey | null; refDate?: Date } = {}): { txns: ParsedTxn[]; used: Set<number> } {
  const issuer = opts.issuer ?? null;
  const ref = opts.refDate ?? new Date();
  const txns: ParsedTxn[] = [];
  const used = new Set<number>();
  const firstX = new Map<ParsedTxn, number>();
  type Prev = { txn: ParsedTxn; lineIdx: number; y: number; page: number; h: number };
  let prev: Prev | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const date = splitDate(line.text);
    if (date) {
      let rest = afterDate(line.text, date.len);
      let row = parseRest(rest, issuer);
      let consumed = i;
      // Amount on the next line ("12/09/2025 LONG MERCHANT" / "NAME CONT.  1,234.00").
      if (!row && rest && lines[i + 1] && lines[i + 1].page === line.page && !splitDate(lines[i + 1].text) && lines[i + 1].y - line.y <= 2 * line.h) {
        const joined = `${rest}  ${lines[i + 1].text}`;
        const r2 = parseRest(joined, issuer);
        if (r2) {
          row = r2;
          rest = joined;
          consumed = i + 1;
        }
      }
      if (row) {
        const isoDate = withYear(date, ref);
        if (isoDate) {
          const credit = row.amount.credit;
          const txn: ParsedTxn = {
            date: isoDate,
            description: row.description,
            amount: row.amount.value,
            credit: credit === true,
            currency: row.currency,
            line: i,
          };
          // Remember whether the side was explicit, so unmarked statements can fall back to text cues.
          if (credit != null) explicit.add(txn);
          txns.push(txn);
          for (let k = i; k <= consumed; k++) used.add(k);
          firstX.set(txn, line.cells[0]?.x ?? 0);
          prev = { txn, lineIdx: consumed, y: lines[consumed].y, page: line.page, h: line.h };
          i = consumed;
          continue;
        }
      }
    }
    // Continuation of the previous description: indented past the date column, close below, no amount.
    const last = prev as Prev | null;
    if (last && line.page === last.page && line.y - last.y <= 1.9 * Math.max(last.h, line.h) && line.y > last.y) {
      const x0 = line.cells[0].x;
      const tokens = line.text.split(/\s+/);
      const { amounts } = readTail(tokens, 0);
      if (
        x0 > (firstX.get(last.txn) ?? 0) + 8 &&
        !amounts.some((a) => a.decimal) &&
        line.cells.length <= 2 &&
        line.text.length <= 70 &&
        !CONT_STOP.test(line.text) &&
        /[A-Za-z]{2}/.test(line.text)
      ) {
        last.txn.description = `${last.txn.description} ${line.text.replace(/\s+/g, " ")}`.slice(0, 200);
        used.add(i);
        prev = { txn: last.txn, page: last.page, h: last.h, lineIdx: i, y: line.y };
        continue;
      }
    }
    prev = null;
  }
  return { txns, used };
}

/* ---------- Classification ---------- */

export type TxnKind = "expense" | "reward" | "payment" | "refund" | "charge";

export interface ClassifiedTxn extends ParsedTxn {
  kind: TxnKind;
  /** Importable row (expense or cashback credit). Card is filled in on import. */
  row: RawImportRow | null;
  auto: AutoInfo | null;
}

const MAPPING: ColumnMapping = {
  date: "date", description: "description", merchant: null, amount: "amount", debit: null, credit: null, drcr: "drcr",
  category: null, subcategory: null, channel: null, card: null, mcc: null, currency: "currency", note: null,
};

const PAYMENT_RE =
  /\b(PAYMENT|PAYMT|PYMT|THANK YOU|BBPS|NEFT|IMPS|RTGS|AUTO ?PAY|AUTO ?DEBIT|NACH|ECS|CHEQUE|CHQ|NETBANKING|NET BANKING|BILLDESK PAY|CRED|INFINITY PAYMENT|UPI PAYMENT|PAYMENT RECD|PAYMENT RECEIVED)\b/;
const REFUND_RE = /\b(REFUND|REVERSAL|REVERSED|RETURN|CANCELL?ATION|CHARGEBACK)\b/;
const CREDIT_TEXT_RE = /\b(PAYMENT RECEIVED|THANK YOU|REFUND|REVERSAL|CASH ?BACK|REWARDS? REDEMPTION|BBPS|NEFT|IMPS)\b/;
const REWARD_DEBIT_RE = /\b(CASH ?BACK|REWARDS?|POINTS?)\b.*\b(REVERSAL|REVERSED|RECOVERY|CLAWBACK|DEBIT)\b|\b(REVERSAL|RECOVERY)\b.*\bCASH ?BACK\b/;

/**
 * Sorts each row into purchases (expenses), cashback credits (rewards), and rows to skip: payments, refunds
 * and card charges (fees, interest, GST). Reuses the CSV statement logic for categorisation.
 */
export function classifyTxns(txns: ParsedTxn[]): ClassifiedTxn[] {
  const anyMarker = txns.some((t) => explicit.has(t));
  return txns.map((t) => {
    const upper = t.description.toUpperCase();
    // Statements without any Dr/Cr marks: payments and cashback are recognised by their text.
    const credit = anyMarker ? t.credit : t.credit || CREDIT_TEXT_RE.test(upper);
    const r = resolveStatementRow(
      { date: t.date, description: t.description, amount: String(t.amount), drcr: credit ? "Cr" : "Dr", currency: t.currency ?? "" },
      MAPPING,
    );
    const base = { ...t, credit };
    if (r.kind === "reward") return { ...base, kind: "reward", row: r.row, auto: null };
    if (r.kind === "credit") {
      const kind: TxnKind = REFUND_RE.test(upper) || !PAYMENT_RE.test(upper) ? "refund" : "payment";
      return { ...base, kind, row: null, auto: null };
    }
    if (r.kind === "charge" || (r.kind === "expense" && REWARD_DEBIT_RE.test(upper))) return { ...base, kind: "charge", row: null, auto: null };
    if (r.kind !== "expense") return { ...base, kind: "charge", row: null, auto: null };
    return { ...base, kind: "expense", row: r.row, auto: r.auto };
  });
}

/* ---------- Whole statement ---------- */

export interface CheckResult {
  status: "match" | "mismatch" | "unknown";
  /** What we compared, for the UI. */
  label: string;
  parsed: number;
  expected: number | null;
}

export interface StatementParse {
  issuer: IssuerDef | null;
  last4: string | null;
  otherLast4: string[];
  period: StatementPeriod;
  summary: StatementSummary;
  txns: ClassifiedTxn[];
  matches: ProductMatch[];
  check: CheckResult;
  counts: Record<TxnKind, number>;
  lineCount: number;
}

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.005);

/** Compares parsed debits with the statement's own totals, so the user can trust (or doubt) the parse. */
export function checkTotals(txns: ClassifiedTxn[], s: StatementSummary): CheckResult {
  const debits = txns.filter((t) => !t.credit).reduce((n, t) => n + t.amount, 0);
  const purchases = txns.filter((t) => t.kind === "expense").reduce((n, t) => n + t.amount, 0);
  const charges = debits - purchases;
  const credits = txns.filter((t) => t.credit).reduce((n, t) => n + t.amount, 0);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  if (s.debits != null && s.debits > 0) {
    const ok = close(debits, s.debits) || close(purchases, s.debits) || (s.fees != null && close(debits, s.debits + s.fees)) || close(debits - charges, s.debits);
    return { status: ok ? "match" : "mismatch", label: "purchases & debits", parsed: r2(debits), expected: s.debits };
  }
  if (s.opening != null && s.totalDue != null && txns.length) {
    const expected = s.totalDue;
    const parsed = r2(s.opening + debits - credits);
    return { status: close(parsed, expected) ? "match" : "mismatch", label: "balance", parsed, expected };
  }
  return { status: "unknown", label: "", parsed: r2(debits), expected: null };
}

/** Full pipeline on reconstructed lines. `catalog` is the product list the user can pick from. */
export function parseStatement(lines: Line[], catalog: CatalogEntry[], opts: { today?: Date } = {}): StatementParse {
  // First pass with no issuer to find the transaction rows; the rest of the text identifies the card.
  const first = parseTransactions(lines, { refDate: opts.today });
  const header = lines.filter((_, i) => !first.used.has(i));
  const headerText = header.map((l) => l.text).join("\n");
  const firstLines = lines.slice(0, 25).map((l) => l.text).join("\n");
  const issuer = detectIssuer(headerText, firstLines);
  const period = detectPeriod(header);
  const ref = period.to ? new Date(`${period.to}T12:00:00`) : (opts.today ?? new Date());
  const { txns } = parseTransactions(lines, { issuer: issuer?.key ?? null, refDate: ref });
  const classified = classifyTxns(txns);
  const summary = detectSummary(header);
  const last4s = detectLast4(headerText.length > 40 ? headerText : lines.map((l) => l.text).join("\n"));
  const counts: Record<TxnKind, number> = { expense: 0, reward: 0, payment: 0, refund: 0, charge: 0 };
  for (const t of classified) counts[t.kind]++;
  return {
    issuer,
    last4: last4s[0] ?? null,
    otherLast4: last4s.slice(1),
    period: period.to || period.from ? period : inferPeriod(classified),
    summary,
    txns: classified,
    matches: matchProducts(headerText, issuer?.bank ?? null, catalog),
    check: checkTotals(classified, summary),
    counts,
    lineCount: lines.length,
  };
}

function inferPeriod(txns: ParsedTxn[]): StatementPeriod {
  if (!txns.length) return { from: null, to: null };
  const sorted = txns.map((t) => t.date).sort();
  return { from: sorted[0], to: sorted[sorted.length - 1] };
}

export const issuerDef = (key: IssuerKey) => ISSUER_BY_KEY.get(key)!;

/* ---------- Card resolution (shared by the preview and the server) ---------- */

export interface WalletCardRef {
  id: string;
  productId: string;
  bank: string;
  last4: string | null;
}

/**
 * Which wallet card a statement belongs to: same last 4 (same product, or the only same-bank card with
 * those digits), then the same product without conflicting digits. null = a new card is needed.
 * `setLast4` = the matched card has no last 4 yet and the statement provides them.
 */
export function resolveWalletCard(
  wallet: WalletCardRef[],
  product: { id: string; bank: string },
  last4: string | null,
): { card: WalletCardRef; setLast4: boolean } | null {
  if (last4) {
    const same = wallet.filter((c) => c.last4 === last4);
    const hit = same.find((c) => c.productId === product.id) ?? (same.filter((c) => c.bank === product.bank).length === 1 ? same.find((c) => c.bank === product.bank) : undefined);
    if (hit) return { card: hit, setLast4: false };
  }
  const byProduct = wallet.filter((c) => c.productId === product.id && (!c.last4 || !last4 || c.last4 === last4));
  const hit = byProduct.find((c) => last4 && c.last4 === last4) ?? byProduct.find((c) => !c.last4) ?? byProduct[0];
  if (hit) return { card: hit, setLast4: !!last4 && !hit.last4 };
  return null;
}

/* ---------- Debugging (no personal data) ---------- */

const KEEP_WORDS = new Set(
  (
    "DATE TRANSACTION TRANSACTIONS DETAILS DESCRIPTION PARTICULARS NARRATION AMOUNT AMT RS INR CR DR C D TOTAL DUE DUES MINIMUM PAYMENT " +
    "RECEIVED THANK YOU STATEMENT PERIOD FROM TO CARD NUMBER NO CREDIT DEBIT DEBITS CREDITS PURCHASES PURCHASE OTHER CHARGES FEES FEE " +
    "BALANCE OPENING PREVIOUS CLOSING OUTSTANDING REWARD REWARDS POINTS CASHBACK CASH BACK REFUND REVERSAL GST IGST CGST SGST INTEREST " +
    "LATE FINANCE PAGE OF MERCHANT CATEGORY SERNO SER INTL USD EUR GBP AED SGD LIMIT AVAILABLE SUMMARY ACCOUNT NEW ENDING IN BBPS NEFT UPI " +
    "JAN FEB MAR APR MAY JUN JUL AUG SEP SEPT OCT NOV DEC SBI HDFC ICICI AXIS HSBC KOTAK IDFC FIRST AU AMEX AMERICAN EXPRESS BANK"
  ).split(" "),
);

/**
 * The statement's line layout with every name, merchant and number masked ("99/99/9999  Xxxxx Xxx  9,999.99 Cr"),
 * so a user can share it to help fix a parser without sharing the statement.
 */
export function anonymiseLines(lines: Line[], limit = 400): string {
  return lines
    .slice(0, limit)
    .map((l) =>
      l.cells
        .map((c) =>
          c.text
            .replace(/[A-Za-z]+/g, (w) => (KEEP_WORDS.has(w.toUpperCase()) ? w : w.replace(/[A-Z]/g, "X").replace(/[a-z]/g, "x")))
            .replace(/\d/g, "9"),
        )
        .join(" | "),
    )
    .map((t, i) => `${String(i + 1).padStart(3, " ")}  p${lines[i].page + 1}  ${t}`)
    .join("\n");
}
