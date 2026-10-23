import { describe, expect, it } from "vitest";
import { CATEGORY_MAP, MERCHANTS } from "../data/categories";
import { ALIASES, ALIAS_COUNT, categorize, categoryFromMcc, isInternational, isRewardCredit, normalizeDescriptor, prettifyDescriptor } from "./categorize";

type Case = [description: string, merchant: string | null, category: string, channel?: string];

/*
 * Realistic statement descriptors. Decisions worth knowing:
 * - Sub-brands keep the parent merchant so card rules still match ("Swiggy", "Amazon") but get their own
 *   category: Swiggy Instamart → groceries, Amazon Fresh → groceries, Amazon Prime Video → entertainment.
 * - Uber Eats (closed in India in 2020) shows up in old statements as its own merchant, food delivery.
 * - Wallet/aggregator names (Paytm, PhonePe, CRED) are weak: the rest of the descriptor decides the category.
 */
const CASES: Case[] = [
  // Food delivery & quick commerce
  ["UPI/SWIGGY/BANGALORE/1234567", "Swiggy", "food_delivery", "online"],
  ["POS 4521XXXXXXXX1188 BUNDL TECHNOLOGIES PVT BANGALORE", "Swiggy", "food_delivery", "online"],
  ["RAZ*SWIGGY BANGALORE IN", "Swiggy", "food_delivery", "online"],
  ["SWIGGY INSTAMART BANGALORE", "Swiggy", "groceries", "online"],
  ["SWIGGYINSTAMART 9876543210", "Swiggy", "groceries"],
  ["ZOMATO LTD GURGAON", "Zomato", "food_delivery", "online"],
  ["PAYU*ZOMATO ONLINE ORDER", "Zomato", "food_delivery"],
  ["UBER EATS INDIA BV", "Uber Eats", "food_delivery"],
  ["DOMINO'S PIZZA 1124 PUNE", "Dominos", "food_delivery"],
  ["JUBILANT FOODWORKS LTD NOIDA", "Dominos", "food_delivery"],
  ["BLINKIT GURGAON", "Blinkit", "groceries", "online"],
  ["ZEPTO MARKETPLACE PRIVATE LI MUMBAI", "Zepto", "groceries"],
  ["KIRANAKART TECHNOLOGIES", "Zepto", "groceries"],
  ["BIGBASKET.COM BANGALORE", "BigBasket", "groceries", "online"],
  ["INNOVATIVE RETAIL CONCEPTS PVT LTD", "BigBasket", "groceries"],
  // Groceries offline
  ["DMART AVENUE SUPERMARTS LTD THANE", "DMart", "groceries", "offline"],
  ["AVENUE SUPERMARTS LTD", "DMart", "groceries"],
  ["RELIANCE SMART BAZAAR HSR", "Reliance Smart", "groceries"],
  ["SRI LAKSHMI SUPERMARKET HSR LAYOUT", null, "groceries", "offline"],
  ["NAMDHARI FRESH JAYANAGAR", null, "groceries"],
  // E-commerce
  ["AMAZON PAY INDIA PRIVATE LIMITED", "Amazon", "shopping", "online"],
  ["AMZN Mktp IN", "Amazon", "shopping", "online"],
  ["WWW.AMAZON.IN", "Amazon", "shopping", "online"],
  ["AMAZON FRESH BANGALORE", "Amazon", "groceries"],
  ["AMAZON PRIME VIDEO", "Amazon", "entertainment"],
  ["AMAZON PAY ADD MONEY TO WALLET", "Amazon", "wallet"],
  ["FLIPKART INTERNET PVT LTD", "Flipkart", "shopping", "online"],
  ["MYNTRA DESIGNS PVT LTD BANGALORE", "Myntra", "shopping"],
  ["FSN E-COMMERCE VENTURES (NYKAA)", "Nykaa", "shopping"],
  ["CCAVENUE*TATACLIQ", "Tata CLiQ", "shopping"],
  ["CROMA INFINITI RETAIL ANDHERI", "Croma", "shopping", "offline"],
  ["RELIANCE DIGITAL RETAIL LTD", "Reliance Digital", "shopping"],
  ["H&M HENNES AND MAURITZ PHOENIX", "H&M", "shopping"],
  ["APOLLO TYRES LTD", "Apollo Tyres", "shopping"],
  // Fuel
  ["BPCL COCO KORAMANGALA", "BPCL", "fuel", "offline"],
  ["HPCL SAI BABA AUTO SERVICES", "HPCL", "fuel", "offline"],
  ["INDIAN OIL CORPORATION LTD", "Indian Oil", "fuel"],
  ["JIO-BP MOBILITY STATION", "Jio-bp", "fuel"],
  ["SHELL INDIA MARKETS BLR", "Shell", "fuel"],
  ["SRI VENKATESWARA FILLING STATION", null, "fuel", "offline"],
  // Travel
  ["INDIGO AIRLINES", "IndiGo", "travel", "online"],
  ["INTERGLOBE AVIATION LTD", "IndiGo", "travel"],
  ["AIR INDIA LTD WEB", "Air India", "travel"],
  ["VISTARA TATA SIA AIRLINES", "Air India", "travel"],
  ["MAKEMYTRIP INDIA PVT LTD", "MakeMyTrip", "travel"],
  ["IRCTC E TICKETING", "IRCTC", "travel"],
  ["UBER INDIA SYSTEMS PVT LTD", "Uber", "travel", "online"],
  ["UBER *TRIP HELP.UBER.COM SAN FRANCISCO USD 23.10", "Uber", "travel", "international"],
  ["OLA CABS ANI TECHNOLOGIES", "Ola", "travel"],
  ["AIRBNB * HMXYZ123", "Airbnb", "travel", "international"],
  ["BOOKING.COM AMSTERDAM", "Booking.com", "travel", "international"],
  ["HOTEL SEA VIEW RESORT GOA", null, "travel"],
  // Utilities & telecom
  ["BESCOM ELECTRICITY BILL", "BESCOM", "utilities", "online"],
  ["BILLDESK*BESCOM", "BESCOM", "utilities"],
  ["AIRTEL PAYMENTS POSTPAID", "Airtel", "utilities"],
  ["RELIANCE JIO INFOCOMM LTD", "Jio", "utilities"],
  ["TATA PLAY LIMITED DTH", "Tata Play", "utilities"],
  ["MAHANAGAR GAS LTD", "Mahanagar Gas", "utilities"],
  ["PAYTM MOBILE RECHARGE", "Paytm", "utilities"],
  // Entertainment
  ["NETFLIX.COM LOS GATOS USD 15.49", "Netflix", "entertainment", "international"],
  ["NETFLIX.COM MUMBAI", "Netflix", "entertainment", "online"],
  ["SPOTIFY INDIA", "Spotify", "entertainment"],
  ["PVR CINEMAS FORUM MALL", "PVR", "entertainment", "offline"],
  ["BOOKMYSHOW BIGTREE ENTERTAINMENT", "BookMyShow", "entertainment"],
  ["HOTSTAR NOVI DIGITAL", "JioHotstar", "entertainment"],
  ["APPLE.COM/BILL ITUNES.COM", "Apple", "entertainment"],
  ["GOOGLE *YouTubePremium g.co/helppay#", "YouTube", "entertainment"],
  ["STEAMGAMES.COM 4259522985 WA USA", "Steam", "entertainment", "international"],
  // Health
  ["APOLLO PHARMACY", "Apollo", "health"],
  ["TATA 1MG HEALTHCARE", "1mg", "health"],
  ["CULTFIT HEALTHIFYME", "Cult.fit", "health"],
  ["SHREE BALAJI MEDICAL AND GENERAL STORES", null, "health", "offline"],
  ["MANIPAL HOSPITALS OLD AIRPORT ROAD", "Manipal Hospitals", "health"],
  // Insurance
  ["HDFC LIFE INSURANCE PREMIUM", "HDFC Life", "insurance", "online"],
  ["LIC OF INDIA PREMIUM", "LIC", "insurance"],
  ["STAR HEALTH AND ALLIED INSURANCE", "Star Health", "insurance"],
  ["NEW INDIA ASSURANCE CO LTD", null, "insurance"],
  // Education
  ["BYJU'S THINK AND LEARN", "BYJU'S", "education"],
  ["DELHI PUBLIC SCHOOL FEES", null, "education"],
  ["AAKASH COACHING CLASSES", null, "education"],
  // Rent
  ["NOBROKER RENT", "NoBroker", "rent", "online"],
  ["CRED RENT PAYMENT", "CRED", "rent"],
  ["HOUSE RENT OCT", null, "rent"],
  // Wallet
  ["PAYTM ADD MONEY", "Paytm", "wallet", "online"],
  ["MOBIKWIK WALLET TOPUP", "MobiKwik", "wallet"],
  // Government
  ["INCOME TAX CHALLAN", "Income Tax", "government", "online"],
  ["TIN NSDL ADVANCE TAX", "Income Tax", "government"],
  ["KARNATAKA RTO E CHALLAN", null, "government"],
  ["PASSPORT SEVA ONLINE", "Passport Seva", "government"],
  // Dining
  ["CAFE COFFEE DAY", "Cafe Coffee Day", "dining", "offline"],
  ["STARBUCKS TATA STARBUCKS INDIRANAGAR", "Starbucks", "dining"],
  ["MCDONALD'S HARDCASTLE RESTAURANTS", "McDonald's", "dining"],
  ["PUNJABI DHABA NH48", null, "dining", "offline"],
  ["TOIT BREWPUB", null, "dining"],
  ["MTR RESTAURANT LALBAGH", null, "dining"],
  ["HOTEL SAI RESTAURANT", null, "dining"],
  // Software (bills)
  ["AWS EMEA aws.amazon.com", "AWS", "utilities"],
  ["OPENAI *CHATGPT SUBSCR SAN FRANCISCO", "OpenAI", "utilities", "international"],
  ["MICROSOFT*OFFICE 365", "Microsoft", "utilities"],
  // False-positive guards
  ["OLAY SKIN CARE STORE", null, "shopping"],
  ["ZOLAKART", null, "other"],
  ["PARENT TEACHER ASSOCIATION", null, "other"],
  ["TAXI STAND KEMPEGOWDA", null, "travel"],
  ["CREDIT VOUCHER 1023", null, "other"],
  ["XYZ TRADING 99887766", null, "other", "offline"],
  ["SUBRAMANYA TRADERS", null, "other"],
  ["BARBEQUE NATION KORAMANGALA", "Barbeque Nation", "dining"],
];

describe("categorize", () => {
  it.each(CASES)("%s", (description, merchant, category, channel) => {
    const r = categorize({ description });
    expect(r.merchant).toBe(merchant);
    expect(r.category).toBe(category);
    if (channel) expect(r.channel).toBe(channel);
    expect(CATEGORY_MAP[r.category]).toBeTruthy();
  });

  it("covers a large test set with full accuracy", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(60);
    const correct = CASES.filter(([d, m, c]) => {
      const r = categorize({ description: d });
      return r.merchant === m && r.category === c;
    }).length;
    expect(correct / CASES.length).toBe(1);
  });

  it("reports confidence and match source", () => {
    expect(categorize({ description: "SWIGGY" })).toMatchObject({ confidence: "high", matchedBy: "alias" });
    expect(categorize({ description: "SRI DURGA RESTAURANT" })).toMatchObject({ confidence: "medium", matchedBy: "keyword" });
    expect(categorize({ description: "RANDOM VENDOR 77" })).toMatchObject({ category: "other", confidence: "low", matchedBy: "none", merchant: null });
  });

  it("uses MCC when no alias matches, and alias beats MCC", () => {
    expect(categorize({ description: "SOME NEW PLACE", mcc: "5812" })).toMatchObject({ category: "dining", matchedBy: "mcc", confidence: "high" });
    expect(categorize({ description: "SOME NEW PLACE", mcc: 5541 })).toMatchObject({ category: "fuel" });
    expect(categorize({ description: "ZOMATO", mcc: "5814" })).toMatchObject({ category: "food_delivery", matchedBy: "alias" });
    // MCC outranks a keyword guess.
    expect(categorize({ description: "GRAND HOTEL", mcc: "5812" }).category).toBe("dining");
  });

  it("marks foreign currency as international", () => {
    expect(categorize({ description: "SPOTIFY AB", currency: "EUR" }).channel).toBe("international");
    expect(categorize({ description: "SPOTIFY AB", currency: "INR" }).channel).toBe("online");
    expect(categorize({ description: "SOME SHOP AED 120.00" }).channel).toBe("international");
    expect(categorize({ description: "PVR CINEMAS", currency: "Rs." }).channel).toBe("offline");
  });

  it("flags card charges", () => {
    for (const d of ["FINANCE CHARGES", "LATE PAYMENT FEE", "IGST @18% ON LATE FEE", "ANNUAL FEE", "FUEL SURCHARGE REVERSAL"]) {
      expect(categorize({ description: d }).charge, d).toBe(true);
    }
    expect(categorize({ description: "GST PAYMENT PORTAL" }).charge).toBeFalsy();
  });
});

describe("normalizeDescriptor", () => {
  it("strips rails, masks, ids, legal suffixes and cities", () => {
    expect(normalizeDescriptor("UPI/SWIGGY/BANGALORE/1234567")).toBe("SWIGGY");
    expect(normalizeDescriptor("POS 4521XXXXXXXX1188 BUNDL TECHNOLOGIES PVT BANGALORE")).toBe("BUNDL");
    expect(normalizeDescriptor("AMAZON PAY INDIA PRIVATE LIMITED")).toBe("AMAZON PAY");
    expect(normalizeDescriptor("NETFLIX.COM LOS GATOS USD 15.49")).toBe("NETFLIX LOS GATOS");
    expect(normalizeDescriptor("ECOM*RAZ*Blue Tokai Coffee, Mumbai")).toBe("BLUE TOKAI COFFEE");
    expect(normalizeDescriptor("upi-swiggy@icici-ref 4485 1234")).toBe("SWIGGY");
  });

  it("prettifies unknown merchants", () => {
    expect(prettifyDescriptor("POS 1234XXXXXX5678 SRI DURGA RESTAURANT PVT LTD BANGALORE")).toBe("Sri Durga Restaurant");
    expect(prettifyDescriptor("123456789")).toBe("");
  });
});

describe("MCC", () => {
  it.each([
    [5411, "groceries"], [5812, "dining"], [5542, "fuel"], [4900, "utilities"], [6300, "insurance"], [8220, "education"],
    [3005, "travel"], [3612, "travel"], [7011, "travel"], [4112, "travel"], [5912, "health"], [8062, "health"],
    [7832, "entertainment"], [9311, "government"], [6540, "wallet"], [5311, "shopping"], [5732, "shopping"],
  ])("%i → %s", (mcc, cat) => expect(categoryFromMcc(mcc)).toBe(cat));
  it("ignores junk", () => {
    expect(categoryFromMcc("")).toBeNull();
    expect(categoryFromMcc("abc")).toBeNull();
    expect(categoryFromMcc(1234)).toBeNull();
  });
});

describe("dictionary", () => {
  it("has broad coverage", () => expect(ALIAS_COUNT).toBeGreaterThanOrEqual(150));
  it("only produces valid categories and known merchants", () => {
    const names = new Set(MERCHANTS.map((m) => m.name));
    for (const a of ALIASES) {
      expect(CATEGORY_MAP[a.category], a.merchant).toBeTruthy();
      expect(names.has(a.merchant), a.merchant).toBe(true);
    }
  });
  it("isInternational", () => {
    expect(isInternational("ANYTHING", "usd")).toBe(true);
    expect(isInternational("ANYTHING", "INR")).toBe(false);
    expect(isInternational("CAFE IN SINGAPORE SG")).toBe(true);
    expect(isInternational("BAGS AND SHOES")).toBe(false);
  });
});

describe("isRewardCredit", () => {
  it.each([
    "CASHBACK", "CASHBACK CREDIT", "CASH BACK CREDITED", "REWARD CREDIT", "REWARDS REDEMPTION", "REWARD POINTS REDEMPTION",
    "STATEMENT CREDIT", "CB CREDIT", "CB CR 0925", "AMAZON PAY CASHBACK", "INSTANT CASHBACK - FLIPKART BBD",
    "SBI CARD CASHBACK FOR SEP-26", "Cashback credited on statement",
  ])("%s is a reward credit", (d) => expect(isRewardCredit(d)).toBe(true));

  it.each([
    "PAYMENT RECEIVED - THANK YOU", "AMAZON PAY INDIA PRIVATE LIMITED REFUND", "REVERSAL OF FUEL SURCHARGE", "NEFT CR HDFC0000001",
    "CASHBACK REVERSAL", "SWIGGY BANGALORE", "", null,
  ])("%s is not", (d) => expect(isRewardCredit(d)).toBe(false));
});
