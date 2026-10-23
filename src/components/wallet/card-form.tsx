"use client";

import { Gift } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { addCard, updateCard, type CardInput } from "@/lib/actions/cards";
import { Button, Field, Input, Select } from "@/components/ui";
import { MONTHS, inr } from "@/lib/format";

export interface CatalogItem {
  id: string;
  bank: string;
  name: string;
  network: string;
  tier: string;
  annualFee: number;
  feeWaiverSpend: number | null;
  rewardUnit: string;
  colorFrom: string;
  colorTo: string;
  benefits: { label: string; value: number }[];
}

export interface CardFormValues {
  nickname: string;
  last4: string;
  creditLimit: string;
  statementDay: string;
  dueDay: string;
  anniversaryMonth: string;
  perksValue: string;
}

export const emptyCardForm = (): CardFormValues => ({
  nickname: "",
  last4: "",
  creditLimit: "",
  statementDay: "1",
  dueDay: "20",
  anniversaryMonth: String(new Date().getMonth() + 1),
  perksValue: "0",
});

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** Step 2 of "Add card", and the whole "Edit card" form. */
export function CardDetailsForm({
  product,
  initial,
  cardId,
  onDone,
  onBack,
}: {
  product: CatalogItem;
  initial: CardFormValues;
  /** Present when editing an existing wallet card. */
  cardId?: string;
  onDone: () => void;
  onBack?: () => void;
}) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof CardFormValues) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));

  const perksTotal = product.benefits.reduce((s, b) => s + (b.value || 0), 0);

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (v.last4 && !/^\d{4}$/.test(v.last4)) {
      setError("Enter only the last 4 digits of the card");
      return;
    }
    const input: CardInput = {
      nickname: v.nickname,
      last4: v.last4,
      creditLimit: v.creditLimit || 0,
      statementDay: v.statementDay,
      dueDay: v.dueDay,
      anniversaryMonth: v.anniversaryMonth,
      perksValue: v.perksValue || 0,
    };
    start(async () => {
      const res = cardId ? await updateCard({ ...input, id: cardId }) : await addCard({ ...input, cardProductId: product.id });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      toast.success(cardId ? "Card updated" : `${product.bank} ${product.name} added to your wallet`);
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nickname" hint="Optional, e.g. “Travel card”">
          <Input value={v.nickname} onChange={set("nickname")} maxLength={40} placeholder={product.name} autoFocus />
        </Field>
        <Field label="Last 4 digits" hint="Optional. Never enter your full card number.">
          <Input
            value={v.last4}
            onChange={(e) => setV((s) => ({ ...s, last4: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="1234"
            className="num font-mono tracking-[0.3em]"
          />
        </Field>
        <Field label="Credit limit (₹)">
          <Input type="number" min={0} step={1000} value={v.creditLimit} onChange={set("creditLimit")} placeholder="2,00,000" className="num" />
        </Field>
        <Field label="Card anniversary" hint="Month your annual fee renews">
          <Select value={v.anniversaryMonth} onChange={set("anniversaryMonth")}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </Select>
        </Field>
        <Field label="Statement day">
          <Select value={v.statementDay} onChange={set("statementDay")}>
            {DAYS.map((d) => <option key={d} value={d}>{ordinal(d)} of the month</option>)}
          </Select>
        </Field>
        <Field label="Payment due day">
          <Select value={v.dueDay} onChange={set("dueDay")}>
            {DAYS.map((d) => <option key={d} value={d}>{ordinal(d)} of the month</option>)}
          </Select>
        </Field>
      </div>

      <Field
        label="Perks you actually use (₹ / year)"
        hint="Lounge visits, memberships, vouchers. Used to judge whether the fee is worth it."
      >
        <Input type="number" min={0} step={100} value={v.perksValue} onChange={set("perksValue")} className="num" />
      </Field>

      {product.benefits.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface-2/60 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <Gift className="size-3.5 text-gold" /> Card benefits
            </p>
            {perksTotal > 0 && (
              <button type="button" onClick={() => setV((s) => ({ ...s, perksValue: String(perksTotal) }))} className="text-[11px] font-medium text-accent hover:underline">
                Use {inr(perksTotal)}
              </button>
            )}
          </div>
          <ul className="flex flex-col gap-1.5">
            {product.benefits.map((b) => (
              <li key={b.label} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-ink/90">{b.label}</span>
                {b.value > 0 && <span className="num shrink-0 text-faint">≈ {inr(b.value)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="rounded-xl border border-bad/25 bg-bad/10 px-3 py-2 text-xs text-bad" role="alert">{error}</p>}

      <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack}>Back to catalog</Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : cardId ? "Save changes" : "Add to wallet"}</Button>
      </div>
    </form>
  );
}

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
