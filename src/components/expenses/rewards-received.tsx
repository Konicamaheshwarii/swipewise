"use client";

import Link from "next/link";
import { ArrowRight, Coins, Plane, Plus, Star, Upload } from "lucide-react";
import { useMemo } from "react";
import { CardFace } from "@/components/card-face";
import { CREDIT_LAG_MONTHS } from "@/components/dashboard/model";
import { Badge, Button, EmptyState, Panel } from "@/components/ui";
import { MONTHS, cardTitle, cn, inr, type RewardKind } from "@/lib/format";
import type { CardView } from "@/lib/wallet";
import { Chip } from "./summary-chip";

export interface CreditRow {
  id: string;
  /** YYYY-MM-DD in server local time */
  day: string;
  /** YYYY-MM */
  month: string;
  cardId: string | null;
  kind: RewardKind;
  /** ₹ value */
  amount: number;
  points: number | null;
  note: string | null;
  source: "manual" | "import";
}

const KIND_STYLE: Record<RewardKind, { icon: typeof Coins; tile: string; text: string; title: string }> = {
  cashback: { icon: Coins, tile: "bg-good/10 text-good", text: "text-good", title: "Cashback credited" },
  points: { icon: Star, tile: "bg-gold/10 text-gold", text: "text-gold", title: "Points posted" },
  miles: { icon: Plane, tile: "bg-info/10 text-info", text: "text-info", title: "Miles posted" },
};

const longMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};
const dayLabel = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};
/** The statement month a credit most likely pays for. */
const forMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return MONTHS[new Date(y, m - 1 - CREDIT_LAG_MONTHS, 1).getMonth()];
};
const units = (n: number) => Math.round(n).toLocaleString("en-IN");

export function RewardsReceived({
  credits, cards, onAdd, onEdit, onImport,
}: {
  credits: CreditRow[];
  cards: CardView[];
  onAdd: () => void;
  onEdit: (c: CreditRow) => void;
  onImport: () => void;
}) {
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const totals = useMemo(() => {
    let cashback = 0, points = 0, pointsValue = 0, miles = 0, milesValue = 0;
    for (const c of credits) {
      if (c.kind === "cashback") cashback += c.amount;
      else if (c.kind === "miles") {
        miles += c.points ?? 0;
        milesValue += c.amount;
      } else {
        points += c.points ?? 0;
        pointsValue += c.amount;
      }
    }
    return { cashback, points, pointsValue, miles, milesValue };
  }, [credits]);
  const groups = useMemo(() => {
    const out: { month: string; rows: CreditRow[]; total: number }[] = [];
    for (const c of credits) {
      const last = out[out.length - 1];
      if (last && last.month === c.month) {
        last.rows.push(c);
        last.total += c.amount;
      } else out.push({ month: c.month, rows: [c], total: c.amount });
    }
    return out;
  }, [credits]);

  if (!credits.length) {
    return (
      <EmptyState
        icon={<Coins className="size-6" />}
        title="No rewards logged yet"
        description={
          cards.length
            ? "Log the cashback your bank credits (or points it posts) each statement. Your dashboard compares it with what your spend should have earned and flags shortfalls."
            : "Add your cards in My Wallet first, then log the cashback and points they pay out here."
        }
        action={
          cards.length ? (
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={onImport}>
                <Upload className="size-4" /> Import statement
              </Button>
              <Button onClick={onAdd}>
                <Plus className="size-4" /> Add reward received
              </Button>
            </div>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <div className={cn("mb-6 grid grid-cols-2 gap-3 animate-fade-up", totals.miles > 0 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        <Chip icon={<Coins className="size-4" />} label="Cashback received" value={inr(totals.cashback)} tone="good" />
        {totals.points > 0 ? (
          <Chip icon={<Star className="size-4" />} label="Points posted" value={`${units(totals.points)} pts`} sub={`≈ ${inr(totals.pointsValue)}`} tone="gold" />
        ) : (
          <Chip icon={<Star className="size-4" />} label="Points posted" value="0 pts" />
        )}
        {totals.miles > 0 && <Chip icon={<Plane className="size-4" />} label="Miles posted" value={`${units(totals.miles)} mi`} sub={`≈ ${inr(totals.milesValue)}`} />}
        <div className={cn(totals.miles > 0 ? "" : "col-span-2 lg:col-span-1")}>
          <Chip icon={<Coins className="size-4" />} label="Total value received" value={inr(totals.cashback + totals.pointsValue + totals.milesValue)} sub={`${credits.length} credit${credits.length === 1 ? "" : "s"} logged`} />
        </div>
      </div>

      <Link
        href="/app#expected-vs-received"
        className="mb-6 flex items-center gap-3 rounded-2xl border border-accent/20 bg-accent/[0.05] px-4 py-3 text-xs text-muted transition-colors hover:border-accent/40"
      >
        <span className="min-w-0 flex-1">
          Banks credit cashback on the <span className="text-ink">next statement</span>, so a credit in October pays for September&apos;s spend.
          The dashboard checks each card&apos;s credits against what that spend should have earned.
        </span>
        <span className="hidden shrink-0 items-center gap-1 font-medium text-accent sm:flex">Expected vs received <ArrowRight className="size-3.5" /></span>
        <ArrowRight className="size-4 shrink-0 text-accent sm:hidden" />
      </Link>

      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g.month}>
            <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
              <h2 className="font-display text-2xl tracking-tight">{longMonth(g.month)}</h2>
              <p className="text-xs text-muted">
                for {forMonth(g.month)} spend · <span className="num font-medium text-ink">{inr(g.total)}</span>
              </p>
            </div>
            <Panel className="divide-y divide-line overflow-hidden">
              {g.rows.map((c) => (
                <CreditItem key={c.id} credit={c} card={c.cardId ? cardById.get(c.cardId) : undefined} onClick={() => onEdit(c)} />
              ))}
            </Panel>
          </section>
        ))}
      </div>
    </>
  );
}

function CreditItem({ credit: c, card, onClick }: { credit: CreditRow; card?: CardView; onClick: () => void }) {
  const style = KIND_STYLE[c.kind];
  const Icon = style.icon;
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.025] focus-visible:bg-white/[0.04] focus-visible:outline-none sm:gap-4 sm:px-5">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", style.tile)}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{c.note || style.title}</p>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-faint">
          <span className="num shrink-0">{dayLabel(c.day)}</span>
          {card ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <CardFace {...card} size="xs" className="w-7 rounded-[3px] p-0 shadow-none" />
              <span className="truncate text-muted">{cardTitle(card)}</span>
            </span>
          ) : (
            <span>No card</span>
          )}
          <Badge tone={c.source === "import" ? "info" : "neutral"} className="px-1.5 py-0 text-[10px]">{c.source === "import" ? "Imported" : "Manual"}</Badge>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        {c.kind === "cashback" ? (
          <span className={cn("num text-sm font-semibold", style.text)}>+{inr(c.amount, { decimals: c.amount % 1 ? 2 : 0 })}</span>
        ) : (
          <>
            <span className={cn("num text-sm font-semibold", style.text)}>+{units(c.points ?? 0)} {c.kind === "miles" ? "mi" : "pts"}</span>
            <span className="num text-[11px] text-faint">≈ {inr(c.amount)}</span>
          </>
        )}
      </div>
    </button>
  );
}
