import { describe, expect, it } from "vitest";
import {
  anonymiseLines, buildLines, detectLast4, leadingDate, linesFromText, matchProducts, parseStatement, resolveWalletCard, type CatalogEntry,
} from "./statement-parser";

const CATALOG: CatalogEntry[] = [
  { id: "sbi-cashback", bank: "SBI Card", name: "Cashback" },
  { id: "sbi-simplyclick", bank: "SBI Card", name: "SimplyCLICK" },
  { id: "phonepe-sbi-select-black", bank: "SBI Card", name: "PhonePe SBI Card SELECT BLACK" },
  { id: "phonepe-sbi-purple", bank: "SBI Card", name: "PhonePe SBI Card PURPLE" },
  { id: "sbi-elite", bank: "SBI Card", name: "SBI Card ELITE" },
  { id: "hdfc-millennia", bank: "HDFC Bank", name: "Millennia" },
  { id: "hdfc-regalia-gold", bank: "HDFC Bank", name: "Regalia Gold" },
  { id: "hdfc-regalia", bank: "HDFC Bank", name: "Regalia" },
  { id: "amazon-icici", bank: "ICICI Bank", name: "Amazon Pay" },
  { id: "icici-coral", bank: "ICICI Bank", name: "Coral" },
  { id: "axis-my-zone", bank: "Axis Bank", name: "MY Zone RuPay" },
  { id: "axis-ace", bank: "Axis Bank", name: "ACE" },
  { id: "flipkart-axis", bank: "Axis Bank", name: "Flipkart" },
  { id: "hsbc-live-plus", bank: "HSBC", name: "Live+" },
  { id: "hsbc-rupay-cashback", bank: "HSBC", name: "RuPay Cashback" },
  { id: "hsbc-travelone", bank: "HSBC", name: "TravelOne" },
  { id: "amex-mrcc", bank: "American Express", name: "Membership Rewards" },
  { id: "amex-smartearn", bank: "American Express", name: "SmartEarn" },
  { id: "kotak-league-platinum", bank: "Kotak Mahindra Bank", name: "League Platinum" },
  { id: "idfc-first-millennia", bank: "IDFC FIRST Bank", name: "Millennia" },
  { id: "idfc-first-select", bank: "IDFC FIRST Bank", name: "Select" },
];

const TODAY = new Date(2026, 9, 21);
const parse = (text: string) => parseStatement(linesFromText(text), CATALOG, { today: TODAY });
const byKind = (p: ReturnType<typeof parse>, kind: string) => p.txns.filter((t) => t.kind === kind);

/* SBI Card: "dd Mon yy" dates, trailing C / D markers, header row + values summary. */
const SBI = `
SBI Card                                                         sbicard.com
CASHBACK SBI CARD
Statement for SBI Card Number   XXXX XXXX XXXX 4821
Statement Date   12 Dec 2025          Payment Due Date   01 Jan 2026
Statement Period : 13 Nov 2025 to 12 Dec 2025

Previous Balance      Payments, Reversals & other Credits      Purchases & Other Debits      Fee, Taxes & Interest Charges      Total Outstanding
12,000.00             12,000.00                                9,870.00                      590.00                             10,460.00

TRANSACTIONS FOR RAJESH KUMAR
Date          Transaction Details                                              Amount ( ₹ )
14 Nov 25     PAYMENT RECEIVED 000PYTM0123 THANK YOU                           12,000.00 C
16 Nov 25     AMAZON PAY INDIA PRIVATE LIMITED BANGALORE IN                     1,299.00 D
19 Nov 25     SWIGGY LIMITED                                                      486.00 D
              BANGALORE IN
22 Nov 25     NETFLIX.COM LOS GATOS USD 15.49                                   1,302.40 D
25 Nov 25     CASHBACK CREDIT                                                     312.40 C
28 Nov 25     DMART AVENUE SUPERMARTS LTD                                       3,412.60 D
02 Dec 25     MYNTRA DESIGNS REFUND                                               499.00 C
05 Dec 25     BPCL COCO KORAMANGALA                                             3,370.00 D
08 Dec 25     ANNUAL FEE                                                          500.00 D
08 Dec 25     IGST @18% ON ANNUAL FEE                                              90.00 D
Page 1 of 2
`;

/* HDFC (new layout): "dd/mm/yyyy| hh:mm", reward points column, "C" = ₹ glyph, credits with "+". */
const HDFC = `
HDFC BANK                                                          hdfcbank.com
Millennia Credit Card Statement
Card No: 4893 77XX XXXX 1188                     Statement Date: 05/01/2026
Billing Period   06 Dec, 2025 - 05 Jan, 2026
TOTAL AMOUNT DUE      MINIMUM DUE        DUE DATE
C 8,105.00            C 410.00           25/01/2026

Domestic Transactions
DATE & TIME             TRANSACTION DESCRIPTION                       REWARDS       AMOUNT          PI
07/12/2025| 13:45       ZOMATO LTD GURGAON                            + 12          C 642.00
10/12/2025| 09:12       BBPS PAYMENT RECEIVED                                       + C 5,000.00
15/12/2025| 20:01       APOLLO PHARMACY HSR LAYOUT                    + 15          C 765.20
28/12/2025| 11:30       UBER INDIA SYSTEMS PVT LTD                    + 7           C 356.00
02/01/2026| 18:22       FLIPKART INTERNET PVT LTD                     + 120         C 6,341.80
03/01/2026| 10:00       CASHBACK CREDITED                                           + C 150.00
`;

/* ICICI: SerNo column, reward points, intl amount column, "CR" credits. */
const ICICI = `
ICICI Bank Credit Card Statement                         www.icicibank.com
Amazon Pay ICICI Bank Credit Card     4375XXXXXXXX9012
Statement period : October 16, 2025 to November 15, 2025
Total Amount due          ₹14,210.00
Minimum Amount due        ₹710.00
Date          SerNo.          Transaction Details                              Reward Points    Intl.# amount    Amount (in₹)
18/10/2025    11223344551     AMAZON PAY IN E COMMERCE BANGALORE IN            24                                 1,234.00
21/10/2025    11223344552     INFINITY PAYMENT RECEIVED, THANK YOU             0                                  9,000.00 CR
25/10/2025    11223344553     OPENAI *CHATGPT SUBSCR SAN FRANCISCO US          16               USD 20.00         1,780.00
02/11/2025    11223344554     IRCTC WEB BOOKING NEW DELHI IN                   12                                 2,415.00
09/11/2025    11223344555     AMAZON PAY IN E COMMERCE REFUND                  0                                    999.00 CR
12/11/2025    11223344556     LATE PAYMENT FEE                                 0                                    700.00
12/11/2025    11223344557     CGST @9% ON LATE PAYMENT FEE                     0                                     63.00
`;

/* Axis: Dr/Cr suffix, merchant category column, cashback earned column after amount. */
const AXIS = `
AXIS BANK                                                       axisbank.com
MY ZONE CREDIT CARD STATEMENT
Card No: 5241 XXXX XXXX 7730
Statement Period  21/12/2025 - 20/01/2026
Total Payment Due   4,617.50 Dr
Minimum Payment Due   300.00 Dr
DATE          TRANSACTION DETAILS                                  MERCHANT CATEGORY     AMOUNT (Rs.)     CASHBACK EARNED
22/12/2025    UPI/SWIGGY/BANGALORE/412398765432                    FOOD PRODUCTS          486.00 Dr        0.00 Cr
27/12/2025    PVR CINEMAS FORUM MALL                               ENTERTAINMENT          980.00 Dr        0.00 Cr
31/12/2025    NEFT PAYMENT RECEIVED                                                     6,000.00 Cr
05/01/2026    SPOTIFY INDIA                                        DIGITAL SERVICES       119.00 Dr        0.00 Cr
12/01/2026    INDIAN OIL PETROL PUMP JAYANAGAR                      FUEL                 3,032.50 Dr        0.00 Cr
`;

/* HSBC: ddMON dates without a year, across a year boundary; CR suffix glued. */
const HSBC = `
HSBC                                       The Hongkong and Shanghai Banking Corporation Limited
HSBC LIVE+ CREDIT CARD
Credit card number   4386 XXXX XXXX 5521
Statement From 21 DEC 2025 To 20 JAN 2026
Opening balance   2,100.00
Total amount due   9,446.00
TRANSACTION DATE     TRANSACTION DETAILS                                AMOUNT(in INR)
23DEC                PAYMENT - THANK YOU                                2,100.00CR
24DEC                BARBEQUE NATION BENGALURU                          3,250.00
30DEC                SWIGGY INSTAMART BANGALORE                         1,128.00
02JAN                CASHBACK                                             421.00CR
05JAN                MAKEMYTRIP INDIA PVT LTD                           5,489.00
`;

/* Amex: "Month dd" dates, CR credits, 15-digit masked number. */
const AMEX = `
American Express Banking Corp.                                 americanexpress.co.in
Membership Rewards Credit Card
Membership Number   XXXX-XXXXXX-91005
Statement Period From November 21 to December 20, 2025
Opening Balance   Rs 3,000.00
New Balance   Rs 4,590.00
Date            Details                                             Amount Rs
November 22     PAYMENT RECEIVED. THANK YOU                          3,000.00CR
November 29     UBER INDIA SYSTEMS PVT LTD BANGALORE                  1,240.00
December 03     STARBUCKS COFFEE INDIRANAGAR                            850.00
December 14     LULU HYPERMARKET KOCHI                                2,500.00
`;

/* Kotak: dd/mm/yyyy with separate Dr/Cr column. */
const KOTAK = `
Kotak Mahindra Bank Ltd.                                             kotak.com
LEAGUE PLATINUM CREDIT CARD
Primary Card Number : 4166XXXXXXXX3307
Statement Date 18/11/2025
Date          Transaction details                                   Spends Area         Amount (Rs.)
19/10/2025    BLINKIT GURGAON                                       Groceries           1,050.00     Dr
25/10/2025    PAYMENT RECEIVED - IMPS                                                   7,500.00     Cr
02/11/2025    KUMAR TRADERS 88219934                                Others                640.00     Dr
`;

describe("dates", () => {
  it("reads every common format", () => {
    expect(leadingDate("12/09/2025 X")).toMatchObject({ d: 12, m: 9, y: 2025 });
    expect(leadingDate("12-09-25 X")).toMatchObject({ d: 12, m: 9, y: 2025 });
    expect(leadingDate("12 Sep 25 X")).toMatchObject({ d: 12, m: 9, y: 2025 });
    expect(leadingDate("12 Sep 2025 X")).toMatchObject({ d: 12, m: 9, y: 2025 });
    expect(leadingDate("08SEP AMAZON")).toMatchObject({ d: 8, m: 9, y: null });
    expect(leadingDate("08SEP 24X7 STORE")).toMatchObject({ d: 8, m: 9, y: null });
    expect(leadingDate("September 12 UBER")).toMatchObject({ d: 12, m: 9, y: null });
    expect(leadingDate("Sep 12, 2025 UBER")).toMatchObject({ d: 12, m: 9, y: 2025 });
    expect(leadingDate("31/02/2025 X")).toBeNull();
    expect(leadingDate("AMAZON 12/09/2025")).toBeNull();
  });
});

describe("card number", () => {
  it("finds the last 4 digits in masked formats", () => {
    expect(detectLast4("Card No: 4893 77XX XXXX 1188")).toEqual(["1188"]);
    expect(detectLast4("XXXX XXXX XXXX 4821")).toEqual(["4821"]);
    expect(detectLast4("4375XXXXXXXX9012")).toEqual(["9012"]);
    expect(detectLast4("Membership Number XXXX-XXXXXX-91005")).toEqual(["1005"]);
    expect(detectLast4("Your card ending 6610")).toEqual(["6610"]);
    expect(detectLast4("Reference 1234 5678 9012 3456")).toEqual([]);
  });
});

describe("SBI Card", () => {
  const p = parse(SBI);
  it("detects the card", () => {
    expect(p.issuer?.bank).toBe("SBI Card");
    expect(p.last4).toBe("4821");
    expect(p.matches[0]).toMatchObject({ id: "sbi-cashback", confidence: "high" });
    expect(p.period).toEqual({ from: "2025-11-13", to: "2025-12-12" });
  });
  it("classifies rows", () => {
    expect(p.counts).toEqual({ expense: 5, reward: 1, payment: 1, refund: 1, charge: 2 });
    const swiggy = byKind(p, "expense").find((t) => t.description.startsWith("SWIGGY"))!;
    expect(swiggy.description).toBe("SWIGGY LIMITED BANGALORE IN"); // wrapped line merged
    expect(swiggy.row).toMatchObject({ date: "2025-11-19", amount: "486", category: "food_delivery", merchant: "Swiggy" });
    const netflix = byKind(p, "expense").find((t) => t.description.startsWith("NETFLIX"))!;
    expect(netflix.amount).toBe(1302.4);
    expect(netflix.row?.channel).toBe("international");
    expect(byKind(p, "reward")[0].row).toMatchObject({ amount: "312.4", date: "2025-11-25" });
  });
  it("reads the summary and checks totals", () => {
    expect(p.summary).toMatchObject({ opening: 12000, debits: 9870, fees: 590, totalDue: 10460 });
    expect(p.check.status).toBe("match");
  });
});

describe("HDFC Bank", () => {
  const p = parse(HDFC);
  it("detects the card", () => {
    expect(p.issuer?.bank).toBe("HDFC Bank");
    expect(p.last4).toBe("1188");
    expect(p.matches[0]).toMatchObject({ id: "hdfc-millennia" });
    expect(p.summary.totalDue).toBe(8105);
    expect(p.summary.minDue).toBe(410);
  });
  it("ignores reward points and the ₹ glyph, reads + as credit", () => {
    expect(p.counts).toEqual({ expense: 4, reward: 1, payment: 1, refund: 0, charge: 0 });
    const amounts = byKind(p, "expense").map((t) => t.amount);
    expect(amounts).toEqual([642, 765.2, 356, 6341.8]);
    expect(byKind(p, "expense")[0].row).toMatchObject({ date: "2025-12-07", merchant: "Zomato", category: "food_delivery" });
    expect(byKind(p, "reward")[0].amount).toBe(150);
    expect(byKind(p, "payment")[0].amount).toBe(5000);
  });
});

describe("ICICI Bank", () => {
  const p = parse(ICICI);
  it("detects the card and period", () => {
    expect(p.issuer?.bank).toBe("ICICI Bank");
    expect(p.last4).toBe("9012");
    expect(p.matches[0]).toMatchObject({ id: "amazon-icici", confidence: "high" });
    expect(p.period).toEqual({ from: "2025-10-16", to: "2025-11-15" });
    expect(p.summary.totalDue).toBe(14210);
  });
  it("handles serial numbers, foreign amounts, refunds and GST", () => {
    expect(p.counts).toEqual({ expense: 3, reward: 0, payment: 1, refund: 1, charge: 2 });
    const openai = byKind(p, "expense").find((t) => t.description.includes("OPENAI"))!;
    expect(openai.amount).toBe(1780);
    expect(openai.currency).toBe("USD");
    expect(openai.row?.channel).toBe("international");
    expect(openai.description.startsWith("11223344553")).toBe(false);
    expect(byKind(p, "expense").find((t) => t.description.includes("IRCTC"))?.row?.category).toBe("travel");
  });
});

describe("Axis Bank", () => {
  const p = parse(AXIS);
  it("detects MY Zone and picks the amount column, not cashback earned", () => {
    expect(p.issuer?.bank).toBe("Axis Bank");
    expect(p.last4).toBe("7730");
    expect(p.matches[0]).toMatchObject({ id: "axis-my-zone", confidence: "high" });
    expect(p.counts).toEqual({ expense: 4, reward: 0, payment: 1, refund: 0, charge: 0 });
    expect(byKind(p, "expense").map((t) => t.amount)).toEqual([486, 980, 119, 3032.5]);
    expect(byKind(p, "expense")[3].row?.category).toBe("fuel");
    expect(p.summary.totalDue).toBe(4617.5);
  });
});

describe("HSBC", () => {
  const p = parse(HSBC);
  it("infers years across the year boundary", () => {
    expect(p.issuer?.bank).toBe("HSBC");
    expect(p.matches[0]).toMatchObject({ id: "hsbc-live-plus", confidence: "high" });
    expect(p.last4).toBe("5521");
    const dates = p.txns.map((t) => t.date);
    expect(dates).toEqual(["2025-12-23", "2025-12-24", "2025-12-30", "2026-01-02", "2026-01-05"]);
  });
  it("classifies and reconciles with the balance", () => {
    expect(p.counts).toEqual({ expense: 3, reward: 1, payment: 1, refund: 0, charge: 0 });
    expect(p.check).toMatchObject({ status: "match", label: "balance" });
  });
});

describe("American Express", () => {
  const p = parse(AMEX);
  it("reads Month-dd dates and 15-digit numbers", () => {
    expect(p.issuer?.bank).toBe("American Express");
    expect(p.last4).toBe("1005");
    expect(p.matches[0]).toMatchObject({ id: "amex-mrcc" });
    expect(p.txns.map((t) => t.date)).toEqual(["2025-11-22", "2025-11-29", "2025-12-03", "2025-12-14"]);
    expect(p.counts).toMatchObject({ expense: 3, payment: 1 });
    expect(p.check.status).toBe("match");
  });
});

describe("Kotak", () => {
  const p = parse(KOTAK);
  it("reads a separate Dr/Cr column", () => {
    expect(p.issuer?.bank).toBe("Kotak Mahindra Bank");
    expect(p.last4).toBe("3307");
    expect(p.matches[0]).toMatchObject({ id: "kotak-league-platinum" });
    expect(p.counts).toMatchObject({ expense: 2, payment: 1 });
    expect(p.period.to).toBe("2025-11-18");
  });
});

describe("mismatch warning", () => {
  it("flags a parse that misses rows", () => {
    const broken = SBI.replace(/^28 Nov 25.*$/m, "28 Nov 25     DMART AVENUE SUPERMARTS LTD");
    expect(parse(broken).check.status).toBe("mismatch");
  });
});

describe("statements without Dr/Cr markers", () => {
  it("falls back to text cues for payments and cashback", () => {
    const p = parse(`
ACME BANK
01/03/2026   PAYMENT RECEIVED THANK YOU    5,000.00
02/03/2026   CASHBACK CREDIT                  120.00
03/03/2026   ZEPTO MARKETPLACE                845.00
`);
    expect(p.counts).toMatchObject({ payment: 1, reward: 1, expense: 1 });
  });
});

describe("positioned text", () => {
  it("rebuilds lines and columns from pdf.js items", () => {
    const lines = buildLines([
      [
        { str: "12/09/2025", x: 40, y: 700, w: 40, h: 8 },
        { str: "AMAZON", x: 100, y: 700.5, w: 28, h: 8 },
        { str: "PAY", x: 130, y: 700, w: 14, h: 8 },
        { str: "1,234.00", x: 400, y: 699.6, w: 30, h: 8 },
        { str: "Cr", x: 432, y: 700, w: 8, h: 8 },
        { str: "Next line", x: 40, y: 688, w: 40, h: 8 },
      ],
    ]);
    expect(lines.map((l) => l.text)).toEqual(["12/09/2025  AMAZON PAY  1,234.00 Cr", "Next line"]);
  });
});

describe("product matching", () => {
  it("prefers the most specific name", () => {
    expect(matchProducts("PHONEPE SBI CARD SELECT BLACK", "SBI Card", CATALOG)[0].id).toBe("phonepe-sbi-select-black");
    expect(matchProducts("Regalia Gold Credit Card", "HDFC Bank", CATALOG)[0].id).toBe("hdfc-regalia-gold");
    expect(matchProducts("nothing here", "HDFC Bank", CATALOG)).toEqual([]);
  });
});

describe("wallet card resolution", () => {
  const wallet = [
    { id: "w1", productId: "sbi-cashback", bank: "SBI Card", last4: "4821" },
    { id: "w2", productId: "hdfc-millennia", bank: "HDFC Bank", last4: null },
  ];
  it("matches by last 4, then by product", () => {
    expect(resolveWalletCard(wallet, { id: "sbi-elite", bank: "SBI Card" }, "4821")?.card.id).toBe("w1");
    expect(resolveWalletCard(wallet, { id: "hdfc-millennia", bank: "HDFC Bank" }, "1188")).toMatchObject({ card: { id: "w2" }, setLast4: true });
    expect(resolveWalletCard(wallet, { id: "axis-ace", bank: "Axis Bank" }, "4821")).toBeNull();
  });
});

describe("anonymised layout", () => {
  it("masks names and numbers but keeps statement words", () => {
    const out = anonymiseLines(linesFromText("12 Sep 25   RAJESH STORE   1,299.00 D\nTotal Amount Due  5,000.00"));
    expect(out).toContain("99 Sep 99 | XXXXXX XXXXX | 9,999.99 D");
    expect(out).toContain("Total Amount Due | 9,999.99");
    expect(out).not.toMatch(/RAJESH|1,299/);
  });
});
