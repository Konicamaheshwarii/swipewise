import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/format";

/* ---------- Button ---------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink hover:brightness-110 shadow-[0_0_0_1px_rgba(212,255,58,0.4),0_8px_30px_-8px_rgba(212,255,58,0.5)]",
  secondary: "bg-surface-3 text-ink hover:bg-white/10 border border-line",
  outline: "border border-line-strong text-ink hover:bg-white/5",
  ghost: "text-muted hover:text-ink hover:bg-white/5",
  danger: "bg-bad/10 text-bad border border-bad/20 hover:bg-bad/20",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-2xl",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center font-medium whitespace-nowrap transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/* ---------- Form controls ---------- */

const control =
  "w-full h-10 rounded-xl bg-surface-2 border border-line px-3 text-sm text-ink placeholder:text-faint transition-colors focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/15";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(control, "select-chevron appearance-none pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "h-auto min-h-20 py-2", className)} {...props} />;
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-faint">{hint}</span>}
    </label>
  );
}

/* ---------- Surfaces ---------- */

export function Panel({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-3xl border border-line bg-surface/80 backdrop-blur-sm", className)} {...props} />;
}

export function PanelHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6", className)}>
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-fade-up">
      <div>
        {eyebrow && <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-accent">{eyebrow}</p>}
        <h1 className="font-display text-4xl leading-none tracking-tight sm:text-5xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Data display ---------- */

type Tone = "neutral" | "accent" | "good" | "warn" | "bad" | "info" | "gold";
const tones: Record<Tone, string> = {
  neutral: "bg-white/5 text-muted border-line",
  accent: "bg-accent/10 text-accent border-accent/25",
  good: "bg-good/10 text-good border-good/25",
  warn: "bg-warn/10 text-warn border-warn/25",
  bad: "bg-bad/10 text-bad border-bad/25",
  info: "bg-info/10 text-info border-info/25",
  gold: "bg-gold/10 text-gold border-gold/25",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", tones[tone], className)}
      {...props}
    />
  );
}

export function Progress({ value, tone = "accent", className }: { value: number; tone?: "accent" | "good" | "warn" | "bad" | "gold"; className?: string }) {
  const color = { accent: "bg-accent", good: "bg-good", warn: "bg-warn", bad: "bg-bad", gold: "bg-gold" }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-700", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "accent" | "good" | "bad" | "gold";
  className?: string;
}) {
  const valueColor = { neutral: "text-ink", accent: "text-accent", good: "text-good", bad: "text-bad", gold: "text-gold" }[tone];
  return (
    <Panel className={cn("relative overflow-hidden p-5", className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted">{label}</p>
        {icon && <div className="grid size-8 place-items-center rounded-xl bg-white/5 text-muted">{icon}</div>}
      </div>
      <p className={cn("num mt-3 text-3xl font-semibold tracking-tight", valueColor)}>{value}</p>
      {hint && <p className="mt-1.5 text-xs text-faint">{hint}</p>}
    </Panel>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <Panel className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && <div className="mb-4 grid size-14 place-items-center rounded-2xl border border-line bg-surface-2 text-accent">{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </Panel>
  );
}
