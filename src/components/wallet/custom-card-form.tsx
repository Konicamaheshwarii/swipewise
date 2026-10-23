"use client";

import { Plus, X } from "lucide-react";
import { useId, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { CardFace } from "@/components/card-face";
import { CategoryIcon } from "@/components/category-icon";
import { Button, Field, Input, Select } from "@/components/ui";
import { CATEGORIES, categoryLabel } from "@/data/categories";
import { addCustomCard, updateCustomCard } from "@/lib/actions/cards";
import { cn, inr } from "@/lib/format";
import { DEFAULT_EXCLUDED, NETWORKS, gradientFor, type CustomCardSetup, type CustomProduct, type Network } from "./custom-shared";

interface Bonus {
  key: number;
  category: string;
  rate: string;
  cap: string;
}

const num = (s: string) => (s.trim() === "" ? null : Number(s));
const str = (n: number | null | undefined) => (n == null ? "" : String(n));

/** "My card isn't listed": build a card with simple % rules. Also edits an existing custom card. */
export function CustomCardForm({
  banks,
  existing,
  onDone,
  onBack,
}: {
  /** Catalog bank names, offered as suggestions. */
  banks: string[];
  existing?: CustomProduct;
  onDone: (added?: string) => void;
  onBack?: () => void;
}) {
  const listId = useId();
  const [bank, setBank] = useState(existing?.bank ?? "");
  const [name, setName] = useState(existing?.name ?? "");
  const [network, setNetwork] = useState<Network>(existing?.network ?? "Visa");
  const [annualFee, setAnnualFee] = useState(str(existing?.annualFee ?? 0));
  const [waiver, setWaiver] = useState(str(existing?.feeWaiverSpend));
  const [forex, setForex] = useState(str(existing?.forexMarkup ?? 3.5));
  const [baseRate, setBaseRate] = useState(str(existing?.baseRate ?? 1));
  const [bonuses, setBonuses] = useState<Bonus[]>(
    existing?.bonuses.map((b, i) => ({ key: i, category: b.category, rate: str(b.rate), cap: str(b.monthlyCap) })) ?? [],
  );
  const [excluded, setExcluded] = useState<string[]>(existing?.excluded ?? DEFAULT_EXCLUDED);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const colors = gradientFor(bank || "Custom");
  const bonusCats = new Set(bonuses.map((b) => b.category));
  const freeCategory = () => CATEGORIES.find((c) => !bonusCats.has(c.key) && !excluded.includes(c.key))?.key ?? "other";

  const setBonus = (key: number, patch: Partial<Bonus>) => setBonuses((bs) => bs.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  const addBonus = () =>
    setBonuses((bs) => [...bs, { key: Math.max(-1, ...bs.map((b) => b.key)) + 1, category: freeCategory(), rate: "5", cap: "" }]);
  const toggleExcluded = (k: string) => setExcluded((ex) => (ex.includes(k) ? ex.filter((x) => x !== k) : [...ex, k]));

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const setup: CustomCardSetup = {
      bank: bank.trim(),
      name: name.trim(),
      network,
      annualFee: num(annualFee) ?? 0,
      feeWaiverSpend: num(waiver),
      forexMarkup: num(forex) ?? 0,
      baseRate: num(baseRate) ?? 0,
      bonuses: bonuses.map((b) => ({ category: b.category, rate: num(b.rate) ?? 0, monthlyCap: num(b.cap) })),
      excluded,
    };
    start(async () => {
      const res = existing ? await updateCustomCard({ productId: existing.id, card: setup }) : await addCustomCard(setup);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      const title = `${setup.bank} ${setup.name}`;
      toast.success(existing ? `${title} updated` : `${title} added to your wallet`);
      onDone(title);
    });
  }

  const summary = [
    `${num(baseRate) ?? 0}% on everything`,
    ...bonuses.map((b) => `${num(b.rate) ?? 0}% on ${categoryLabel(b.category)}${num(b.cap) ? ` (up to ${inr(num(b.cap)!)}/mo)` : ""}`),
  ];

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-6 md:grid-cols-[15rem_1fr]">
      {/* Live preview */}
      <div className="md:sticky md:top-0 md:self-start">
        <div className="relative flex justify-center rounded-2xl border border-line bg-surface-2/50 px-4 pb-4 pt-6">
          <div
            className="pointer-events-none absolute inset-x-8 top-8 h-24 rounded-full opacity-40 blur-3xl transition-colors"
            style={{ background: `linear-gradient(90deg, ${colors.colorFrom}, ${colors.colorTo})` }}
          />
          <CardFace bank={bank || "Your bank"} name={name || "Card name"} network={network} {...colors} size="sm" className="relative w-full max-w-56" />
        </div>
        <ul className="mt-3 flex flex-col gap-1 px-1 text-xs text-muted">
          {summary.map((s) => (
            <li key={s} className="flex gap-1.5">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" /> {s}
            </li>
          ))}
          <li className="text-faint">
            {num(annualFee) ? `${inr(num(annualFee)!)}/yr` : "No annual fee"}
            {num(waiver) ? ` · waived on ${inr(num(waiver)!, { compact: true })}` : ""}
          </li>
        </ul>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Bank">
            <Input value={bank} onChange={(e) => setBank(e.target.value)} list={listId} maxLength={40} placeholder="e.g. HDFC Bank" autoFocus required />
            <datalist id={listId}>
              {banks.map((b) => <option key={b} value={b} />)}
            </datalist>
          </Field>
          <Field label="Card name">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Shoppers Stop" required />
          </Field>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Network</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Network">
            {NETWORKS.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={network === n}
                onClick={() => setNetwork(n)}
                className={cn(
                  "h-8 rounded-lg border px-3 text-xs font-medium transition-colors",
                  network === n ? "border-accent/60 bg-accent/10 text-accent" : "border-line bg-surface-2 text-muted hover:text-ink",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Annual fee (₹)">
            <Input type="number" min={0} step={1} value={annualFee} onChange={(e) => setAnnualFee(e.target.value)} className="num" />
          </Field>
          <Field label="Fee waived on (₹)">
            <Input type="number" min={0} step={1000} value={waiver} onChange={(e) => setWaiver(e.target.value)} placeholder="Optional" className="num" />
          </Field>
          <Field label="Forex markup (%)" className="col-span-2 sm:col-span-1">
            <Input type="number" min={0} max={10} step={0.01} value={forex} onChange={(e) => setForex(e.target.value)} className="num" />
          </Field>
        </div>

        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2/40 p-4">
          <div>
            <h3 className="text-sm font-semibold">Rewards</h3>
            <p className="mt-0.5 text-[11px] text-faint">As a % of spend. For points, use their ₹ value (e.g. 4 pts per ₹150 at ₹0.25 ≈ 0.67%).</p>
          </div>
          <Field label="Base reward on everything (%)">
            <Input type="number" min={0} max={40} step={0.01} value={baseRate} onChange={(e) => setBaseRate(e.target.value)} className="num sm:max-w-40" />
          </Field>

          {bonuses.map((b) => (
            <div key={b.key} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-line bg-surface/60 p-3 animate-fade-up">
              <div className="grid min-w-0 grid-cols-2 gap-2">
                <Field label="Bonus category" className="col-span-2">
                  <div className="flex items-center gap-2">
                    <CategoryIcon category={b.category} size="sm" />
                    <Select value={b.category} onChange={(e) => setBonus(b.key, { category: e.target.value })} aria-label="Bonus category">
                      {CATEGORIES.map((c) => (
                        <option key={c.key} value={c.key} disabled={c.key !== b.category && (bonusCats.has(c.key) || excluded.includes(c.key))}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </Field>
                <Field label="Reward %">
                  <Input type="number" min={0} max={40} step={0.01} value={b.rate} onChange={(e) => setBonus(b.key, { rate: e.target.value })} className="num" />
                </Field>
                <Field label="Cap ₹/month">
                  <Input type="number" min={0} step={50} value={b.cap} onChange={(e) => setBonus(b.key, { cap: e.target.value })} placeholder="No cap" className="num" />
                </Field>
              </div>
              <button
                type="button"
                onClick={() => setBonuses((bs) => bs.filter((x) => x.key !== b.key))}
                className="grid size-8 place-items-center self-start rounded-lg text-faint hover:bg-white/5 hover:text-bad"
                aria-label={`Remove ${categoryLabel(b.category)} bonus`}
              >
                <X className="size-4" />
              </button>
            </div>
          ))}

          {bonuses.length < 3 && (
            <button
              type="button"
              onClick={addBonus}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong text-xs font-medium text-muted transition-colors hover:border-accent/50 hover:text-accent"
            >
              <Plus className="size-3.5" /> Add a bonus category {bonuses.length > 0 && <span className="text-faint">({3 - bonuses.length} left)</span>}
            </button>
          )}
        </section>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted">No rewards on</span>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.filter((c) => c.key !== "other").map((c) => {
              const on = excluded.includes(c.key);
              const isBonus = bonusCats.has(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={on}
                  disabled={isBonus}
                  onClick={() => toggleExcluded(c.key)}
                  className={cn(
                    "h-7 rounded-full border px-2.5 text-[11px] font-medium transition-colors disabled:opacity-35",
                    on ? "border-bad/35 bg-bad/10 text-bad" : "border-line bg-surface-2 text-muted hover:text-ink",
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="rounded-xl border border-bad/25 bg-bad/10 px-3 py-2 text-xs text-bad" role="alert">{error}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {onBack ? <Button type="button" variant="ghost" onClick={onBack}>Back</Button> : <span />}
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : existing ? "Save reward setup" : "Add to wallet"}</Button>
        </div>
      </div>
    </form>
  );
}
