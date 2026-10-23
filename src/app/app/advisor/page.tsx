import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { Advisor } from "@/components/advisor/advisor";
import type { CatalogOption } from "@/components/advisor/suggestions";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { simulateActual, toDate } from "@/engine";
import { requireUser } from "@/lib/auth";
import { loadCatalog, loadWallet, toEngineCard } from "@/lib/wallet";

export const metadata: Metadata = { title: "Swipe Advisor" };

export default async function AdvisorPage() {
  const user = await requireUser();
  const [{ engineCards, cardViews, txns }, products] = await Promise.all([loadWallet(user.id), loadCatalog()]);
  const owned = new Set(cardViews.map((v) => v.productId));
  const catalog: CatalogOption[] = products
    .filter((p) => !owned.has(p.id))
    .map((p) => ({
      card: toEngineCard(p), bank: p.bank, name: p.name, network: p.network,
      colorFrom: p.colorFrom, colorTo: p.colorTo, annualFee: p.annualFee, feeWaiverSpend: p.feeWaiverSpend, rewardUnit: p.rewardUnit, pointValue: p.pointValue,
    }));

  const now = new Date();
  // Cap usage so far, from what was actually swiped on each card this calendar year.
  const thisYear = txns.filter((t) => toDate(t.date).getFullYear() === now.getFullYear());
  const caps = [...simulateActual(engineCards, thisYear).caps.entries()];

  return (
    <>
      <PageHeader
        eyebrow="Swipe Advisor"
        title={<>Which card, <span className="italic text-accent">right now?</span></>}
        description="Tell us what you're buying. We rank every card in your wallet by what you actually take home, after caps, exclusions and forex."
      />
      {engineCards.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="size-6" />}
          title="Add your cards first"
          description="The advisor compares the cards in your wallet. Add at least one to see which to swipe."
          action={<LinkButton href="/app/wallet">Go to My Wallet</LinkButton>}
        />
      ) : (
        <Advisor cards={engineCards} views={cardViews} caps={caps} now={now.toISOString()} catalog={catalog} />
      )}
    </>
  );
}
