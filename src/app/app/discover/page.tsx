import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { DiscoverHero, Methodology, SuggestionCard, WellCovered } from "@/components/discover/suggestions";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { discover } from "@/engine";
import { requireUser } from "@/lib/auth";
import { inr } from "@/lib/format";
import { loadCatalog, loadWallet, toEngineCard } from "@/lib/wallet";

export const metadata: Metadata = { title: "Discover" };

export default async function DiscoverPage() {
  const user = await requireUser();
  const [{ engineCards, cardViews, txns }, catalog] = await Promise.all([loadWallet(user.id), loadCatalog()]);

  const header = (
    <PageHeader
      eyebrow="Discover"
      title={<>The card you&rsquo;re <span className="italic text-accent">missing</span></>}
      description="We replay your last 12 months of spending with each catalog card added to your wallet and rank them by what they'd put in your pocket, after fees."
    />
  );

  if (txns.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={<Receipt className="size-6" />}
          title="Log some spending first"
          description="Recommendations are based on how you actually spend. Add or import a few months of expenses to see which card would earn you the most."
          action={<LinkButton href="/app/expenses">Add expenses</LinkButton>}
        />
      </>
    );
  }

  const owned = new Set(cardViews.map((c) => c.productId));
  const candidates = catalog.filter((p) => !owned.has(p.id));
  const products = new Map(candidates.map((p) => [p.id, p]));
  const suggestions = discover(engineCards, candidates.map((p) => toEngineCard(p)), txns);
  const totalSpend = txns.reduce((s, t) => s + t.amount, 0);

  const [top, ...rest] = suggestions;
  const topWorth = top && top.netGain > 0;

  return (
    <>
      {header}
      <p className="-mt-4 mb-6 text-xs text-faint">
        Based on <span className="num text-muted">{inr(totalSpend, { compact: true })}</span> across{" "}
        <span className="num text-muted">{txns.length}</span> expenses and the {engineCards.length} card
        {engineCards.length === 1 ? "" : "s"} already in your wallet.
      </p>

      {suggestions.length === 0 ? (
        <EmptyState title="You own every card in the catalog" description="Nothing left to suggest. Impressive." />
      ) : (
        <div className="space-y-8">
          {topWorth ? <DiscoverHero s={top} product={products.get(top.productId)!} /> : <WellCovered />}

          <section>
            <h2 className="mb-4 text-[15px] font-semibold tracking-tight">{topWorth ? "Other options, ranked" : "All catalog cards, ranked"}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {(topWorth ? rest : suggestions).map((s, i) => (
                <SuggestionCard key={s.productId} s={s} product={products.get(s.productId)!} rank={i + (topWorth ? 2 : 1)} />
              ))}
            </div>
          </section>

          <Methodology />
        </div>
      )}
    </>
  );
}
