"use client";

import { ExternalLink, Info, Pencil, Search, SearchX, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { CardFace } from "@/components/card-face";
import { CategoryIcon } from "@/components/category-icon";
import { Badge, Button, EmptyState, Panel } from "@/components/ui";
import { categoryLabel } from "@/data/categories";
import { cn, inr, pct, rewardKind, type RewardKind } from "@/lib/format";
import { EditProductModal } from "./edit-product-modal";
import type { CatalogProduct, CatalogRuleView } from "./types";

const KIND_LABEL: Record<RewardKind, string> = { cashback: "Cashback", points: "Points", miles: "Miles" };
const KIND_OPTIONS = Object.values(KIND_LABEL);
const TIER_ORDER = ["Entry", "Mid", "Premium", "Super Premium"];
const CHANNEL_LABEL: Record<string, string> = { online: "Online", offline: "In-store", international: "International" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10" → "Oct 2026" */
export function fmtVerified(s: string) {
  const m = /^(\d{4})-(\d{2})/.exec(s);
  return m ? `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}` : s;
}

export function CatalogBrowser({ products, isAdmin }: { products: CatalogProduct[]; isAdmin: boolean }) {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<string | null>(null);
  const [bank, setBank] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = products.find((p) => p.id === editingId) ?? null;

  const tiers = useMemo(
    () => [...new Set(products.map((p) => p.tier))].sort((a, b) => TIER_ORDER.indexOf(a) - TIER_ORDER.indexOf(b)),
    [products],
  );
  const banks = useMemo(() => [...new Set(products.map((p) => p.bank))].sort(), [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (tier && p.tier !== tier) return false;
      if (bank && p.bank !== bank) return false;
      if (kind && KIND_LABEL[rewardKind(p.rewardUnit, p.pointValue)] !== kind) return false;
      if (!q) return true;
      const hay = [p.bank, p.name, p.network, p.rewardUnit, ...p.rules.flatMap((r) => [r.label, ...r.merchants, ...r.categories.map(categoryLabel)])]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [products, query, tier, bank, kind]);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border border-warn/20 bg-warn/[0.06] px-4 py-3 text-xs leading-relaxed text-warn/90">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <p>
          Reward rules here are approximations of each issuer&rsquo;s published terms and change often. Always verify the current terms with the
          issuer before relying on them.
        </p>
      </div>

      <Panel className="space-y-4 p-4 sm:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards, banks, merchants or categories"
            className="h-11 w-full rounded-2xl border border-line bg-surface-2 pl-10 pr-3 text-sm text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/15"
          />
        </div>
        <ChipRow label="Rewards" options={KIND_OPTIONS} value={kind} onChange={setKind} />
        <ChipRow label="Tier" options={tiers} value={tier} onChange={setTier} />
        <ChipRow label="Bank" options={banks} value={bank} onChange={setBank} />
      </Panel>

      <p className="text-xs text-faint">
        Showing <span className="num text-muted">{filtered.length}</span> of {products.length} cards
      </p>

      {filtered.length === 0 ? (
        <EmptyState icon={<SearchX className="size-6" />} title="No cards match" description="Try a different search or clear the filters." />
      ) : (
        <div className="space-y-6">
          {filtered.map((p) => (
            <ProductPanel key={p.id} p={p} onEdit={isAdmin ? () => setEditingId(p.id) : undefined} />
          ))}
        </div>
      )}

      {isAdmin && editing && <EditProductModal product={editing} onClose={() => setEditingId(null)} />}
    </div>
  );
}

function ChipRow({ label, options, value, onChange }: { label: string; options: string[]; value: string | null; onChange: (v: string | null) => void }) {
  const chip = (active: boolean) =>
    cn(
      "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      active ? "border-accent/50 bg-accent/10 text-accent" : "border-line text-muted hover:border-line-strong hover:text-ink",
    );
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 shrink-0 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">{label}</span>
      <div className="-mr-4 flex gap-2 overflow-x-auto pr-4 sm:mr-0 sm:flex-wrap sm:overflow-visible sm:pr-0">
        <button type="button" className={chip(value === null)} onClick={() => onChange(null)}>
          All
        </button>
        {options.map((o) => (
          <button key={o} type="button" className={chip(value === o)} onClick={() => onChange(value === o ? null : o)} aria-pressed={value === o}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProductPanel({ p, onEdit }: { p: CatalogProduct; onEdit?: () => void }) {
  const cashback = rewardKind(p.rewardUnit, p.pointValue) === "cashback";
  const facts: { label: string; value: string; hint?: string }[] = [
    { label: "Annual fee", value: p.annualFee ? inr(p.annualFee) : "Free" },
    { label: "Joining fee", value: p.joiningFee ? inr(p.joiningFee) : "Free" },
    { label: "Fee waiver", value: p.feeWaiverSpend ? inr(p.feeWaiverSpend, { compact: true }) : "—", hint: p.feeWaiverSpend ? "spend / year" : "none" },
    { label: "Forex markup", value: pct(p.forexMarkup, 2) },
    { label: "Earns", value: p.rewardUnit },
    { label: "Point value", value: cashback ? "₹1" : `₹${Number(p.pointValue.toFixed(2))}`, hint: cashback ? "cashback" : "per point" },
  ];

  return (
    <Panel
      id={p.id}
      className="scroll-mt-24 overflow-hidden transition-[border-color,box-shadow] duration-500 target:border-accent/50 target:shadow-[0_0_0_4px_rgba(212,255,58,0.08)]"
    >
      <div className="relative p-5 sm:p-6">
        <div
          className="pointer-events-none absolute -left-20 -top-28 size-72 rounded-full opacity-20 blur-3xl"
          style={{ background: `radial-gradient(circle, ${p.colorTo}, transparent 70%)` }}
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <CardFace bank={p.bank} name={p.name} network={p.network} colorFrom={p.colorFrom} colorTo={p.colorTo} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">
              {p.bank} · {p.network}
            </p>
            <h2 className="mt-0.5 font-display text-3xl leading-none tracking-tight">{p.name}</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone={p.tier === "Super Premium" || p.tier === "Premium" ? "gold" : "neutral"}>{p.tier}</Badge>
              <Badge>{p.rules.length} rules</Badge>
            </div>
          </div>
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit} className="self-start sm:self-center">
              <Pencil className="size-3.5" /> Edit
            </Button>
          )}
        </div>

        <dl className="relative mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
          {facts.map((f) => (
            <div key={f.label} className="bg-surface px-4 py-3">
              <dt className="text-[11px] text-faint">{f.label}</dt>
              <dd className="num mt-1 truncate text-sm font-semibold">
                {f.value}
                {f.hint && <span className="ml-1 text-[11px] font-normal text-faint">{f.hint}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <div className="relative mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">Benefits</h4>
            {p.benefits.length ? (
              <ul className="space-y-1.5 text-sm text-muted">
                {p.benefits.map((b) => (
                  <li key={b.label} className="flex items-baseline justify-between gap-3">
                    <span className="flex items-baseline gap-2">
                      <span className="size-1 shrink-0 translate-y-[-2px] rounded-full bg-accent/70" />
                      {b.label}
                    </span>
                    {b.value > 0 && <span className="num shrink-0 text-xs text-faint">~{inr(b.value)}/yr</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-faint">No notable extras</p>
            )}
          </div>
          <div>
            <h4 className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">No rewards on</h4>
            {p.excluded.length ? (
              <div className="flex flex-wrap gap-1.5">
                {p.excluded.map((c) => (
                  <Badge key={c} tone="bad">
                    {categoryLabel(c)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-faint">No category exclusions listed</p>
            )}
          </div>
        </div>
      </div>

      <RulesTable rules={p.rules} />

      {p.notes && (
        <div className="mx-5 mb-4 flex gap-2.5 rounded-2xl border border-info/20 bg-info/[0.05] p-3.5 text-xs leading-relaxed text-muted sm:mx-6">
          <Info className="mt-0.5 size-3.5 shrink-0 text-info" />
          <p>{p.notes}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line px-5 py-3 text-[11px] text-faint sm:px-6">
        <span>Last verified {fmtVerified(p.lastVerified)}</span>
        <span>·</span>
        <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-ink">
          Source <ExternalLink className="size-3" />
        </a>
      </div>
    </Panel>
  );
}

const ROW = "md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.7fr)_6.5rem_minmax(0,1fr)_5rem] md:items-center md:gap-4";

function RulesTable({ rules }: { rules: CatalogRuleView[] }) {
  return (
    <div className="border-t border-line bg-surface-2/40">
      <div className={cn(ROW, "hidden px-6 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-faint md:grid")}>
        <span>Rule</span>
        <span>Applies to</span>
        <span className="text-right">Earns</span>
        <span>Cap</span>
        <span className="text-right">Min txn</span>
      </div>
      <ul className="divide-y divide-line">
        {rules.map((r) => (
          <li key={r.id} className={cn(ROW, "px-5 py-3.5 sm:px-6")}>
            <div className="flex items-start justify-between gap-3 md:block">
              <p className="text-sm font-medium">{r.label}</p>
              <p className="num shrink-0 text-sm font-semibold text-accent md:hidden">{pct(r.pct, 2)}</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 md:mt-0">
              <Scope r={r} />
            </div>
            <div className="hidden text-right md:block">
              <p className="num text-sm font-semibold text-accent">{pct(r.pct, 2)}</p>
              {r.rateType === "points" && (
                <p className="num text-[11px] text-faint">
                  {Number(r.rate.toFixed(2))} pts / {inr(r.perAmount)}
                </p>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted md:mt-0 md:block">
              {r.rateType === "points" && (
                <span className="num text-faint md:hidden">
                  {Number(r.rate.toFixed(2))} pts / {inr(r.perAmount)}
                </span>
              )}
              {r.capValue != null && r.capPeriod ? (
                <span className="num">
                  {inr(r.capValue)}
                  <span className="text-faint"> / {r.capPeriod}</span>
                  {r.capShared && <span className="block text-[11px] text-faint md:mt-0.5">shared with other rules</span>}
                </span>
              ) : (
                <span className="text-faint">No cap</span>
              )}
              <span className="num text-faint md:hidden">{r.minTxn ? `Min ${inr(r.minTxn)}` : ""}</span>
            </div>
            <p className="num hidden text-right text-xs text-muted md:block">{r.minTxn ? inr(r.minTxn) : <span className="text-faint">—</span>}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Scope({ r }: { r: CatalogRuleView }) {
  if (!r.categories.length && !r.merchants.length && !r.channels.length) {
    return <span className="text-xs text-faint">All other spends</span>;
  }
  return (
    <>
      {r.categories.map((c) => (
        <span key={c} className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pl-0.5 pr-2 text-[11px] text-muted">
          <CategoryIcon category={c} size="sm" className="size-5 rounded-full [&_svg]:size-3" />
          {categoryLabel(c)}
        </span>
      ))}
      {r.merchants.map((m) => (
        <span key={m} className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] text-ink/80">
          {m}
        </span>
      ))}
      {r.channels.map((c) => (
        <Badge key={c} tone="info">
          {CHANNEL_LABEL[c] ?? c}
        </Badge>
      ))}
    </>
  );
}
