import type { CSSProperties } from "react";
import { BadgeCheck, Sparkles } from "lucide-react";
import { CardFace } from "@/components/card-face";
import { cn } from "@/lib/format";
import { pickCards } from "./cards";

// Back to front: position offsets (px), rotation and float delay per card.
const LAYOUT = [
  { x: -70, y: 0, r: -14, delay: "0s", last4: "0042" },
  { x: 60, y: 46, r: 9, delay: "1.2s", last4: "7310" },
  { x: -36, y: 100, r: -5, delay: "2.1s", last4: "5521" },
  { x: 24, y: 160, r: 3, delay: "0.6s", last4: "1984" },
];

/** Floating stack of real catalog cards with a Swipe Advisor result chip. */
export function HeroCards({ className }: { className?: string }) {
  const cards = pickCards("hdfc-infinia", "axis-atlas", "sbi-cashback", "swiggy-hdfc");
  return (
    <div className={cn("relative mx-auto h-[400px] w-full max-w-[480px] sm:h-[440px]", className)}>
      {/* glow under the stack */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl" />

      <div className="absolute inset-x-0 top-4 h-[360px] origin-top scale-[0.82] sm:top-2 sm:scale-100">
        {cards.map((card, i) => {
          const l = LAYOUT[i];
          return (
            <div
              key={card.id}
              className="absolute left-1/2 top-0 -translate-x-1/2"
              style={{ marginLeft: l.x, top: l.y, zIndex: i }}
            >
              <CardFace
                bank={card.bank}
                name={card.name}
                network={card.network}
                colorFrom={card.colorFrom}
                colorTo={card.colorTo}
                last4={l.last4}
                size="md"
                className="animate-float shadow-[0_30px_80px_-25px_rgba(0,0,0,0.9)]"
                style={{ "--r": `${l.r}deg`, animationDelay: l.delay } as CSSProperties}
              />
            </div>
          );
        })}
      </div>

      {/* Swipe Advisor result chip */}
      <div
        className="animate-float absolute bottom-2 left-0 z-10 w-[min(300px,88%)] rounded-2xl border border-white/10 bg-surface-2/70 p-3.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:-left-6 sm:bottom-0"
        style={{ "--r": "-2deg", animationDelay: "1.6s" } as CSSProperties}
      >
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          <Sparkles className="size-3" /> Swipe Advisor
        </div>
        <p className="mt-2 text-sm text-muted">
          Swiggy · <span className="num text-ink">₹640</span>
        </p>
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2 ring-1 ring-white/5">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">Use Swiggy HDFC</p>
            <p className="text-[11px] text-faint">10% cashback on Swiggy</p>
          </div>
          <div className="text-right">
            <p className="num text-base font-semibold text-accent">+₹64</p>
            <p className="text-[10px] text-faint">10% back</p>
          </div>
        </div>
      </div>

      {/* Card Review chip */}
      <div
        className="animate-float absolute right-0 top-0 z-10 hidden items-center gap-2 rounded-full border border-white/10 bg-surface-2/70 py-1.5 pl-1.5 pr-3.5 text-xs shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:flex"
        style={{ "--r": "3deg", animationDelay: "2.8s" } as CSSProperties}
      >
        <span className="grid size-6 place-items-center rounded-full bg-good/15 text-good">
          <BadgeCheck className="size-3.5" />
        </span>
        <span className="text-muted">
          Atlas: <span className="font-medium text-good">Keep</span> · <span className="num text-ink">+₹9,400/yr</span>
        </span>
      </div>
    </div>
  );
}
