import { AlertTriangle, BadgeCheck } from "lucide-react";
import type { CardReview, Verdict } from "@/engine";
import { CardFace } from "@/components/card-face";
import { CategoryIcon } from "@/components/category-icon";
import { Badge, Panel, Progress } from "@/components/ui";
import { categoryLabel } from "@/data/categories";
import { cardTitle, cn, inr, pct } from "@/lib/format";
import type { CardView } from "@/lib/wallet";

export const VERDICTS: Record<Verdict, { tone: "good" | "info" | "warn" | "gold" | "bad"; label: string; ring: string }> = {
  keep: { tone: "good", label: "Keep", ring: "from-good/30" },
  keep_free: { tone: "info", label: "Keep · free", ring: "from-info/25" },
  push: { tone: "warn", label: "Push spend", ring: "from-warn/30" },
  downgrade: { tone: "gold", label: "Downgrade / ask waiver", ring: "from-gold/30" },
  close: { tone: "bad", label: "Consider closing", ring: "from-bad/30" },
};

export function ReviewCard({
  review, card, rank, earningSpend, limitShare, index,
}: {
  review: CardReview;
  card: CardView;
  rank: number;
  /** Annualised spend routed here that actually earns rewards. */
  earningSpend: number;
  /** This card's share of the wallet's total credit limit, 0..1. */
  limitShare: number;
  index: number;
}) {
  const v = VERDICTS[review.verdict];
  const caution = review.verdict === "close" || review.verdict === "downgrade";
  const waiver = card.annualFee > 0 && card.feeWaiverSpend ? card.feeWaiverSpend : null;

  return (
    <Panel className="relative overflow-hidden animate-fade-up" style={{ animationDelay: `${index * 60}ms` }}>
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r via-transparent to-transparent", v.ring)} />
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[auto_1fr] lg:gap-8">
        {/* Left: card + verdict */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start lg:flex-col">
          <CardFace {...card} size="md" className="w-full max-w-72 sm:w-64 lg:w-72" />
          <div className="flex w-full flex-col gap-1.5 sm:pt-1 lg:pt-0">
            <div className="flex items-center gap-2">
              <span className="num text-xs text-faint">#{rank}</span>
              <Badge tone={v.tone}>{v.label}</Badge>
            </div>
            <p className="text-sm font-medium">{cardTitle(card)}</p>
            <p className="text-xs text-faint">
              {card.annualFee ? `${inr(card.annualFee)} annual fee` : "Lifetime free"}
              {waiver ? ` · waived at ${inr(waiver, { compact: true })}` : ""}
            </p>
          </div>
        </div>

        {/* Right: verdict detail */}
        <div className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="font-display text-2xl leading-tight sm:text-[28px]">{review.headline}</p>
            <div className="shrink-0 sm:text-right">
              <p className="text-[11px] uppercase tracking-[0.14em] text-faint">Net annual value</p>
              <p className={cn("text-4xl font-semibold tracking-tight", review.nav > 0 ? "text-accent" : review.nav < 0 ? "text-bad" : "text-ink")}>
                {review.nav > 0 ? "+" : ""}{inr(review.nav)}
              </p>
            </div>
          </div>

          {/* NAV equation */}
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-stretch gap-1.5 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] sm:gap-2">
            <Term label="Marginal value" value={inr(review.marginal)} hint="what it adds" />
            <Op>+</Op>
            <Term label="Perks" value={inr(review.perks)} hint={review.perks ? "lounges, etc." : "none recorded"} />
            <Op className="hidden sm:grid">−</Op>
            <div className="col-span-3 grid grid-cols-[auto_1fr_auto_1fr] gap-1.5 sm:contents">
              <Op className="sm:hidden">−</Op>
              <Term
                label="Annual fee"
                value={review.feeWaived ? <span className="text-good">₹0</span> : inr(review.fee)}
                hint={review.feeWaived ? <span className="inline-flex items-center gap-1 text-good"><BadgeCheck className="size-3" /> waived</span> : card.annualFee ? "charged" : "free card"}
              />
              <Op>=</Op>
              <Term label="NAV" value={inr(review.nav)} strong={review.nav > 0 ? "accent" : review.nav < 0 ? "bad" : undefined} />
            </div>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">Where it wins</p>
              {review.topCategories.length ? (
                <ul className="mt-2.5 flex flex-col gap-2">
                  {review.topCategories.map((t) => (
                    <li key={t.category} className="flex items-center gap-2.5 text-sm">
                      <CategoryIcon category={t.category} size="sm" />
                      <span className="flex-1 truncate text-muted">{categoryLabel(t.category)}</span>
                      <span className="num">{inr(t.reward)}<span className="text-faint">/yr</span></span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2.5 text-sm text-muted">Another card beats it on every expense you have.</p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">Spend to route here</p>
                <p className="num mt-1.5 text-lg font-medium">{inr(earningSpend)}<span className="text-sm text-faint">/yr</span></p>
                <p className="text-xs text-faint">earning {inr(review.rewards)}/yr on the best-card strategy</p>
              </div>
              {waiver && (
                <div>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-muted">Fee-waiver spend</span>
                    <span className="num text-faint">{inr(review.spend, { compact: true })} / {inr(waiver, { compact: true })}</span>
                  </div>
                  <Progress value={(review.spend / waiver) * 100} tone={review.feeWaived ? "good" : review.verdict === "push" ? "accent" : "gold"} className="mt-1.5" />
                  <p className="mt-1 text-[11px] text-faint">
                    {review.feeWaived ? "Waiver target met at this pace" : `${inr(review.waiverGap ?? 0)} short of the waiver at this pace`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {caution && (
            <div className="mt-5 flex gap-3 rounded-2xl border border-warn/20 bg-warn/[0.05] p-4 text-xs leading-relaxed text-muted">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
              <p>
                <span className="font-medium text-ink">Before you close it:</span>{" "}
                {card.creditLimit > 0 ? (
                  <>
                    this card is <span className="num text-ink">{pct(limitShare * 100, 0)}</span> of your total credit limit (
                    {inr(card.creditLimit, { compact: true })}).
                  </>
                ) : (
                  <>add this card&apos;s credit limit in My Wallet to see how much of your total limit you&apos;d lose.</>
                )}{" "}
                Closing it can push up your utilisation and shorten
                your average credit history, both of which can dent your score. Call the bank first: ask for a fee waiver, or a switch to a
                lifetime-free variant that keeps the account open.
              </p>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Term({ label, value, hint, strong }: { label: string; value: React.ReactNode; hint?: React.ReactNode; strong?: "accent" | "bad" }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-center rounded-xl border px-3 py-2.5",
        strong === "accent" ? "border-accent/25 bg-accent/[0.06]" : strong === "bad" ? "border-bad/25 bg-bad/[0.06]" : "border-line bg-surface-2/60",
      )}
    >
      <span className="truncate text-[10px] uppercase tracking-wider text-faint">{label}</span>
      <span className={cn("num mt-0.5 text-base font-semibold", strong === "accent" && "text-accent", strong === "bad" && "text-bad")}>{value}</span>
      {hint && <span className="truncate text-[10px] text-faint">{hint}</span>}
    </div>
  );
}

function Op({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("grid place-items-center text-lg text-faint", className)}>{children}</span>;
}
