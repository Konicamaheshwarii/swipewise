import type { ReactNode } from "react";
import { cn } from "@/lib/format";

type Tone = "neutral" | "good" | "warn" | "gold";
const TILE: Record<Tone, string> = { neutral: "bg-white/5 text-muted", good: "bg-good/10 text-good", warn: "bg-warn/10 text-warn", gold: "bg-gold/10 text-gold" };
const TEXT: Record<Tone, string> = { neutral: "text-ink", good: "text-good", warn: "text-warn", gold: "text-gold" };

/** Compact summary stat for the Expenses page. */
export function Chip({ icon, label, value, sub, tone = "neutral" }: { icon: ReactNode; label: string; value: string; sub?: string; tone?: Tone }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface/80 px-4 py-3">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", TILE[tone])}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-muted">{label}</p>
        <p className={cn("num truncate text-lg font-semibold tracking-tight", TEXT[tone])}>{value}</p>
        {sub && <p className="num truncate text-[11px] text-faint">{sub}</p>}
      </div>
    </div>
  );
}
