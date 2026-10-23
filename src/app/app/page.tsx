import { CreditCard, FileText, Gem, Receipt, TrendingDown, Wallet } from "lucide-react";
import { buildDashboard } from "@/components/dashboard/model";
import { MonthlyChart } from "@/components/dashboard/monthly-chart";
import {
  CategoryBreakdown, CheatSheet, RecentTransactions, RewardCheckPanel, WaiverProgress, cardIndex,
} from "@/components/dashboard/sections";
import { StatementImportButton } from "@/components/statements/statement-import";
import { EmptyState, LinkButton, PageHeader, Panel, PanelHeader, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { describeSplit, inr, pct } from "@/lib/format";
import { loadStatementCatalog, loadWallet } from "@/lib/wallet";

function greeting(hour: number) {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const wallet = await loadWallet(user.id);
  const now = new Date();
  const first = user.name.trim().split(/\s+/)[0] || "there";
  const title = `${greeting(now.getHours())}, ${first}`;

  if (!wallet.cardViews.length) {
    const catalog = await loadStatementCatalog(user.id);
    return (
      <>
        <PageHeader title={title} description="Let's set up your wallet so we can tell you which card to swipe." />
        <EmptyState
          icon={<CreditCard className="size-6" />}
          title="Add your first card"
          description="Pick your cards from the catalog, or drop in your statement PDFs and we'll add the cards and their spending for you."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <StatementImportButton catalog={catalog} cards={[]}>
                <FileText className="size-4" /> Import statements (PDF)
              </StatementImportButton>
              <LinkButton href="/app/wallet">Add cards</LinkButton>
            </div>
          }
        />
      </>
    );
  }

  if (!wallet.expenses.length) {
    const catalog = await loadStatementCatalog(user.id);
    return (
      <>
        <PageHeader title={title} description={`${wallet.cardViews.length} card${wallet.cardViews.length > 1 ? "s" : ""} in your wallet. Now add some spending.`} />
        <EmptyState
          icon={<Receipt className="size-6" />}
          title="No expenses yet"
          description="Import your statement PDFs, add a few expenses or import a CSV. Then you'll see rewards earned, rewards missed and your card cheat sheet."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <StatementImportButton catalog={catalog} cards={wallet.cardViews}>
                <FileText className="size-4" /> Import statements (PDF)
              </StatementImportButton>
              <LinkButton href="/app/expenses">Add expenses</LinkButton>
            </div>
          }
        />
      </>
    );
  }

  const cards = cardIndex(wallet.cardViews);
  // Credits for the expected-vs-received check (statement months plus the month they're credited in).
  const creditsSince = new Date(now.getFullYear(), now.getMonth() - 4, 1);
  const credits = await db.rewardCredit.findMany({
    where: { userId: user.id, date: { gte: creditsSince } },
    select: { userCardId: true, date: true, amount: true, points: true },
  });
  const m = buildDashboard(
    wallet.engineCards, wallet.txns, wallet.expenses,
    new Map(wallet.cardViews.map((c) => [c.id, c.anniversaryMonth])), now,
    { meta: new Map(wallet.cardViews.map((c) => [c.id, { rewardUnit: c.rewardUnit, pointValue: c.pointValue }])), credits },
  );
  const k = m.kpis;
  const change = k.changePct;
  const captured = k.optimalRewards > 0 ? (k.actualRewards / k.optimalRewards) * 100 : 100;

  return (
    <>
      <PageHeader
        title={title}
        description={
          k.missed >= 1
            ? <>You captured <span className="text-ink">{pct(captured, 0)}</span> of the rewards your cards could have paid over the last 12 months. The cheat sheet below closes the gap.</>
            : "You're swiping the right card. Here's how your wallet is doing."
        }
        actions={<LinkButton href="/app/advisor" variant="secondary">Which card now?</LinkButton>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Spend this month"
          value={inr(k.spendThisMonth, { compact: k.spendThisMonth >= 1e5 })}
          icon={<Wallet className="size-4" />}
          hint={change == null ? "No spend this time last month" : `${change >= 0 ? "▲" : "▼"} ${pct(Math.abs(change), 0)} vs same days of ${k.lastMonthLabel}`}
        />
        <StatCard
          label="Rewards earned · 12 mo"
          value={inr(k.actualRewards)}
          tone="good"
          icon={<Gem className="size-4" />}
          hint={describeSplit(k.split) || `On ${k.tracked} expenses with a known card`}
        />
        <StatCard
          label="Missed rewards · 12 mo"
          value={inr(k.missed)}
          tone={k.missed >= 1 ? "bad" : "neutral"}
          icon={<TrendingDown className="size-4" />}
          hint="If you'd used the best card"
        />
        <StatCard
          label="Wallet net value / yr"
          value={inr(k.walletNet)}
          tone="accent"
          icon={<CreditCard className="size-4" />}
          hint="Best-card rewards + perks − fees"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-3 lg:gap-6">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Spend & rewards" subtitle="Last 12 months, against what the best card each time would have paid" />
          <div className="mt-4">
            <MonthlyChart months={m.months} />
          </div>
        </Panel>
        <CategoryBreakdown slices={m.categories} total={m.totalSpend} />
      </div>

      <div className="mt-4 lg:mt-6">
        <RewardCheckPanel check={m.rewardCheck} cards={cards} />
      </div>

      <div className="mt-4 lg:mt-6">
        <CheatSheet categories={m.cheatCategories} merchants={m.cheatMerchants} cards={cards} />
      </div>

      <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-5 lg:gap-6">
        <div className="lg:col-span-3">
          <RecentTransactions rows={m.recent} cards={cards} />
        </div>
        <div className="lg:col-span-2">
          <WaiverProgress rows={m.waivers} cards={cards} />
        </div>
      </div>
    </>
  );
}
