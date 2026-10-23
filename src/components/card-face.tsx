import { cn } from "@/lib/format";

export interface CardFaceProps {
  bank: string;
  name: string;
  network: string;
  colorFrom: string;
  colorTo: string;
  last4?: string | null;
  nickname?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  style?: React.CSSProperties;
}

const sizes = {
  xs: "w-14 rounded-md p-1.5",
  sm: "w-44 rounded-xl p-3",
  md: "w-72 rounded-2xl p-5",
  lg: "w-80 sm:w-96 rounded-3xl p-6",
};

/** A credit card rendered in the issuer's colours. */
export function CardFace({ bank, name, network, colorFrom, colorTo, last4, nickname, size = "md", className, style }: CardFaceProps) {
  const tiny = size === "xs";
  return (
    <div
      className={cn(
        "card-sheen relative aspect-[1.586] shrink-0 overflow-hidden text-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10",
        sizes[size],
        className,
      )}
      style={{ background: `linear-gradient(135deg, ${colorFrom} 0%, ${colorTo} 100%)`, ...style }}
      aria-label={`${bank} ${name}`}
    >
      {/* decorative arcs */}
      <div className="pointer-events-none absolute -right-1/4 -top-1/2 aspect-square w-[90%] rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -right-[10%] -top-1/3 aspect-square w-[70%] rounded-full border border-white/10" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_100%,rgba(0,0,0,0.35),transparent_60%)]" />

      {!tiny && (
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={cn("truncate font-semibold uppercase tracking-[0.14em] text-white/70", size === "sm" ? "text-[8px]" : "text-[10px]")}>{bank}</p>
              <p className={cn("truncate font-display leading-tight", size === "sm" ? "text-base" : size === "md" ? "text-2xl" : "text-3xl")}>{name}</p>
            </div>
            <Contactless className={cn("shrink-0 text-white/70", size === "sm" ? "size-3" : "size-5")} />
          </div>
          <Chip className={cn(size === "sm" ? "h-4 w-6" : "h-7 w-10")} />
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              {nickname && size !== "sm" && <p className="truncate text-[10px] uppercase tracking-widest text-white/60">{nickname}</p>}
              <p className={cn("num font-mono tracking-[0.2em] text-white/90", size === "sm" ? "text-[9px]" : "text-sm")}>
                •••• {last4 || "••••"}
              </p>
            </div>
            <NetworkMark network={network} small={size === "sm"} />
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 28" className={className} aria-hidden>
      <defs>
        <linearGradient id="chip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e3a1" />
          <stop offset="1" stopColor="#b8913f" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="39" height="27" rx="5" fill="url(#chip)" stroke="rgba(0,0,0,0.25)" />
      <path d="M0 10h13M0 18h13M27 10h13M27 18h13M13 0v28M27 0v28M13 14h14" stroke="rgba(0,0,0,0.25)" fill="none" />
    </svg>
  );
}

function Contactless({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden>
      <path d="M8.5 7.5a6 6 0 0 1 0 9M12 5a10 10 0 0 1 0 14M15.5 2.5a14 14 0 0 1 0 19M5 10a2.5 2.5 0 0 1 0 4" />
    </svg>
  );
}

function NetworkMark({ network, small }: { network: string; small?: boolean }) {
  const n = network.toLowerCase();
  if (n.includes("master")) {
    return (
      <div className={cn("flex", small ? "-space-x-1.5" : "-space-x-3")} aria-label="Mastercard">
        <span className={cn("rounded-full bg-[#eb001b]/90", small ? "size-3" : "size-6")} />
        <span className={cn("rounded-full bg-[#f79e1b]/90 mix-blend-screen", small ? "size-3" : "size-6")} />
      </div>
    );
  }
  const label = n.includes("visa") ? "VISA" : n.includes("rupay") ? "RuPay" : n.includes("amex") ? "AMEX" : network.toUpperCase();
  return <span className={cn("font-black italic tracking-tight text-white/90", small ? "text-[9px]" : "text-lg")}>{label}</span>;
}
