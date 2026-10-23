# Swipewise: Build Plan

> "Swipe the right card. Every time."

Implements the MVP from [REQUIREMENTS.md](REQUIREMENTS.md), plus new card discovery (F10) from Phase 2.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, Server Actions), TypeScript | One codebase for UI and API |
| Styling | Tailwind CSS v4, custom design tokens, dark premium theme | Fast to build, consistent look |
| DB | Prisma 6 + SQLite (`prisma/dev.db`) | Runs locally without setup. Switch `provider` to `postgresql` for production |
| Auth | Email/password, bcrypt hashes, signed JWT (`jose`) in an httpOnly cookie | No third-party dependency |
| Charts | Recharts | |
| Icons / toasts | lucide-react / sonner | |
| Tests | Vitest (reward engine) | |

`cacheComponents` is turned off. Every page is per-user and dynamic, so the classic request-time rendering model is simpler and correct.

## Architecture

```
src/
  engine/          Pure TypeScript reward engine. No DB or framework imports. Unit-tested.
    types.ts       EngineCard, EngineRule, Txn, CapState
    evaluate.ts    rule matching, effective return, cap handling
    optimize.ts    greedy chronological allocation, actual-vs-optimal
    review.ts      marginal value, NAV, keep/close verdicts
    discover.ts    which catalog card adds the most value
    engine.test.ts
  data/
    categories.ts  system categories + popular merchants (icons, colours)
    catalog.ts     15 seed Indian cards with reward rules (approximate; each has source + lastVerified)
  lib/
    db.ts          Prisma client singleton
    session.ts     JWT cookie create/read/destroy
    auth.ts        requireUser() data access layer
    wallet.ts      load user cards/expenses from DB and map them to engine types
    actions/       server actions: auth, cards, expenses, catalog (admin)
    format.ts      ₹ formatting helpers
  components/
    ui/            Button, Input, Select, Modal, Badge, Progress, StatCard
    card-face.tsx  credit card visual
  app/
    page.tsx       landing page
    login, signup
    app/           signed-in area (sidebar layout)
      page.tsx     Dashboard
      advisor/     Swipe Advisor (best card for a purchase, computed client-side, updates instantly)
      wallet/      My cards (add, edit, remove)
      expenses/    list, add, CSV import
      review/      Keep / Close verdicts
      discover/    new card recommendations
      catalog/     browse card rules; admins can edit fees and rates
  proxy.ts         redirects signed-out users away from /app
prisma/
  schema.prisma
  seed.ts          catalog + demo user (demo@swipewise.app / demo1234) with 12 months of expenses
```

## Engine rules (summary)

- Rule match priority: merchant rule > category rule > channel rule > base rate. The highest priority wins, with ties broken by the higher rate.
- `rate` is converted to an effective % using `pointValue` (e.g. 4 points per ₹150 at ₹0.50 per point = 1.33%).
- Caps are in ₹ of reward value, per `capGroup`, per period (month, quarter or year; a statement cycle is approximated as a calendar month). Rules with the same `capGroup` share a cap.
- Excluded categories (rent, fuel, wallet and so on) earn 0.
- International spend subtracts the forex markup.
- Allocation goes through expenses in date order and gives each to the best card given the cap usage so far.
- Marginal value of a card = total rewards with all cards − total rewards without that card.
- NAV = marginal value + perks value − annual fee. The fee is 0 when the waiver spend is met.

## Build order

1. Scaffold and dependencies ✅
2. Engine and tests ✅
3. Prisma schema, catalog and seed ✅
4. Auth (session, proxy, login/signup) ✅
5. UI kit, theme and landing page ✅
6. App shell, then Dashboard, Advisor, Wallet, Expenses, Review, Discover and Catalog ✅ (pages built in parallel by 4 subagents)
7. Typecheck, lint, tests, production build, then click through every page in a real browser ✅

## Later (not in this build)

Reminders/notifications, utilization alerts, PDF statement import, offers feed, SMS parsing, Account Aggregator, browser extension, Postgres deploy.
