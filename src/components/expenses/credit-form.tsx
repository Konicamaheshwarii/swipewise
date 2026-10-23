"use client";

import { Coins, Plane, Star, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { CardFace } from "@/components/card-face";
import { Modal } from "@/components/modal";
import { Button, Field, Input, Select } from "@/components/ui";
import { addCredit, deleteCredit, updateCredit } from "@/lib/actions/credits";
import { REWARD_KIND_LABEL, cardTitle, cn, inr, rewardKind, type RewardKind } from "@/lib/format";
import type { CardView } from "@/lib/wallet";
import { todayKey } from "./expense-form";

export interface CreditFormValues {
  id?: string;
  cardId: string;
  day: string;
  kind: RewardKind;
  /** ₹ for cashback, a points/miles count otherwise. */
  value: string;
  note: string;
}

export const KINDS: { key: RewardKind; icon: typeof Coins }[] = [
  { key: "cashback", icon: Coins },
  { key: "points", icon: Star },
  { key: "miles", icon: Plane },
];

export const kindOfCard = (c: CardView | undefined): RewardKind => (c ? rewardKind(c.rewardUnit, c.pointValue) : "cashback");

export function emptyCredit(card?: CardView, day = todayKey()): CreditFormValues {
  return { cardId: card?.id ?? "", day, kind: kindOfCard(card), value: "", note: "" };
}

export function CreditFormModal({ initial, cards, onClose }: { initial: CreditFormValues; cards: CardView[]; onClose: () => void }) {
  const editing = !!initial.id;
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const card = cardById.get(v.cardId);
  const set = <K extends keyof CreditFormValues>(k: K, val: CreditFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const units = v.kind !== "cashback";
  const unitName = v.kind === "miles" ? "miles" : card && kindOfCard(card) === "points" ? card.rewardUnit : "points";
  const n = Number(v.value);
  const worth = units && card && n > 0 ? n * card.pointValue : null;

  // Picking a card sets the reward type it pays; the user can still change it.
  const onCard = (id: string) => setV((s) => ({ ...s, cardId: id, kind: kindOfCard(cardById.get(id)) }));

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const input = {
      userCardId: v.cardId,
      date: v.day,
      kind: v.kind,
      amount: units ? null : v.value,
      points: units ? v.value : null,
      note: v.note,
    };
    start(async () => {
      const res = v.id ? await updateCredit({ ...input, id: v.id }) : await addCredit(input);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      toast.success(v.id ? "Reward updated" : units ? `${Math.round(n).toLocaleString("en-IN")} ${v.kind} logged` : `${inr(n, { decimals: n % 1 ? 2 : 0 })} cashback logged`);
      onClose();
    });
  }

  function remove() {
    if (!v.id) return;
    const id = v.id;
    start(async () => {
      const res = await deleteCredit(id);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      toast.success("Reward deleted");
      onClose();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "Edit reward received" : "Add reward received"}
      description={editing ? undefined : "Log cashback credited or points posted on your statement. We'll compare it with what your spend should have earned."}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Card">
          <div className="relative">
            {card && <CardFace {...card} size="xs" className="pointer-events-none absolute left-2 top-1/2 w-9 -translate-y-1/2 rounded-[4px] p-0 shadow-none" />}
            <Select value={v.cardId} onChange={(e) => onCard(e.target.value)} required className={cn(card && "pl-14")}>
              <option value="" disabled>Pick a card</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {cardTitle(c)}{c.last4 ? ` ·· ${c.last4}` : ""}
                </option>
              ))}
            </Select>
          </div>
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Type</span>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface-2 p-1" role="radiogroup" aria-label="Reward type">
            {KINDS.map(({ key, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={v.kind === key}
                onClick={() => set("kind", key)}
                className={cn(
                  "flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors",
                  v.kind === key ? "bg-surface-3 text-ink shadow-sm ring-1 ring-line-strong" : "text-muted hover:text-ink",
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                {REWARD_KIND_LABEL[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[1.4fr_1fr] gap-3">
          <Field
            label={units ? `${v.kind === "miles" ? "Miles" : "Points"} credited` : "Amount credited (₹)"}
            hint={units ? (worth != null ? <>≈ <span className="num">{inr(worth)}</span> at {inr(card!.pointValue, { decimals: 2 })} each</> : card ? `Number of ${unitName}` : "Pick a card to value them") : undefined}
          >
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              required
              value={v.value}
              onChange={(e) => set("value", e.target.value)}
              placeholder="0"
              className="num h-12 text-xl font-semibold"
              autoFocus={!editing}
            />
          </Field>
          <Field label="Date credited">
            <Input type="date" required value={v.day} max="2100-12-31" onChange={(e) => set("day", e.target.value)} className="h-12" />
          </Field>
        </div>

        <Field label="Note" hint="Optional">
          <Input value={v.note} onChange={(e) => set("note", e.target.value)} maxLength={280} placeholder="e.g. Cashback for Sep statement" />
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
          <Button type="submit" disabled={pending || !v.cardId}>{pending ? "Saving…" : editing ? "Save changes" : "Add reward"}</Button>
        </div>
      </form>
    </Modal>
  );
}
