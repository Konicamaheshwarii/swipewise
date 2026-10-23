"use client";

import { Save } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Button, Field, Input, Select } from "@/components/ui";
import { updateProduct, updateRule, type ActionResult } from "@/lib/actions/catalog";
import { pct } from "@/lib/format";
import type { CatalogProduct, CatalogRuleView } from "./types";

const str = (n: number | null | undefined) => (n == null ? "" : String(n));

/** Submits a form to a server action and toasts the outcome. */
function useSave(action: (fd: FormData) => Promise<ActionResult>, success: string) {
  const [pending, start] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const res = await action(fd);
        if ("error" in res) toast.error(res.error);
        else toast.success(success);
      } catch {
        toast.error("Couldn't save. Please try again.");
      }
    });
  };
  return { pending, onSubmit };
}

export function EditProductModal({ product: p, onClose }: { product: CatalogProduct; onClose: () => void }) {
  const { pending, onSubmit } = useSave(updateProduct, `${p.name} updated`);
  return (
    <Modal open onClose={onClose} title={`Edit ${p.bank} ${p.name}`} description="Changes apply to every user's calculations immediately." className="sm:max-w-2xl">
      <form onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" name="id" value={p.id} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Annual fee (₹)">
            <Input name="annualFee" type="number" min={0} step="any" required defaultValue={p.annualFee} />
          </Field>
          <Field label="Joining fee (₹)">
            <Input name="joiningFee" type="number" min={0} step="any" required defaultValue={p.joiningFee} />
          </Field>
          <Field label="Fee waiver spend (₹)" hint="Blank = no waiver">
            <Input name="feeWaiverSpend" type="number" min={0} step="any" placeholder="None" defaultValue={str(p.feeWaiverSpend)} />
          </Field>
          <Field label="Forex markup (%)">
            <Input name="forexMarkup" type="number" min={0} step="any" required defaultValue={p.forexMarkup} />
          </Field>
          <Field label="Point value (₹)" hint={`per ${p.rewardUnit.toLowerCase()}`}>
            <Input name="pointValue" type="number" min={0} step="any" required defaultValue={p.pointValue} />
          </Field>
          <Field label="Last verified" hint="YYYY-MM">
            <Input name="lastVerified" required pattern="\d{4}-\d{2}(-\d{2})?" defaultValue={p.lastVerified} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            <Save className="size-4" /> {pending ? "Saving…" : "Save card"}
          </Button>
        </div>
      </form>

      <div className="mt-8 border-t border-line pt-6">
        <h3 className="text-sm font-semibold">Reward rules</h3>
        <p className="mt-0.5 text-xs text-muted">Scope and priority are set in the seed catalog. Each rule saves on its own.</p>
        <div className="mt-4 space-y-3">
          {p.rules.map((r) => (
            <RuleForm key={r.id} rule={r} pointValue={p.pointValue} />
          ))}
        </div>
      </div>
    </Modal>
  );
}

function RuleForm({ rule: r, pointValue }: { rule: CatalogRuleView; pointValue: number }) {
  const { pending, onSubmit } = useSave(updateRule, `Rule “${r.label}” updated`);
  const [rateType, setRateType] = useState(r.rateType);
  const [rate, setRate] = useState(String(r.rate));
  const [perAmount, setPerAmount] = useState(String(r.perAmount));

  // Live preview of what the engine will use.
  const eff = rateType === "percent" ? Number(rate) : (Number(rate) / (Number(perAmount) || 100)) * pointValue * 100;

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-line bg-surface-2/60 p-4">
      <input type="hidden" name="id" value={r.id} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Label" className="col-span-2 sm:col-span-4">
          <Input name="label" required maxLength={80} defaultValue={r.label} />
        </Field>
        <Field label="Rate type">
          <Select name="rateType" value={rateType} onChange={(e) => setRateType(e.target.value as CatalogRuleView["rateType"])}>
            <option value="percent">Percent</option>
            <option value="points">Points</option>
          </Select>
        </Field>
        <Field label={rateType === "percent" ? "Rate (%)" : "Points"}>
          <Input name="rate" type="number" min={0} step="any" required value={rate} onChange={(e) => setRate(e.target.value)} />
        </Field>
        <Field label="Per ₹" hint={rateType === "percent" ? "Unused for percent" : undefined}>
          <Input name="perAmount" type="number" min={0} step="any" required value={perAmount} onChange={(e) => setPerAmount(e.target.value)} />
        </Field>
        <Field label="Min txn (₹)">
          <Input name="minTxn" type="number" min={0} step="any" placeholder="None" defaultValue={str(r.minTxn)} />
        </Field>
        <Field label="Cap (₹ reward)" hint="Blank = uncapped">
          <Input name="capValue" type="number" min={0} step="any" placeholder="None" defaultValue={str(r.capValue)} />
        </Field>
        <Field label="Cap period">
          <Select name="capPeriod" defaultValue={r.capPeriod ?? ""}>
            <option value="">None</option>
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
            <option value="year">Year</option>
          </Select>
        </Field>
        <div className="col-span-2 flex items-end justify-between gap-3">
          <p className="pb-2 text-xs text-muted">
            Effective <span className="num font-semibold text-accent">{Number.isFinite(eff) ? pct(eff, 2) : "—"}</span>
            {r.capShared && <span className="text-faint"> · shared cap, keep other rules in the group in sync</span>}
          </p>
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            {pending ? "Saving…" : "Save rule"}
          </Button>
        </div>
      </div>
    </form>
  );
}
