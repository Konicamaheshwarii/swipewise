# Credit Card Optimizer: Requirements

## 1. Problem

A user has between 1 and N credit cards, and each card has different reward rules: category multipliers, monthly caps, exclusions, annual fees, fee waivers and milestone bonuses. Most people don't know:

1. **Which card to use for a given purchase** to earn the most.
2. **Which cards are worth keeping**: whether a card's rewards and benefits cover its annual fee.
3. **Which card is missing**: whether a new card would add real value given how they spend.

The app answers these three questions from the user's own cards, expenses and categories.

---

## 2. Existing products

| Product | Market | What it does | Gap / our angle |
|---|---|---|---|
| **MaxRewards** | US | Links bank accounts, picks the best card per category or store, activates offers. Free plan plus paid plans (about $9–20/month). | US only. Paid. Uses bank linking, which is hard to build. |
| **CardPointers** | US | Best card per category, offer tracking, bonus-category tracking. | US only. |
| **Kudos** | US | Browser extension that suggests the best card at checkout. | US only. Works at checkout, not as an annual review. |
| **Credeem** | India | Ranks cards by projected Net Annual Value from the user's spending. | Focuses on choosing a new card, not on daily use. |
| **CRED / CheQ / super.money** | India | Bill payment and rewards for paying bills. | No per-transaction card advice. |
| **CardTrail, TechnoFino, CardExpert** | India | Spend-analysis articles, calculators and community discussion. | Content only. No personalized engine. |

**Opportunity:** a personal, privacy-friendly tool, especially for Indian cards (which have complex caps and exclusions), that combines all three answers: **which card to use now**, **which to keep or close**, and **which to add**.

---

## 3. Users

- **Primary:** someone with 2–10 cards who wants to maximize rewards without memorizing rules.
- **Secondary:** someone with 0–1 cards deciding which card to get first.

---

## 4. Functional requirements

### 4.1 MVP (Phase 1)

**F1. User and auth**
- Sign up and log in with email/password or Google OAuth.
- Profile: name, currency (default INR) and country.

**F2. Card catalog (admin-managed)**
- Master list of card products: bank, name, network (Visa, Mastercard, RuPay, Amex), annual fee, joining fee and fee-waiver spend.
- Reward rules per card (see section 5): base rate, category rates, caps, exclusions and point value.
- Benefits: lounge visits, fuel-surcharge waiver, forex markup, insurance and similar.
- Admin screen to add or edit cards. Rules change often, so the catalog must be data, not code.

**F3. My cards (1..N)**
- Add a card from the catalog, or add a custom card with manual rules.
- Per-card fields: nickname, last 4 digits (optional), credit limit, statement day, due day, card anniversary month and whether the fee is waived in the first year.
- Never store the full card number, CVV or expiry.

**F4. Categories**
- Default categories: Groceries, Dining, Fuel, Online Shopping, Travel (Flights/Hotels), Utilities, Rent, Insurance, Education, Wallet Load, Government/Tax, EMI, International, Entertainment, Other.
- Users can add their own subcategories.
- Optional merchant mapping, for example Swiggy → Dining (with a merchant-specific rate) or Amazon → Online Shopping.

**F5. Expenses**
- Add an expense manually: amount, date, category, merchant (optional), card used (optional) and channel (online/offline/international).
- Bulk import from CSV/Excel.
- Edit and delete expenses.

**F6. Best card for a purchase**
- Input: amount, category, merchant (optional) and channel.
- Output: cards ranked by **effective return**, with the explanation, for example: "Card A: 5% = ₹250 (₹750 left of the monthly cap)" or "Card B: 0% (rent excluded)".
- Takes into account caps already used this cycle, exclusions, minimum transaction amounts, forex markup and remaining credit limit.

**F7. Category cheat sheet**
- One screen showing the best card per category for this month, for example "Dining → Card A, Fuel → Card C". Useful to save as a phone wallpaper.

**F8. Card review: keep or close**
- For each card, over the last 12 months (or a projection):
  - Rewards earned when the user follows the optimal strategy.
  - **Marginal value** = (total rewards with all cards) − (total rewards without this card). This shows what the card adds that other cards can't.
  - Benefits value: lounge visits used × ₹ value, fuel surcharge saved, and so on.
  - Annual fee after any waiver, if the waiver spend is met.
  - **Net Annual Value (NAV)** = marginal value + benefits − fee.
- Verdict: **Keep**, **Keep but spend ₹X more to waive the fee**, **Downgrade or ask for a fee waiver**, or **Close**.
- Warning: closing an old card lowers total credit limit and can raise utilization, which affects the credit score.

**F9. Dashboard**
- Spend by category and by card per month.
- Rewards earned vs. missed rewards (actual card used vs. the best card).
- Progress on fee waivers and milestones, for example "Spend ₹40,000 more by Mar to waive the ₹2,500 fee".

### 4.2 Phase 2

- **F10. New card recommendation.** Simulate each catalog card added to the user's wallet and rank them by NAV gain.
- **F11. Reminders.** Due dates, statement dates, fee renewal dates, milestone deadlines and caps about to reset.
- **F12. Utilization.** Per-card and overall utilization, with an alert above 30%.
- **F13. Interest-free period.** Show which card gives the longest interest-free period for a purchase made today, based on statement date.
- **F14. Statement import.** Parse PDF statements to auto-create expenses and auto-categorize by merchant or MCC.
- **F15. Offers.** Bank or merchant offers with expiry dates, such as "10% off on Swiggy with HDFC on Fridays".
- **F16. Mobile app or PWA** for checking at the point of sale.

### 4.3 Phase 3 (optional)

- SMS or email parsing to capture transactions automatically.
- Account Aggregator integration (India) for automatic data.
- Browser extension that suggests the card at checkout, like Kudos.
- Community-maintained card rules with an admin review step.

---

## 5. Reward rule model (core of the system)

A card has many **RewardRules**. Each rule has these fields:

| Field | Example |
|---|---|
| `category` / `merchant_list` / `channel` | Dining, [Swiggy, Zomato], online |
| `rate_type` | `percent_cashback` or `points_per_amount` |
| `rate` | 5 (%) or 4 points per ₹150 |
| `point_value` | ₹0.25 per point; depends on redemption |
| `cap_amount` + `cap_period` | ₹1,000 per statement cycle, or 5,000 points per month |
| `min_txn_amount` | ₹100 |
| `excluded` | true for Rent, Fuel, Wallet, Insurance, Govt |
| `valid_from` / `valid_to` | Rules change, so keep a history |
| `priority` | A merchant rule overrides a category rule, which overrides the base rate |

Other card-level fields:
- **Milestones:** for example, spend ₹1L in a quarter for 10,000 bonus points.
- **Fee waiver:** for example, spend ₹2L in the card year to waive the fee.
- **Forex markup:** for example, 3.5%, which is subtracted from the international return.

**Effective return** for a transaction on a card:
```
reward  = min(amount × rate × point_value, remaining_cap)   (0 if excluded or below min_txn)
cost    = forex_markup × amount  (if international) + surcharge (if any)
return  = reward − cost
```

---

## 6. Optimization logic

1. **Best card for one purchase (F6):** compute the effective return on every user card, taking into account how much of each cap is already used this cycle, and sort.
2. **Optimal allocation for a period (F8, F9):** go through expenses in date order and give each one to the card with the highest effective return. Update cap usage as you go. Greedy is good enough for an MVP. Integer programming can come later to handle milestones properly.
3. **Marginal value per card:** run step 2 with all cards, then once more with each card removed, and take the difference. Cost is N+1 simulations, which is cheap for N ≤ 20.
4. **New card recommendation (F10):** run step 2 with the wallet plus each catalog card, and rank by NAV gain.
5. **Milestones and fee waivers:** after the greedy pass, check whether moving spend to a card that is close to a milestone or waiver gives more value. If so, recommend it, for example: "Put the next ₹15,000 on Card B to unlock a ₹1,500 bonus".

---

## 7. Data model (draft)

```
User(id, name, email, currency, country)
Bank(id, name)
CardProduct(id, bank_id, name, network, annual_fee, joining_fee, fee_waiver_spend, forex_markup, point_value_default)
RewardRule(id, card_product_id, category_id?, merchant_id?, channel?, rate_type, rate, point_value?, cap_amount?, cap_period?, min_txn?, excluded, priority, valid_from, valid_to)
Milestone(id, card_product_id, spend_target, period, bonus_value)
Benefit(id, card_product_id, type, quantity, value_per_unit)
UserCard(id, user_id, card_product_id, nickname, last4?, credit_limit, statement_day, due_day, anniversary_month, active)
Category(id, name, parent_id?, user_id? /* null = system */)
Merchant(id, name, category_id, mcc?)
Expense(id, user_id, amount, date, category_id, merchant_id?, channel, user_card_id?)
BenefitUsage(id, user_card_id, benefit_id, date, quantity)
```

---

## 8. Non-functional requirements

- **Security and privacy:** no full card numbers or CVVs (stay outside PCI scope), passwords hashed with bcrypt or argon2, HTTPS, per-user data isolation, data export and account deletion.
- **Accuracy:** each card rule has a "last verified" date and a link to the source T&C. Show a "rules may have changed" disclaimer.
- **Performance:** a best-card lookup should take under 200 ms. A yearly simulation for 10 cards and 5,000 expenses should take under 2 s.
- **Testability:** the reward engine is a pure function with unit tests for every rule type (caps, exclusions, milestones).

---

## 9. Suggested tech stack (adjust to your skills)

- **Frontend:** Next.js (React) with Tailwind, built as a PWA so it works on mobile.
- **Backend:** Next.js API routes or NestJS/Express (Node + TypeScript).
- **Database:** PostgreSQL with the Prisma ORM.
- **Auth:** NextAuth / Auth.js.
- **Charts:** Recharts.
- **Reward engine:** a standalone TypeScript module (`/engine`) with no database dependency, so it is easy to test and reuse in a mobile app later.

---

## 10. Milestones

| Phase | Scope | Rough effort (1 dev) |
|---|---|---|
| 1a | Auth, card catalog + admin, my cards, categories | 1–2 weeks |
| 1b | Expenses + CSV import, reward engine + tests | 2 weeks |
| 1c | Best-card lookup, cheat sheet, card review (NAV), dashboard | 2 weeks |
| 2 | New card recommendation, reminders, utilization, statement PDF import | 3–4 weeks |
| 3 | SMS parsing, Account Aggregator, browser extension | later |

**Seed data:** start with 15–20 popular Indian cards, such as HDFC Millennia, SBI Cashback, Amazon Pay ICICI, Axis Flipkart, Swiggy HDFC, IDFC First Millennia, HDFC Regalia Gold, Axis Atlas and AU LIT, so the engine can be tested on real rules.
