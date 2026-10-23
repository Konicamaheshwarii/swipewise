"use client";

import { ArrowLeft, ArrowRight, Check, FileText, PenLine, Plus, Search, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CardFace } from "@/components/card-face";
import { Modal } from "@/components/modal";
import { Button, Input } from "@/components/ui";
import { addCards } from "@/lib/actions/cards";
import { cn, inr } from "@/lib/format";
import type { CatalogItem } from "./card-form";
import { CustomCardForm } from "./custom-card-form";

type Step = "banks" | "cards" | "custom";

/** Footer that sticks to the bottom of the Modal's scroll area (offsets its p-6). */
function StickyFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky -bottom-6 z-10 -mx-6 -mb-6 mt-6 border-t border-line bg-surface/90 px-6 py-4 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">{children}</div>
    </div>
  );
}

/** Quick add: pick banks, tap every card you own, add them all in one go. */
export function QuickAddSheet({
  catalog,
  owned,
  onClose,
  onDetails,
  onStatements,
}: {
  catalog: CatalogItem[];
  owned: Set<string>;
  onClose: () => void;
  /** Switch to the one-card-with-details flow. */
  onDetails: () => void;
  /** Switch to statement PDF import (adds cards from the statements). */
  onStatements?: () => void;
}) {
  const [step, setStep] = useState<Step>("banks");
  const [banks, setBanks] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();

  const bankCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of catalog) m.set(p.bank, (m.get(p.bank) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [catalog]);
  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);

  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    // A search looks across every bank, so a card under an unpicked bank is still findable.
    const pool = banks.length && !terms.length ? catalog.filter((p) => banks.includes(p.bank)) : catalog;
    return pool.filter((p) => {
      const hay = `${p.bank} ${p.name} ${p.network} ${p.tier}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [catalog, banks, q]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const picked = selected.map((id) => byId.get(id)).filter((p): p is CatalogItem => !!p);

  function submit() {
    start(async () => {
      const res = await addCards(selected);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Added ${res.added} card${res.added === 1 ? "" : "s"}`, {
        description: "Add limits and billing days whenever you like. Rewards already work.",
      });
      onClose();
    });
  }

  if (step === "custom") {
    return (
      <Modal open onClose={onClose} title="Add a card that isn't listed" description="Tell us how it earns. You can fine-tune this later." className="sm:max-w-3xl">
        <CustomCardForm
          banks={bankCounts.map(([b]) => b)}
          onBack={() => setStep("cards")}
          onDone={() => {
            if (selected.length) {
              setStep("cards");
              toast(`${selected.length} selected card${selected.length === 1 ? " is" : "s are"} still waiting to be added`);
            } else onClose();
          }}
        />
      </Modal>
    );
  }

  if (step === "banks") {
    return (
      <Modal open onClose={onClose} title="Which banks do you have cards from?" description="Pick all that apply. Next, you'll tap your cards." className="sm:max-w-2xl">
        <StepDots step={0} />
        {onStatements && (
          <button
            type="button"
            onClick={onStatements}
            className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-accent/25 bg-accent/[0.05] p-3 text-left transition-colors hover:border-accent/50 hover:bg-accent/[0.08]"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
              <FileText className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">Have statement PDFs? Add cards automatically</span>
              <span className="block text-xs text-muted">Drop them all in. We find each card and import its spending. Read on your device.</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-accent" />
          </button>
        )}
        <div className="flex flex-wrap gap-2">
          {bankCounts.map(([bank, count]) => {
            const on = banks.includes(bank);
            return (
              <button
                key={bank}
                type="button"
                aria-pressed={on}
                onClick={() => setBanks((b) => toggle(b, bank))}
                className={cn(
                  "group inline-flex h-10 items-center gap-2 rounded-full border pl-3.5 pr-2 text-sm font-medium transition-all active:scale-[0.97]",
                  on
                    ? "border-accent/60 bg-accent/10 text-ink shadow-[0_0_0_1px_rgba(212,255,58,0.25)]"
                    : "border-line bg-surface-2 text-muted hover:border-line-strong hover:text-ink",
                )}
              >
                {on && <Check className="-ml-0.5 size-3.5 text-accent" />}
                {bank}
                <span className={cn("num grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[11px]", on ? "bg-accent text-accent-ink" : "bg-white/5 text-faint")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-5 text-xs text-faint">
          Bank not here?{" "}
          <button type="button" onClick={() => setStep("custom")} className="font-medium text-accent hover:underline">Add your card manually</button>
          {" · "}
          <button type="button" onClick={onDetails} className="font-medium text-muted hover:text-ink hover:underline">Add one card with full details</button>
        </p>
        <StickyFooter>
          <button
            type="button"
            onClick={() => {
              setBanks([]);
              setStep("cards");
            }}
            className="text-sm font-medium text-muted hover:text-ink"
          >
            Skip, show all
          </button>
          <Button onClick={() => setStep("cards")} disabled={!banks.length}>
            {banks.length ? `Show ${banks.reduce((s, b) => s + (bankCounts.find(([x]) => x === b)?.[1] ?? 0), 0)} cards` : "Pick a bank"}
            <ArrowRight className="size-4" />
          </Button>
        </StickyFooter>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Tap your cards" description="Select every card you carry. Details can wait." className="sm:max-w-3xl">
      <StepDots step={1} />
      {/* Search stays pinned while the grid scrolls (-top-6 offsets the Modal's padding). */}
      <div className="sticky -top-6 z-10 -mx-6 mb-4 flex flex-col gap-3 bg-surface/90 px-6 pb-3 pt-3 backdrop-blur-md">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by bank or card name" className="pl-9" aria-label="Search cards" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setStep("banks")} className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium text-muted hover:bg-white/5 hover:text-ink">
            <ArrowLeft className="size-3.5" /> Banks
          </button>
          {banks.length === 0 ? (
            <span className="text-xs text-faint">All banks</span>
          ) : (
            banks.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBanks((bs) => bs.filter((x) => x !== b))}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-surface-2 pl-2.5 pr-1.5 text-xs text-ink hover:border-line-strong"
                aria-label={`Remove ${b} filter`}
              >
                {b} <X className="size-3 text-faint" />
              </button>
            ))
          )}
          {q && banks.length > 0 && <span className="text-[11px] text-faint">Searching all banks</span>}
        </div>
      </div>

      {results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-muted">No cards match “{q}”.</p>
          <Button variant="secondary" size="sm" onClick={() => setStep("custom")}>
            <PenLine className="size-3.5" /> My card isn&apos;t listed
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
          {results.map((p) => {
            const inWallet = owned.has(p.id);
            const on = selected.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                disabled={inWallet}
                aria-pressed={on}
                onClick={() => setSelected((s) => toggle(s, p.id))}
                className={cn(
                  "group relative flex min-w-0 flex-col gap-2 rounded-2xl border p-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 sm:p-2.5",
                  on
                    ? "border-accent/70 bg-accent/[0.06] shadow-[0_0_0_1px_rgba(212,255,58,0.5),0_10px_30px_-12px_rgba(212,255,58,0.35)]"
                    : "border-line bg-surface-2/40 hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-2",
                  inWallet && "cursor-not-allowed opacity-45 hover:translate-y-0",
                )}
              >
                <CardFace {...p} size="sm" className={cn("w-full transition-transform duration-200", on && "scale-[0.97]")} />
                <div className="min-w-0 px-0.5">
                  <p className="truncate text-[10px] uppercase tracking-[0.12em] text-faint">{p.bank}</p>
                  <p className="truncate text-[13px] font-medium sm:text-sm">{p.name}</p>
                  <p className="num mt-0.5 text-[11px] text-muted">{p.annualFee ? `${inr(p.annualFee)}/yr` : "Lifetime free"}</p>
                </div>
                {inWallet ? (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-ink backdrop-blur">
                    <Check className="size-3" /> In wallet
                  </span>
                ) : (
                  <span
                    className={cn(
                      "absolute right-3 top-3 grid size-6 place-items-center rounded-full border transition-all duration-200",
                      on ? "scale-100 border-accent bg-accent text-accent-ink" : "scale-90 border-white/40 bg-black/40 text-transparent backdrop-blur",
                    )}
                    aria-hidden
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setStep("custom")}
            className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong p-3 text-center text-muted transition-colors hover:border-accent/50 hover:bg-accent/[0.03] hover:text-ink"
          >
            <span className="grid size-10 place-items-center rounded-xl border border-line bg-surface-2">
              <Plus className="size-4" />
            </span>
            <span className="text-sm font-medium">My card isn&apos;t listed</span>
            <span className="text-[11px] text-faint">Set up its rewards yourself</span>
          </button>
        </div>
      )}

      <StickyFooter>
        {picked.length ? (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex shrink-0 -space-x-5">
              {picked.slice(-4).map((p, i) => (
                <CardFace
                  key={p.id}
                  {...p}
                  size="xs"
                  className="w-10 rounded-[5px] shadow-[0_4px_12px_rgba(0,0,0,0.6)] animate-fade-up"
                  style={{ transform: `rotate(${(i - 1.5) * 4}deg)` }}
                />
              ))}
            </div>
            <p className="min-w-0 text-sm">
              <span className="num font-semibold text-ink">{picked.length}</span> <span className="text-muted">selected</span>
            </p>
          </div>
        ) : (
          <button type="button" onClick={onDetails} className="min-w-0 truncate text-xs font-medium text-muted hover:text-ink hover:underline">
            Add one card with details
          </button>
        )}
        <Button onClick={submit} disabled={!picked.length || pending} className="shrink-0">
          {pending ? "Adding…" : picked.length ? `Add ${picked.length} card${picked.length === 1 ? "" : "s"}` : "Tap to select"}
        </Button>
      </StickyFooter>
    </Modal>
  );
}

function StepDots({ step }: { step: 0 | 1 }) {
  return (
    <div className="-mt-2 mb-5 flex items-center gap-1.5" aria-hidden>
      {[0, 1].map((i) => (
        <span key={i} className={cn("h-1 rounded-full transition-all duration-300", i === step ? "w-6 bg-accent" : i < step ? "w-3 bg-accent/40" : "w-3 bg-white/10")} />
      ))}
    </div>
  );
}
