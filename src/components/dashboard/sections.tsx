import Link from "next/link";
import { AlertTriangle, ArrowRight, BadgeCheck, CircleDashed, CircleSlash, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { CardFace } from "@/components/card-face";
import { CategoryIcon } from "@/components/category-icon";
import { Badge, Panel, PanelHeader, Progress } from "@/components/ui";
import { categoryLabel } from "@/data/categories";
import { cardTitle, cn, fmtDate, inr, pct, type RewardKind } from "@/lib/format";
import type { CardView } from "@/lib/wallet";
import { CREDIT_LAG_MONTHS, type CategorySlice, type CheatRow, type CheckCell, type CheckRow, type RecentRow, type RewardCheck, type WaiverRow } from "./model";

type Cards = Record<string, CardView>;

/* ---------- Spend by category ---------- */

export function CategoryBreakdown({ slices, total }: { slices: CategorySlice[]; total: number }) {
  const max = slices[0]?.spend ?? 1;
  return (
    <Panel className="flex h-full flex-col">
      <PanelHeader title="Where it goes" subtitle={`${inr(total)} across 12 months · top ${slices.length} categories`} />
      {/* Share strip: part-to-whole at a glance, 2px surface gaps between segments. */}
      <div className="mx-5 mt-5 flex h-2 gap-0.5 overflow-hidden rounded-full sm:mx-6" aria-hidden>
        {slices.map((s) => (
          <span key={s.category} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${s.share * 100}%`, background: s.color }} />
        ))}
        <span className="h-full flex-1 rounded-r-full bg-white/10" />
      </div>
      <ul className="flex flex-1 flex-col gap-3 px-5 py-5 sm:px-6">
        {slices.map((s) => (
          <li key={s.category} className="flex items-center gap-3">
            <CategoryIcon category={s.category} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">{s.label}</span>
                <span className="num shrink-0 text-ink">
                  {inr(s.spend, { compact: true })}
                  <span className="ml-1.5 text-xs text-faint">{pct(s.share * 100, 0)}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                <div className="h-full rounded-full" style={{ width: `${(s.spend / max) * 100}%`, background: s.color, opacity: 0.85 }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ---------- Cheat sheet ---------- */

export function CheatSheet({ categories, merchants, cards }: { categories: CheatRow[]; merchants: CheatRow[]; cards: Cards }) {
  const month = fmtDate(new Date(), { month: "long", year: "numeric" });
  return (
    <Panel className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_100%_0%,rgba(212,255,58,0.07),transparent_60%),radial-gradient(40%_60%_at_0%_100%,rgba(125,211,252,0.05),transparent_70%)]" />
      <div className="relative">
        <PanelHeader
          title={<span className="flex items-center gap-2"><Sparkles className="size-4 text-accent" /> Your cheat sheet</span>}
          subtitle={`Best card per category for ${month}, after the caps you've already used. Screenshot it.`}
          action={<Link href="/app/advisor" className="hidden items-center gap-1 text-xs text-muted hover:text-ink sm:flex">Swipe Advisor <ArrowRight className="size-3.5" /></Link>}
        />
        <div className="grid grid-cols-1 gap-2 px-5 pt-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-3">
          {categories.map((r) => <CheatTile key={r.key} row={r} card={r.cardId ? cards[r.cardId] : undefined} />)}
        </div>
        <p className="px-5 pb-2 pt-6 text-[11px] font-medium uppercase tracking-[0.14em] text-faint sm:px-6">Popular merchants</p>
        <div className="grid grid-cols-2 gap-2 px-5 pb-5 sm:grid-cols-3 sm:px-6 sm:pb-6 lg:grid-cols-5">
          {merchants.map((r) => <MerchantTile key={r.key} row={r} card={r.cardId ? cards[r.cardId] : undefined} />)}
        </div>
      </div>
    </Panel>
  );
}

function CheatTile({ row, card }: { row: CheatRow; card?: CardView }) {
  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-line bg-surface-2/60 p-3 transition-colors hover:border-line-strong" title={row.reason}>
      <CategoryIcon category={row.category} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] uppercase tracking-wider text-faint">{row.label}</p>
        {card ? (
          <p className="truncate text-sm font-medium">{cardTitle(card)}</p>
        ) : (
          <p className="flex items-center gap-1 text-sm text-muted"><CircleSlash className="size-3.5" /> No card earns here</p>
        )}
      </div>
      {card && (
        <div className="flex shrink-0 flex-col items-end gap-1">
          <CardFace {...card} size="xs" />
          <span className="num text-xs font-semibold text-accent">{pct(row.effectivePct, 2)}</span>
        </div>
      )}
    </div>
  );
}

function MerchantTile({ row, card }: { row: CheatRow; card?: CardView }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-2/60 p-3" title={row.reason}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{row.label}</span>
        {card ? <span className="num text-xs font-semibold text-accent">{pct(row.effectivePct, 2)}</span> : <span className="text-xs text-faint">0%</span>}
      </div>
      <div className="flex items-center gap-2">
        {card ? (
          <>
            <CardFace {...card} size="xs" className="w-10" />
            <span className="truncate text-[11px] text-muted">{cardTitle(card)}</span>
          </>
        ) : (
          <span className="text-[11px] text-faint">No rewards</span>
        )}
      </div>
    </div>
  );
}

/* ---------- Fee waivers ---------- */

export function WaiverProgress({ rows, cards }: { rows: WaiverRow[]; cards: Cards }) {
  return (
    <Panel className="h-full">
      <PanelHeader title="Fee waivers" subtitle="Spend in the current card year vs the waiver target" />
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted sm:px-6">None of your cards has a spend-based fee waiver.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line px-5 pb-2 pt-3 sm:px-6">
          {rows.map((r) => {
            const card = cards[r.cardId];
            if (!card) return null;
            const done = r.spent >= r.target;
            const ratio = (r.spent / r.target) * 100;
            const left = r.target - r.spent;
            const resets = fmtDate(r.resets, { month: "short", year: "numeric" });
            return (
              <li key={r.cardId} className="flex items-center gap-3 py-3.5">
                <CardFace {...card} size="xs" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{cardTitle(card)}</span>
                    <span className="num shrink-0 text-xs text-muted">{inr(r.spent, { compact: true })} / {inr(r.target, { compact: true })}</span>
                  </div>
                  <Progress value={ratio} tone={done ? "good" : ratio >= 65 ? "accent" : "gold"} className="mt-2" />
                  <p className="mt-1.5 text-[11px] text-faint">
                    {done ? (
                      <span className="inline-flex items-center gap-1 text-good"><BadgeCheck className="size-3.5" /> Fee waived · {inr(r.fee)} saved</span>
                    ) : (
                      <><span className="num text-muted">{inr(left)}</span> to go to save {inr(r.fee)} · resets {resets}</>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* ---------- Recent transactions ---------- */

export function RecentTransactions({ rows, cards }: { rows: RecentRow[]; cards: Cards }) {
  return (
    <Panel className="h-full">
      <PanelHeader
        title="Recent transactions"
        subtitle="Checked against the best card at the time"
        action={<Link href="/app/expenses" className="flex items-center gap-1 text-xs text-muted hover:text-ink">View all <ArrowRight className="size-3.5" /></Link>}
      />
      <ul className="flex flex-col px-3 pb-3 pt-2 sm:px-4">
        {rows.map((r) => {
          const card = r.cardId ? cards[r.cardId] : undefined;
          const better = r.betterCardId ? cards[r.betterCardId] : undefined;
          return (
            <li key={r.id} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-white/[0.02]">
              <CategoryIcon category={r.category} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.merchant || categoryLabel(r.category)}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-faint">
                  <span>{fmtDate(r.date, { day: "numeric", month: "short" })}</span>
                  {r.merchant && <span className="hidden sm:inline">· {categoryLabel(r.category)}</span>}
                  {better ? (
                    <Badge tone="bad" className="max-w-full truncate">Missed {inr(r.missed)} · use {cardTitle(better)}</Badge>
                  ) : card && r.earned != null && r.earned > 0 ? (
                    <Badge tone="good">Best pick · {inr(r.earned)}</Badge>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="num text-sm font-medium">{inr(r.amount)}</span>
                {card ? (
                  <span className="flex items-center gap-1.5 text-[11px] text-faint">
                    <span className="hidden max-w-24 truncate sm:inline">{cardTitle(card)}</span>
                    <CardFace {...card} size="xs" className="w-8 rounded-[3px] p-0" />
                  </span>
                ) : (
                  <span className="text-[11px] text-faint">No card</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* ---------- Expected vs received ---------- */

const KIND_BADGE: Record<RewardKind, { tone: "good" | "gold" | "info"; label: string }> = {
  cashback: { tone: "good", label: "Cashback" },
  points: { tone: "gold", label: "Points" },
  miles: { tone: "info", label: "Miles" },
};

const lagCopy = CREDIT_LAG_MONTHS === 1 ? "the following month" : `${CREDIT_LAG_MONTHS} months later`;

export function RewardCheckPanel({ check, cards }: { check: RewardCheck; cards: Cards }) {
  const rows = check.rows.filter((r) => cards[r.cardId]);
  const first = check.months[check.months.length - 1];
  const ratio = check.expectedLogged > 0 ? (check.received / check.expectedLogged) * 100 : 0;
  return (
    <Panel id="expected-vs-received" className="relative scroll-mt-24 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_70%_at_0%_0%,rgba(74,222,128,0.06),transparent_60%)]" />
      <div className="relative">
        <PanelHeader
          title={<span className="flex items-center gap-2"><ShieldCheck className="size-4 text-good" /> Expected vs received</span>}
          subtitle={
            <>
              What each card should have paid on a month&apos;s spend, against what you logged as credited {lagCopy}
              {first ? <> (e.g. {first.label} spend → {first.creditLabel} statement)</> : null}. Banks post cashback on the next statement.
            </>
          }
          action={<Link href="/app/expenses?tab=rewards" className="hidden shrink-0 items-center gap-1 text-xs text-muted hover:text-ink sm:flex">Rewards received <ArrowRight className="size-3.5" /></Link>}
        />

        {rows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted sm:px-6">No rewards expected on your cards in the last {check.months.length} months.</p>
        ) : (
          <>
            {/* Summary */}
            <div className="mx-5 mt-5 flex flex-col gap-3 rounded-2xl border border-line bg-surface-2/50 p-4 sm:mx-6 sm:flex-row sm:items-center sm:gap-6">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wider text-faint">Received where logged</p>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                  <span className="num text-2xl font-semibold tracking-tight text-ink">{inr(check.received)}</span>
                  <span className="num text-xs text-muted">of {inr(check.expectedLogged)} expected</span>
                </p>
                <Progress value={ratio} tone={ratio >= 95 ? "good" : "warn"} className="mt-2.5" />
              </div>
              <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                {check.short > 0 ? (
                  <Badge tone="warn"><AlertTriangle className="size-3" /> {check.short} short · <span className="num">{inr(check.shortBy)}</span> to chase</Badge>
                ) : check.expectedLogged > 0 ? (
                  <Badge tone="good"><BadgeCheck className="size-3" /> All logged credits on track</Badge>
                ) : null}
                {check.notLogged > 0 && <Badge><CircleDashed className="size-3" /> {check.notLogged} month{check.notLogged === 1 ? "" : "s"} not logged yet</Badge>}
              </div>
            </div>

            <ul className="flex flex-col divide-y divide-line px-5 pb-2 pt-2 sm:px-6">
              {rows.map((r) => (
                <CheckRowItem key={r.cardId} row={r} card={cards[r.cardId]} months={check.months} />
              ))}
            </ul>
          </>
        )}
      </div>
    </Panel>
  );
}

function CheckRowItem({ row, card, months }: { row: CheckRow; card: CardView; months: RewardCheck["months"] }) {
  const badge = KIND_BADGE[row.kind];
  const short = row.cells.filter((c) => c.status === "short" && c.expected > 0);
  return (
    <li className="grid gap-3 py-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:items-center lg:gap-6">
      <div className="flex min-w-0 items-center gap-3">
        <CardFace {...card} size="xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{cardTitle(card)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">
            <Badge tone={badge.tone} className="px-1.5 py-0 text-[10px]">{badge.label}</Badge>
            <span className="num truncate" title={`Expected over ${months.length} months`}>{inr(row.expected, { compact: row.expected >= 1e5 })} expected</span>
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {row.cells.map((c, i) => (
          <CheckCellItem key={c.month} cell={c} kind={row.kind} card={card} label={months[i].label} creditLabel={months[i].creditLabel} />
        ))}
      </div>
      {short.map((c) => {
        const m = months.find((x) => x.key === c.month)!;
        return (
          <p key={c.month} className="flex items-start gap-1.5 text-[11px] text-warn lg:col-start-2">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            <span>
              {m.creditLabel} credit for {m.label} spend is short by <span className="num font-medium">{inr(c.gap)}</span> ({pct((c.received / c.expected) * 100, 0)} of expected). Check with {card.bank}.
            </span>
          </p>
        );
      })}
    </li>
  );
}

function CheckCellItem({ cell: c, kind, card, label, creditLabel }: { cell: CheckCell; kind: RewardKind; card: CardView; label: string; creditLabel: string }) {
  const units = kind !== "cashback";
  const unit = kind === "miles" ? "mi" : "pts";
  const n = (v: number) => Math.round(v).toLocaleString("en-IN");
  const fmt = (value: number, count: number | null) => (units ? `${n(count ?? 0)} ${unit}` : inr(value));
  const ratio = c.expected > 0 ? (c.received / c.expected) * 100 : c.received > 0 ? 100 : 0;
  const tone = c.status === "on-track" ? "good" : c.status === "short" ? "warn" : "neutral";
  const addHref = `/app/expenses?tab=rewards&add=${encodeURIComponent(card.id)}&for=${c.month}`;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-2xl border p-2.5 sm:p-3",
        tone === "warn" ? "border-warn/25 bg-warn/[0.05]" : tone === "good" ? "border-line bg-surface-2/60" : "border-dashed border-line bg-transparent",
      )}
      title={`${label} spend, credited on the ${creditLabel} statement`}
    >
      <p className="flex items-center justify-between gap-1 text-[10px] font-medium uppercase tracking-wider text-faint">
        <span className="truncate">{label}<span className="hidden sm:inline"> → {creditLabel}</span></span>
        {c.status === "on-track" ? <BadgeCheck className="size-3.5 shrink-0 text-good" /> : c.status === "short" ? <AlertTriangle className="size-3.5 shrink-0 text-warn" /> : null}
      </p>

      {c.status === "none" ? (
        <p className="text-xs text-faint">Nothing expected</p>
      ) : c.status === "not-logged" ? (
        <>
          <p className="num truncate text-sm font-semibold text-muted">{fmt(c.expected, c.expectedUnits)}</p>
          <p className="truncate text-[11px] text-faint">
            expected{units ? <span className="hidden sm:inline"> ≈ {inr(c.expected)}</span> : null}
          </p>
          <div className="mt-auto flex flex-col items-start gap-0.5 pt-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-1">
            <span className="truncate text-[11px] text-faint">Not logged yet</span>
            <Link href={addHref} className="-mx-1 inline-flex shrink-0 items-center gap-0.5 rounded-md px-1 text-[11px] font-medium text-accent hover:underline" aria-label={`Add reward received for ${cardTitle(card)}, ${label} spend`}>
              <Plus className="size-3" />Add
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className={cn("num truncate text-sm font-semibold", tone === "warn" ? "text-warn" : "text-ink")}>{fmt(c.received, c.receivedUnits)}</p>
          <p className="num truncate text-[11px] text-faint">of {fmt(c.expected, c.expectedUnits)}</p>
          <Progress value={ratio} tone={tone === "warn" ? "warn" : "good"} className="h-1" />
          <p className={cn("truncate text-[11px]", tone === "warn" ? "text-warn" : "text-good")} title={c.status === "short" ? `Short by ${inr(c.gap)}. Check with the bank` : undefined}>
            {c.status === "short" ? (
              <>Short by <span className="num">{inr(c.gap)}</span></>
            ) : (
              "On track"
            )}
          </p>
        </>
      )}
    </div>
  );
}

export const cardIndex = (views: CardView[]): Cards => Object.fromEntries(views.map((v) => [v.id, v]));
