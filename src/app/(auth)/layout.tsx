import type { CSSProperties } from "react";
import { Sparkles } from "lucide-react";
import { CardFace } from "@/components/card-face";
import { Logo } from "@/components/logo";
import { pickCards } from "@/components/marketing/cards";

const FAN = [
  { r: -12, x: -90, y: 30, delay: "0s" },
  { r: 0, x: 0, y: 0, delay: "1.4s" },
  { r: 12, x: 90, y: 30, delay: "0.7s" },
];

/** Split auth layout: form on the left, brand panel on the right (lg+). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const cards = pickCards("hdfc-regalia-gold", "swiggy-hdfc", "amex-mrcc");
  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-[1fr_1.05fr]">
      <div className="bg-aurora relative flex flex-col px-4 py-6 sm:px-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm animate-fade-up">{children}</div>
        </div>
        <p className="text-center text-[11px] text-faint lg:text-left">
          Reward rules are approximations. Verify with your bank. Not financial advice.
        </p>
      </div>

      <aside className="relative hidden overflow-hidden border-l border-line bg-surface lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-12">
        <div className="bg-aurora pointer-events-none absolute inset-0" />
        <div className="bg-grid pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute left-1/2 top-[38%] size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative h-[260px] w-full max-w-lg">
          {cards.map((c, i) => {
            const f = FAN[i];
            return (
              <div key={c.id} className="absolute left-1/2 top-0 -translate-x-1/2" style={{ marginLeft: f.x, top: f.y, zIndex: i === 1 ? 3 : i }}>
                <CardFace
                  bank={c.bank}
                  name={c.name}
                  network={c.network}
                  colorFrom={c.colorFrom}
                  colorTo={c.colorTo}
                  last4={["4410", "1984", "3005"][i]}
                  size="md"
                  className="animate-float shadow-[0_30px_80px_-25px_rgba(0,0,0,0.9)]"
                  style={{ "--r": `${f.r}deg`, animationDelay: f.delay } as CSSProperties}
                />
              </div>
            );
          })}
        </div>

        <figure className="relative mt-14 max-w-md text-center">
          <Sparkles className="mx-auto size-6 text-accent/70" />
          <blockquote className="mt-4 font-display text-3xl leading-tight tracking-tight">
            Every card has a job. Swipewise tells you <em className="text-accent">which one</em>, for every swipe.
          </blockquote>
          <figcaption className="mt-5 text-sm text-muted">
            Caps, exclusions and fee waivers handled for you.
          </figcaption>
        </figure>
      </aside>
    </div>
  );
}
