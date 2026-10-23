"use client";

import { CalendarClock, Check, CircleAlert, CreditCard, FileText, Gift, Pencil, Plus, Search, SlidersHorizontal, Sparkles, Trash2, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CardFace } from "@/components/card-face";
import { Modal } from "@/components/modal";
import { StatementImportModal } from "@/components/statements/statement-import";
import { Badge, Button, EmptyState, Input, LinkButton, PageHeader, Panel, StatCard } from "@/components/ui";
import { removeCard } from "@/lib/actions/cards";
import { MONTHS, cardTitle, cn, inr } from "@/lib/format";
import type { CardView } from "@/lib/wallet";
import { CardDetailsForm, emptyCardForm, ordinal, type CatalogItem } from "./card-form";
import { CustomCardForm } from "./custom-card-form";
import type { CustomProduct } from "./custom-shared";
import { QuickAddSheet } from "./quick-add";

export type { CatalogItem };

export function WalletView({
  cards,
  catalog,
  custom,
  welcome,
  initialAdd,
}: {
  cards: CardView[];
  catalog: CatalogItem[];
  custom: CustomProduct[];
  welcome: boolean;
  initialAdd: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // Remount key so each "Add card" opening starts fresh. Quick add is the default; ?add=<id> opens the detail form.
  const [addSession, setAddSession] = useState<{ key: number; mode: "quick" | "details"; product: string | null } | null>(
    initialAdd ? { key: 0, mode: "details", product: initialAdd } : null,
  );
  const [showDetailsBanner, setShowDetailsBanner] = useState(true);
  const [editingSetup, setEditingSetup] = useState<CustomProduct | null>(null);
  const [showWelcome, setShowWelcome] = useState(welcome);
  const [editing, setEditing] = useState<CardView | null>(null);
  const [removing, setRemoving] = useState<CardView | null>(null);
  const [pdfImport, setPdfImport] = useState(0);
  const openStatements = () => {
    setAddSession(null);
    setPdfImport((k) => k + 1);
  };

  const productById = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const customById = useMemo(() => new Map(custom.map((p) => [p.id, p])), [custom]);
  const banks = useMemo(() => [...new Set(catalog.map((p) => p.bank))], [catalog]);
  const incomplete = cards.filter((c) => c.needsDetails);
  const owned = useMemo(() => new Set(cards.map((c) => c.productId)), [cards]);

  const totals = useMemo(
    () => ({
      limit: cards.reduce((s, c) => s + c.creditLimit, 0),
      fees: cards.reduce((s, c) => s + c.annualFee, 0),
      perks: cards.reduce((s, c) => s + c.perksValue, 0),
    }),
    [cards],
  );

  // Drop ?add / ?welcome from the URL once they've been handled.
  const cleanUrl = () => {
    if (initialAdd || welcome) router.replace(pathname, { scroll: false });
  };
  const openAdd = (mode: "quick" | "details" = "quick") => setAddSession((s) => ({ key: (s?.key ?? 0) + 1, mode, product: null }));
  const closeAdd = () => {
    setAddSession(null);
    if (initialAdd) cleanUrl();
  };

  const addButton = (
    <Button onClick={() => openAdd()}>
      <Plus className="size-4" /> Add card
    </Button>
  );

  return (
    <>
      <PageHeader
        eyebrow="My wallet"
        title="Your cards"
        description="Every card you carry, with its billing cycle, fees and perks. Swipewise uses these to pick the best card for each purchase."
        actions={addButton}
      />

      {showWelcome && (
        <Panel className="relative mb-8 overflow-hidden border-accent/25 p-5 sm:p-6 animate-fade-up">
          <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-accent/10 blur-3xl" />
          <button
            onClick={() => {
              setShowWelcome(false);
              cleanUrl();
            }}
            className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-ink"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-accent">
                <Sparkles className="size-3.5" /> Welcome to Swipewise
              </p>
              <h2 className="font-display text-3xl leading-tight">Let&apos;s set up your wallet</h2>
              <ol className="mt-3 flex flex-col gap-2 text-sm text-muted">
                <Step n={1} done={cards.length > 0}>Add the credit cards you carry. Only the last 4 digits, never the full number.</Step>
                <Step n={2}>Log a few expenses, or import a CSV, so we can learn how you spend.</Step>
                <Step n={3}>Get the best card for every purchase, and see which cards earn their fee.</Step>
              </ol>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {cards.length > 0 ? (
                <LinkButton href="/app/expenses">Log expenses</LinkButton>
              ) : (
                addButton
              )}
            </div>
          </div>
        </Panel>
      )}

      {incomplete.length > 0 && showDetailsBanner && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-warn/25 bg-warn/[0.06] p-4 animate-fade-up sm:items-center">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-warn sm:mt-0" />
          <p className="min-w-0 flex-1 text-sm text-muted">
            <span className="font-medium text-ink">
              {incomplete.length} card{incomplete.length === 1 ? " needs" : "s need"} limit &amp; billing days
            </span>{" "}
            <span className="text-faint">— only needed for utilisation and fee-waiver tracking; rewards already work.</span>
          </p>
          <Button variant="outline" size="sm" onClick={() => setEditing(incomplete[0])} className="hidden shrink-0 sm:inline-flex">
            Complete next
          </Button>
          <button
            onClick={() => setShowDetailsBanner(false)}
            className="-m-1 grid size-7 shrink-0 place-items-center rounded-lg text-faint hover:bg-white/5 hover:text-ink"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {cards.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="size-6" />}
          title="Your wallet is empty"
          description="Tap the cards you own to get personalised recommendations. Adding all of them takes under a minute."
          action={
            <div className="flex flex-col items-center gap-3">
              {addButton}
              <button type="button" onClick={openStatements} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
                <FileText className="size-4 text-accent" /> Have statement PDFs? Add cards automatically
              </button>
            </div>
          }
        />
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Cards" value={cards.length} icon={<CreditCard className="size-4" />} hint={`${new Set(cards.map((c) => c.bank)).size} issuers`} />
            <StatCard label="Total credit limit" value={inr(totals.limit, { compact: true })} hint={inr(totals.limit)} />
            <StatCard label="Annual fees" value={inr(totals.fees)} hint="Before any fee waivers" tone={totals.fees ? "neutral" : "good"} />
            <StatCard label="Perks you use" value={inr(totals.perks)} hint="Per year, across cards" tone="gold" icon={<Gift className="size-4" />} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((c, i) => (
              <WalletCard
                key={c.id}
                card={c}
                index={i}
                onEdit={() => setEditing(c)}
                onRemove={() => setRemoving(c)}
                onSetup={c.isCustom && customById.has(c.productId) ? () => setEditingSetup(customById.get(c.productId)!) : undefined}
              />
            ))}
            <button
              onClick={() => openAdd()}
              className="group flex min-h-64 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-line-strong text-muted transition-colors hover:border-accent/50 hover:bg-accent/[0.03] hover:text-ink"
            >
              <span className="grid size-12 place-items-center rounded-2xl border border-line bg-surface-2 transition-colors group-hover:border-accent/40 group-hover:text-accent">
                <Plus className="size-5" />
              </span>
              <span className="text-sm font-medium">Add another card</span>
            </button>
          </div>
        </>
      )}

      {addSession?.mode === "quick" && (
        <QuickAddSheet key={addSession.key} catalog={catalog} owned={owned} onClose={closeAdd} onDetails={() => openAdd("details")} onStatements={openStatements} />
      )}

      {addSession?.mode === "details" && (
        <AddCardModal
          key={addSession.key}
          catalog={catalog}
          owned={owned}
          initialProduct={addSession.product ? productById.get(addSession.product) ?? null : null}
          onClose={closeAdd}
        />
      )}

      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editing.needsDetails ? "Complete details" : "Edit card"}
          description={
            editing.needsDetails
              ? `${editing.bank} ${editing.name}. Limit and billing days power utilisation and fee-waiver tracking.`
              : `${editing.bank} ${editing.name}`
          }
        >
          <CardDetailsForm
            product={productById.get(editing.productId) ?? fallbackProduct(editing)}
            cardId={editing.id}
            initial={{
              nickname: editing.nickname ?? "",
              last4: editing.last4 ?? "",
              creditLimit: editing.creditLimit ? String(editing.creditLimit) : "",
              statementDay: String(editing.statementDay),
              dueDay: String(editing.dueDay),
              anniversaryMonth: String(editing.anniversaryMonth),
              perksValue: String(editing.perksValue),
            }}
            onDone={() => setEditing(null)}
          />
        </Modal>
      )}

      {editingSetup && (
        <Modal open onClose={() => setEditingSetup(null)} title="Reward setup" description={`${editingSetup.bank} ${editingSetup.name} · your custom card`} className="sm:max-w-3xl">
          <CustomCardForm banks={banks} existing={editingSetup} onDone={() => setEditingSetup(null)} />
        </Modal>
      )}

      {removing && <RemoveDialog card={removing} onClose={() => setRemoving(null)} />}

      {pdfImport > 0 && <StatementImportModal key={pdfImport} catalog={catalog} cards={cards} onClose={() => setPdfImport(0)} />}
    </>
  );
}

function Step({ n, done, children }: { n: number; done?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          "num mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold",
          done ? "border-accent bg-accent text-accent-ink" : "border-line-strong text-ink",
        )}
      >
        {done ? <Check className="size-3" /> : n}
      </span>
      <span className={cn(done && "text-faint line-through decoration-faint/50")}>{children}</span>
    </li>
  );
}

function WalletCard({
  card: c,
  index,
  onEdit,
  onRemove,
  onSetup,
}: {
  card: CardView;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
  /** Custom cards only: edit the reward setup. */
  onSetup?: () => void;
}) {
  const premium = /premium/i.test(c.tier);
  return (
    <Panel className="group relative flex flex-col overflow-hidden animate-fade-up" style={{ animationDelay: `${index * 60}ms` }}>
      {/* Card on a soft glow in its own colours */}
      <div className="relative flex justify-center px-5 pb-4 pt-6">
        <div
          className="pointer-events-none absolute inset-x-6 top-8 h-32 rounded-full opacity-40 blur-3xl transition-opacity duration-500 group-hover:opacity-60"
          style={{ background: `linear-gradient(90deg, ${c.colorFrom}, ${c.colorTo})` }}
        />
        <CardFace
          bank={c.bank}
          name={c.name}
          network={c.network}
          colorFrom={c.colorFrom}
          colorTo={c.colorTo}
          last4={c.last4}
          nickname={c.nickname}
          size="md"
          className="w-full max-w-72 transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-[-1deg]"
        />
      </div>

      <div className="flex flex-1 flex-col gap-4 border-t border-line px-5 pb-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold tracking-tight">{cardTitle(c)}</h3>
            <p className="truncate text-xs text-muted">
              {c.nickname ? `${c.bank} ${c.name}` : c.network}
              {c.last4 && <span className="num"> · •••• {c.last4}</span>}
            </p>
          </div>
          {c.isCustom ? <Badge tone="info">Custom</Badge> : <Badge tone={premium ? "gold" : "neutral"}>{c.tier}</Badge>}
        </div>

        {c.needsDetails && (
          <button
            onClick={onEdit}
            className="-mt-1 inline-flex h-7 items-center gap-1.5 self-start rounded-full border border-warn/25 bg-warn/[0.07] px-2.5 text-[11px] font-medium text-warn transition-colors hover:border-warn/50 hover:bg-warn/15"
          >
            <CircleAlert className="size-3" /> Complete details
          </button>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
          <Stat
            label="Credit limit"
            value={
              c.creditLimit ? (
                inr(c.creditLimit)
              ) : (
                <button onClick={onEdit} className="inline-flex items-center gap-1 text-faint hover:text-accent">
                  <Plus className="size-3" /> Add limit
                </button>
              )
            }
            muted={!c.creditLimit}
          />
          <Stat
            label="Billing"
            value={
              c.needsDetails ? (
                <button onClick={onEdit} className="inline-flex items-center gap-1 text-faint hover:text-accent">
                  <Plus className="size-3" /> Add billing days
                </button>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="size-3 text-faint" />
                  {ordinal(c.statementDay)} · due {ordinal(c.dueDay)}
                </span>
              )
            }
            muted={c.needsDetails}
          />
          <Stat
            label="Annual fee"
            value={c.annualFee ? inr(c.annualFee) : "Lifetime free"}
            sub={c.annualFee && c.feeWaiverSpend ? `Waived on ${inr(c.feeWaiverSpend, { compact: true })} spend` : c.annualFee && !c.needsDetails ? `Renews in ${MONTHS[c.anniversaryMonth - 1]}` : undefined}
            good={!c.annualFee}
          />
          <Stat label="Perks value" value={c.perksValue ? `${inr(c.perksValue)}/yr` : "None"} muted={!c.perksValue} gold={c.perksValue > 0} />
        </dl>

        <div className="mt-auto flex gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={onEdit} className="flex-1">
            <Pencil className="size-3.5" /> Edit
          </Button>
          {onSetup && (
            <Button variant="secondary" size="sm" onClick={onSetup} aria-label={`Edit rewards for ${cardTitle(c)}`}>
              <SlidersHorizontal className="size-3.5" /> Rewards
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onRemove} className={cn("hover:text-bad", onSetup && "px-2.5")} aria-label={`Remove ${cardTitle(c)}`}>
            <Trash2 className="size-3.5" /> {!onSetup && "Remove"}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function Stat({ label, value, sub, muted, good, gold }: { label: string; value: React.ReactNode; sub?: string; muted?: boolean; good?: boolean; gold?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-faint">{label}</dt>
      <dd className={cn("num mt-0.5 truncate font-medium", muted ? "text-faint" : good ? "text-good" : gold ? "text-gold" : "text-ink")}>{value}</dd>
      {sub && <dd className="mt-0.5 truncate text-[11px] text-faint">{sub}</dd>}
    </div>
  );
}

function RemoveDialog({ card, onClose }: { card: CardView; onClose: () => void }) {
  const [pending, start] = useTransition();
  const remove = () =>
    start(async () => {
      const res = await removeCard(card.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`${cardTitle(card)} removed`);
      onClose();
    });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Remove ${cardTitle(card)}?`}
      description={`Expenses logged on this card are kept, but they won't be linked to any card.${card.isCustom ? " Its custom reward setup is deleted too." : ""}`}
    >
      <div className="mb-6 flex justify-center">
        <CardFace {...card} size="sm" className="opacity-80 grayscale-[30%]" />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={remove} disabled={pending}>
          <Trash2 className="size-4" /> {pending ? "Removing…" : "Remove card"}
        </Button>
      </div>
    </Modal>
  );
}

function fallbackProduct(c: CardView): CatalogItem {
  return { ...c, id: c.productId, benefits: [] };
}

/* ---------- Add card: pick from catalog, then details ---------- */

function AddCardModal({
  catalog,
  owned,
  initialProduct,
  onClose,
}: {
  catalog: CatalogItem[];
  owned: Set<string>;
  initialProduct: CatalogItem | null;
  onClose: () => void;
}) {
  const [product, setProduct] = useState<CatalogItem | null>(initialProduct);
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return catalog.filter((p) => {
      const hay = `${p.bank} ${p.name} ${p.network} ${p.tier}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [catalog, q]);

  if (product) {
    return (
      <Modal open onClose={onClose} title="Card details" description="Used to track billing cycles, fee waivers and caps.">
        <div className="mb-5 flex items-center gap-4 rounded-2xl border border-line bg-surface-2/60 p-3">
          <CardFace {...product} size="sm" className="w-32 rounded-lg p-2" />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-faint">{product.bank}</p>
            <p className="truncate font-semibold">{product.name}</p>
            <p className="mt-0.5 text-xs text-muted">
              {product.annualFee ? `${inr(product.annualFee)} / yr` : "Lifetime free"}
              {product.feeWaiverSpend ? ` · waived on ${inr(product.feeWaiverSpend, { compact: true })}` : ""}
            </p>
          </div>
        </div>
        <CardDetailsForm product={product} initial={emptyCardForm()} onDone={onClose} onBack={() => setProduct(null)} />
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Add a card with details" description="Pick your card from the catalog, then fill in its details." className="sm:max-w-3xl">
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by bank or card name" className="pl-9" autoFocus />
      </div>
      {results.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No cards match “{q}”.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {results.map((p) => {
            const inWallet = owned.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => setProduct(p)}
                className="group relative flex flex-col gap-2.5 rounded-2xl border border-line bg-surface-2/40 p-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <CardFace {...p} size="sm" className="w-full" />
                <div className="min-w-0 px-0.5">
                  <p className="truncate text-[10px] uppercase tracking-[0.12em] text-faint">{p.bank}</p>
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="num mt-0.5 text-[11px] text-muted">{p.annualFee ? `${inr(p.annualFee)}/yr` : "Lifetime free"}</p>
                </div>
                {inWallet && (
                  <Badge tone="accent" className="absolute right-3.5 top-3.5 bg-black/60 backdrop-blur">
                    <Check className="size-3" /> In wallet
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
