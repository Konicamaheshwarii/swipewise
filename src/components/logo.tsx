import Link from "next/link";
import { cn } from "@/lib/format";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)}>
      <span className="relative grid size-8 place-items-center">
        <span className="absolute inset-0 rotate-[-12deg] rounded-[9px] bg-accent/25 transition-transform group-hover:rotate-[-18deg]" />
        <span className="relative grid size-8 place-items-center rounded-[9px] bg-accent text-accent-ink">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 15c3 0 4-6 8-6s5 6 8 6" />
          </svg>
        </span>
      </span>
      <span className="text-[17px] font-semibold tracking-tight">
        Swipe<span className="font-display text-xl italic text-accent">wise</span>
      </span>
    </Link>
  );
}
