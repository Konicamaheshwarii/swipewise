"use client";

import { Coins, FileText, Globe, Plane, Plus, Receipt, Search, Star, TrendingDown, Upload, Wallet, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { CardFace } from "@/components/card-face";
import { CategoryIcon } from "@/components/category-icon";
import { StatementImportModal, type StatementProduct } from "@/components/statements/statement-import";
import { CREDIT_LAG_MONTHS } from "@/components/dashboard/model";
import { Badge, Button, EmptyState, Input, Panel, PageHeader, Select } from "@/components/ui";
import { CATEGORIES, categoryLabel } from "@/data/categories";
import type { Channel, EngineCard } from "@/engine";
import { MONTHS, addToSplit, cardTitle, cn, emptySplit, inr, rewardHint, rewardKind } from "@/lib/format";
import type { CardView } from "@/lib/wallet";
import { CreditFormModal, emptyCredit, type CreditFormValues } from "./credit-form";
import { CHANNELS, ExpenseFormModal, emptyExpense, todayKey, type ExpenseFormValues } from "./expense-form";
import { ImportModal } from "./import-modal";
import { RewardsReceived, type CreditRow } from "./rewards-received";
import { Chip } from "./summary-chip";

export interface ExpenseRow {
  id: string;
  amount: number;
  /** ISO timestamp */
  date: string;
  /** YYYY-MM-DD in server local time */
  day: string;
  /** YYYY-MM */
  month: string;
  category: string;
  subcategory: string | null;
  merchant: string | null;
  channel: Channel;
  note: string | null;
  cardId: string | null;
  /** Net reward on the card actually used (caps applied); null when no card. */
  earned: number | null;
  /** Best card at that moment, given the same cap usage. */
  best: { cardId: string; net: number; reason: string } | null;
}

const PAGE = 100;
/** Ignore rounding-level differences when flagging a better card. */
const MIN_GAIN = 1;

const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
const longMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};
const dayLabel = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};
const shortName = (c: CardView) => c.nickname || c.name;

/** Gain from using the best card instead of the one used (0 when the right card was used). */
const missedOn = (r: ExpenseRow) => (r.earned != null && r.best ? Math.max(0, r.best.net - r.earned) : 0);

type Tab = "expenses" | "rewards";

/** Where a credit for `forMonth` spend usually lands: the card's statement day the month after, never in the future. */
function creditDay(card: CardView, forMonth: string | null) {
  const today = todayKey();
  if (!forMonth) return today;
  const [y, m] = forMonth.split("-").map(Number);
  const first = new Date(y, m - 1 + CREDIT_LAG_MONTHS, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const day = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}-${String(Math.min(card.statementDay || 1, last)).padStart(2, "0")}`;
  return day < today ? day : today;
}

export function ExpensesView({
  rows, credits, cards, catalog, engineCards, initialTab = "expenses", initialAdd = null,
}: {
  rows: ExpenseRow[];
  credits: CreditRow[];
  cards: CardView[];
  /** Catalog cards a statement PDF can be matched to. */
  catalog: StatementProduct[];
  engineCards: EngineCard[];
  initialTab?: Tab;
  /** Open "Add reward received" for this card (from the dashboard). */
  initialAdd?: { cardId: string; forMonth: string | null } | null;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [creditForm, setCreditForm] = useState<{ key: number; values: CreditFormValues } | null>(() => {
    const card = initialAdd ? cards.find((c) => c.id === initialAdd.cardId) : undefined;
    return card ? { key: 0, values: emptyCredit(card, creditDay(card, initialAdd!.forMonth)) } : null;
  });
  const [q, setQ] = useState("");
  const [month, setMonth] = useState("");
  const [category, setCategory] = useState("");
  const [card, setCard] = useState("");
  const [channel, setChannel] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [form, setForm] = useState<{ key: number; values: ExpenseFormValues } | null>(null);
  const [importing, setImporting] = useState(false);
  const [pdfImport, setPdfImport] = useState(0);
  const query = useDeferredValue(q.trim().toLowerCase());

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const months = useMemo(() => [...new Set(rows.map((r) => r.month))], [rows]);
  const pastMerchants = useMemo(() => [...new Set(rows.map((r) => r.merchant).filter((m): m is string => !!m))], [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (month && r.month !== month) return false;
        if (category && r.category !== category) return false;
        if (channel && r.channel !== channel) return false;
        if (card === "none" ? r.cardId : card && r.cardId !== card) return false;
        if (query) {
          const hay = `${r.merchant ?? ""} ${r.note ?? ""} ${r.subcategory ?? ""} ${categoryLabel(r.category)}`.toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      }),
    [rows, month, category, channel, card, query],
  );

  const summary = useMemo(() => {
    let spend = 0, earned = 0, missed = 0;
    const split = emptySplit();
    const monthTotals = new Map<string, { spend: number; count: number }>();
    for (const r of filtered) {
      spend += r.amount;
      earned += r.earned ?? 0;
      missed += missedOn(r);
      const c = r.cardId ? cardById.get(r.cardId) : undefined;
      if (c && r.earned) addToSplit(split, r.earned, c.rewardUnit, c.pointValue);
      const t = monthTotals.get(r.month) ?? { spend: 0, count: 0 };
      t.spend += r.amount;
      t.count++;
      monthTotals.set(r.month, t);
    }
    return { spend, earned, missed, split, monthTotals };
  }, [filtered, cardById]);
  // Which reward types this wallet earns, so a cashback-only wallet doesn't show an empty points chip.
  const kinds = useMemo(() => new Set(cards.map((c) => rewardKind(c.rewardUnit, c.pointValue))), [cards]);

  const groups = useMemo(() => {
    const out: { month: string; rows: ExpenseRow[] }[] = [];
    for (const r of filtered.slice(0, limit)) {
      const last = out[out.length - 1];
      if (last && last.month === r.month) last.rows.push(r);
      else out.push({ month: r.month, rows: [r] });
    }
    return out;
  }, [filtered, limit]);

  const filtering = !!(q || month || category || card || channel);
  const clearFilters = () => {
    setQ("");
    setMonth("");
    setCategory("");
    setCard("");
    setChannel("");
    setLimit(PAGE);
  };
  const onFilter = (fn: (v: string) => void) => (e: { target: { value: string } }) => {
    fn(e.target.value);
    setLimit(PAGE);
  };

  const openForm = (values: ExpenseFormValues) => setForm((f) => ({ key: (f?.key ?? 0) + 1, values }));
  const openCredit = (values: CreditFormValues) => setCreditForm((f) => ({ key: (f?.key ?? 0) + 1, values }));
  const openCreditEdit = (c: CreditRow) =>
    openCredit({
      id: c.id,
      cardId: c.cardId && cardById.has(c.cardId) ? c.cardId : "",
      day: c.day,
      kind: c.kind,
      value: String(c.kind === "cashback" ? c.amount : c.points ?? c.amount),
      note: c.note ?? "",
    });
  const closeCredit = () => {
    setCreditForm(null);
    // Drop ?add=… so a refresh doesn't reopen the form.
    if (initialAdd) window.history.replaceState(null, "", "/app/expenses?tab=rewards");
  };
  const switchTab = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", t === "rewards" ? "/app/expenses?tab=rewards" : "/app/expenses");
  };
  const openEdit = (r: ExpenseRow) =>
    openForm({
      id: r.id,
      amount: String(r.amount),
      day: r.day,
      merchant: r.merchant ?? "",
      category: r.category,
      subcategory: r.subcategory ?? "",
      channel: r.channel,
      cardId: r.cardId && cardById.has(r.cardId) ? r.cardId : "",
      note: r.note ?? "",
    });

  return (
    <>
      <PageHeader
        eyebrow="Expenses"
        title="Where your money goes"
        description={
          tab === "rewards"
            ? "Cashback and points your banks actually paid out, to check against what your spend should have earned."
            : "Every purchase, the reward it earned, and whether another card in your wallet would have earned more."
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setPdfImport((k) => k + 1)}>
              <FileText className="size-4" /> Import statements (PDF)
            </Button>
            <Button variant="secondary" onClick={() => setImporting(true)}>
              <Upload className="size-4" /> Import CSV
            </Button>
            {tab === "rewards" ? (
              <Button onClick={() => openCredit(emptyCredit(cards[0]))} disabled={!cards.length}>
                <Plus className="size-4" /> Add reward received
              </Button>
            ) : (
              <Button onClick={() => openForm(emptyExpense())}>
                <Plus className="size-4" /> Add expense
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 flex w-full gap-1 rounded-2xl border border-line bg-surface-2/70 p-1 sm:w-fit" role="tablist" aria-label="Expenses view">
        {([
          ["expenses", "Expenses", rows.length],
          ["rewards", "Rewards received", credits.length],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => switchTab(key)}
            className={cn(
              "flex h-9 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors sm:flex-none",
              tab === key ? "bg-surface-3 text-ink shadow-sm ring-1 ring-line-strong" : "text-muted hover:text-ink",
            )}
          >
            {label}
            <span className={cn("num rounded-full px-1.5 text-[11px]", tab === key ? "bg-white/10 text-ink" : "bg-white/5 text-faint")}>{count.toLocaleString("en-IN")}</span>
          </button>
        ))}
      </div>

      {tab === "rewards" ? (
        <RewardsReceived
          credits={credits}
          cards={cards}
          onAdd={() => openCredit(emptyCredit(cards[0]))}
          onEdit={openCreditEdit}
          onImport={() => setImporting(true)}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Receipt className="size-6" />}
          title="No expenses yet"
          description={
            cards.length
              ? "Log a few purchases or import a CSV from your bank. We'll show what each one earned and where a better card would have paid more."
              : "Import your statement PDFs to add your cards and spending in one go, or add cards in My Wallet first."
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={() => setPdfImport((k) => k + 1)}>
                <FileText className="size-4" /> Import statements (PDF)
              </Button>
              <Button variant="secondary" onClick={() => setImporting(true)}>
                <Upload className="size-4" /> Import CSV
              </Button>
              <Button onClick={() => openForm(emptyExpense())}>
                <Plus className="size-4" /> Add expense
              </Button>
            </div>
          }
        />
      ) : (
        <>
          {/* Summary for the filtered set */}
          <div className={cn("mb-6 grid grid-cols-2 gap-3 animate-fade-up", kinds.size === 3 ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
            <Chip
              icon={<Wallet className="size-4" />}
              label="Total spend"
              value={inr(summary.spend, { compact: summary.spend >= 1e6 })}
              sub={kinds.size > 1 ? `${filtered.length.toLocaleString("en-IN")} expense${filtered.length === 1 ? "" : "s"}` : undefined}
            />
            {(kinds.has("cashback") || kinds.size === 0) && (
              <Chip icon={<Coins className="size-4" />} label="Cashback earned" value={inr(summary.split.cashback)} sub="Credited as money" tone="good" />
            )}
            {kinds.has("points") && (
              <Chip
                icon={<Star className="size-4" />}
                label="Points earned"
                value={`≈ ${inr(summary.split.pointsValue)}`}
                sub={`${Math.round(summary.split.points).toLocaleString("en-IN")} pts`}
                tone="gold"
              />
            )}
            {kinds.has("miles") && (
              <Chip
                icon={<Plane className="size-4" />}
                label="Miles earned"
                value={`≈ ${inr(summary.split.milesValue)}`}
                sub={`${Math.round(summary.split.miles).toLocaleString("en-IN")} miles`}
              />
            )}
            {kinds.size <= 1 && <Chip icon={<Receipt className="size-4" />} label="Expenses" value={filtered.length.toLocaleString("en-IN")} />}
            <Chip icon={<TrendingDown className="size-4" />} label="Missed rewards" value={inr(summary.missed)} sub="vs best card each time" tone={summary.missed >= MIN_GAIN ? "warn" : "neutral"} />
          </div>

          {/* Filters */}
          <Panel className="mb-6 p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]">
              <div className="relative col-span-2 md:col-span-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
                <Input value={q} onChange={onFilter(setQ)} placeholder="Search merchant or note" className="pl-9" aria-label="Search" />
              </div>
              <Select value={month} onChange={onFilter(setMonth)} aria-label="Month">
                <option value="">All months</option>
                {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </Select>
              <Select value={category} onChange={onFilter(setCategory)} aria-label="Category">
                <option value="">All categories</option>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </Select>
              <Select value={card} onChange={onFilter(setCard)} aria-label="Card">
                <option value="">All cards</option>
                {cards.map((c) => <option key={c.id} value={c.id}>{cardTitle(c)}</option>)}
                <option value="none">No card</option>
              </Select>
              <Select value={channel} onChange={onFilter(setChannel)} aria-label="Channel">
                <option value="">All channels</option>
                {CHANNELS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </Select>
              {filtering && (
                <Button variant="ghost" onClick={clearFilters} className="col-span-2 md:col-span-1">
                  <X className="size-4" /> Clear
                </Button>
              )}
            </div>
          </Panel>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="size-6" />}
              title="Nothing matches these filters"
              description="Try a different month or card, or clear the filters."
              action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <div className="flex flex-col gap-6">
              {groups.map((g) => {
                const t = summary.monthTotals.get(g.month)!;
                return (
                  <section key={g.month}>
                    <div className="mb-2 flex items-baseline justify-between px-1">
                      <h2 className="font-display text-2xl tracking-tight">{longMonth(g.month)}</h2>
                      <p className="text-xs text-muted">
                        <span className="num">{t.count}</span> expense{t.count === 1 ? "" : "s"} ·{" "}
                        <span className="num font-medium text-ink">{inr(t.spend)}</span>
                      </p>
                    </div>
                    <Panel className="divide-y divide-line overflow-hidden">
                      {g.rows.map((r) => (
                        <Row key={r.id} row={r} card={r.cardId ? cardById.get(r.cardId) : undefined} best={r.best ? cardById.get(r.best.cardId) : undefined} onClick={() => openEdit(r)} />
                      ))}
                    </Panel>
                  </section>
                );
              })}
              {filtered.length > limit && (
                <div className="flex flex-col items-center gap-2">
                  <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
                    Show more
                  </Button>
                  <p className="text-xs text-faint">
                    Showing {limit.toLocaleString("en-IN")} of {filtered.length.toLocaleString("en-IN")}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {form && (
        <ExpenseFormModal key={form.key} initial={form.values} cards={cards} engineCards={engineCards} merchants={pastMerchants} onClose={() => setForm(null)} />
      )}
      {creditForm && <CreditFormModal key={creditForm.key} initial={creditForm.values} cards={cards} onClose={closeCredit} />}
      {importing && <ImportModal cards={cards} onClose={() => setImporting(false)} />}
      {pdfImport > 0 && <StatementImportModal key={pdfImport} catalog={catalog} cards={cards} onClose={() => setPdfImport(0)} />}
    </>
  );
}

function Row({ row: r, card, best, onClick }: { row: ExpenseRow; card?: CardView; best?: CardView; onClick: () => void }) {
  const gain = missedOn(r);
  const showBest = best && r.best && (r.earned == null ? r.best.net >= MIN_GAIN : gain >= MIN_GAIN);
  const sub = [r.subcategory, r.note].filter(Boolean).join(" · ");

  return (
    <button onClick={onClick} className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.025] focus-visible:bg-white/[0.04] focus-visible:outline-none sm:gap-4 sm:px-5">
      <CategoryIcon category={r.category} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{r.merchant || categoryLabel(r.category)}</p>
          {r.channel === "international" && (
            <Badge tone="info" className="hidden sm:inline-flex">
              <Globe className="size-3" /> International
            </Badge>
          )}
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-faint">
          <span className="num shrink-0">{dayLabel(r.day)}</span>
          <span aria-hidden>·</span>
          <span className="truncate">{sub || (r.merchant ? categoryLabel(r.category) : r.channel === "offline" ? "In store" : r.channel === "online" ? "Online" : "International")}</span>
        </p>
        {/* Mobile: card + reward hint on their own line */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 md:hidden">
          {r.channel === "international" && (
            <Badge tone="info" className="sm:hidden">
              <Globe className="size-3" /> Intl
            </Badge>
          )}
          {card && <CardChip card={card} />}
          {showBest && <BestBadge best={best!} net={r.best!.net} untracked={r.earned == null} />}
        </div>
      </div>

      <div className="hidden w-40 shrink-0 md:block">{card ? <CardChip card={card} /> : <span className="text-xs text-faint">No card</span>}</div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className="num text-sm font-semibold">{inr(r.amount, { decimals: r.amount % 1 ? 2 : 0 })}</p>
        <Earned earned={r.earned} card={card} />
        {showBest && (
          <span className="hidden md:block">
            <BestBadge best={best!} net={r.best!.net} untracked={r.earned == null} />
          </span>
        )}
      </div>
    </button>
  );
}

function CardChip({ card }: { card: CardView }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <CardFace {...card} size="xs" className="w-8 rounded-[4px] p-0 shadow-none" />
      <span className="truncate text-xs text-muted">{shortName(card)}</span>
    </span>
  );
}

function Earned({ earned, card }: { earned: number | null; card?: CardView }) {
  if (earned == null) return <span className="text-[11px] text-faint">Card not tracked</span>;
  if (earned >= 0.5) {
    const kind = card ? rewardKind(card.rewardUnit, card.pointValue) : "cashback";
    return (
      <span className={cn("num text-[11px] font-medium", kind === "cashback" ? "text-good" : kind === "points" ? "text-gold" : "text-info")}>
        {card ? rewardHint(earned, card.rewardUnit, card.pointValue) : `+${inr(earned)} earned`}
      </span>
    );
  }
  if (earned <= -0.5) return <span className="num text-[11px] font-medium text-bad">{inr(earned)} after forex</span>;
  return <span className="text-[11px] text-faint">No reward</span>;
}

function BestBadge({ best, net, untracked }: { best: CardView; net: number; untracked: boolean }) {
  return (
    <Badge tone={untracked ? "neutral" : "warn"} title={`${cardTitle(best)} would have earned ${inr(net)}`} className="max-w-48">
      <span className="truncate">Best: {shortName(best)}</span>
      <span className="num shrink-0">+{inr(net)}</span>
    </Badge>
  );
}
