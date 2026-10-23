import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { LinkButton } from "@/components/ui";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
];

/** Sticky translucent top bar for the public pages. */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/60 backdrop-blur-xl supports-[backdrop-filter]:bg-bg/45">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-ink">
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link href="/login" className="rounded-lg px-2.5 py-2 text-sm text-muted transition-colors hover:text-ink sm:px-3">
            Sign in
          </Link>
          <LinkButton href="/signup" size="sm" className="h-9 px-3.5 sm:px-4">
            Get started <ArrowRight className="size-3.5" />
          </LinkButton>
        </div>
      </nav>
    </header>
  );
}
