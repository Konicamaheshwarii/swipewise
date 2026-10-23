import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import {
  categoryFromTag, creditKey, detectColumns, detectNegativeIsDebit, matchCard, normalizeCredit, normalizeRow, parseDate, resolveStatementRow,
  sampleStatementCsv,
} from "./import-utils";

const parse = (csv: string) => Papa.parse<Record<string, string>>(csv.trim(), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
const cards = [
  { id: "c1", bank: "HDFC Bank", name: "Millennia", nickname: null, last4: "1188" },
  { id: "c2", bank: "SBI Card", name: "Cashback", nickname: "Daily", last4: null },
];

function run(csv: string, cardId = "") {
  const { data, meta } = parse(csv);
  const mapping = detectColumns(meta.fields ?? []);
  const negativeIsDebit = detectNegativeIsDebit(data, mapping);
  return { mapping, rows: data.map((r) => resolveStatementRow(r, mapping, { cardId, negativeIsDebit })) };
}

describe("parseDate", () => {
  it.each([
    ["2026-10-02", "2026-10-02"], ["02/10/2026", "2026-10-02"], ["02-10-26", "2026-10-02"], ["02-Oct-26", "2026-10-02"],
    ["2 Oct 2026", "2026-10-02"], ["02 Sept 2026", "2026-09-02"], ["Oct 2, 2026", "2026-10-02"], ["02/10/2026 18:45:10", "2026-10-02"],
  ])("%s", (input, want) => {
    const d = parseDate(input)!;
    expect(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`).toBe(want);
  });
  it("rejects junk", () => {
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("hello")).toBeNull();
  });
});

describe("raw statements", () => {
  it("handles Narration + Amount + Dr/Cr, skipping credits and charges", () => {
    const { mapping, rows } = run(sampleStatementCsv(new Date(2026, 9, 21)));
    expect(mapping).toMatchObject({ date: "Transaction Date", description: "Narration", amount: "Amount (INR)", drcr: "Dr/Cr" });
    expect(rows.filter((r) => r.kind === "credit")).toHaveLength(2);
    expect(rows.filter((r) => r.kind === "reward")).toHaveLength(1);
    expect(rows.filter((r) => r.kind === "charge")).toHaveLength(1);
    const exp = rows.flatMap((r) => (r.kind === "expense" ? [r] : []));
    expect(exp).toHaveLength(19);
    const swiggy = exp[0];
    expect(swiggy.row).toMatchObject({ merchant: "Swiggy", category: "food_delivery", channel: "online", amount: "486" });
    expect(swiggy.auto?.confidence).toBe("high");
    const netflix = exp.find((r) => r.row.merchant === "Netflix")!;
    expect(netflix.row.channel).toBe("international");
    const unknown = exp.find((r) => r.descriptor.startsWith("KUMAR"))!;
    expect(unknown.row).toMatchObject({ merchant: "Kumar Traders", category: "other" });
    const checked = exp.map((r) => normalizeRow(r.row, cards));
    expect(checked.every((c) => "row" in c)).toBe(true);
  });

  it("handles separate Debit/Credit columns", () => {
    const { mapping, rows } = run(`
Date,Particulars,Debit,Credit
05-Oct-26,BPCL COCO KORAMANGALA,"2,000.00",
06-Oct-26,PAYMENT RECEIVED,,"10,000.00"
07-Oct-26,APOLLO PHARMACY,350,`);
    expect(mapping).toMatchObject({ description: "Particulars", debit: "Debit", credit: "Credit" });
    expect(rows.map((r) => r.kind)).toEqual(["expense", "credit", "expense"]);
    expect(rows[0].kind === "expense" && rows[0].row).toMatchObject({ category: "fuel", merchant: "BPCL", amount: "2000" });
  });

  it("handles signed amounts, Cr suffixes and bank-style negatives", () => {
    const card = run(`
Date,Description,Amount
2026-10-01,ZOMATO,450
2026-10-02,PAYMENT THANK YOU,-5000
2026-10-03,AMAZON REFUND,"1,200.00 Cr"
2026-10-04,PAYMENT RECEIVED,5000`);
    expect(card.rows.map((r) => r.kind)).toEqual(["expense", "credit", "credit", "credit"]);
    const bank = run(`
Date,Description,Amount
2026-10-01,ZOMATO,-450
2026-10-02,MYNTRA,-1200
2026-10-03,REFUND MYNTRA,1200`);
    expect(bank.rows.map((r) => r.kind)).toEqual(["expense", "expense", "credit"]);
  });

  it("imports app exports (Fold-style tags, Type, Account)", () => {
    const { mapping, rows } = run(`
Date,Merchant,Amount,Type,Account,Tag
2026-10-01,Swiggy,320,debit,HDFC Credit Card XX1188,Food
2026-10-02,Starbucks Indiranagar,410,debit,HDFC Credit Card XX1188,Food
2026-10-03,Some Kirana,900,debit,HDFC Credit Card XX1188,Untagged
2026-10-04,Unknown Corp,100,debit,SBI Card,Personal
2026-10-05,Refund,100,credit,HDFC Credit Card XX1188,Shopping`);
    expect(mapping).toMatchObject({ merchant: "Merchant", amount: "Amount", drcr: "Type", card: "Account", category: "Tag" });
    const exp = rows.flatMap((r) => (r.kind === "expense" ? [r.row] : []));
    expect(rows[4].kind).toBe("credit");
    expect(exp.map((r) => r.category)).toEqual(["food_delivery", "dining", "groceries", "other"]);
    expect(normalizeRow(exp[0], cards)).toMatchObject({ row: { userCardId: "c1" } });
    expect(normalizeRow(exp[3], cards)).toMatchObject({ row: { userCardId: "c2" } });
  });

  it("keeps cashback credits as rewards received, skipping payments and refunds", () => {
    const { rows } = run(`
Date,Narration,Amount,Dr/Cr,Card
2026-10-01,SWIGGY,450,Dr,1188
2026-10-02,PAYMENT RECEIVED - THANK YOU,5000,Cr,1188
2026-10-03,CASHBACK CREDIT,"212.50",Cr,1188
2026-10-04,AMAZON REFUND,1200,Cr,1188
2026-10-05,INSTANT CASHBACK,75,Cr,Daily`);
    expect(rows.map((r) => r.kind)).toEqual(["expense", "credit", "reward", "credit", "reward"]);
    const rewards = rows.flatMap((r) => (r.kind === "reward" ? [normalizeCredit(r.row, cards)] : []));
    expect(rewards[0]).toMatchObject({ row: { amount: 212.5, userCardId: "c1", note: "CASHBACK CREDIT" } });
    expect(rewards[1]).toMatchObject({ row: { amount: 75, userCardId: "c2" } });
  });

  it("reads cashback from a Credit column and from unsigned amounts", () => {
    const split = run(`Date,Particulars,Debit,Credit
05-Oct-26,CB CREDIT SEP,,"150.00"`);
    expect(split.rows[0]).toMatchObject({ kind: "reward", row: { amount: "150" } });
    const plain = run(`Date,Description,Amount
2026-10-01,ZOMATO,450
2026-10-02,AMAZON PAY CASHBACK,40`, "c2");
    expect(plain.rows.map((r) => r.kind)).toEqual(["expense", "reward"]);
    expect(plain.rows[1].kind === "reward" && normalizeCredit(plain.rows[1].row, cards)).toMatchObject({ row: { userCardId: "c2", amount: 40 } });
  });

  it("keys credits by day, amount and card", () => {
    const a = creditKey({ date: new Date(2026, 9, 3, 9), amount: 212.5, userCardId: "c1" });
    expect(creditKey({ date: new Date(2026, 9, 3, 18), amount: 212.5, userCardId: "c1" })).toBe(a);
    expect(creditKey({ date: new Date(2026, 9, 3, 18), amount: 212.5, userCardId: "c2" })).not.toBe(a);
  });

  it("applies one card to the whole file", () => {
    const { rows } = run(`Date,Narration,Amount\n2026-10-01,SWIGGY,100`, "c2");
    expect(rows[0].kind === "expense" && normalizeRow(rows[0].row, cards)).toMatchObject({ row: { userCardId: "c2" } });
  });

  it("keeps the simple template working", () => {
    const { rows } = run(`date,amount,category,merchant,channel,card,note\n2026-10-02,1249,food_delivery,Swiggy,online,1188,Friday`);
    expect(rows[0]).toMatchObject({ kind: "expense", auto: null, row: { category: "food_delivery", merchant: "Swiggy", channel: "online", note: "Friday" } });
  });
});

describe("category tags", () => {
  it.each([
    ["Food", "dining"], ["Shopping", "shopping"], ["Bills", "utilities"], ["Bills & Utilities", "utilities"], ["Travel", "travel"],
    ["Groceries", "groceries"], ["Fuel", "fuel"], ["food_delivery", "food_delivery"], ["Dining Out", "dining"], ["Govt & Tax", "government"],
    ["Personal", null], ["Untagged", null], ["", null],
  ])("%s → %s", (tag, key) => expect(categoryFromTag(tag)).toBe(key));
});

describe("matchCard", () => {
  it("matches by masked number, bank-only and id", () => {
    expect(matchCard("HDFC Credit Card XX1188", cards)).toBe("c1");
    expect(matchCard("SBI Card", cards)).toBe("c2");
    expect(matchCard("c1", cards)).toBe("c1");
    expect(matchCard("HDFC Millennia Credit Card", cards)).toBe("c1");
    expect(matchCard("Axis Ace", cards)).toBeNull();
  });
});
