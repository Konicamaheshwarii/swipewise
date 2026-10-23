import Link from "next/link";
import { Logo } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-3 text-sm text-muted">Swipe the right card. Every single time.</p>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
            <a href="#features" className="text-muted hover:text-ink">Features</a>
            <Link href="/login" className="text-muted hover:text-ink">Sign in</Link>
            <a href="#how-it-works" className="text-muted hover:text-ink">How it works</a>
            <Link href="/signup" className="text-muted hover:text-ink">Create account</Link>
          </div>
        </div>
        <p className="mt-10 max-w-3xl text-xs leading-relaxed text-faint">
          Reward rules are approximations of issuers&apos; published terms and change often. Always verify rates, caps and fees
          with your bank before relying on them. Swipewise is not affiliated with any bank or card network, and nothing here is
          financial advice.
        </p>
        <p className="mt-4 text-xs text-faint">© {new Date().getFullYear()} Swipewise</p>
      </div>
    </footer>
  );
}
