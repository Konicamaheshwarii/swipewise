import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/auth";
import { BottomNav, MobileMore, SideNav } from "./nav";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser();
  return (
    <div className="relative flex min-h-screen bg-bg">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[480px] bg-[radial-gradient(50%_60%_at_60%_0%,rgba(212,255,58,0.06),transparent_70%)]" />

      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-8 border-r border-line bg-surface/40 px-4 py-6 backdrop-blur-xl lg:flex">
        <Logo href="/app" className="px-2" />
        <SideNav user={{ name: user.name, email: user.email }} />
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/80 px-4 py-3 backdrop-blur-xl lg:hidden">
          <Logo href="/app" />
          <MobileMore />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-8 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}
