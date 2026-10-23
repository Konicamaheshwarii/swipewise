"use client";

import { Globe, MapPin, MousePointerClick, Sparkles, Trash2 } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { CardFace } from "@/components/card-face";
import { CategoryIcon } from "@/components/category-icon";
import { Modal } from "@/components/modal";
import { Button, Field, Input, Select } from "@/components/ui";
import { CATEGORIES, CATEGORY_MAP, MERCHANTS } from "@/data/categories";
import { rankCards, type Channel, type EngineCard } from "@/engine";
import { addExpense, deleteExpense, updateExpense } from "@/lib/actions/expenses";
import { categorize, type CategorizeResult } from "@/lib/categorize";
import { cardTitle, cn, inr } from "@/lib/format";
import type { CardView } from "@/lib/wallet";

export interface ExpenseFormValues {
  id?: string;
  amount: string;
  day: string;
  merchant: string;
  category: string;
  subcategory: string;
  channel: Channel;
  cardId: string;
  note: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const emptyExpense = (): ExpenseFormValues => ({
  amount: "",
  day: todayKey(),
  merchant: "",
  category: "shopping",
  subcategory: "",
  channel: "online",
  cardId: "",
  note: "",
});

export const CHANNELS: { key: Channel; label: string; icon: typeof Globe }[] = [
  { key: "online", label: "Online", icon: MousePointerClick },
  { key: "offline", label: "In store", icon: MapPin },
  { key: "international", label: "International", icon: Globe },
];

export function ExpenseFormModal({
  initial,
  cards,
  engineCards,
  merchants,
  onClose,
}: {
  initial: ExpenseFormValues;
  cards: CardView[];
  engineCards: EngineCard[];
  /** The user's own past merchants, suggested alongside the popular ones. */
  merchants: string[];
  onClose: () => void;
}) {
  const editing = !!initial.id;
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Category picked by hand (or an existing expense): the categoriser must not overwrite it.
  const [catTouched, setCatTouched] = useState(editing);
  const [auto, setAuto] = useState<CategorizeResult | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(autoTimer.current), []);

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const suggestions = useMemo(() => {
    const seen = new Set(MERCHANTS.map((m) => m.name.toLowerCase()));
    return [...MERCHANTS.map((m) => m.name), ...merchants.filter((m) => !seen.has(m.toLowerCase()))];
  }, [merchants]);

  const setField = <K extends keyof ExpenseFormValues>(k: K, val: ExpenseFormValues[K]) => setV((s) => ({ ...s, [k]: val }));

  function onMerchant(name: string) {
    const hit = MERCHANTS.find((m) => m.name.toLowerCase() === name.trim().toLowerCase());
    setV((s) => (hit ? { ...s, merchant: name, category: hit.category, channel: s.channel === "international" ? s.channel : hit.channel } : { ...s, merchant: name }));
    clearTimeout(autoTimer.current);
    setAuto(null);
    if (hit || name.trim().length < 3) return;
    // Unknown merchant: once the user pauses, guess the category from the text.
    autoTimer.current = setTimeout(() => {
      const r = categorize({ description: name });
      if (r.confidence === "low" || r.charge) return;
      setAuto(r);
      if (catTouched) return;
      setV((s) => ({ ...s, category: r.category, channel: s.channel === "international" ? s.channel : r.channel }));
    }, 450);
  }

  // Live "best card" hint. Ignores caps already used this month.
  const deferred = useDeferredValue(v);
  const hint = useMemo(() => {
    const amount = Number(deferred.amount);
    if (!engineCards.length || !(amount > 0)) return null;
    const ranked = rankCards(engineCards, {
      amount,
      date: deferred.day || todayKey(),
      category: deferred.category,
      merchant: deferred.merchant || null,
      channel: deferred.channel,
    });
    const best = ranked[0];
    const chosen = deferred.cardId ? ranked.find((r) => r.cardId === deferred.cardId) : undefined;
    return { best, card: cardById.get(best.cardId), chosen };
  }, [deferred, engineCards, cardById]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const input = {
      amount: v.amount,
      date: v.day,
      category: v.category,
      subcategory: v.subcategory,
      merchant: v.merchant,
      channel: v.channel,
      note: v.note,
      userCardId: v.cardId || null,
    };
    start(async () => {
      const res = v.id ? await updateExpense({ ...input, id: v.id }) : await addExpense(input);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      toast.success(v.id ? "Expense updated" : `${inr(Number(v.amount))} logged`);
      onClose();
    });
  }

  function remove() {
    if (!v.id) return;
    const id = v.id;
    start(async () => {
      const res = await deleteExpense(id);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      toast.success("Expense deleted");
      onClose();
    });
  }

  const sameAsBest = hint && (hint.best.cardId === v.cardId || (hint.chosen && hint.chosen.net >= hint.best.net - 0.5));

  return (
    <Modal open onClose={onClose} title={editing ? "Edit expense" : "Add expense"} description={editing ? undefined : "Log a purchase to track rewards and spot better cards."}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-[1.4fr_1fr] gap-3">
          <Field label="Amount (₹)">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              required
              value={v.amount}
              onChange={(e) => setField("amount", e.target.value)}
              placeholder="0"
              className="num h-12 text-xl font-semibold"
              autoFocus={!editing}
            />
          </Field>
          <Field label="Date">
            <Input type="date" required value={v.day} max="2100-12-31" onChange={(e) => setField("day", e.target.value)} className="h-12" />
          </Field>
        </div>

        <Field
          label="Merchant"
          hint={
            auto ? (
              <span className="flex flex-wrap items-center gap-x-1" aria-live="polite">
                <Sparkles className="size-3 text-accent" />
                Auto: <span className="text-ink/80">{CATEGORY_MAP[auto.category]?.label}</span>
                {catTouched && auto.category !== v.category && (
                  <button type="button" onClick={() => setField("category", auto.category)} className="text-accent hover:underline">use it</button>
                )}
                {auto.merchant && auto.merchant.toLowerCase() !== v.merchant.trim().toLowerCase() && (
                  <>
                    · looks like
                    <button type="button" onClick={() => onMerchant(auto.merchant!)} className="font-medium text-accent hover:underline">{auto.merchant}</button>
                  </>
                )}
              </span>
            ) : (
              "Pick a popular merchant to auto-fill category and channel"
            )
          }
        >
          <Input value={v.merchant} onChange={(e) => onMerchant(e.target.value)} list="merchant-suggestions" maxLength={80} placeholder="Swiggy, Amazon, Indian Oil…" autoComplete="off" />
          <datalist id="merchant-suggestions">
            {suggestions.map((m) => <option key={m} value={m} />)}
          </datalist>
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Category">
            <div className="relative">
              <CategoryIcon category={v.category} size="sm" className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2" />
              <Select
                value={v.category}
                onChange={(e) => {
                  setCatTouched(true);
                  setField("category", e.target.value);
                }}
                className="pl-10"
              >
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </Select>
            </div>
          </Field>
          <Field label="Subcategory" hint="Optional">
            <Input value={v.subcategory} onChange={(e) => setField("subcategory", e.target.value)} maxLength={60} placeholder="e.g. Weekend brunch" />
          </Field>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Channel</span>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface-2 p-1" role="radiogroup" aria-label="Channel">
            {CHANNELS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={v.channel === key}
                onClick={() => setField("channel", key)}
                className={cn(
                  "flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors",
                  v.channel === key ? (key === "international" ? "bg-info/15 text-info" : "bg-surface-3 text-ink shadow-sm ring-1 ring-line-strong") : "text-muted hover:text-ink",
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <Field label="Card used">
          <Select value={v.cardId} onChange={(e) => setField("cardId", e.target.value)}>
            <option value="">Not sure / not tracked</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {cardTitle(c)}{c.last4 ? ` ·· ${c.last4}` : ""}
              </option>
            ))}
          </Select>
        </Field>

        {hint && hint.card && (
          <div
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-3 transition-colors",
              sameAsBest || !v.cardId ? "border-accent/25 bg-accent/[0.06]" : "border-warn/25 bg-warn/[0.06]",
            )}
            aria-live="polite"
          >
            <CardFace {...hint.card} size="xs" />
            <div className="min-w-0 flex-1 text-xs">
              <p className="flex items-center gap-1 font-medium text-ink">
                <Sparkles className="size-3 text-accent" />
                {sameAsBest ? "Nice, that's the best card for this" : (
                  <>Best card: <span className="truncate">{cardTitle(hint.card)}</span></>
                )}
                <span className="num ml-auto shrink-0 pl-2 text-accent">+{inr(Math.max(0, hint.best.net))}</span>
              </p>
              <p className="mt-0.5 truncate text-faint">
                {hint.chosen && !sameAsBest
                  ? `Your pick earns ${inr(Math.max(0, hint.chosen.net))}. ${hint.best.reason}`
                  : hint.best.reason}
              </p>
            </div>
          </div>
        )}

        <Field label="Note" hint="Optional">
          <Input value={v.note} onChange={(e) => setField("note", e.target.value)} maxLength={280} placeholder="Anything to remember" />
        </Field>

        {error && <p className="rounded-xl border border-bad/25 bg-bad/10 px-3 py-2 text-xs text-bad" role="alert">{error}</p>}

        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {editing ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <Button type="button" variant="danger" onClick={remove} disabled={pending}>
                  <Trash2 className="size-4" /> Confirm delete
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>Keep</Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)} className="hover:text-bad">
                <Trash2 className="size-4" /> Delete
              </Button>
            )
          ) : (
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          )}
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Add expense"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export const channelLabel = (c: string) => CHANNELS.find((x) => x.key === c)?.label ?? c;
export const categoryOf = (k: string) => CATEGORY_MAP[k] ?? CATEGORY_MAP.other;
