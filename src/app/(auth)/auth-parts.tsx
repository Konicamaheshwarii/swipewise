import type { ReactNode } from "react";

export function AuthHeading({ title, subtitle }: { title: ReactNode; subtitle: string }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-5xl leading-none tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-muted">{subtitle}</p>
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-faint">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
