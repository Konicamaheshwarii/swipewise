"use client";

import Link from "next/link";
import { ArrowRight, Compass, ExternalLink } from "lucide-react";
import { CardFace } from "@/components/card-face";
import { Panel } from "@/components/ui";
import { fmtPct, rankCards, type EngineCard, type Txn } from "@/engine";
import { inr, rewardKind } from "@/lib/format";

const KIND = { cashback: "Cashback", points: "Points", miles: "Miles" } as const;

export interface CatalogOption {
  card: EngineCard;
  bank: string;
  name: string;
  network: string;
  colorFrom: string;
  colorTo: string;
  annualFee: number;
  feeWaiverSpend: number | null;
  rewardUnit: string;
  pointValue: number;
}

export const isRupay = (network: string) => network.toLowerCase().includes("rupay");

/**
 * Catalog cards (not in the wallet) that would earn more on this purchase.
 * Ranked purely by what this purchase would earn; no sponsored placement.
 */
export function CatalogSuggestions({
  options,
  txn,
  bestWalletNet,
  upi,
}: {
  options: CatalogOption[];
  txn: Txn;
  /** Best net the user's own cards earn here (0 if none earn). */
  bestWalletNet: number;
  upi: boolean;
}) {
  if (txn.amount <= 0) return null;
  const pool = upi ? options.filter((o) => isRupay(o.network)) : options;
  const byId = new Map(pool.map((o) => [o.card.id, o]));
  // Fresh card: no caps used yet.
  const ranked = rankCards(pool.map((o) => o.card), txn).filter((r) => r.net > 0);

  // Only worth showing when it's a real step up: nothing in the wallet earns,
  // or a catalog card earns at least 1.5x and ₹10 more.
  const better = ranked.filter((r) => bestWalletNet <= 0 || (r.net >= bestWalletNet * 1.5 && r.net - bestWalletNet >= 10));
  const top = better.slice(0, 3);
  if (!top.length) return null;

  const none = bestWalletNet <= 0;
  return (
    <Panel className="animate-fade-up overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">{none ? "Cards that would earn here" : "Could earn more here"}</h3>
          <p className="mt-0.5 text-xs text-muted">
            {none ? "None of your cards earn on this. " : "Better than your best card for this purchase. "}
            Ranked only by rewards{upi ? " · RuPay cards only (UPI)" : ""}.
          </p>
        </div>
        <Compass className="mt-0.5 size-4 shrink-0 text-faint" />
      </div>

      <ul className="mt-3 divide-y divide-line">
        {top.map((r) => {
          const o = byId.get(r.cardId)!;
          return (
            <li key={r.cardId} className="flex items-center gap-4 px-5 py-3.5 sm:px-6">
              <CardFace bank={o.bank} name={o.name} network={o.network} colorFrom={o.colorFrom} colorTo={o.colorTo} size="xs" className="w-12" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {o.bank} {o.name}
                </p>
                <p className="truncate text-xs text-muted">
                  {fmtPct(r.effectivePct)} {KIND[rewardKind(o.rewardUnit, o.pointValue)].toLowerCase()} · {r.rule?.label ?? "Rewards"}
                </p>
                <p className="mt-0.5 text-[11px] text-faint">
                  {o.annualFee === 0
                    ? "Lifetime free"
                    : `${inr(o.annualFee)}/yr fee${o.feeWaiverSpend ? ` · waived on ${inr(o.feeWaiverSpend, { compact: true })} spend` : ""}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="num text-sm font-semibold text-good">{inr(r.net, { decimals: r.net < 100 ? 2 : 0 })}</p>
                {!none && <p className="num text-[11px] text-faint">+{inr(r.net - bestWalletNet, { decimals: 0 })} more</p>}
                <Link href={`/app/catalog#${o.card.productId}`} className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink">
                  Details <ExternalLink className="size-3" />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <Link
        href="/app/discover"
        className="flex items-center justify-between gap-3 border-t border-line bg-white/[0.02] px-5 py-3 text-xs text-muted transition-colors hover:text-ink sm:px-6"
      >
        <span>One purchase isn&apos;t the whole story. See which card is worth its fee for all your spending.</span>
        <ArrowRight className="size-4 shrink-0" />
      </Link>
    </Panel>
  );
}
