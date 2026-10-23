// Automatic transaction categorisation from raw bank statement text.
// Pure: no DB or framework imports, so it runs on the client, the server and in unit tests.
// Relative imports (not "@/") so Vitest can load this without a path-alias config.
import { CATEGORY_MAP } from "../data/categories";
import type { Channel } from "../engine/types";

export type Confidence = "high" | "medium" | "low";
export type MatchedBy = "alias" | "mcc" | "keyword" | "none";

export interface CategorizeInput {
  description: string;
  mcc?: string | number | null;
  /** Transaction currency from a statement column, e.g. "USD". Anything other than INR means international. */
  currency?: string | null;
}

export interface CategorizeResult {
  /** Canonical merchant name (matches MERCHANTS / reward rules), or null when unknown. */
  merchant: string | null;
  category: string;
  channel: Channel;
  confidence: Confidence;
  matchedBy: MatchedBy;
  /** Card charges (fees, interest, GST on fees). Not a purchase; imports skip these. */
  charge?: boolean;
}

/* ---------- Descriptor cleanup ---------- */

// Transaction-rail and card-network noise. Removed wherever it appears as a whole word.
const RAIL_TOKENS = [
  "UPI", "POS", "ECOM", "IMPS", "NEFT", "RTGS", "ACH", "NACH", "MPS", "VPS", "IPS", "TXN", "TRANSACTION", "PURCHASE",
  "SPENT", "AT", "REF", "NO", "VISA", "MASTERCARD", "RUPAY", "AMEX", "DINERS", "CARD", "DEBIT", "PG", "WWW", "HTTP", "HTTPS",
  "MANDATE", "AUTOPAY", "RECURRING", "SI",
];
// Payment gateways that prefix the real merchant ("RAZ*SWIGGY", "PAYU*ZOMATO", "BILLDESK*BESCOM").
const GATEWAY_TOKENS = [
  "RAZ", "RAZORPAY", "RAZORPAYSOFTWARE", "RZP", "PAYU", "PAYUPAYMENTS", "CCAVENUE", "CCAVENUES", "AVENUES", "BILLDESK",
  "BDSK", "CASHFREE", "CF", "JUSPAY", "PAYGLOCAL", "PINELABS", "PINE", "EASEBUZZ", "PAYGATE", "INSTAMOJO", "PHI",
];
// Words that never identify a merchant (legal suffixes, country, generic web).
const ENTITY_TOKENS = [
  "PVT", "PRIVATE", "LTD", "LIMITED", "LLP", "LLC", "INC", "CORP", "CORPORATION", "CO", "COMPANY", "INDIA", "IND", "IN",
  "COM", "NET", "ORG", "THE", "OF", "SERVICES", "SERVICE", "SOLUTIONS", "TECHNOLOGIES", "TECHNOLOGY", "ENTERPRISES",
];
const CITY_TOKENS = [
  "BANGALORE", "BENGALURU", "BANGLORE", "BLR", "MUMBAI", "BOMBAY", "DELHI", "NEW", "NEWDELHI", "GURGAON", "GURUGRAM", "NOIDA",
  "HYDERABAD", "SECUNDERABAD", "CHENNAI", "MADRAS", "PUNE", "KOLKATA", "CALCUTTA", "AHMEDABAD", "JAIPUR", "LUCKNOW",
  "CHANDIGARH", "KOCHI", "COCHIN", "THANE", "NAVI", "INDORE", "BHOPAL", "SURAT", "NAGPUR", "VADODARA", "COIMBATORE",
  "MYSORE", "MYSURU", "GOA", "VISAKHAPATNAM", "PATNA", "BHUBANESWAR", "GHAZIABAD", "FARIDABAD", "MOHALI", "KA", "MH", "DL",
  "TN", "TS", "HR", "UP", "WB", "GJ", "KL", "RJ", "KORAMANGALA", "INDIRANAGAR", "WHITEFIELD", "ANDHERI", "BANDRA",
];

const NOISE = new Set([...RAIL_TOKENS, ...GATEWAY_TOKENS]);
const DISPLAY_NOISE = new Set([...ENTITY_TOKENS, ...CITY_TOKENS]);

/**
 * Uppercase, punctuation-free tokens with rail prefixes, gateway prefixes, card masks and reference ids removed.
 * Keeps brand-bearing words like INDIA (AIR INDIA) so aliases can still match.
 */
function cleanDescriptor(raw: string): string {
  let s = ` ${String(raw ?? "").toUpperCase()} `;
  s = s
    .replace(/@[A-Z0-9.]+/g, " ") // UPI handle suffix (swiggy@icici)
    .replace(/\b\d{4,6}[X*]{2,}\d{2,6}\b/g, " ") // masked card 4521XXXXXXXX1188
    .replace(/[X*]{4,}\s?\d{2,4}\b/g, " ") // XXXX1188, ****1188
    .replace(/\b(?:USD|EUR|GBP|SGD|AED|AUD|CAD|JPY|INR|RS)\s?\d[\d,]*(?:\.\d+)?\b/g, " ") // currency + amount
    .replace(/\b\d[\d,]*\.\d{1,2}\b/g, " ") // bare amounts 15.49
    .replace(/(\w)['’`](\w)/g, "$1$2") // DOMINO'S → DOMINOS
    .replace(/(\w)&(\w)/g, "$1$2") // H&M → HM
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ");
  const tokens = s.split(" ").filter((t) => {
    if (!t || NOISE.has(t)) return false;
    if (/^\d{5,}$/.test(t)) return false; // reference numbers
    if (t.length >= 8 && (t.match(/\d/g)?.length ?? 0) >= 4) return false; // mixed ref ids, QR codes
    return true;
  });
  return tokens.join(" ");
}

/**
 * Human-readable, comparable form of a raw descriptor: uppercase, without rail/gateway prefixes, card masks,
 * reference ids, legal suffixes (PVT LTD, PRIVATE LIMITED), INDIA, .COM, common Indian city names and punctuation.
 */
export function normalizeDescriptor(raw: string): string {
  const tokens = cleanDescriptor(raw)
    .split(" ")
    .filter((t) => t && !DISPLAY_NOISE.has(t) && !/^\d{1,4}$/.test(t));
  return tokens.join(" ");
}

/** "BLUE TOKAI COFFEE" → "Blue Tokai Coffee". Empty when nothing meaningful is left. */
export function prettifyDescriptor(raw: string): string {
  const n = normalizeDescriptor(raw).slice(0, 48).trim();
  return n
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .trim();
}

/* ---------- Merchant aliases ---------- */

interface AliasDef {
  merchant: string;
  category: string;
  channel: Channel;
  /**
   * Whole-word phrases matched against the cleaned descriptor. A trailing "*" lets the last word be a prefix
   * ("SWIGGY*" matches "SWIGGYINSTAMART"); put more specific entries earlier.
   */
  patterns: string[];
  /** Foreign entity that bills cross-border: channel is international. */
  foreign?: boolean;
  /** Aggregator/wallet name: only used when nothing more specific matches, and keyword/MCC can refine the category. */
  weak?: boolean;
}

type Row = [merchant: string, category: string, channel: Channel, patterns: string[], flags?: { foreign?: boolean; weak?: boolean }];

// Order matters: the first matching entry wins, so sub-brands come before their parent brand.
const ROWS: Row[] = [
  // Card charges are handled separately (see CHARGE_RE). Fuel first so "JIO BP" isn't Jio telecom.
  ["Jio-bp", "fuel", "offline", ["JIO BP", "JIOBP", "RELIANCE BP", "RBML"]],
  ["Indian Oil", "fuel", "offline", ["INDIAN OIL*", "INDIANOIL*", "IOCL", "IOC", "IOCL*"]],
  ["Bharat Gas", "utilities", "online", ["BHARAT GAS", "BHARATGAS"]],
  ["BPCL", "fuel", "offline", ["BPCL*", "BHARAT PETROLEUM", "BHARAT PETRO*", "BHARATPETROLEUM"]],
  ["HPCL", "fuel", "offline", ["HPCL*", "HINDUSTAN PETROLEUM", "HP PETROL*", "HP PAY", "HP FUEL*", "HP AUTO CARE"]],
  ["Shell", "fuel", "offline", ["SHELL", "SHELL INDIA*", "SHELL PETROL*"]],
  ["Nayara", "fuel", "offline", ["NAYARA*", "ESSAR OIL", "ESSAR PETRO*"]],
  ["Indane", "utilities", "online", ["INDANE*"]],

  // Quick commerce / groceries (before their parent brands)
  ["Swiggy", "groceries", "online", ["SWIGGY INSTAMART", "SWIGGYINSTAMART", "INSTAMART", "SWIGGY INSTA*"]],
  ["Swiggy", "dining", "online", ["SWIGGY DINEOUT", "SWIGGYDINEOUT", "DINEOUT"]],
  ["Amazon", "groceries", "online", ["AMAZON FRESH", "AMAZONFRESH", "AMZN FRESH"]],
  ["Amazon", "entertainment", "online", ["AMAZON PRIME*", "AMZN PRIME*", "PRIME VIDEO", "PRIMEVIDEO*", "AMAZON VIDEO", "AMZN DIGITAL", "AMAZON DIGITAL"]],
  ["AWS", "utilities", "online", ["AWS", "AWS EMEA", "AMAZON WEB SERVICES", "AMAZON INTERNET SERVICES"]],
  ["Audible", "entertainment", "online", ["AUDIBLE*"]],
  ["JioMart", "groceries", "online", ["JIOMART*", "JIO MART"]],
  ["Blinkit", "groceries", "online", ["BLINKIT*", "GROFERS*", "BLINK COMMERCE"]],
  ["Zepto", "groceries", "online", ["ZEPTO*", "KIRANAKART*"]],
  ["BigBasket", "groceries", "online", ["BIGBASKET*", "BIG BASKET", "BBNOW", "BB NOW", "BBDAILY", "BB DAILY", "SUPERMARKET GROCERY SUPPLIES", "INNOVATIVE RETAIL CONCEPTS"]],
  ["DMart", "groceries", "offline", ["DMART*", "D MART", "AVENUE SUPERMARTS", "AVENUE E COMMERCE"]],
  ["Reliance Smart", "groceries", "offline", ["RELIANCE FRESH", "RELIANCE SMART*", "SMART BAZAAR", "SMART POINT"]],
  ["More", "groceries", "offline", ["MORE RETAIL", "MORE SUPERMARKET", "MORE MEGASTORE", "MORE HYPERMARKET"]],
  ["Spencer's", "groceries", "offline", ["SPENCERS*", "SPENCER S RETAIL"]],
  ["Star Bazaar", "groceries", "offline", ["STAR BAZAAR", "STAR MARKET", "TRENT HYPERMARKET"]],
  ["Big Bazaar", "groceries", "offline", ["BIG BAZAAR", "BIGBAZAAR"]],
  ["Nature's Basket", "groceries", "offline", ["NATURES BASKET", "GODREJ NATURES"]],
  ["Metro Cash & Carry", "groceries", "offline", ["METRO CASH*", "METRO WHOLESALE"]],
  ["Ratnadeep", "groceries", "offline", ["RATNADEEP*"]],
  ["Lulu", "groceries", "offline", ["LULU HYPERMARKET", "LULU MALL", "LULU"]],
  ["Country Delight", "groceries", "online", ["COUNTRY DELIGHT", "COUNTRYDELIGHT"]],
  ["Licious", "groceries", "online", ["LICIOUS", "DELIGHTFUL GOURMET"]],
  ["FreshToHome", "groceries", "online", ["FRESHTOHOME", "FRESH TO HOME"]],

  // Food delivery
  ["Uber Eats", "food_delivery", "online", ["UBER EATS", "UBEREATS*"]],
  ["Swiggy", "food_delivery", "online", ["SWIGGY*", "BUNDL*", "BUNDL TECHNOLOGIES"]],
  ["Zomato", "food_delivery", "online", ["ZOMATO*", "ZOMATO MEDIA", "ETERNAL LTD"]],
  ["Dominos", "food_delivery", "online", ["DOMINOS*", "DOMINO", "JUBILANT FOODWORKS", "JUBILANT FOOD*"]],
  ["EatSure", "food_delivery", "online", ["EATSURE", "REBEL FOODS", "FAASOS", "BEHROUZ*"]],
  ["FreshMenu", "food_delivery", "online", ["FRESHMENU", "FRESH MENU"]],

  // Dining
  ["McDonald's", "dining", "offline", ["MCDONALDS*", "MC DONALDS", "HARDCASTLE RESTAURANTS", "CONNAUGHT PLAZA RESTAURANTS"]],
  ["KFC", "dining", "offline", ["KFC", "DEVYANI INTERNATIONAL", "SAPPHIRE FOODS"]],
  ["Pizza Hut", "dining", "offline", ["PIZZA HUT", "PIZZAHUT"]],
  ["Burger King", "dining", "offline", ["BURGER KING", "BURGERKING", "RESTAURANT BRANDS ASIA"]],
  ["Starbucks", "dining", "offline", ["STARBUCKS*", "TATA STARBUCKS"]],
  ["Cafe Coffee Day", "dining", "offline", ["CAFE COFFEE DAY", "COFFEE DAY*", "CCD"]],
  ["Third Wave Coffee", "dining", "offline", ["THIRD WAVE COFFEE", "THIRDWAVE*"]],
  ["Blue Tokai", "dining", "offline", ["BLUE TOKAI"]],
  ["Chaayos", "dining", "offline", ["CHAAYOS", "SUNSHINE TEAHOUSE"]],
  ["Subway", "dining", "offline", ["SUBWAY"]],
  ["Haldiram's", "dining", "offline", ["HALDIRAM*"]],
  ["Barbeque Nation", "dining", "offline", ["BARBEQUE NATION", "BARBEQUE*", "BARBECUE NATION"]],
  ["Wow! Momo", "dining", "offline", ["WOW MOMO*"]],
  ["Taco Bell", "dining", "offline", ["TACO BELL"]],

  // Shopping
  ["Amazon", "shopping", "online", ["AMAZON*", "AMZN*", "AMAZON PAY", "AMAZON SELLER SERVICES"]],
  ["Flipkart", "shopping", "online", ["FLIPKART*", "FKRT", "INSTAKART"]],
  ["Myntra", "shopping", "online", ["MYNTRA*"]],
  ["Ajio", "shopping", "online", ["AJIO*"]],
  ["Nykaa", "shopping", "online", ["NYKAA*", "FSN E COMMERCE", "FSN ECOMMERCE"]],
  ["Tata CLiQ", "shopping", "online", ["TATA CLIQ", "TATACLIQ"]],
  ["Tata Neu", "shopping", "online", ["TATA NEU", "TATANEU", "TATA DIGITAL"]],
  ["Meesho", "shopping", "online", ["MEESHO*", "FASHNEAR"]],
  ["Snapdeal", "shopping", "online", ["SNAPDEAL*"]],
  ["Croma", "shopping", "offline", ["CROMA*", "INFINITI RETAIL"]],
  ["Reliance Digital", "shopping", "offline", ["RELIANCE DIGITAL", "RELIANCEDIGITAL", "RELIANCE RESQ"]],
  ["Reliance Trends", "shopping", "offline", ["RELIANCE TRENDS", "TRENDS FOOTWEAR"]],
  ["Vijay Sales", "shopping", "offline", ["VIJAY SALES"]],
  ["Westside", "shopping", "offline", ["WESTSIDE"]],
  ["Zudio", "shopping", "offline", ["ZUDIO"]],
  ["Shoppers Stop", "shopping", "offline", ["SHOPPERS STOP", "SHOPPERSSTOP"]],
  ["Lifestyle", "shopping", "offline", ["LIFESTYLE INTERNATIONAL", "LIFESTYLE STORES"]],
  ["Pantaloons", "shopping", "offline", ["PANTALOONS", "ABFRL"]],
  ["H&M", "shopping", "offline", ["HENNES*", "HM HENNES", "H AND M"]],
  ["Uniqlo", "shopping", "offline", ["UNIQLO"]],
  ["Decathlon", "shopping", "offline", ["DECATHLON*"]],
  ["IKEA", "shopping", "offline", ["IKEA*"]],
  ["Lenskart", "shopping", "online", ["LENSKART*"]],
  ["FirstCry", "shopping", "online", ["FIRSTCRY*", "BRAINBEES"]],
  ["Pepperfry", "shopping", "online", ["PEPPERFRY"]],
  ["Apollo Tyres", "shopping", "offline", ["APOLLO TYRES"]],
  ["Tanishq", "shopping", "offline", ["TANISHQ*"]],
  ["Titan", "shopping", "offline", ["TITAN COMPANY", "TITAN WORLD", "TITAN EYE*"]],
  ["Samsung", "shopping", "online", ["SAMSUNG*"]],
  ["OnePlus", "shopping", "online", ["ONEPLUS*", "ONE PLUS"]],
  ["Xiaomi", "shopping", "online", ["XIAOMI*", "MI STORE", "MI COM"]],
  ["boAt", "shopping", "online", ["BOAT LIFESTYLE", "IMAGINE MARKETING"]],
  ["Bata", "shopping", "offline", ["BATA"]],
  ["Nike", "shopping", "offline", ["NIKE*"]],
  ["Adidas", "shopping", "offline", ["ADIDAS*"]],
  ["Puma", "shopping", "offline", ["PUMA"]],
  ["Crossword", "shopping", "offline", ["CROSSWORD"]],
  ["Purplle", "shopping", "online", ["PURPLLE*"]],
  ["Mamaearth", "shopping", "online", ["MAMAEARTH", "HONASA"]],
  ["Apple", "shopping", "offline", ["APPLE STORE", "APPLE INDIA", "APPLE RETAIL"]],
  ["Apple", "entertainment", "online", ["APPLE COM BILL", "APPLE COM", "ITUNES*", "APPLE SERVICES", "APPLE MUSIC", "ICLOUD"]],

  // Travel: OTAs, airlines, rail, cabs, hotels
  ["MakeMyTrip", "travel", "online", ["MAKEMYTRIP*", "MAKE MY TRIP", "MMT"]],
  ["Goibibo", "travel", "online", ["GOIBIBO*", "IBIBO*"]],
  ["Cleartrip", "travel", "online", ["CLEARTRIP*"]],
  ["Yatra", "travel", "online", ["YATRA*"]],
  ["EaseMyTrip", "travel", "online", ["EASEMYTRIP*", "EASE MY TRIP", "EASY TRIP PLANNERS"]],
  ["ixigo", "travel", "online", ["IXIGO*", "LE TRAVENUES"]],
  ["IRCTC", "travel", "online", ["IRCTC*", "INDIAN RAILWAY*"]],
  ["redBus", "travel", "online", ["REDBUS*"]],
  ["AbhiBus", "travel", "online", ["ABHIBUS*"]],
  ["IndiGo", "travel", "online", ["INDIGO*", "INTERGLOBE AVIATION", "INTERGLOBE*"]],
  ["Air India Express", "travel", "online", ["AIR INDIA EXPRESS", "AIRINDIAEXPRESS", "AIX CONNECT", "AIRASIA INDIA"]],
  ["Air India", "travel", "online", ["AIR INDIA*", "AIRINDIA*", "VISTARA", "TATA SIA"]],
  ["SpiceJet", "travel", "online", ["SPICEJET*", "SPICE JET"]],
  ["Akasa Air", "travel", "online", ["AKASA*", "SNV AVIATION"]],
  ["Emirates", "travel", "online", ["EMIRATES*"]],
  ["Singapore Airlines", "travel", "online", ["SINGAPORE AIRLINES", "SINGAPORE AIR"]],
  ["Qatar Airways", "travel", "online", ["QATAR AIRWAYS", "QATAR AIR"]],
  ["Uber", "travel", "online", ["UBER*", "UBER INDIA", "UBER BV"]],
  ["Ola", "travel", "online", ["OLA", "OLACABS*", "OLA CABS", "OLAMONEY", "ANI TECHNOLOGIES"]],
  ["Rapido", "travel", "online", ["RAPIDO*", "ROPPEN TRANSPORTATION"]],
  ["Namma Yatri", "travel", "online", ["NAMMA YATRI", "NAMMAYATRI"]],
  ["BluSmart", "travel", "online", ["BLUSMART*"]],
  ["Zoomcar", "travel", "online", ["ZOOMCAR*"]],
  ["Metro Rail", "travel", "offline", ["BMRCL", "DMRC", "METRO RAIL*", "MUMBAI METRO*", "HYDERABAD METRO*", "CHENNAI METRO*"]],
  ["FASTag", "travel", "online", ["FASTAG*", "NETC FASTAG"]],
  ["Airbnb", "travel", "online", ["AIRBNB*"], { foreign: true }],
  ["Booking.com", "travel", "online", ["BOOKING COM", "BOOKINGCOM", "BOOKING HOTEL*"], { foreign: true }],
  ["Agoda", "travel", "online", ["AGODA*"], { foreign: true }],
  ["Expedia", "travel", "online", ["EXPEDIA*"], { foreign: true }],
  ["OYO", "travel", "online", ["OYO*", "ORAVEL STAYS"]],
  ["Marriott", "travel", "online", ["MARRIOTT*", "JW MARRIOTT", "COURTYARD BY MARRIOTT"]],
  ["Taj Hotels", "travel", "online", ["TAJ HOTEL*", "TAJ MAHAL PALACE", "INDIAN HOTELS", "IHCL", "VIVANTA", "GINGER HOTEL*"]],
  ["ITC Hotels", "travel", "online", ["ITC HOTEL*", "ITC MAURYA", "ITC GRAND*", "WELCOMHOTEL"]],
  ["Hyatt", "travel", "online", ["HYATT*"]],
  ["Hilton", "travel", "online", ["HILTON*"]],
  ["FabHotels", "travel", "online", ["FABHOTELS", "FAB HOTELS"]],
  ["Treebo", "travel", "online", ["TREEBO*"]],

  // Telecom, DTH, broadband
  ["Airtel", "utilities", "online", ["AIRTEL*", "BHARTI AIRTEL", "BHARTI HEXACOM"]],
  ["JioHotstar", "entertainment", "online", ["JIOHOTSTAR", "JIO HOTSTAR", "HOTSTAR*", "DISNEY HOTSTAR", "DISNEYPLUS*", "NOVI DIGITAL", "JIOCINEMA", "JIO CINEMA", "STAR INDIA"]],
  ["JioSaavn", "entertainment", "online", ["JIOSAAVN", "JIO SAAVN", "SAAVN*"]],
  ["Jio", "utilities", "online", ["JIO", "RELIANCE JIO", "JIO FIBER", "JIOFIBER", "JIO PREPAID", "JIO POSTPAID", "RJIL"]],
  ["Vi", "utilities", "online", ["VODAFONE*", "VODAFONE IDEA", "VI POSTPAID", "VI PREPAID", "IDEA CELLULAR"]],
  ["BSNL", "utilities", "online", ["BSNL*"]],
  ["ACT Fibernet", "utilities", "online", ["ACT FIBERNET", "ATRIA CONVERGENCE", "ACTCORP"]],
  ["Hathway", "utilities", "online", ["HATHWAY*"]],
  ["Tata Play", "utilities", "online", ["TATA PLAY*", "TATA SKY", "TATASKY*"]],
  ["Dish TV", "utilities", "online", ["DISH TV", "DISHTV*", "D2H"]],

  // Electricity, water, piped gas
  ["BESCOM", "utilities", "online", ["BESCOM*"]],
  ["Tata Power", "utilities", "online", ["TATA POWER*"]],
  ["Adani Electricity", "utilities", "online", ["ADANI ELECTRICITY*", "AEML"]],
  ["MSEDCL", "utilities", "online", ["MSEDCL*", "MAHADISCOM", "MAHAVITARAN"]],
  ["TANGEDCO", "utilities", "online", ["TANGEDCO*", "TNEB", "TNPDCL"]],
  ["BSES", "utilities", "online", ["BSES*"]],
  ["CESC", "utilities", "online", ["CESC*"]],
  ["TSSPDCL", "utilities", "online", ["TSSPDCL", "TGSPDCL", "APSPDCL", "APEPDCL"]],
  ["KSEB", "utilities", "online", ["KSEB*"]],
  ["BWSSB", "utilities", "online", ["BWSSB"]],
  ["Delhi Jal Board", "utilities", "online", ["DELHI JAL BOARD", "DJB"]],
  ["Mahanagar Gas", "utilities", "online", ["MAHANAGAR GAS", "MGL"]],
  ["IGL", "utilities", "online", ["INDRAPRASTHA GAS", "IGL"]],
  ["Adani Total Gas", "utilities", "online", ["ADANI TOTAL GAS", "ADANI GAS"]],

  // Software, cloud, subscriptions
  ["YouTube", "entertainment", "online", ["YOUTUBE*", "GOOGLE YOUTUBE*", "YT PREMIUM"]],
  ["Google Play", "entertainment", "online", ["GOOGLE PLAY", "GOOGLEPLAY", "PLAY STORE", "GOOGLE PLAYSTORE"]],
  ["Google Pay", "wallet", "online", ["GOOGLE PAY", "GPAY"], { weak: true }],
  ["Google", "utilities", "online", ["GOOGLE*", "GOOGLE CLOUD", "GSUITE", "GOOGLE WORKSPACE"]],
  ["Xbox", "entertainment", "online", ["XBOX*", "MICROSOFT XBOX", "MSFT XBOX"]],
  ["Microsoft", "utilities", "online", ["MICROSOFT*", "MSFT*", "OFFICE 365", "MS OFFICE"]],
  ["Adobe", "utilities", "online", ["ADOBE*"]],
  ["OpenAI", "utilities", "online", ["OPENAI*", "CHATGPT*"], { foreign: true }],
  ["GitHub", "utilities", "online", ["GITHUB*"], { foreign: true }],
  ["Notion", "utilities", "online", ["NOTION SO", "NOTION LABS"], { foreign: true }],
  ["Figma", "utilities", "online", ["FIGMA*"], { foreign: true }],
  ["Zoom", "utilities", "online", ["ZOOM US", "ZOOM VIDEO", "ZOOMUS"], { foreign: true }],
  ["Dropbox", "utilities", "online", ["DROPBOX*"], { foreign: true }],
  ["Canva", "utilities", "online", ["CANVA*"]],

  // OTT, music, movies, gaming
  ["Netflix", "entertainment", "online", ["NETFLIX*"]],
  ["Spotify", "entertainment", "online", ["SPOTIFY*"]],
  ["SonyLIV", "entertainment", "online", ["SONYLIV", "SONY LIV", "CULVER MAX"]],
  ["ZEE5", "entertainment", "online", ["ZEE5*", "ZEE ENTERTAINMENT"]],
  ["BookMyShow", "entertainment", "online", ["BOOKMYSHOW*", "BOOK MY SHOW", "BIGTREE ENTERTAINMENT", "BIGTREE*"]],
  ["PVR", "entertainment", "offline", ["PVR*", "PVR INOX", "INOX*"]],
  ["Cinepolis", "entertainment", "offline", ["CINEPOLIS*"]],
  ["PlayStation", "entertainment", "online", ["PLAYSTATION*", "SONY PLAYSTATION", "PSN"]],
  ["Steam", "entertainment", "online", ["STEAM*", "STEAMGAMES*", "VALVE"], { foreign: true }],
  ["Dream11", "entertainment", "online", ["DREAM11*", "SPORTA TECHNOLOGIES"]],
  ["Wonderla", "entertainment", "offline", ["WONDERLA*"]],
  ["Imagicaa", "entertainment", "offline", ["IMAGICA*"]],

  // Health & pharmacy
  ["Apollo", "health", "offline", ["APOLLO*", "APOLLO PHARMACY", "APOLLO HOSPITAL*", "APOLLO 247"]],
  ["1mg", "health", "online", ["1MG", "TATA 1MG", "TATA1MG", "ONEMG"]],
  ["Netmeds", "health", "online", ["NETMEDS*"]],
  ["PharmEasy", "health", "online", ["PHARMEASY*", "AXELIA SOLUTIONS"]],
  ["MedPlus", "health", "offline", ["MEDPLUS*", "OPTIVAL HEALTH"]],
  ["Wellness Forever", "health", "offline", ["WELLNESS FOREVER"]],
  ["Practo", "health", "online", ["PRACTO*"]],
  ["Cult.fit", "health", "online", ["CULT FIT", "CULTFIT*", "CUREFIT*", "CURE FIT", "CULT"]],
  ["Fortis", "health", "offline", ["FORTIS*"]],
  ["Max Healthcare", "health", "offline", ["MAX HEALTHCARE", "MAX HOSPITAL*", "MAX SUPER SPECIALITY"]],
  ["Manipal Hospitals", "health", "offline", ["MANIPAL HOSPITAL*"]],
  ["Narayana Health", "health", "offline", ["NARAYANA HEALTH", "NARAYANA HRUDAYALAYA"]],
  ["Dr Lal PathLabs", "health", "offline", ["LAL PATHLABS", "LAL PATH LABS", "DR LAL*"]],
  ["Thyrocare", "health", "online", ["THYROCARE*"]],
  ["Metropolis", "health", "offline", ["METROPOLIS HEALTHCARE", "METROPOLIS LAB*"]],

  // Insurance
  ["LIC", "insurance", "online", ["LIC", "LIC OF INDIA", "LICI", "LIFE INSURANCE CORP*"]],
  ["HDFC Life", "insurance", "online", ["HDFC LIFE*", "HDFC STANDARD LIFE", "HDFCLIFE"]],
  ["HDFC Ergo", "insurance", "online", ["HDFC ERGO*"]],
  ["ICICI Prudential", "insurance", "online", ["ICICI PRU*", "ICICIPRU*"]],
  ["ICICI Lombard", "insurance", "online", ["ICICI LOMBARD", "ICICILOMBARD"]],
  ["SBI Life", "insurance", "online", ["SBI LIFE*", "SBILIFE"]],
  ["SBI General", "insurance", "online", ["SBI GENERAL*"]],
  ["Axis Max Life", "insurance", "online", ["MAX LIFE*", "AXIS MAX LIFE"]],
  ["Tata AIA", "insurance", "online", ["TATA AIA*"]],
  ["Tata AIG", "insurance", "online", ["TATA AIG*"]],
  ["Bajaj Allianz", "insurance", "online", ["BAJAJ ALLIANZ*", "BAJAJ GENERAL", "BAJAJ LIFE"]],
  ["Star Health", "insurance", "online", ["STAR HEALTH*"]],
  ["Niva Bupa", "insurance", "online", ["NIVA BUPA", "MAX BUPA"]],
  ["Care Health", "insurance", "online", ["CARE HEALTH*", "RELIGARE HEALTH"]],
  ["Acko", "insurance", "online", ["ACKO*"]],
  ["Digit Insurance", "insurance", "online", ["GO DIGIT", "DIGIT INSURANCE", "GODIGIT"]],
  ["PolicyBazaar", "insurance", "online", ["POLICYBAZAAR*", "POLICY BAZAAR", "PB FINTECH"]],

  // Education
  ["BYJU'S", "education", "online", ["BYJUS*", "THINK AND LEARN"]],
  ["Unacademy", "education", "online", ["UNACADEMY*", "SORTING HAT"]],
  ["upGrad", "education", "online", ["UPGRAD*"]],
  ["Coursera", "education", "online", ["COURSERA*"]],
  ["Udemy", "education", "online", ["UDEMY*"]],
  ["Physics Wallah", "education", "online", ["PHYSICSWALLAH", "PHYSICS WALLAH"]],
  ["Vedantu", "education", "online", ["VEDANTU*"]],
  ["Simplilearn", "education", "online", ["SIMPLILEARN*"]],
  ["Great Learning", "education", "online", ["GREAT LEARNING", "GREATLEARNING"]],
  ["Scaler", "education", "online", ["SCALER ACADEMY", "INTERVIEWBIT"]],
  ["Duolingo", "education", "online", ["DUOLINGO*"]],

  // Rent
  ["CRED", "rent", "online", ["CRED RENT", "CREDRENT"]],
  ["NoBroker", "rent", "online", ["NOBROKER*", "NO BROKER"]],
  ["RedGiraffe", "rent", "online", ["REDGIRAFFE*", "RED GIRAFFE"]],
  ["Housing.com", "rent", "online", ["HOUSING COM", "HOUSINGCOM", "HOUSING PAY"]],
  ["MagicBricks", "rent", "online", ["MAGICBRICKS*"]],
  ["Stanza Living", "rent", "online", ["STANZA LIVING", "DTWELVE SPACES"]],

  // Government
  ["Income Tax", "government", "online", ["INCOME TAX*", "INCOMETAX*", "CBDT", "TIN NSDL", "EGOV NSDL", "PROTEAN EGOV"]],
  ["GST", "government", "online", ["GSTN", "GST PORTAL", "GST PAYMENT"]],
  ["Passport Seva", "government", "online", ["PASSPORT SEVA", "PASSPORTINDIA*", "PASSPORT"]],
  ["Parivahan", "government", "online", ["PARIVAHAN*", "VAHAN", "SARATHI"]],
  ["BBMP", "government", "online", ["BBMP*"]],
  ["GHMC", "government", "online", ["GHMC*"]],
  ["MCGM", "government", "online", ["MCGM*", "BMC PROPERTY TAX"]],

  // Wallets and aggregators (weak: a more specific merchant, MCC or keyword wins)
  ["CRED", "utilities", "online", ["CRED", "DREAMPLUG"], { weak: true }],
  ["Paytm", "wallet", "online", ["PAYTM*", "ONE97 COMMUNICATIONS", "ONE97*"], { weak: true }],
  ["PhonePe", "wallet", "online", ["PHONEPE*", "PHONE PE"], { weak: true }],
  ["MobiKwik", "wallet", "online", ["MOBIKWIK*", "ONE MOBIKWIK"], { weak: true }],
  ["Freecharge", "wallet", "online", ["FREECHARGE*"], { weak: true }],
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function compile(pattern: string): RegExp {
  const prefix = pattern.endsWith("*");
  const words = (prefix ? pattern.slice(0, -1) : pattern).trim().split(/\s+/).map(esc).join(" ");
  return new RegExp(`(?:^| )${words}${prefix ? "[A-Z0-9]*" : ""}(?= |$)`);
}

export const ALIASES: (AliasDef & { res: RegExp[] })[] = ROWS.map(([merchant, category, channel, patterns, flags]) => ({
  merchant, category, channel, patterns, ...flags, res: patterns.map(compile),
}));

/** Number of descriptor patterns the alias dictionary recognises. */
export const ALIAS_COUNT = ALIASES.reduce((n, a) => n + a.patterns.length, 0);

function findAlias(clean: string, weak: boolean) {
  return ALIASES.find((a) => !!a.weak === weak && a.res.some((re) => re.test(clean)));
}

/* ---------- Keyword fallback ---------- */

// Checked in this order; on a tie the longer phrase wins, then the earlier category. Phrases are whole words.
// A trailing "~" marks a weak word (half weight), e.g. PREMIUM loses to CAFE.
const KEYWORDS: [category: string, phrases: string[]][] = [
  ["wallet", ["ADD MONEY", "ADDMONEY", "LOAD MONEY", "WALLET", "WALLET LOAD", "WALLET TOPUP", "WALLET RECHARGE", "PREPAID CARD LOAD"]],
  ["government", ["INCOME TAX", "ADVANCE TAX", "PROPERTY TAX", "TAX", "TAXES", "CHALLAN", "E CHALLAN", "GST", "MUNICIPAL", "MUNICIPAL CORPORATION", "NAGAR NIGAM", "PASSPORT", "RTO", "TRAFFIC POLICE", "GOVT", "GOVERNMENT", "COURT FEE", "STAMP DUTY", "REGISTRATION DEPT", "TREASURY"]],
  ["insurance", ["INSURANCE", "INS PREMIUM", "PREMIUM~", "LIC", "ASSURANCE", "POLICY~", "LIFE INSURANCE", "GENERAL INSURANCE", "HEALTH INSURANCE", "MOTOR INSURANCE"]],
  ["education", ["SCHOOL", "COLLEGE", "UNIVERSITY", "FEES~", "FEE~", "SCHOOL FEES", "COLLEGE FEES", "TUITION", "TUITION FEES", "COACHING", "ACADEMY~", "INSTITUTE~", "VIDYALAYA", "VIDYA", "CLASSES", "EDUCATION", "EDUCATIONAL", "LEARNING~", "EXAM FEE", "PUBLIC SCHOOL"]],
  ["rent", ["RENT", "HOUSE RENT", "ROOM RENT", "PG RENT", "RENT PAYMENT", "HOUSING~", "HOUSING SOCIETY", "LEASE"]],
  ["fuel", ["PETROL", "PETROLEUM", "PETROL PUMP", "FUEL", "FUELS", "FILLING STATION", "FUEL STATION", "SERVICE STATION", "DIESEL", "CNG", "CNG STATION", "PETRO~", "AUTO FUELS", "EV CHARGING"]],
  ["health", ["HOSPITAL", "HOSPITALS", "PHARMACY", "PHARMA", "MEDICAL", "MEDICALS", "MEDICOS", "MEDICINES", "CHEMIST", "CHEMISTS", "DRUG", "DRUGS", "DRUG HOUSE", "CLINIC", "CLINICS", "DIAGNOSTIC", "DIAGNOSTICS", "PATHOLOGY", "PATH LAB", "DENTAL", "DENTIST", "HEALTHCARE", "HEALTH CARE", "HEALTH~", "NURSING HOME", "EYE CARE", "EYE HOSPITAL", "GYM", "FITNESS", "PHYSIOTHERAPY", "AYURVEDA", "WELLNESS~"]],
  ["dining", ["RESTAURANT", "RESTAURANTS", "RESTRO", "CAFE", "CAFES", "CAFFE", "COFFEE", "DHABA", "BAR", "BARS", "PUB", "BREWERY", "BREWING", "BREWPUB", "BISTRO", "KITCHEN", "EATERY", "EATERIES", "BAKERY", "BAKERS", "BAKE", "SWEETS", "SWEET HOUSE", "BIRYANI", "PIZZA", "PIZZERIA", "BURGER", "DINER", "GRILL", "LOUNGE~", "CANTEEN", "TAVERN", "TIFFIN", "DOSA", "IDLI", "CHAAT", "JUICE", "FOOD COURT", "BHOJANALAYA", "MESS", "TEA HOUSE", "CHAI", "ICE CREAM", "CREAMERY", "TANDOOR", "BIRIYANI", "FOODS~", "VEG"]],
  ["travel", ["AIRLINE", "AIRLINES", "AIRWAYS", "AVIATION", "AIRPORT", "HOTEL", "HOTELS", "RESORT", "RESORTS", "TRAVELS", "TRAVEL", "TOURS", "TOURS AND TRAVELS", "TOURISM", "HOLIDAYS", "CABS", "CAB", "TAXI", "TAXIS", "INN", "LODGE", "HOMESTAY", "HOSTEL~", "RAILWAY", "RAILWAYS", "METRO RAIL", "BUS", "BUS SERVICE", "PARKING", "TOLL", "TOLL PLAZA", "CAR RENTAL", "SELF DRIVE", "VISA FEE", "DUTY FREE"]],
  ["utilities", ["ELECTRICITY", "ELECTRICITY BILL", "ELECTRIC SUPPLY", "POWER DISTRIBUTION", "WATER", "WATER BILL", "WATER SUPPLY", "SEWERAGE", "GAS", "PIPED GAS", "GAS BILL", "LPG", "CYLINDER", "BROADBAND", "FIBER", "FIBRE", "FIBERNET", "INTERNET", "DTH", "RECHARGE", "MOBILE RECHARGE", "MOBILE BILL", "POSTPAID", "PREPAID", "TELECOM", "TELESERVICES", "CABLE TV", "BILL PAYMENT", "BILLPAY", "BBPS", "BILL~", "UTILITY", "UTILITIES", "MAINTENANCE~"]],
  ["groceries", ["SUPERMARKET", "SUPER MARKET", "SUPERMARKETS", "HYPERMARKET", "MART", "SUPERMART", "MINIMART", "KIRANA", "GROCER", "GROCERS", "GROCERY", "GROCERIES", "FRESH", "PROVISION", "PROVISIONS", "PROVISION STORE", "GENERAL STORE~", "GENERAL STORES~", "DEPARTMENTAL STORE~", "DAIRY", "MILK", "VEGETABLES", "FRUITS", "FRUIT", "CASH AND CARRY", "BAZAAR~", "ORGANIC", "MEAT", "CHICKEN", "FISH"]],
  ["entertainment", ["CINEMA", "CINEMAS", "MULTIPLEX", "THEATRE", "THEATER", "THEATRES", "MOVIES", "MOVIE", "GAMING", "GAMES", "GAME~", "AMUSEMENT", "AMUSEMENT PARK", "WATER PARK", "THEME PARK", "BOWLING", "CONCERT", "EVENTS~", "TICKETS~", "STREAMING", "MUSIC", "ENTERTAINMENT", "CLUB~", "SNOOKER", "ESCAPE ROOM"]],
  ["shopping", ["FASHION", "FASHIONS", "APPAREL", "APPARELS", "CLOTHING", "GARMENTS", "TEXTILES", "FOOTWEAR", "SHOES", "ELECTRONICS", "MOBILES", "MOBILE STORE", "JEWELLERS", "JEWELLERY", "JEWELERS", "JEWELRY", "RETAIL~", "BOUTIQUE", "LIFESTYLE~", "MALL", "BOOKS", "BOOK STORE", "FURNITURE", "FURNISHING", "HOME DECOR", "COSMETICS", "BEAUTY~", "TOYS", "GIFTS", "OPTICALS", "OPTICIANS", "WATCHES", "HARDWARE", "SPORTS", "STATIONERY", "STORE~", "STORES~", "ENTERPRISE~", "SHOP~", "SHOPPING"]],
];

const KW = KEYWORDS.flatMap(([category, phrases], order) =>
  phrases.map((p) => {
    const weak = p.endsWith("~");
    const phrase = weak ? p.slice(0, -1) : p;
    return { category, order, weight: phrase.split(" ").length * (weak ? 0.5 : 1), re: compile(phrase) };
  }),
);

/** Best keyword category for a cleaned descriptor, or null. */
function keywordCategory(clean: string): string | null {
  let best: (typeof KW)[number] | null = null;
  for (const k of KW) {
    if (!k.re.test(clean)) continue;
    if (!best || k.weight > best.weight || (k.weight === best.weight && k.order < best.order)) best = k;
  }
  return best?.category ?? null;
}

// Fees, interest and taxes the card issuer itself charges. Not a purchase.
const CHARGE_RE =
  /\b(FINANCE CHARGES?|LATE (?:PAYMENT )?(?:FEE|CHARGES?)|ANNUAL (?:MEMBERSHIP )?FEE|RENEWAL FEE|JOINING FEE|MEMBERSHIP FEE|OVER ?LIMIT|CASH ADVANCE FEE|INTEREST (?:CHARGED?|ON)|IGST|CGST|SGST|GST ON|SERVICE TAX|FUEL SURCHARGE|MARKUP FEE|FOREX MARKUP|CROSS CURRENCY|DCC (?:FEE|MARKUP)|EMI PROCESSING|PROCESSING FEE|RETURNED PAYMENT|CHEQUE BOUNCE)\b/;

// Wallet top-ups through a brand that is otherwise shopping (AMAZON PAY ADD MONEY).
const WALLET_LOAD_RE = /\b(ADD ?MONEY|LOAD MONEY|WALLET (?:LOAD|TOP ?UP|RECHARGE)|BALANCE (?:LOAD|TOP ?UP)|GIFT CARD LOAD)\b/;

/* ---------- MCC ---------- */

const MCC_EXACT: Record<number, string> = {
  4011: "travel", 4111: "travel", 4112: "travel", 4119: "health", 4121: "travel", 4131: "travel", 4411: "travel",
  4457: "travel", 4468: "travel", 4511: "travel", 4582: "travel", 4722: "travel", 4723: "travel", 4784: "travel",
  4789: "travel", 7011: "travel", 7012: "travel", 7032: "travel", 7033: "travel", 7512: "travel", 7513: "travel",
  7519: "travel", 7523: "travel",
  4812: "utilities", 4814: "utilities", 4816: "utilities", 4821: "utilities", 4899: "utilities", 4900: "utilities",
  4829: "wallet", 6540: "wallet", 6051: "wallet",
  5411: "groceries", 5422: "groceries", 5451: "groceries", 5499: "groceries", 5300: "groceries",
  5811: "dining", 5812: "dining", 5813: "dining", 5814: "dining", 5462: "dining", 5441: "dining",
  5541: "fuel", 5542: "fuel", 5983: "fuel", 5172: "fuel", 5552: "fuel",
  5912: "health", 5122: "health", 5975: "health", 5976: "health", 5047: "health", 7997: "health",
  6300: "insurance", 6381: "insurance", 6399: "insurance", 5960: "insurance",
  8351: "education", 5942: "shopping", 5943: "shopping",
  7832: "entertainment", 7829: "entertainment", 7841: "entertainment", 7911: "entertainment", 7922: "entertainment",
  7929: "entertainment", 7932: "entertainment", 7933: "entertainment", 7941: "entertainment", 7991: "entertainment",
  7992: "entertainment", 7993: "entertainment", 7994: "entertainment", 7995: "entertainment", 7996: "entertainment",
  7998: "entertainment", 7999: "entertainment", 5815: "entertainment", 5816: "entertainment", 5817: "entertainment",
  5818: "entertainment",
  6513: "rent",
  5262: "shopping", 5094: "shopping",
};

/** Category for a merchant category code, or null when unknown/unmapped. */
export function categoryFromMcc(mcc: string | number | null | undefined): string | null {
  const n = typeof mcc === "number" ? mcc : Number(String(mcc ?? "").replace(/\D/g, "") || NaN);
  if (!Number.isInteger(n) || n < 1 || n > 9999) return null;
  if (MCC_EXACT[n]) return MCC_EXACT[n];
  if (n >= 3000 && n <= 3999) return "travel"; // airlines 3000–3350, car rental 3351–3500, hotels 3501–3999
  if (n >= 8011 && n <= 8099) return "health";
  if (n >= 8211 && n <= 8299) return "education";
  if (n >= 9000 && n <= 9999) return "government";
  if (n >= 5000 && n <= 5999) return "shopping"; // remaining retail: dept stores, apparel, electronics, misc
  return null;
}

/* ---------- International ---------- */

const FX_CODES = "USD|EUR|GBP|SGD|AED|AUD|CAD|JPY|CHF|HKD|THB|MYR|NZD|SAR|QAR|OMR|KWD|BHD|CNY|LKR|NPR|IDR|VND|ZAR|SEK|NOK|DKK|KRW|PHP|MXN|BRL|TWD";
const FX_RE = new RegExp(`(?:^|[^A-Z])(?:${FX_CODES})(?:[^A-Z]|$)|[$€£¥]|\\bUS\\$`);
const FOREIGN_PLACE_RE =
  /\b(LOS GATOS|SAN FRANCISCO|SAN JOSE|MOUNTAIN VIEW|CUPERTINO|MENLO PARK|SUNNYVALE|SEATTLE|REDMOND|NEW YORK|LONDON|DUBLIN|AMSTERDAM|LUXEMBOURG|SINGAPORE SG|DUBAI|ABU DHABI|USA|GBR|SGP|NLD|IRL|LUX|UNITED STATES|UNITED KINGDOM)\b/;

/** True when the raw text or currency column says this was charged in a foreign currency. */
export function isInternational(raw: string, currency?: string | null): boolean {
  const cur = (currency ?? "").trim().toUpperCase().replace(/[^A-Z₹]/g, "");
  if (cur && !["INR", "RS", "₹", "RUPEE", "RUPEES"].includes(cur)) return /^[A-Z]{3}$/.test(cur);
  const s = String(raw ?? "").toUpperCase();
  return FX_RE.test(s) || FOREIGN_PLACE_RE.test(s);
}

/** Card-present vs online hints from the raw text. */
function channelHint(raw: string): Channel | null {
  const s = ` ${String(raw ?? "").toUpperCase()} `;
  if (/\b(POS|SWIPE|CHIP|CONTACTLESS|TAP AND PAY|EDC)\b/.test(s)) return "offline";
  if (/\b(ECOM|E-COM|ONLINE|WWW|INTERNET|SI|AUTOPAY|RECURRING)\b|\.COM\b|\.IN\b/.test(s)) return "online";
  return null;
}

const defaultChannel = (category: string): Channel => CATEGORY_MAP[category]?.defaultChannel ?? "offline";

/**
 * Works out merchant, category and channel from a raw statement line.
 * Precedence: specific merchant alias > MCC > keyword > aggregator alias > "other".
 */
export function categorize(input: CategorizeInput): CategorizeResult {
  const raw = String(input.description ?? "");
  const clean = cleanDescriptor(raw);
  const foreign = isInternational(raw, input.currency);
  const hint = channelHint(raw);
  const mccCat = categoryFromMcc(input.mcc);

  if (CHARGE_RE.test(clean)) {
    return { merchant: null, category: "other", channel: foreign ? "international" : "online", confidence: "high", matchedBy: "keyword", charge: true };
  }

  const alias = findAlias(clean, false);
  if (alias) {
    const category = WALLET_LOAD_RE.test(clean) ? "wallet" : alias.category;
    let channel: Channel = alias.channel;
    if (foreign || alias.foreign) channel = "international";
    else if (hint === "online") channel = "online";
    return { merchant: alias.merchant, category, channel, confidence: "high", matchedBy: "alias" };
  }

  const kw = keywordCategory(clean);
  const weak = findAlias(clean, true);
  const pick = (category: string): Channel => (foreign ? "international" : hint ?? (weak ? weak.channel : defaultChannel(category)));

  if (mccCat) return { merchant: weak?.merchant ?? null, category: mccCat, channel: pick(mccCat), confidence: "high", matchedBy: "mcc" };
  if (kw) return { merchant: weak?.merchant ?? null, category: kw, channel: pick(kw), confidence: "medium", matchedBy: "keyword" };
  if (weak) return { merchant: weak.merchant, category: weak.category, channel: pick(weak.category), confidence: "medium", matchedBy: "alias" };
  return { merchant: null, category: "other", channel: foreign ? "international" : hint ?? "offline", confidence: "low", matchedBy: "none" };
}

/** Canonical merchants the alias dictionary can produce, with their primary category/channel. */
export function aliasMerchants(): { name: string; category: string; channel: Channel }[] {
  const seen = new Map<string, { name: string; category: string; channel: Channel }>();
  // Later rows of a brand are its main entry (e.g. Swiggy food delivery after Instamart), so keep the last one.
  for (const a of ALIASES) if (!a.weak || !seen.has(a.merchant)) seen.set(a.merchant, { name: a.merchant, category: a.category, channel: a.channel });
  return [...seen.values()];
}

/* ---------- Reward credits ---------- */

// Cashback or rewards the bank paid back onto the card ("CASHBACK CREDIT", "REWARDS REDEMPTION", "CB CR").
const REWARD_CREDIT_RE =
  /\b(CASH ?BACK|CASHBK|INSTANT DISCOUNT CREDIT|REWARDS? (?:POINTS? )?(?:CREDIT|REDEMPTION|REDEEMED|CONVERSION)|POINTS? REDEMPTION|STATEMENT CREDIT|CB (?:CREDIT|CR)|CASHPOINTS? (?:CREDIT|REDEMPTION|REDEEMED))\b/;
// A cashback being taken back is a debit, not a reward.
const REWARD_REVERSAL_RE = /\b(REVERSAL|REVERSED|REVERSE|RECOVERY|CLAWBACK|DEBIT)\b/;

/** True for a statement credit line that is cashback or redeemed rewards (not a payment or refund). */
export function isRewardCredit(description: string | null | undefined): boolean {
  const s = ` ${String(description ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, " ")} `;
  return REWARD_CREDIT_RE.test(s) && !REWARD_REVERSAL_RE.test(s);
}
