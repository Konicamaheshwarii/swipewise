"use client";

import { ArrowUpRight, Ban, Globe, Hourglass, Sparkles, Trophy } from "lucide-react";
import { CardFace } from "@/components/card-face";
import { Badge, Panel } from "@/components/ui";
import type { Evaluation } from "@/engine";
import { cardTitle, cn, describeReward, inr, pct, rewardKind, type RewardKind } from "@/lib/format";
import type { CardView } from "@/lib/wallet";
import { useTween } from "./use-tween";

const PERIOD = { month: "this month", quarter: "this quarter", year: "this year" } as const;

/** ₹ with paise for small amounts so ₹12.50 doesn't read as ₹13. */
const money = (n: number) => inr(n, { decimals: Math.abs(n) < 100 && Math.round(n) !== n ? 2 : 0 });

export function AdvisorResults({
  results,
  views,
  amount,
  categoryName,
}: {
  results: Evaluation[];
  views: CardView[];
  amount: number;
  categoryName: string;
}) {
  const byId = new Map(views.map((v) => [v.id, v]));
  const winner = results[0];
  const rest = results.slice(1);
  // Re-run the entrance animation only when the ranking order changes.
  const order = results.map((r) => r.cardId).join("|");

  if (amount <= 0) {
    return (
      <Panel className="grid min-h-72 place-items-center p-8 text-center">
        <div>
          <Sparkles className="mx-auto size-6 text-accent" />
          <p className="mt-3 font-display text-3xl">Enter an amount</p>
          <p className="mt-1 text-sm text-muted">Results update as you type.</p>
        </div>
      </Panel>
    );
  }

  const nothing = results.every((r) => r.reward <= 0 && r.forexCost <= 0);

  return (
    <div className="space-y-6">
      {nothing ? (
        <NoRewards categoryName={categoryName} excluded={results.every((r) => r.excluded)} />
      ) : (
        <WinnerHero winner={winner} view={byId.get(winner.cardId)!} runnerUp={rest[0]} runnerUpView={rest[0] && byId.get(rest[0].cardId)} amount={amount} />
      )}

      {(nothing ? results : rest).length > 0 && (
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between px-5 pb-2 pt-5 sm:px-6">
            <h3 className="text-[15px] font-semibold tracking-tight">{nothing ? "Your cards" : "Everything else in your wallet"}</h3>
            <span className="text-xs text-faint">{results.length} cards ranked</span>
          </div>
          <ul className="divide-y divide-line">
            {(nothing ? results : rest).map((r, i) => (
              <RankRow
                key={`${r.cardId}:${order}`}
                rank={nothing ? i + 1 : i + 2}
                r={r}
                view={byId.get(r.cardId)!}
                best={Math.max(winner.net, 0)}
                delay={i * 40}
              />
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function WinnerHero({
  winner,
  view,
  runnerUp,
  runnerUpView,
  amount,
}: {
  winner: Evaluation;
  view: CardView;
  runnerUp?: Evaluation;
  runnerUpView?: CardView;
  amount: number;
}) {
  const net = useTween(winner.net);
  const eff = useTween(winner.effectivePct);
  const losing = winner.net < 0;
  const diff = runnerUp ? winner.net - runnerUp.net : 0;
  const title = cardTitle(view);

  return (
    <Panel className="relative overflow-hidden p-5 sm:p-8">
      {/* glow in the card's own colours */}
      <div
        className="pointer-events-none absolute -left-16 -top-20 size-80 rounded-full opacity-40 blur-3xl transition-[background] duration-700"
        style={{ background: `radial-gradient(circle, ${view.colorTo}, transparent 70%)` }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 right-0 size-72 rounded-full opacity-25 blur-3xl transition-[background] duration-700"
        style={{ background: `radial-gradient(circle, ${view.colorFrom}, transparent 70%)` }}
      />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        <div key={winner.cardId} className="mx-auto animate-fade-up sm:mx-0">
          <CardFace
            bank={view.bank}
            name={view.name}
            network={view.network}
            colorFrom={view.colorFrom}
            colorTo={view.colorTo}
            last4={view.last4}
            nickname={view.nickname}
            size="md"
            className="w-64 sm:w-60 sm:-rotate-3 lg:w-64"
            style={{ boxShadow: `0 30px 80px -20px ${view.colorTo}aa, 0 0 0 1px rgba(255,255,255,0.08)` }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <Badge tone="accent" className="mb-3">
            <Trophy className="size-3" /> Best card for this swipe
          </Badge>
          <p key={`t-${winner.cardId}`} className="animate-fade-up text-sm text-muted">
            Use <span className="font-semibold text-ink">{title}</span>
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-faint">{losing ? "Lowest cost" : "You earn"}</p>
          <p className={cn("num font-display text-6xl leading-none tracking-tight sm:text-7xl", losing ? "text-warn" : "text-accent")}>
            {money(net)}
          </p>
          <p className="num mt-2 text-sm text-muted">
            <span className="font-semibold text-ink">{pct(eff, 2)}</span> back on {inr(amount)}
            {winner.forexCost > 0 && (
              <span className="text-faint">
                {" "}· {money(winner.reward)} reward − {money(winner.forexCost)} forex
              </span>
            )}
          </p>
          {winner.reward > 0 && (
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
              <KindBadge kind={rewardKind(view.rewardUnit, view.pointValue)} />
              <span>
                Earned as {describeReward(winner.reward, view.rewardUnit, view.pointValue)}
                {rewardKind(view.rewardUnit, view.pointValue) !== "cashback" && ", value depends on how you redeem"}
              </span>
            </p>
          )}

          <p className="mt-4 text-sm leading-relaxed text-ink/80">{winner.reason}</p>
          <CapNote r={winner} />

          {runnerUp && runnerUpView && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-line bg-white/[0.03] px-3.5 py-2.5 text-xs text-muted">
              <ArrowUpRight className="mt-px size-3.5 shrink-0 text-good" />
              {diff < 0.5 ? (
                <span>
                  Tied with <span className="text-ink">{cardTitle(runnerUpView)}</span>, either works.
                </span>
              ) : (
                <span>
                  <span className="num font-semibold text-good">{money(diff)} more</span> than your next best card,{" "}
                  <span className="text-ink">{cardTitle(runnerUpView)}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function CapNote({ r }: { r: Evaluation }) {
  if (r.capRemaining == null || !r.rule?.capPeriod) return null;
  const period = PERIOD[r.rule.capPeriod];
  if (r.capRemaining <= 0) return null; // the reason already says the cap is used up
  const left = Math.max(0, r.capRemaining - r.reward);
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs text-faint">
      <Hourglass className="size-3.5" />
      {r.capped
        ? `This swipe uses the last ${inr(r.capRemaining)} of the cap ${period}`
        : `${inr(left)} of reward cap left ${period} after this swipe`}
    </p>
  );
}

function NoRewards({ categoryName, excluded }: { categoryName: string; excluded: boolean }) {
  return (
    <Panel className="relative overflow-hidden p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-10 -top-16 size-64 rounded-full bg-bad/10 blur-3xl" />
      <div className="relative flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-bad/25 bg-bad/10 text-bad">
          <Ban className="size-5" />
        </span>
        <div>
          <p className="font-display text-3xl leading-tight sm:text-4xl">No card earns here</p>
          <p className="mt-2 max-w-md text-sm text-muted">
            {excluded
              ? `${categoryName} is excluded from rewards on every card in your wallet. Use whichever card has the longest interest-free period.`
              : "None of your cards has a reward rule that matches this purchase."}
          </p>
        </div>
      </div>
    </Panel>
  );
}

const KIND_LABEL: Record<RewardKind, string> = { cashback: "Cashback", points: "Points", miles: "Miles" };

/** Cashback is money in hand; points and miles are worth their ₹ value only when redeemed well. */
function KindBadge({ kind }: { kind: RewardKind }) {
  return <Badge tone={kind === "cashback" ? "good" : kind === "miles" ? "info" : "gold"}>{KIND_LABEL[kind]}</Badge>;
}

function RankRow({ rank, r, view, best, delay }: { rank: number; r: Evaluation; view: CardView; best: number; delay: number }) {
  const share = best > 0 ? Math.max(0, r.net) / best : 0;
  return (
    <li className="animate-fade-up px-5 py-4 sm:px-6" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="num w-4 shrink-0 text-xs text-faint">{rank}</span>
        <CardFace bank={view.bank} name={view.name} network={view.network} colorFrom={view.colorFrom} colorTo={view.colorTo} size="xs" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-sm font-medium">{cardTitle(view)}</p>
            {r.excluded && <Badge tone="bad">No rewards</Badge>}
            {r.belowMin && <Badge tone="warn">Below minimum</Badge>}
            {r.capped && <Badge tone="warn">{r.capRemaining && r.capRemaining > 0 ? "Partly capped" : "Cap used up"}</Badge>}
            {r.reward > 0 && <KindBadge kind={rewardKind(view.rewardUnit, view.pointValue)} />}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted">{r.reason}</p>
          {r.forexCost > 0 && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-warn/90">
              <Globe className="size-3" /> −{money(r.forexCost)} forex markup
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("num text-sm font-semibold", r.net > 0 ? "text-ink" : r.net < 0 ? "text-bad" : "text-faint")}>{money(r.net)}</p>
          <p className="num text-[11px] text-faint">{pct(r.effectivePct, 2)}</p>
        </div>
      </div>
      {best > 0 && (
        <div className="ml-[6rem] mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.05] sm:ml-[6.5rem]">
          <div className="h-full rounded-full bg-white/25 transition-[width] duration-500" style={{ width: `${share * 100}%` }} />
        </div>
      )}
    </li>
  );
}
