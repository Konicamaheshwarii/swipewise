import { CreditCard, Info } from "lucide-react";
import { allocate, monthsSpanned, reviewWallet } from "@/engine";
import { ReviewCard } from "@/components/review/review-card";
import { EmptyState, LinkButton, PageHeader, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { cn, inr } from "@/lib/format";
import { loadWallet } from "@/lib/wallet";

export default async function ReviewPage() {
  const user = await requireUser();
  const wallet = await loadWallet(user.id);

  const header = (
    <PageHeader
      eyebrow="Card Review"
      title="Keep, push or close"
      description="Each card's net annual value (NAV) is what it adds to your wallet's rewards on top of your other cards, plus the perks you use, minus the fee you'd actually pay after any spend-based waiver."
    />
  );

  if (!wallet.cardViews.length) {
    return (
      <>
        {header}
        <EmptyState
          icon={<CreditCard className="size-6" />}
          title="No cards to review"
          description="Add the cards you hold and we'll tell you which ones earn their keep."
          action={<LinkButton href="/app/wallet">Add cards</LinkButton>}
        />
      </>
    );
  }

  const review = reviewWallet(wallet.engineCards, wallet.txns);
  const factor = 12 / monthsSpanned(wallet.txns);

  // Spend that actually earns on each card (excludes zero-reward spend such as rent).
  const earning = new Map<string, number>();
  for (const a of allocate(wallet.engineCards, wallet.txns).assignments) {
    if (!a.cardId || !a.evaluation || a.evaluation.net <= 0) continue;
    earning.set(a.cardId, (earning.get(a.cardId) ?? 0) + a.txn.amount * factor);
  }

  const views = new Map(wallet.cardViews.map((c) => [c.id, c]));
  const totalLimit = wallet.cardViews.reduce((s, c) => s + c.creditLimit, 0);
  const counts = review.cards.reduce<Record<string, number>>((m, r) => ({ ...m, [r.verdict]: (m[r.verdict] ?? 0) + 1 }), {});
  const flagged = (counts.close ?? 0) + (counts.downgrade ?? 0);
  const noData = !wallet.txns.length;

  return (
    <>
      {header}

      <Panel className="overflow-hidden animate-fade-up">
        <div className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
          <Summary label="Annual rewards" value={inr(review.annualRewards)} hint="best card on every swipe" />
          <Summary label="Annual fees" value={review.annualFees ? `−${inr(review.annualFees)}` : "₹0"} hint="after waivers you'll hit" tone={review.annualFees ? "bad" : undefined} />
          <Summary label="Perks value" value={`+${inr(review.annualPerks)}`} hint="as recorded on your cards" />
          <Summary label="Net value" value={inr(review.net)} hint="per year" tone="accent" />
        </div>
        <p className="border-t border-line bg-surface px-5 py-3 text-xs text-muted sm:px-6">
          {noData
            ? "No expenses yet, so rewards are zero. Add expenses for a meaningful review."
            : <>Based on {review.months} month{review.months > 1 ? "s" : ""} of spending{review.months < 12 ? ", annualised" : ""}.{" "}</>}
          {!noData && (flagged
            ? <span className="text-ink">{flagged} card{flagged > 1 ? "s" : ""} cost{flagged > 1 ? "" : "s"} more than {flagged > 1 ? "they add" : "it adds"}.</span>
            : <span className="text-ink">Every card pays its way.</span>)}
        </p>
      </Panel>

      <div className="mt-4 flex gap-3 rounded-2xl border border-info/15 bg-info/[0.04] p-4 text-xs leading-relaxed text-muted animate-fade-up sm:items-center">
        <Info className="mt-0.5 size-4 shrink-0 text-info sm:mt-0" />
        <p>
          <span className="font-medium text-ink">Marginal value</span> is what your wallet loses without the card: we re-run the best-card
          strategy with it removed and compare. A card with a big rewards number can still have a small marginal value if another card would
          have earned almost the same on that spend.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-4 lg:gap-5">
        {review.cards.map((r, i) => {
          const card = views.get(r.cardId);
          if (!card) return null;
          return (
            <ReviewCard
              key={r.cardId}
              review={r}
              card={card}
              rank={i + 1}
              index={i}
              earningSpend={earning.get(r.cardId) ?? 0}
              limitShare={totalLimit ? card.creditLimit / totalLimit : 0}
            />
          );
        })}
      </div>

      <p className="mt-6 text-center text-[11px] text-faint">Reward rules are approximate and change often. Check your card&apos;s current terms before closing anything.</p>
    </>
  );
}

function Summary({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "accent" | "bad" }) {
  return (
    <div className="bg-surface p-5 sm:p-6">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cn("mt-2 text-2xl font-semibold tracking-tight sm:text-3xl", tone === "accent" && "text-accent", tone === "bad" && "text-bad")}>{value}</p>
      <p className="mt-1 text-[11px] text-faint">{hint}</p>
    </div>
  );
}
