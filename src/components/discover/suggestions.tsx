import { ArrowRight, BookOpen, Check, FlaskConical, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { CardProduct } from "@prisma/client";
import { CardFace } from "@/components/card-face";
import { CategoryIcon } from "@/components/category-icon";
import { Badge, LinkButton, Panel } from "@/components/ui";
import { categoryLabel } from "@/data/categories";
import type { Suggestion } from "@/engine";
import { cn, inr } from "@/lib/format";

type Product = Pick<CardProduct, "id" | "bank" | "name" | "network" | "tier" | "colorFrom" | "colorTo" | "annualFee">;

const addHref = (id: string) => `/app/wallet?add=${encodeURIComponent(id)}`;
const rulesHref = (id: string) => `/app/catalog#${id}`;

function FeeLine({ s }: { s: Suggestion }) {
  if (s.feeWaived) return <span className="text-good">Fee waived</span>;
  if (s.fee === 0) return <span className="text-good">Lifetime free</span>;
  return <span className="num">{inr(s.fee)}/yr fee</span>;
}

export function DiscoverHero({ s, product: p }: { s: Suggestion; product: Product }) {
  return (
    <Panel className="relative animate-fade-up overflow-hidden p-6 sm:p-8 lg:p-10">
      <div
        className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full opacity-35 blur-3xl"
        style={{ background: `radial-gradient(circle, ${p.colorTo}, transparent 70%)` }}
      />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />

      <div className="relative grid items-center gap-8 lg:grid-cols-[auto_1fr] lg:gap-12">
        <div className="order-2 mx-auto lg:order-1">
          <CardFace
            bank={p.bank}
            name={p.name}
            network={p.network}
            colorFrom={p.colorFrom}
            colorTo={p.colorTo}
            size="lg"
            className="w-72 max-w-full animate-float [--r:-4deg] sm:w-96"
            style={{ boxShadow: `0 40px 100px -30px ${p.colorTo}cc, 0 0 0 1px rgba(255,255,255,0.08)` }}
          />
        </div>

        <div className="order-1 min-w-0 lg:order-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">Top pick for you</Badge>
            <Badge>{p.tier}</Badge>
          </div>
          <p className="mt-4 text-sm text-muted">{p.bank}</p>
          <h2 className="font-display text-4xl leading-none tracking-tight sm:text-5xl">{p.name}</h2>

          <p className="num mt-6 font-display text-6xl leading-none tracking-tight text-accent sm:text-7xl">
            +{inr(s.netGain)}
            <span className="ml-2 font-sans text-base font-medium tracking-normal text-muted">/yr net</span>
          </p>

          <dl className="mt-6 grid grid-cols-3 gap-3 border-y border-line py-4 text-sm">
            <Stat label="Extra rewards" value={`+${inr(s.gain)}`} />
            <Stat label="Annual fee" value={<FeeLine s={s} />} />
            <Stat label="Spend it takes over" value={inr(s.spend, { compact: true })} />
          </dl>

          {s.topCategories.length > 0 && (
            <div className="mt-5">
              <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.16em] text-faint">Where it wins</p>
              <div className="flex flex-wrap gap-2">
                {s.topCategories.map((c) => (
                  <span key={c.category} className="flex items-center gap-2 rounded-full border border-line bg-surface-2 py-1 pl-1 pr-3 text-xs">
                    <CategoryIcon category={c.category} size="sm" className="size-6 rounded-full" />
                    {categoryLabel(c.category)}
                    <span className="num text-good">{inr(c.reward)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-7 flex flex-wrap gap-2">
            <LinkButton href={addHref(p.id)} size="lg">
              <Plus className="size-4" /> Add to wallet
            </LinkButton>
            <LinkButton href={rulesHref(p.id)} size="lg" variant="outline">
              <BookOpen className="size-4" /> See rules
            </LinkButton>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-faint">{label}</dt>
      <dd className="num mt-1 truncate font-semibold">{value}</dd>
    </div>
  );
}

export function SuggestionCard({ s, product: p, rank }: { s: Suggestion; product: Product; rank: number }) {
  const worth = s.netGain > 0;
  return (
    <Panel
      className={cn("group flex min-w-0 animate-fade-up flex-col p-5 transition-colors hover:border-line-strong", !worth && "bg-surface/40")}
      style={{ animationDelay: `${Math.min(rank, 10) * 40}ms` }}
    >
      <div className="flex items-start gap-4">
        <CardFace
          bank={p.bank}
          name={p.name}
          network={p.network}
          colorFrom={p.colorFrom}
          colorTo={p.colorTo}
          size="sm"
          className={cn("w-36", !worth && "opacity-60 grayscale-[40%]")}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-faint">
            #{rank} · {p.tier}
          </p>
          <p className="truncate text-xs text-muted">{p.bank}</p>
          <p className="truncate font-medium">{p.name}</p>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        {worth ? (
          <p className="num font-display text-4xl leading-none text-good">
            +{inr(s.netGain)}
            <span className="ml-1 font-sans text-xs text-muted">/yr</span>
          </p>
        ) : (
          <p className="text-sm font-medium text-faint">Not worth it for you</p>
        )}
        <p className="text-right text-[11px] leading-relaxed text-faint">
          <span className="num">+{inr(s.gain)}</span> rewards
          <br />
          <FeeLine s={s} />
        </p>
      </div>

      <div className="mt-4 flex min-h-7 flex-wrap gap-1.5">
        {s.topCategories.map((c) => (
          <span key={c.category} title={`${categoryLabel(c.category)}: ${inr(c.reward)}/yr`} className="flex items-center gap-1.5 text-[11px] text-muted">
            <CategoryIcon category={c.category} size="sm" className="size-6 rounded-lg" />
            {categoryLabel(c.category)}
          </span>
        ))}
        {s.topCategories.length === 0 && <span className="text-[11px] text-faint">Doesn&rsquo;t beat your cards anywhere</span>}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-5">
        <LinkButton href={addHref(p.id)} size="sm" variant={worth ? "secondary" : "ghost"} className="flex-1">
          <Plus className="size-3.5" /> Add to wallet
        </LinkButton>
        <Link href={rulesHref(p.id)} className="flex items-center gap-1 px-2 text-xs text-muted hover:text-ink">
          See rules <ArrowRight className="size-3" />
        </Link>
      </div>
    </Panel>
  );
}

export function WellCovered() {
  return (
    <Panel className="relative overflow-hidden p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-10 -top-16 size-64 rounded-full bg-good/10 blur-3xl" />
      <div className="relative flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-good/25 bg-good/10 text-good">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <p className="font-display text-3xl leading-tight sm:text-4xl">Your wallet is well covered</p>
          <p className="mt-2 max-w-lg text-sm text-muted">
            No catalog card adds enough rewards on your spending to beat its annual fee. Keep swiping what you have.
          </p>
        </div>
      </div>
    </Panel>
  );
}

export function Methodology() {
  const points = [
    "We replay your last 12 months of expenses with the card added, sending each purchase to whichever card earns most, caps included.",
    "Extra rewards = the wallet's total with the card minus without it, scaled to a full year.",
    "The annual fee is subtracted unless the spend it would take over meets its fee-waiver threshold.",
    "Perks like lounges, insurance and welcome bonuses are not included. Weigh them yourself.",
  ];
  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <FlaskConical className="size-4 text-info" />
        <h3 className="text-[15px] font-semibold tracking-tight">How we calculate this</h3>
      </div>
      <ul className="mt-4 grid gap-3 text-xs leading-relaxed text-muted sm:grid-cols-2">
        {points.map((t) => (
          <li key={t} className="flex gap-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-faint" />
            {t}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
