import { Check, Search, Sparkles, TrendingUp } from "lucide-react";
import { CardFace } from "@/components/card-face";
import { Badge, Progress } from "@/components/ui";
import { cn } from "@/lib/format";
import { CATALOG } from "@/data/catalog";
import { cardById } from "./cards";

/* Static, illustrative mock UIs for the landing page feature panels. */

function Mini({ id }: { id: string }) {
  const c = cardById(id);
  if (!c) return null;
  return <CardFace bank={c.bank} name={c.name} network={c.network} colorFrom={c.colorFrom} colorTo={c.colorTo} size="xs" />;
}

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative rounded-2xl border border-line bg-bg/70 p-4 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] sm:p-5", className)}>
      {children}
    </div>
  );
}

const RANKED = [
  { id: "swiggy-hdfc", name: "Swiggy HDFC", why: "10% on Swiggy", rate: "10%", earn: "₹64" },
  { id: "hdfc-millennia", name: "HDFC Millennia", why: "5% partner merchant", rate: "5%", earn: "₹32" },
  { id: "amazon-icici", name: "Amazon Pay ICICI", why: "2% Amazon Pay partner", rate: "2%", earn: "₹13" },
  { id: "bpcl-sbi-octane", name: "BPCL Octane", why: "Base rate", rate: "0.6%", earn: "₹4" },
];

export function AdvisorMock() {
  return (
    <Frame>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm">
        <Search className="size-4 text-faint" />
        <span className="text-ink">Swiggy</span>
        <span className="text-faint">·</span>
        <span className="text-muted">Dining</span>
        <span className="num ml-auto font-medium">₹640</span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {RANKED.map((r, i) => (
          <li
            key={r.id}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5",
              i === 0 ? "bg-accent/[0.07] ring-1 ring-accent/25" : "opacity-80",
            )}
          >
            <span className="num w-3 text-xs text-faint">{i + 1}</span>
            <Mini id={r.id} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{r.name}</p>
              <p className="truncate text-[11px] text-faint">{r.why}</p>
            </div>
            <div className="text-right">
              <p className={cn("num text-sm font-semibold", i === 0 ? "text-accent" : "text-ink")}>{r.earn}</p>
              <p className="num text-[10px] text-faint">{r.rate}</p>
            </div>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

const VERDICTS = [
  { id: "swiggy-hdfc", name: "Swiggy HDFC", nav: "+₹4,820", fee: "Fee waived", tone: "good" as const, verdict: "Keep", bar: 82 },
  { id: "hdfc-regalia-gold", name: "Regalia Gold", nav: "+₹1,150", fee: "₹2,500 fee", tone: "warn" as const, verdict: "Borderline", bar: 38 },
  { id: "bpcl-sbi-octane", name: "BPCL Octane", nav: "−₹1,480", fee: "₹1,499 fee", tone: "bad" as const, verdict: "Close", bar: 8 },
];

export function ReviewMock() {
  return (
    <Frame>
      <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-faint">
        <span>Net annual value</span>
        <span>Last 12 months</span>
      </div>
      <ul className="space-y-3">
        {VERDICTS.map((v) => (
          <li key={v.id} className="rounded-xl border border-line bg-surface/60 p-3">
            <div className="flex items-center gap-3">
              <Mini id={v.id} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{v.name}</p>
                <p className="text-[11px] text-faint">{v.fee}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge tone={v.tone}>{v.verdict}</Badge>
                <span className={cn("num text-xs font-semibold", v.tone === "bad" ? "text-bad" : "text-ink")}>{v.nav}</span>
              </div>
            </div>
            <Progress value={v.bar} tone={v.tone} className="mt-2.5" />
          </li>
        ))}
      </ul>
    </Frame>
  );
}

export function DiscoverMock() {
  const c = cardById("axis-atlas");
  return (
    <Frame className="overflow-hidden">
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-gold/10 blur-3xl" />
      <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        {c && (
          <CardFace
            bank={c.bank}
            name={c.name}
            network={c.network}
            colorFrom={c.colorFrom}
            colorTo={c.colorTo}
            size="sm"
            className="rotate-[-6deg]"
          />
        )}
        <div className="text-center sm:text-left">
          <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold sm:justify-start">
            <Sparkles className="size-3" /> Best addition
          </p>
          <p className="num mt-1 font-display text-5xl leading-none text-ink">+₹7,300</p>
          <p className="mt-1 text-xs text-muted">a year, after fees</p>
        </div>
      </div>
      <ul className="relative mt-5 space-y-2 border-t border-line pt-4 text-xs text-muted">
        {["Your ₹2.1L of travel spend earns 5× miles", "Fee waived at your current spend", "Replaces 2% you earn today on flights"].map((t) => (
          <li key={t} className="flex items-start gap-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-good" />
            {t}
          </li>
        ))}
      </ul>
      <div className="relative mt-4 flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-[11px] text-faint ring-1 ring-line">
        <TrendingUp className="size-3.5 text-accent" /> Ranked against {CATALOG.length} cards using your real spend
      </div>
    </Frame>
  );
}
