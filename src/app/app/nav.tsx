"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, CreditCard, LayoutDashboard, Library, LogOut, Receipt, Scale, WandSparkles } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { cn } from "@/lib/format";

export const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/advisor", label: "Swipe Advisor", icon: WandSparkles },
  { href: "/app/wallet", label: "My Wallet", icon: CreditCard },
  { href: "/app/expenses", label: "Expenses", icon: Receipt },
  { href: "/app/review", label: "Card Review", icon: Scale },
  { href: "/app/discover", label: "Discover", icon: Compass },
  { href: "/app/catalog", label: "Card Catalog", icon: Library },
];

const isActive = (pathname: string, href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

export function SideNav({ user }: { user: { name: string; email: string } }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active ? "bg-white/[0.06] text-ink" : "text-muted hover:bg-white/[0.03] hover:text-ink",
              )}
            >
              {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />}
              <Icon className={cn("size-[18px]", active ? "text-accent" : "text-faint group-hover:text-muted")} />
              {label}
              {href === "/app/advisor" && (
                <span className="ml-auto rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">LIVE</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-line bg-surface-2/60 p-3">
        <div className="flex items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-info text-sm font-bold text-accent-ink">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-[11px] text-faint">{user.email}</p>
          </div>
          <form action={logout}>
            <button className="grid size-8 place-items-center rounded-lg text-faint hover:bg-white/5 hover:text-ink" aria-label="Sign out" title="Sign out">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/** Mobile bottom tab bar (first 5 destinations). */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {NAV.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} className={cn("flex flex-col items-center gap-1 py-2.5 text-[10px]", active ? "text-accent" : "text-faint")}>
              <Icon className="size-5" />
              {label.replace("Swipe ", "").replace("My ", "")}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Mobile top-bar overflow links. */
export function MobileMore() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1">
      {NAV.slice(5).map(({ href, icon: Icon, label }) => (
        <Link key={href} href={href} aria-label={label} className={cn("grid size-9 place-items-center rounded-lg", isActive(pathname, href) ? "text-accent" : "text-muted")}>
          <Icon className="size-[18px]" />
        </Link>
      ))}
      <form action={logout}>
        <button className="grid size-9 place-items-center rounded-lg text-muted" aria-label="Sign out">
          <LogOut className="size-[18px]" />
        </button>
      </form>
    </div>
  );
}
