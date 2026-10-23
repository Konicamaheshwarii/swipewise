# Swipewise

**Swipe the right card. Every time.**

Swipewise looks at your credit cards and your spending and answers three questions:

1. **Which card should I use for this purchase?** The Swipe Advisor ranks your cards live. It accounts for category and merchant rates, monthly or quarterly caps you've already used, exclusions (rent, fuel, wallet loads…), minimum amounts and forex markup.
2. **Which cards are worth keeping?** Card Review works out each card's *marginal value*: what your wallet loses without it. It adds perks, subtracts the annual fee unless your spend waives it, and gives a verdict: Keep, Push spend, Downgrade or Close.
3. **Which card am I missing?** Discover replays your last 12 months with each catalog card added and ranks them by net gain per year.

There's also a dashboard (spend, rewards earned vs. missed, best card per category, fee-waiver progress), expense tracking with CSV import, and a 45-card catalog whose rules admins can edit.

**Adding cards is fast:** Quick add lets you pick your banks, tap all your cards at once, and add them in one go. Billing details are optional and can be filled in later. A card that isn't in the catalog can be added as a custom card with your own reward rates.

See [REQUIREMENTS.md](REQUIREMENTS.md) for the product spec and [PLAN.md](PLAN.md) for the architecture.

## Quick start

Requires Node 20.9+.

```bash
npm install
cp .env.example .env      # then set SESSION_SECRET to a long random string
npm run db:push           # creates prisma/dev.db (SQLite)
npm run db:seed           # 15-card catalog + demo account
npm run dev
```

Open http://localhost:3000 and click **Try the live demo**, or sign in with `demo@swipewise.app` / `demo1234`. The demo account is an admin, so it can also edit catalog rules.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production build / serve |
| `npm test` | Reward engine unit tests (Vitest) |
| `npm run typecheck` / `lint` | TypeScript / ESLint |
| `npm run db:reset` | Wipe the DB and re-seed |

## Project layout

```
src/engine/      pure reward engine (no DB/framework), unit-tested
src/data/        seed catalog (45 Indian cards) + categories & merchants
src/lib/         db, session/auth, DB→engine mapping, server actions
src/components/  UI kit, CardFace, feature components
src/app/         landing, auth, and the signed-in app under /app
prisma/          schema + seed
```

## Notes

- **Reward rules are approximations** of each issuer's published terms (see `lastVerified` per card). Banks change them often, so verify them and edit them in **Card Catalog**.
- A statement cycle is approximated as a calendar month when applying monthly caps.
- Swipewise never stores full card numbers or CVVs, only an optional last 4 digits.
- For production, change `provider` in `prisma/schema.prisma` to `postgresql` and set `DATABASE_URL`.
