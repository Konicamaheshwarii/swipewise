import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Ban,
  CalendarClock,
  Compass,
  CreditCard,
  FileSpreadsheet,
  Gauge,
  LayoutGrid,
  Receipt,
  Scale,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { DemoButton } from "@/components/marketing/demo-button";
import { AdvisorMock, DiscoverMock, ReviewMock } from "@/components/marketing/feature-mocks";
import { HeroCards } from "@/components/marketing/hero-cards";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";
import { LinkButton } from "@/components/ui";
import { cn } from "@/lib/format";

export const metadata: Metadata = {
  title: { absolute: "Swipewise: swipe the right card, every time" },
};

const BANKS = ["HDFC Bank", "SBI Card", "ICICI Bank", "Axis Bank", "HSBC", "American Express", "Federal Bank"];

const FEATURES: {
  eyebrow: string;
  icon: ReactNode;
  title: ReactNode;
  body: string;
  points: string[];
  mock: ReactNode;
}[] = [
  {
    eyebrow: "Swipe Advisor",
    icon: <Zap className="size-4" />,
    title: (
      <>
        Which card <em className="text-accent">right now?</em>
      </>
    ),
    body: "Type the merchant and amount. Swipewise ranks every card in your wallet by what it actually pays you back, after caps you've already used this month and the categories each bank excludes.",
    points: ["Merchant-specific rates beat category rates", "Knows how much of each cap is left", "Accounts for forex markup abroad"],
    mock: <AdvisorMock />,
  },
  {
    eyebrow: "Card Review",
    icon: <Scale className="size-4" />,
    title: (
      <>
        Which cards <em className="text-accent">earn their fee?</em>
      </>
    ),
    body: "For every card we work out what it adds that your other cards can't, add the perks you really use, subtract the fee you really pay, and give you a plain verdict: keep, borderline or close.",
    points: ["Marginal value, not just raw rewards", "Fee waivers counted when you hit the spend", "Lounge and other perks valued in ₹"],
    mock: <ReviewMock />,
  },
  {
    eyebrow: "Discover",
    icon: <Compass className="size-4" />,
    title: (
      <>
        Which card are <em className="text-accent">you missing?</em>
      </>
    ),
    body: "We replay a year of your spending with each card in the catalog added to your wallet, then show the one that adds the most net value. No sponsored rankings, just your numbers.",
    points: ["Simulated on your real expenses", "Net of joining and annual fees", "Shows exactly where the gain comes from"],
    mock: <DiscoverMock />,
  },
];

const EXTRAS = [
  { icon: Ban, title: "Caps & exclusions aware", body: "Rent, fuel, wallet loads and monthly caps are built into every recommendation." },
  { icon: CalendarClock, title: "Fee-waiver tracking", body: "See how far you are from each card's waiver spend before the anniversary." },
  { icon: Gauge, title: "Missed-rewards meter", body: "What you earned versus what the best card would have earned, month by month." },
  { icon: FileSpreadsheet, title: "CSV import", body: "Bring a year of expenses in one go. Categories and merchants map automatically." },
  { icon: LayoutGrid, title: "Category cheat sheet", body: "Best card per category this month, on one screen you can glance at in the queue." },
  { icon: ShieldCheck, title: "Private by design", body: "We never ask for or store full card numbers, CVV or expiry. Last 4 digits at most." },
];

const STEPS = [
  { icon: CreditCard, title: "Add your cards", body: "Pick them from the catalog in seconds. Rates, caps and fees come pre-filled." },
  { icon: Receipt, title: "Log or import expenses", body: "Add a purchase in two taps or import a CSV of the past year." },
  { icon: Compass, title: "Get your playbook", body: "Which card to swipe, which to keep, and which to add next, all in rupees." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col overflow-x-clip">
      <SiteNav />

      <main className="flex-1">
        {/* ---------- Hero ---------- */}
        <section className="bg-aurora relative">
          <div className="bg-grid pointer-events-none absolute inset-0" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:gap-6 lg:pb-24 lg:pt-24">
            <div className="animate-fade-up text-center lg:text-left">
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-white/[0.03] py-1 pl-1 pr-3 text-xs text-muted backdrop-blur transition-colors hover:text-ink"
              >
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-ink">New</span>
                Discover the card your wallet is missing
                <ArrowRight className="size-3" />
              </a>
              <h1 className="mt-6 font-display text-[3.1rem] leading-[0.95] tracking-tight sm:text-7xl lg:text-[5.5rem]">
                Swipe the right card.
                <br />
                <em className="text-gradient pr-2">Every single time.</em>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg lg:mx-0">
                Swipewise answers the three questions every card holder has:{" "}
                <span className="text-ink">which card to use right now</span>,{" "}
                <span className="text-ink">which cards are worth their fee</span>, and{" "}
                <span className="text-ink">which card you&apos;re missing</span>. Built for Indian cards and their fine print.
              </p>
              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
                <DemoButton className="w-full sm:w-auto" formClassName="w-full sm:w-auto" />
                <LinkButton href="/signup" variant="outline" size="lg" className="w-full sm:w-auto">
                  Create free account <ArrowRight className="size-4" />
                </LinkButton>
              </div>
              <p className="mt-4 text-xs text-faint">No bank login. No card numbers. Demo loads a year of sample spending.</p>
            </div>

            <div className="animate-fade-up [animation-delay:150ms]">
              <HeroCards />
            </div>
          </div>
        </section>

        {/* ---------- Trust strip ---------- */}
        <section className="border-y border-line bg-surface/40">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-8 sm:px-6 lg:flex-row lg:gap-10">
            <p className="shrink-0 text-[11px] font-medium uppercase tracking-[0.18em] text-faint">Works with cards from</p>
            <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 lg:flex-1 lg:justify-between">
              {BANKS.map((b, i) => (
                <li
                  key={b}
                  className={cn(
                    "text-base text-muted/70 transition-colors hover:text-ink sm:text-lg",
                    i % 2 ? "font-display italic tracking-tight" : "font-semibold tracking-tight",
                  )}
                >
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Features ---------- */}
        <section id="features" className="scroll-mt-20 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="Three questions, answered"
              title={
                <>
                  Your wallet, finally <em className="text-accent">working for you</em>
                </>
              }
              body="Every bank publishes its rules in a different PDF. Swipewise turns them into one engine that knows your cards and your spending."
            />

            <div className="mt-14 space-y-6">
              {FEATURES.map((f, i) => (
                <div
                  key={f.eyebrow}
                  className="relative overflow-hidden rounded-[2rem] border border-line bg-gradient-to-b from-surface to-surface/40 p-6 sm:p-10"
                >
                  <div
                    className={cn(
                      "pointer-events-none absolute size-96 rounded-full bg-accent/[0.06] blur-3xl",
                      i % 2 ? "-left-40 -top-40" : "-right-40 -top-40",
                    )}
                  />
                  <div className="relative grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                    <div className={cn(i % 2 && "lg:order-2")}>
                      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                        <span className="grid size-7 place-items-center rounded-lg bg-accent/10 ring-1 ring-accent/25">{f.icon}</span>
                        {f.eyebrow}
                      </p>
                      <h3 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">{f.title}</h3>
                      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">{f.body}</p>
                      <ul className="mt-6 space-y-2.5">
                        {f.points.map((p) => (
                          <li key={p} className="flex items-center gap-2.5 text-sm text-ink/90">
                            <span className="size-1.5 shrink-0 rounded-full bg-accent" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className={cn("mx-auto w-full max-w-md", i % 2 && "lg:order-1")}>{f.mock}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-px overflow-hidden rounded-[2rem] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {EXTRAS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="group bg-bg p-6 transition-colors hover:bg-surface sm:p-7">
                  <div className="grid size-10 place-items-center rounded-xl border border-line bg-surface-2 text-muted transition-colors group-hover:border-accent/30 group-hover:text-accent">
                    <Icon className="size-[18px]" />
                  </div>
                  <h4 className="mt-5 text-[15px] font-semibold tracking-tight">{title}</h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how-it-works" className="scroll-mt-20 border-t border-line bg-surface/30 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="How it works"
              title={
                <>
                  Set up in <em className="text-accent">five minutes</em>
                </>
              }
              body="No bank linking, no screen scraping. You stay in control of what goes in."
            />
            <div className="relative mt-14">
              <div className="pointer-events-none absolute left-[16%] right-[16%] top-[3.25rem] hidden h-px bg-gradient-to-r from-transparent via-line-strong to-transparent md:block" />
              <ol className="relative grid gap-5 md:grid-cols-3">
                {STEPS.map(({ icon: Icon, title, body }, i) => (
                  <li key={title} className="relative rounded-3xl border border-line bg-bg/80 p-6 text-center backdrop-blur sm:p-8">
                    <div className="relative mx-auto grid size-14 place-items-center rounded-2xl border border-line-strong bg-surface-2 text-accent shadow-[0_0_40px_-10px_rgba(212,255,58,0.35)]">
                      <Icon className="size-6" />
                      <span className="num absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">
                        {i + 1}
                      </span>
                    </div>
                    <h3 className="mt-6 font-display text-2xl tracking-tight sm:text-3xl">{title}</h3>
                    <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">{body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ---------- Stat band ---------- */}
        <section className="relative overflow-hidden border-y border-line py-20 sm:py-28">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-[60rem] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/[0.07] blur-3xl" />
          <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
            <p className="num font-display text-7xl leading-none tracking-tight sm:text-8xl lg:text-9xl">
              <span className="text-gradient">₹18,000+</span>
            </p>
            <p className="mx-auto mt-6 max-w-2xl font-display text-2xl leading-snug text-ink/90 sm:text-3xl">
              a year. That&apos;s what a typical four-card wallet <em className="text-accent">can leave on the table</em> by
              swiping the wrong card.
            </p>
            <p className="mx-auto mt-5 max-w-lg text-xs text-faint">
              Illustrative estimate based on common Indian card reward rates and everyday spending patterns. Your number depends on
              your cards and how you spend; the demo shows a worked example.
            </p>
          </div>
        </section>

        {/* ---------- Final CTA ---------- */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-[2rem] border border-accent/20 bg-surface px-6 py-14 text-center sm:px-12 sm:py-20">
              <div className="bg-aurora pointer-events-none absolute inset-0 opacity-90" />
              <div className="pointer-events-none absolute -bottom-32 left-1/2 h-64 w-[36rem] max-w-full -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
              <div className="relative">
                <h2 className="mx-auto max-w-3xl font-display text-5xl leading-[1] tracking-tight sm:text-6xl lg:text-7xl">
                  Stop guessing at the <em className="text-accent">checkout counter.</em>
                </h2>
                <p className="mx-auto mt-5 max-w-lg text-muted">
                  See your own playbook in minutes, or poke around a fully loaded demo wallet first.
                </p>
                <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                  <LinkButton href="/signup" size="lg" className="w-full sm:w-auto">
                    Create free account <ArrowRight className="size-4" />
                  </LinkButton>
                  <DemoButton variant="outline" className="w-full sm:w-auto" formClassName="w-full sm:w-auto" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: ReactNode; body: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
      <h2 className="mt-4 font-display text-4xl leading-[1.02] tracking-tight sm:text-6xl">{title}</h2>
      <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}
