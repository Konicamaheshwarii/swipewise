import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CATALOG, type CatalogRule } from "../src/data/catalog";
import { simulateActual, type CapPeriod, type Channel, type EngineCard } from "../src/engine";

const db = new PrismaClient();

// More specific rules win: merchant (4) > category (2) > channel (1), and combinations add up,
// so "PhonePe + insurance" (6) beats plain "PhonePe" (4).
const priorityOf = (r: CatalogRule) =>
  (r.merchants?.length ? 4 : 0) + (r.categories?.length ? 2 : 0) + (r.channels?.length ? 1 : 0);

async function seedCatalog() {
  for (const c of CATALOG) {
    const { rules, benefits, excludedCategories, ...product } = c;
    const data = { ...product, notes: product.notes ?? null, benefits: JSON.stringify(benefits), excludedCategories: excludedCategories.join(",") };
    await db.cardProduct.upsert({ where: { id: c.id }, create: data, update: data });
    await db.rewardRule.deleteMany({ where: { cardProductId: c.id } });
    await db.rewardRule.createMany({
      data: rules.map((r) => ({
        cardProductId: c.id,
        label: r.label,
        categories: (r.categories ?? []).join(","),
        merchants: (r.merchants ?? []).join(","),
        channels: (r.channels ?? []).join(","),
        rateType: r.rateType,
        rate: r.rate,
        perAmount: r.perAmount ?? 100,
        capValue: r.capValue ?? null,
        capPeriod: r.capPeriod ?? null,
        capGroup: r.capGroup ?? null,
        minTxn: r.minTxn ?? null,
        priority: priorityOf(r),
      })),
    });
  }
  console.log(`Seeded ${CATALOG.length} card products`);
}

// Deterministic RNG so the demo looks the same every time.
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function seedDemo() {
  const email = "demo@swipewise.app";
  await db.user.deleteMany({ where: { email } });
  const user = await db.user.create({
    data: { name: "Aarav Mehta", email, passwordHash: await bcrypt.hash("demo1234", 10), isAdmin: true },
  });

  const mk = (cardProductId: string, extra: Record<string, unknown>) =>
    db.userCard.create({ data: { userId: user.id, cardProductId, ...extra } });
  const amazon = await mk("amazon-icici", { last4: "4021", creditLimit: 300000, statementDay: 18, dueDay: 5, anniversaryMonth: 3 });
  const cashback = await mk("sbi-cashback", { last4: "7713", creditLimit: 250000, statementDay: 2, dueDay: 22, anniversaryMonth: 7 });
  const millennia = await mk("hdfc-millennia", { last4: "1188", creditLimit: 200000, statementDay: 10, dueDay: 30, anniversaryMonth: 11 });
  const regalia = await mk("hdfc-regalia-gold", { nickname: "Regalia Gold", last4: "9054", creditLimit: 600000, statementDay: 25, dueDay: 14, anniversaryMonth: 5, perksValue: 3000 });
  const swiggy = await mk("swiggy-hdfc", { last4: "3307", creditLimit: 150000, statementDay: 12, dueDay: 2, anniversaryMonth: 1, perksValue: 500 });

  const r = rng(42);
  const between = (a: number, b: number) => Math.round(a + r() * (b - a));
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const all = [amazon.id, cashback.id, millennia.id, regalia.id, swiggy.id];
  // Habit: mostly swipes the premium card, regardless of category.
  const habit = () => (r() < 0.45 ? regalia.id : pick(all));

  type E = { amount: number; category: string; merchant?: string; channel: string; userCardId: string; day: number; note?: string };
  const expenses: { date: Date; amount: number; category: string; merchant: string | null; channel: string; userCardId: string; note: string | null; userId: string }[] = [];
  const now = new Date();

  for (let back = 11; back >= 0; back--) {
    const base = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const lastDay = back === 0 ? now.getDate() : daysInMonth;
    const month = base.getMonth();
    const list: E[] = [];

    list.push({ amount: 28000, category: "rent", channel: "online", userCardId: r() < 0.5 ? regalia.id : cashback.id, day: 3, note: "Flat rent" });
    for (let i = 0; i < 4; i++) list.push({ amount: between(600, 2400), category: "groceries", merchant: pick(["BigBasket", "Blinkit", "Zepto"]), channel: "online", userCardId: habit(), day: between(1, 28) });
    for (let i = 0; i < 2; i++) list.push({ amount: between(1500, 4200), category: "groceries", merchant: "DMart", channel: "offline", userCardId: habit(), day: between(1, 28) });
    for (let i = 0; i < 3; i++) list.push({ amount: between(900, 3800), category: "dining", channel: "offline", userCardId: habit(), day: between(1, 28) });
    for (let i = 0; i < 6; i++) {
      const merchant = pick(["Swiggy", "Swiggy", "Zomato"]);
      list.push({ amount: between(280, 950), category: "food_delivery", merchant, channel: "online", userCardId: merchant === "Swiggy" && r() < 0.6 ? swiggy.id : habit(), day: between(1, 28) });
    }
    for (let i = 0; i < 2; i++) list.push({ amount: between(900, 6500), category: "shopping", merchant: "Amazon", channel: "online", userCardId: r() < 0.85 ? amazon.id : habit(), day: between(1, 28) });
    list.push({ amount: between(1500, 5200), category: "shopping", merchant: pick(["Flipkart", "Myntra", "Ajio", "Nykaa"]), channel: "online", userCardId: habit(), day: between(1, 28) });
    for (let i = 0; i < 3; i++) list.push({ amount: between(1800, 3200), category: "fuel", merchant: pick(["BPCL", "Indian Oil"]), channel: "offline", userCardId: habit(), day: between(1, 28) });
    list.push({ amount: 999, category: "utilities", merchant: "Airtel", channel: "online", userCardId: habit(), day: 8, note: "Postpaid" });
    list.push({ amount: between(1800, 4200), category: "utilities", channel: "online", userCardId: habit(), day: 12, note: "Electricity" });
    list.push({ amount: 649, category: "entertainment", merchant: "Netflix", channel: "online", userCardId: habit(), day: 15 });
    if (r() < 0.7) list.push({ amount: between(500, 1400), category: "entertainment", merchant: "BookMyShow", channel: "online", userCardId: habit(), day: between(1, 28) });
    for (let i = 0; i < 4; i++) list.push({ amount: between(180, 650), category: "travel", merchant: pick(["Uber", "Ola"]), channel: "online", userCardId: habit(), day: between(1, 28) });
    if (r() < 0.6) list.push({ amount: between(400, 1600), category: "health", merchant: pick(["1mg", "Apollo"]), channel: "online", userCardId: habit(), day: between(1, 28) });
    if (back % 3 === 1) list.push({ amount: between(6000, 16000), category: "travel", merchant: pick(["MakeMyTrip", "Cleartrip", "IRCTC"]), channel: "online", userCardId: regalia.id, day: between(1, 28), note: "Flights" });
    if (month === 2) list.push({ amount: 24000, category: "insurance", channel: "online", userCardId: regalia.id, day: 20, note: "Health insurance premium" });
    if (month === 9 || month === 10) list.push({ amount: between(35000, 60000), category: "shopping", merchant: pick(["Croma", "Flipkart"]), channel: month === 9 ? "online" : "offline", userCardId: habit(), day: between(5, 20), note: "Festive sale" });
    if (back === 4) {
      for (let i = 0; i < 4; i++) list.push({ amount: between(4000, 18000), category: pick(["dining", "shopping", "travel"]), channel: "international", userCardId: regalia.id, day: between(10, 18), note: "Trip to Singapore" });
    }

    for (const e of list) {
      // Spread the current (partial) month across the days so far instead of piling onto today.
      const day = back === 0 ? Math.max(1, Math.ceil((e.day / 28) * lastDay)) : Math.min(e.day, lastDay);
      expenses.push({
        userId: user.id,
        date: new Date(base.getFullYear(), month, day, between(9, 21), between(0, 59)),
        amount: e.amount, category: e.category, merchant: e.merchant ?? null, channel: e.channel,
        userCardId: e.userCardId, note: e.note ?? null,
      });
    }
  }

  await db.expense.createMany({ data: expenses });
  console.log(`Seeded demo user ${email} / demo1234 with 5 cards and ${expenses.length} expenses`);

  await seedCredits(user.id, now, { amazon: amazon.id, cashback: cashback.id, millennia: millennia.id, regalia: regalia.id, swiggy: swiggy.id });
}

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/**
 * Rewards the banks "paid" the demo user over the last 4 statement months, computed with the same engine
 * as the dashboard (mirrors toEngineCard in src/lib/wallet.ts). Credits land on each card's statement day
 * the month after the spend. Mostly matching, with SBI Cashback short one month, Millennia's latest credit
 * not logged and two Regalia Gold points postings.
 */
async function seedCredits(userId: string, now: Date, ids: Record<"amazon" | "cashback" | "millennia" | "regalia" | "swiggy", string>) {
  const userCards = await db.userCard.findMany({ where: { userId }, include: { cardProduct: { include: { rules: true } } } });
  const engineCards: EngineCard[] = userCards.map((uc) => {
    const p = uc.cardProduct;
    return {
      id: uc.id, productId: p.id, name: `${p.bank} ${p.name}`, bank: p.bank, annualFee: p.annualFee, feeWaiverSpend: p.feeWaiverSpend,
      forexMarkup: p.forexMarkup, excludedCategories: list(p.excludedCategories), perksValue: uc.perksValue,
      rules: p.rules.map((r) => ({
        id: r.id, label: r.label, categories: list(r.categories), merchants: list(r.merchants), channels: list(r.channels) as Channel[],
        pct: r.rateType === "percent" ? r.rate : (r.rate / (r.perAmount || 100)) * p.pointValue * 100,
        capValue: r.capValue, capPeriod: (r.capPeriod as CapPeriod | null) ?? null, capGroup: r.capGroup, minTxn: r.minTxn, priority: r.priority,
      })),
    };
  });
  const since = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  const expenses = await db.expense.findMany({ where: { userId, date: { gte: since } } });
  const actual = simulateActual(engineCards, expenses.map((e) => ({ amount: e.amount, date: e.date, category: e.category, merchant: e.merchant, channel: e.channel as Channel, cardId: e.userCardId })));

  // Expected ₹ (gross reward, as on the dashboard check) per card per month.
  const mk = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const expected = new Map<string, number>();
  for (const a of actual.assignments) {
    if (!a.cardId || !a.evaluation) continue;
    const k = `${a.cardId}|${mk(new Date(a.txn.date))}`;
    expected.set(k, (expected.get(k) ?? 0) + a.evaluation.reward);
  }

  const byId = new Map(userCards.map((c) => [c.id, c]));
  const credits: { userId: string; userCardId: string; date: Date; amount: number; kind: string; points: number | null; note: string | null; source: string }[] = [];
  const round2 = (n: number) => Math.round(n * 100) / 100;
  for (let back = 4; back >= 1; back--) {
    const spend = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const label = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][spend.getMonth()];
    for (const [key, id] of Object.entries(ids) as [keyof typeof ids, string][]) {
      const card = byId.get(id)!;
      const exp = expected.get(`${id}|${mk(spend)}`) ?? 0;
      if (exp < 1) continue;
      const date = new Date(spend.getFullYear(), spend.getMonth() + 1, card.statementDay, 10);
      if (date > now) continue; // not credited yet
      if (key === "millennia" && back === 1) continue; // credited, but not logged yet
      if (key === "regalia") {
        if (back !== 2 && back !== 3) continue;
        const points = Math.round(exp / card.cardProduct.pointValue);
        credits.push({ userId, userCardId: id, date, amount: round2(points * card.cardProduct.pointValue), kind: "points", points, note: `Reward points posted for ${label}`, source: "manual" });
        continue;
      }
      // SBI Cashback paid only ~60% one month (e.g. a merchant wrongly treated as excluded).
      const amount = key === "cashback" && back === 2 ? Math.round(exp * 0.6) : key === "millennia" ? Math.floor(exp) : round2(exp);
      const note = key === "amazon" ? `Amazon Pay balance for ${label}` : key === "millennia" ? `CashPoints for ${label}` : `Cashback for ${label} statement`;
      credits.push({ userId, userCardId: id, date, amount, kind: "cashback", points: null, note, source: back <= 2 && key !== "cashback" ? "import" : "manual" });
    }
  }
  await db.rewardCredit.createMany({ data: credits });
  for (const c of credits) {
    const exp = [...expected.entries()].find(([k]) => k === `${c.userCardId}|${mk(new Date(c.date.getFullYear(), c.date.getMonth() - 1, 1))}`)?.[1] ?? 0;
    console.log(`  ${c.date.toISOString().slice(0, 10)} ${byId.get(c.userCardId)!.cardProduct.name.padEnd(14)} ${c.kind.padEnd(8)} received ₹${c.amount.toFixed(2).padStart(8)} · expected ₹${exp.toFixed(2)}`);
  }
  console.log(`Seeded ${credits.length} reward credits`);
}

seedCatalog()
  .then(seedDemo)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
