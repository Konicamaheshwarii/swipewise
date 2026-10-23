# Getting users' card lists and transactions automatically: options for Swipewise (India)

*Research date: 21 Oct 2026. Audience: founder and product team. This is not legal advice. Regulations, Play/Google policies and vendor terms in this area change often, so re-check anything marked **[verify]** before you commit to it.*

---

## TL;DR

**Short answer:** Not through a "Plaid for India" today. As of this research, **no bank in India shares credit card transactions through the Account Aggregator (AA) network**. The ReBIT/Sahamati standards define a Credit Card data type, but Sahamati's live activation tables list none. Fold's own help centre says the same: *"credit card data is not yet live on AA"*. Fold reads card-alert **emails** instead.

**What works today, roughly in order of how soon we can use it:**

| # | Route | What it gives us | Needs a licence / regulated partner? | Time to launch |
|---|---|---|---|---|
| 1 | **User uploads a statement (PDF/CSV/Excel), or a CSV exported from Fold, into Swipewise** | Full transactions with merchant descriptors; we categorise them | No | Days (import is already being built) |
| 2 | **Gmail link (read card-alert and statement emails)** | Near real-time transactions plus monthly statements | No, but needs Google restricted-scope verification and an annual CASA security assessment | 2–4 months |
| 3 | **SMS parsing (Android only)** | Transaction alerts | No, but needs a Google Play permission exception ("SMS-based money management") | 1–3 months, approval not guaranteed |
| 4 | **BBPS / Bharat Connect bill fetch via a partner** | Amount due, minimum/payable amount, due date, name. **No transactions** | Must be an Agent Institution under a bank COU; data-use limits | 1–3 months |
| 5 | **Credit bureau pull via a partner** | List of cards: issuer, limit, open date, balance, payment history. **No card variant, no transactions** | Partner plus explicit consent; RBI is tightening access by unregulated firms | 1–3 months, needs company and contracts |
| 6 | **Account Aggregator** | Bank-account transactions only. **Credit cards not live** | Must be (or sit behind) an RBI/SEBI/IRDAI/PFRDA-regulated FIU | 5–10 months |

**Recommendation:**
1. **Now (0–2 weeks):** Ship statement and CSV upload with auto-categorisation. Add bank-specific parsers for the top 6–8 issuers, handle password-protected PDFs in the browser, and support Fold CSV export. This is enough to test with real people.
2. **Next (1–3 months):** Build a **Gmail connector** that reads only card-alert and statement emails, which is the route Fold and CRED use. Start Google OAuth verification and CASA early. Optionally, work through a partner on a **bureau pull** to pre-fill "which cards do you hold?" (the user still picks the card variant).
3. **Later:** Add **BBPS bill fetch** for due-date reminders once we have a company, and only if the data-use rules fit. Revisit **AA** when issuers go live with the credit card data type; watch Sahamati's activation table. Becoming an FIU needs a regulated entity, which a small startup should not chase now.

---

## Can we connect Fold?

**No, not directly, and we shouldn't try to.**
- Fold has **no public or partner API and no webhooks** that we could find. A third-party GitHub/Mintlify page describes calling `api.fold.money` with an OTP login. That is an **unofficial, reverse-engineered** route. Using it would mean handling users' Fold sessions, would likely breach Fold's terms, and would break without warning. **Do not build on it.**
- **What does work:** according to Fold's help centre, users can **export their transactions as CSV from the Fold web app** (view.money): one combined bank-and-card file, plus a card-only file. Fold said Excel/PDF export was "planned". **[verify]** the current columns, in particular whether Fold's categories and tags are included. Ask the founder to export his own file and send it over.
- **How Fold gets its data:** bank accounts come through **Account Aggregator, with Finvu as the AA partner** (Fold ToS, third-party services). Credit cards come from **parsing card-transaction emails in Gmail**, because "credit card data is not yet live on AA" (Fold help centre). Fold is run by Lunchbrake Classic Pvt Ltd.
- **Takeaway:** a Fold user can export a CSV and upload it to Swipewise. That is legitimate and good enough for testing. Supporting "Fold CSV" as a named import format is worth doing.

## Can we connect CRED?

**No.** CRED has **no public API, partner programme or user data export** that we could find **[verify by asking CRED directly; this is unlikely to change]**. Scraping or automating the CRED app would need users' CRED credentials or session, which means ToS and security risk. We could not retrieve CRED's terms text to quote a specific clause **[unverified]**, but assume automation is prohibited.

How CRED itself gets data, from public and partly dated sources:
- **Card list:** when you add cards, CRED historically pulled the cards linked to your mobile number (2018 YourStory: "verifies … details … to fetch your card details"). This is widely understood to be a **credit-bureau** lookup, and reviews mention Experian/CRIF scores. The user then confirms the full card number. **[CRED's current mechanism is unverified.]**
- **Statements and bill amounts:** "Smart Statements" reads **card statement emails through Gmail** with explicit permission. CRED's privacy page says its "use of Google APIs is … compliant with their data policy", which implies Google restricted-scope verification. Forum users report SMS reading too.
- **Paying bills:** since 1 Jul 2024, credit card bill payments through third-party apps go over **BBPS** (see below).
- **Takeaway:** everything CRED does is either open to us (Gmail, bureau via a partner, BBPS via a partner) or tied to CRED's scale and licences. CRED is evidence that **Gmail + bureau + BBPS** is the workable stack in India.

## How to test with real people this month (checklist)

- [ ] **Raw statement import (in progress):** accept CSV/XLS/XLSX/PDF. Auto-detect Date / Narration / Dr-Cr or Amount columns. Auto-categorise descriptors and let the user correct them, then store their correction rules.
- [ ] **Named presets** for the top issuers' net-banking downloads: HDFC, ICICI, SBI Card, Axis, Kotak, AMEX, IDFC First, plus **Fold CSV**. Collect 2–3 real (redacted) samples of each from testers.
- [ ] **Password-protected PDFs:** prompt for the password and decrypt **in the browser** (for example with pdf.js), so neither the password nor the raw PDF reaches our server. Show a hint of the bank's password format (see section 3).
- [ ] **Card list:** keep manual add, and pre-suggest the card from the statement header (issuer and last 4 digits). The user picks the variant (e.g. "HDFC Regalia Gold").
- [ ] **Consent and privacy for testers:** a one-screen notice covering what we store, why, how long, and how to delete. Add a "delete all my data" button. Default to **storing only parsed transactions, not the PDF**. Mask card numbers to the last 4 digits.
- [ ] **Recruit 10–30 testers.** Ask them to upload 3 months of statements and compare our categorisation and rewards maths against reality.
- [ ] **For development only:** register for an **AA sandbox** (Setu Bridge, OneMoney/Moneyone developer portal, or the Finvu sandbox) to learn the consent flow on **mock data**. **Sandboxes do not give real-user data.** Real data needs production go-live as (or behind) a regulated FIU. No provider we found offers a "test with real users" pilot to an unregulated startup **[verify with Setu: aa@setu.co]**.
- [ ] **Don't:** scrape Fold/CRED/bank portals, ask for net-banking passwords, or ship READ_SMS before Play approval.

---

## 1. Account Aggregator (AA): RBI / Sahamati

**Status of credit cards**
- A **Credit Card FI type exists in the standards.** Sahamati's GitHub (`schemas/credit_card/`) and Sahamati's FIP onboarding guide both use "credit card account" as an example FI type. Every FI schema has Profile, Summary and Transactions sections.
- **Credit cards are not activated anywhere we could find:**
  - Sahamati's *Data (FI types) available on AA* page (25 FI types, last updated Dec 2024) does **not list credit cards**.
  - *FI types activated by non-banking FIPs* (updated 29 May 2026): no credit card.
  - *Account types activated by banks*: savings accounts, sole-proprietor current accounts (which "include CC/OD facility types", meaning cash-credit/overdraft, **not** credit cards), and term and recurring deposits.
  - Setu's AA docs list supported test FI types: DEPOSIT, TD, RD, MF, ETF, EQUITIES, NPS, INSURANCE, GSTR. No credit card.
  - Fold's help centre explicitly states that card data is not live on AA.
- **So we cannot confirm which fields would come back** (MCC? card variant?) **or how far back the history goes**, because no issuer serves it. **[unverified: check the `credit_card` XSD on GitHub/ReBIT if we want to plan ahead.]** For deposits, history depends on the FIP and the requested date range; often 6–12+ months.
- **Ecosystem size (June 2026, Sahamati):** 176 FIPs, about 1,020 FIUs, 17 operational AAs. RBI recognised Sahamati as the AA **Self-Regulatory Organisation** in June 2026. AA interoperability changes are expected by 31 Dec 2026 (MediaNama, Oct 2026).

**Consent UX (deposits today):** the FIU redirects the user to the AA (e.g. Finvu/OneMoney). The user logs in or creates an AA handle with a mobile OTP, discovers accounts at their bank with a bank OTP, and approves a consent stating purpose, FI types, date range, frequency and expiry. Data is then pushed to the FIU encrypted. Fold reports AA is "young and error-prone": joint accounts are unsupported and some data is missing or duplicated.

**Who can be an FIU**
- Sahamati: the FIU **must be regulated by RBI, SEBI, IRDAI or PFRDA**, and "every entity needs to be a FIP first, then an FIU" (if it holds financial information). Steps: build to the ReBIT spec, test in a sandbox, enrol in the UAT Central Registry, get certified by a Sahamati-empanelled auditor, then list in the Central Registry.
- **TSPs** (Setu, Finarkein, Moneyone, FinBox, etc.) build and run the FIU module, but **they do not make an unregulated company an FIU**. An unregulated startup can only get AA data **through a regulated partner who is the FIU** (e.g. a partner NBFC), and the partner's use case and licence must cover it. For PFM/rewards optimisation that is a hard sell. **[verify with any prospective partner]**
- Ongoing (per CASParser, Mar 2026, vendor source): quarterly self-tests and an IS audit every two years. Industry estimate of ₹5–25 lakh first-year cost. 5–10 months to integrate.

**Providers (indicative; FIP counts per HyperVerge, May 2026, vendor blog)**

| AA / TSP | Notes |
|---|---|
| Anumati (Perfios) | About 80+ live FIPs |
| CAMS Finserv AA | About 70+ |
| OneMoney (FinSec AA) / Moneyone (TSP) | About 65+. Self-serve developer portal with test FIU ID and API key in "Test" mode |
| Finvu (Cookiejar) | About 60+. Sandbox at finvu.github.io/sandbox. Fold's AA |
| NADL | About 60+ |
| Setu AA (Pine Labs) | Multi-AA gateway. Self-serve sandbox on "The Bridge" with a mock FIP. Production keys only after go-live. Certification (via Aujas) billed by Setu |
| Protean SurakshAA, Saafe, Finarkein (TSP) | Smaller or TSP players |

**Pricing:** not published. Market reports put it at "a few rupees to tens of rupees per consent/pull", or subscriptions "in the lakhs per month" at scale, plus TSP integration fees. **[ask for rate cards]**

## 2. Credit bureau pull (CIBIL, Experian, Equifax, CRIF High Mark)

- **Fields for each credit card account** (CIBIL report guides): member name (the **issuing bank**), account type ("Credit Card"), ownership, masked account number, **date opened**, **credit limit**, high credit, current balance, amount overdue, date reported, up to 36 months of payment history, and closed status. **No card variant or product name** (e.g. "Regalia Gold"). **No transactions.** So a bureau pull tells us *"you have HDFC, Axis and SBI cards with these limits"*, and the user must still pick the variant.
- **Who can access:** under CICRA, "specified users" (banks, NBFCs and other RBI-authorised entities) pull reports. Consumer apps (OneScore with Experian, CRED, Paytm) show reports through **consumer-consent partnerships with a bureau**, usually with **mobile OTP plus explicit consent**. RBI's Jan 2025 credit-reporting Master Direction sets rules for sharing with third parties on consent: CICs must vet the third party, data is for the agreed purpose only, and no resale. Earlier, RBI told lenders to stop giving unregulated entities bureau access. **Expect due diligence and a company entity. A pre-incorporation startup will not qualify.** **[verify current CIC directions]**
- **Partners that resell or aggregate:** Signzy, Setu, Bureau, Perfios, Decentro, Surepass and others (FinBox overview). Pricing is **not public**: usage-based, per pull. Ask each of them. Whether they will serve a **non-lending PFM use case** is the key question. **[unverified]**
- **Fit for Swipewise:** good for **auto-listing which banks' cards the user holds**, not for spend data.

## 3. Email (Gmail API)

- **Scope:** reading mail (`gmail.readonly`) is a **restricted scope**. For a public app that means **Google OAuth verification plus an annual CASA security assessment** by a Google-approved lab (TAC Security, DEKRA, Leviathan, Bishop Fox, …). Google assigns assurance level AL1 or AL2 and you must re-certify every year.
- **Cost and time:** about **US$500–4,500 a year** for the assessment (DeepStrike; TAC lists Tier 2 at roughly $540–1,800). Budget **6–12 weeks** in total including fixes. One vendor quotes $15k–75k, which seems to include remediation and consulting, so treat it as an upper bound. We must also comply with Google's **Limited Use** policy: no ads, no selling, and humans read the data only with consent or for security.
- **Before verification:** an app in "Testing" mode works for **up to 100 listed test users**. That is enough for a pilot. Published-but-unverified apps show a "danger" screen and have a **lifetime 100-user cap** on the project.
- **Lower-friction alternative:** ask users to **auto-forward card alerts and statements** to a Swipewise inbox (e.g. `u123@in.swipewise.app`). This needs no Google scope at all. CRED users already do this to limit CRED's access.
- **Parsing:** card-alert emails (per transaction: amount, merchant, last 4 digits, time) are easy to regex. That is what Fold does. Statement PDFs are **password-protected**. Typical formats, all from secondary sources **[verify on each bank's email]**:
  - HDFC card: first 4 letters of the name in capitals + last 4 card digits (e.g. `RAJE3456`).
  - Axis / HDFC accounts: first 4 letters of the name + DOB as DDMM.
  - SBI Card: often DOB plus last 4 card digits, but sources conflict.
  - ICICI: format not confirmed.

  The bank's email usually states the format. Ask the user once and store nothing beyond what's needed (or derive the password client-side).

## 4. SMS parsing

- **Android:** Google Play's SMS/Call Log policy now lists **"SMS-based money management"** (READ_SMS / RECEIVE_SMS, e.g. "apps that track and manage budget") as a permitted exception. It must be a **core function**, declared in the Play Console and reviewed. Budgeting apps "may not exfiltrate … non-financial or personal SMS". Approval is case-by-case. Older reports (Bluecoins, 2019) show rejections, so plan for review back-and-forth. A web app (Swipewise today) would need a native Android app first.
- **iOS:** third-party apps **cannot read SMS**. Not possible.
- **Others:** Walnut/axio and Money View historically relied on SMS. CRED reportedly reads SMS as well.

## 5. Statement-analysis APIs

- **Perfios:** has a **Credit Card Statement Analyser** (extraction, categorisation, validation; API or batch).
- **Signzy:** bank statement analysis, and claims a single API covering credit card and bank statements.
- **FinBox BankConnect, Arya.ai, Advance.ai, KYCKart:** bank-statement focused. Card support is **[unverified]**.
- **Pricing:** never public. Per statement, per page or per entity, sold to lenders. Usually priced for lending volumes and needs a company KYC.
- **Open source:** e.g. `xfina` (PyPI; parses Indian card statements including ICICI) and various GitHub parsers using pdfplumber + regex.
- **For Swipewise:** our own parser plus an LLM fallback for unknown layouts is probably cheaper and faster than a vendor at our stage. Revisit if accuracy across issuers becomes a problem.

## 6. BBPS / Bharat Connect credit card bill fetch

- **Background:** RBI's BBPS direction (2024) routed third-party credit card bill payments through BBPS from **1 Jul 2024**. By July 2024 about **15 major issuers** were live, covering about 80–85% of cardholders (ICICI, SBI Card, Kotak, BoB, IndusInd, HDFC; Axis and Yes "soon"). **[Current 2026 list unverified: pull it from a partner's biller-list API.]**
- **What a fetch returns** (Setu "Fetched Bill" object): `customerName`, `amount` (bill amount), `billDate`, `dueDate`, `billNumber`, `billPeriod`, `minAmount`/`maxAmount` (payable range; for cards often maps to the minimum due), and biller-specific `additionalInfo`. **No transactions. No card variant.** One bank FAQ notes the amount is the **last statement amount**, not the live outstanding.
- **Inputs:** typically the **registered mobile number + last 4 card digits**. NBBL requires the **first fetch to be authenticated** (OTP) and fetches and reminders to need **explicit, time-bound consent with opt-out**.
- **Who can do it:** you must be an **Agent Institution (AI)** sponsored by a **Customer Operating Unit (COU)**, usually a bank, reached via TSPs such as Setu, Cashfree, Razorpay, PayU, BillDesk or Euronet. Banks ask for company KYC, financials or ITRs and promoter checks. There is no net-worth requirement for agents. Cashfree and Setu offer sandboxes, and pricing is negotiated **[not public]**.
- **Data-use limit (important):** NBBL circular NPCI/2024-25/BBPS/005 (15 Aug 2024) and its reiteration NPCI/2026-27/BBPS/006 (9 Jun 2026) say BBPS customer data **may be used only for transaction processing and customer service within BBPS**, *"shall not be used … for any marketing, cross-selling or promotional activities"*, and **must not be used outside the BBPS framework**. Sensitive data (full card number, OTPs, balances) cannot be stored even encrypted.
- **Honest assessment:** BBPS is designed for **paying** bills. Using bill fetch *only* to power reminders and rewards analytics without offering payment is likely **outside** the intended use, and recommending card upgrades from it could count as cross-selling. It is feasible **if Swipewise also offers bill payment** (become an AI) and keeps the fetched data inside that flow. Even then, it gives due dates and amounts, not spend categories. **Medium value, medium compliance risk. A phase-3 item; confirm with the COU partner.**

## 7. What comparable apps do

| App | Card list | Card transactions / bills | Source |
|---|---|---|---|
| **Fold** | User links cards | **Gmail card-alert emails**; banks via AA (Finvu) | Fold help centre, ToS |
| **CRED** | Cards linked to mobile number (bureau-style lookup) + user verifies | **Gmail statements** ("Smart Statements"), SMS reported; payments via BBPS | YourStory 2018, forums, CRED privacy page (dated or partial) |
| **Jupiter** | Advertises "track 10+ credit cards" | Mechanism not confirmed (likely email/SMS/BBPS) **[unverified]** | jupiter.money |
| **OneScore** | **Experian/CIBIL report** (consumer consent) | None | Experian 2019 press release |
| **Walnut/axio, Money View** | From SMS | **SMS parsing** | cardtrail.in blog |
| **Kiwi** | Not researched successfully **[unverified]** | | |

**Pattern:** nobody gets card transactions via AA today. The working routes are **email**, **SMS** and **user upload**, with **bureau** for the card list and **BBPS** for bill amounts.

---

## 8. Comparison table

| Route | Data we get | Effort | Cost | Time to launch | Compliance burden | User friction |
|---|---|---|---|---|---|---|
| **Statement / CSV upload** (incl. Fold CSV) | Full transactions + descriptors; card from header | Low–Med (parsers per bank) | ~0 | **Days** | Low (DPDP basics) | Medium: monthly manual upload, PDF password |
| **Email forwarding to Swipewise inbox** | Alerts (real-time) + statements | Medium | Low (inbound mail service) | 2–4 weeks | Low–Med | Low after a one-time filter setup |
| **Gmail API connector** | Same, automatic, plus history backfill | Medium | ~$0.5–4.5k/yr CASA + engineering | 2–4 months (≤100 test users immediately) | Medium: Google verification, Limited Use, annual audit | **Low**: one OAuth click (scary permission screen) |
| **SMS (Android app)** | Transaction alerts | Medium (needs a native app) | Low | 1–3 months + Play review | Medium; Play may reject | Low on Android; **impossible on iOS** |
| **Credit bureau via partner** | Card list: issuer, limit, open date, balance. No variant, no transactions | Low (API) | Per-pull fee (₹ tens?) **[verify]** | 1–3 months (contracts, KYC) | Med–High: consent, CIC rules, partner diligence | Low: OTP |
| **BBPS bill fetch via COU/TSP** | Bill amount, min/payable, due date, name. No transactions | Medium | Negotiated **[verify]** | 1–3 months | **High-ish**: AI onboarding; data restricted to BBPS purposes | Low: mobile + last 4 + OTP |
| **Statement-analysis vendor** (Perfios etc.) | Parsed + categorised transactions | Low | Per-statement, lender pricing | 1–2 months (sales cycle) | Low–Med | Same as upload |
| **Account Aggregator** | Bank-account transactions only (**cards not live**) | High | ₹5–25 lakh yr 1 (estimate) + per pull | 5–10 months | **High**: must be or partner with a regulated FIU | Low–Med: AA handle + OTPs |

## 9. Roadmap

**Phase 0 – now (no licence, no company paperwork needed)**
- Statement/CSV/Excel upload with bank presets and Fold CSV. Client-side PDF unlock. Auto-categorisation with user-correctable rules. Infer the card (issuer + last 4) from statements and ask for the variant.
- Optional: an email-forwarding address for alerts and statements.

**Phase 1 – 1–3 months (company + Google verification)**
- Gmail connector: narrow queries (sender allow-list of bank alert domains), read-only, parse, discard raw mail. Apply for OAuth verification and CASA early. Run the beta with ≤100 test users meanwhile.
- Talk to 2–3 bureau aggregators about a consumer-consent "list my cards" pull for a non-lending use case.

**Phase 2 – 3–6 months**
- Android app with SMS parsing, only if the Play exception is granted.
- BBPS: only if we also want to offer bill payment. Choose a COU/TSP (Setu, Cashfree, Razorpay, PayU) and confirm the data-use limits in writing.

**Phase 3 – watch**
- AA credit card FI type going live (check Sahamati activation tables quarterly). If it does, partner with a regulated FIU or TSP rather than becoming one.

**Needs a company / regulated partner:** bureau pulls, BBPS (Agent Institution under a COU), AA (regulated FIU), statement-analysis vendors (company KYC), and Google verification in practice (a verified domain and privacy policy).

## 10. DPDP Act 2023: what applies to us

- **Timeline:** the DPDP Rules were notified on 13–14 Nov 2025. Consent-manager provisions start about 13 Nov 2026. The **core obligations** (notice, consent, security, breach reporting, erasure) apply from about **13 May 2027**. The IT Act's SPDI Rules apply until then. **[verify exact dates in the Gazette]** Build for DPDP now. It is cheap at this stage.
- **Consent and notice:** a clear, itemised notice in plain language (English plus Indian languages on request) covering the data we collect (transactions, card last 4 digits, email contents if Gmail is linked), the purpose (spend analysis and card recommendations), and how to withdraw consent. Withdrawing must be as easy as giving consent.
- **Purpose limitation:** use transaction data only for the stated purpose. No ads or resale. This also follows from Google Limited Use and the BBPS rules.
- **Data minimisation:** store parsed fields (date, amount, merchant, category, card last 4), not raw PDFs or emails. Never store full card numbers, CVV, OTPs or statement passwords.
- **Retention and deletion:** delete when the purpose is served or consent is withdrawn. Provide a "delete my account and data" control. Erase inactive users' data after a defined period, and notify them before erasure (the Rules set timelines for some classes of fiduciary). **[verify]**
- **Security and breach:** reasonable safeguards (encryption at rest, access logs, retain logs for 1 year per the Rules **[verify]**). Report breaches to the Data Protection Board and to affected users.
- **Grievance:** publish a contact for data-protection queries. Respond to access, correction and erasure requests.
- **Children:** verifiable parental consent for under-18s. Simplest is to restrict sign-up to 18+.

---

## Fastest way to test with your own cards (personal / pilot)

*Added 21 Oct 2026. Question: "For testing, how can I get my own cards (6–10 cards across several issuers) and monthly spend into Swipewise without typing them in?" This builds on sections 3–5 and only covers what is different when the only user is you (or a handful of testers).*

### Ranked options, fastest first

| # | Option | Setup time | What you get | Covers | Ongoing effort |
|---|---|---|---|---|---|
| 1 | **Fold CSV export → existing CSV import** | ~15 min (plus a "Fold" column preset if the auto-mapper misses) | Past transactions for every card Fold tracks: date, amount, merchant/description, card/account; Fold's category/tags **[columns unverified]** | All cards Fold already sees (Fold reads the same Gmail alerts) | Re-export monthly |
| 2 | **Google Apps Script in your own Gmail → POST to a Swipewise webhook** | 1–2 h for the script + 1–2 days for per-bank parsers | Per-transaction alerts: amount, merchant text, card last 4, date/time. Can backfill by searching old mail | Banks that send email alerts (Axis, HDFC, ICICI, SBI Card likely; HSBC India **probably SMS only**) | None (time trigger every 15 min) |
| 3 | **Gmail API connector in Swipewise (OAuth, unverified app, you as test user)** | ~½ day Google Cloud setup + 3–5 days build | Same as #2, plus statement emails/PDF attachments; **this is the code path that becomes the product** | Same as #2 | Re-consent every 7 days while in "Testing" (see below) |
| 4 | **Gmail filter auto-forward → Swipewise inbound address** (Cloudflare Email Workers / Postmark / Mailgun) | 2–4 h infra + same parsers | Same alerts as #2, new mail only (no backfill unless you forward old mails by hand) | Same as #2 | None |
| 5 | **Monthly statement PDF upload** (already planned) | Parsers per bank: days | Full, authoritative monthly list incl. fees/refunds; card last 4 from header | **All** issuers incl. HSBC | Monthly upload + password |
| 6 | **SMS: Cashiro (open-source Android app on F-Droid) → CSV export → import** | ~30 min | Transactions parsed from bank SMS on the phone, exported as CSV | Fills the HSBC gap; anything SMS-only | Export monthly |
| 7 | **Own sideloaded SMS-reader APK posting to Swipewise** | 1–2 weeks | Real-time SMS alerts | Android only | Maintain an app |
| – | **Personal open-banking API / AA "for myself"** | — | **None exists.** AA has no live credit-card FI type (section 1); AA sandboxes only serve mock data; there is no personal access-token scheme for Indian card data | — | — |

**Recommendation:** do **#1 today** (and **#6** if HSBC is missing from Fold) to get real data into the app this week. In parallel, build **#3, the Gmail connector**, because it is the same code we will later put through Google verification for real users. If you want zero OAuth/token plumbing first, **#2 (Apps Script)** gets the same alert data flowing in an afternoon and its parsers carry over to #3 unchanged. Treat **#5 (statement PDFs)** as the monthly source of truth for reconciliation (refunds, fees, missed alerts).

### What the Gmail rules actually are for personal / test use (verified against Google docs)

- **No verification or CASA is needed** while the app is used only by you and listed testers. Google: *"Apps in development/testing/staging mode are not subject to verification"* and personal-use apps (<100 users) can keep running unverified; users click through the "Google hasn't verified this app" warning. Cap: **100 users per project, lifetime**.
- **"Internal" user type is not available to you** unless the founder's mail is on a Google Workspace domain; for a personal @gmail.com you must use **External**.
- **7-day token expiry:** with publishing status **Testing**, Google issues refresh tokens that **expire after 7 days** (except for basic identity scopes). So a Testing-mode connector needs a "Reconnect Gmail" click weekly.
  - Workaround **[verify]**: set publishing status to **In production** but do **not** submit for verification. The app stays "unverified" (warning screen, 100-user cap) but refresh tokens should not hit the 7-day expiry. Google's personal-use exemption suggests this is allowed; confirm in the console before relying on it, and re-consent after switching (existing tokens keep the old expiry).
- Google allows **100 refresh tokens per Google account per OAuth client**; the oldest is silently invalidated beyond that (irrelevant for one user, but do not mint a new token on every login).
- Even unverified, the app must follow the **Google API Services User Data Policy / Limited Use** (no ads, no resale, no human reading).
- **Apps Script (#2)** runs as you inside your own account, so Swipewise never holds a Google token. You still see the unverified-app warning once at authorization. Consumer-account Apps Script quotas (trigger runtime, Gmail reads/day) are ample for one inbox **[verify current quota numbers]**.

### Do issuers email every card transaction? (mostly unverified: confirm from your own inbox)

| Issuer | Per-transaction email? | Likely sender(s) | Notes |
|---|---|---|---|
| **Axis** | Yes, widely reported | `alerts@axis.bank.in` (transactional, per Axis RBI notice booklet); statements from `cc.statements@axis.bank.in`. Older mail from `alerts@axisbank.com` | Axis moved to `.bank.in`; filters must include both domains |
| **HDFC** | Yes for most cardholders; forum users report occasional gaps | `alerts@hdfcbank.net` / `alerts@hdfcbank.bank.in` **[unverified]** | HDFC says card alerts are regulatory and separate from InstaAlerts; email alerts free. Check email ID is registered |
| **ICICI** | Yes, widely reported | `credit_cards@icicibank.com` **[unverified]** | Forum sample: *"Your ICICI Bank Credit Card XX1234 has been used for a transaction of INR 45.44 on Jul 12, 20xx at 12:14:30. Info: MERCHANT."* |
| **SBI Card** (incl. PhonePe SBI SELECT BLACK, SBI Cashback) | Reported yes (secondary source) | `onlinesbicard@sbicard.com` **[unverified]**; statements `Statements@sbicard.com` **[unverified]** | Sample (complaint site): *"Rs.7,651.00 spent on your SBI Card ending with 8968 at MERCHANT on 14/07/21."* SBI Card is an NBFC, so it may not move to `.bank.in` |
| **HSBC India** (Live+) | **Probably not**: HSBC India's alert T&Cs describe alerts as **SMS** | — | Use SMS (#6) or statement PDF (#5) for HSBC |

- **RBI `.bank.in` migration:** RBI told banks to move to `.bank.in` domains by 31 Oct 2025; some banks still send from legacy domains. **Do not hard-code one sender per bank.** Do a one-off discovery search in your own Gmail (e.g. `("credit card" (spent OR debited OR "used for" OR "transaction")) newer_than:60d`) and record the real senders and templates.
- **Enabling alerts:** RBI requires card transaction alerts; SMS is guaranteed, email depends on a registered email ID. If a bank's emails are missing, update the email in net banking/app; there is no single "email alerts" toggle that we could confirm for any of these issuers **[unverified]**.
- **Security:** anyone can send an email that *looks* like a bank alert. Only accept mail whose `From` domain is on the allow-list and, for Gmail API/Apps Script, check the `Authentication-Results` header shows **DKIM/DMARC pass** for that domain.

### Statement PDFs and CSV downloads (for #5)

- **Passwords (secondary sources; conflicts flagged; the statement email usually states the format):**
  - **SBI Card:** DOB `DDMMYYYY` + last 4 card digits (12 digits) per two sources; Adobe's guide says name + DDMM. **Conflict.**
  - **HDFC card:** first 4 letters of name (CAPS) + last 4 card digits (ClearTax) vs first 4 letters (lower) + DDMM (Adobe). **Conflict.**
  - **Axis card / ICICI card / HSBC India card:** no reliable source found **[unverified]**. (HSBC in other countries uses card-derived passwords, not DOB, so do not assume.)
  - Keep the plan from section 3: ask the user, unlock **in the browser** (pdf.js), never send or store the password or raw PDF.
- **CSV/Excel downloads:** no issuer documentation found. Forum reports: SBI Card offers up to 24 months of transactions as **PDF only** on the website; HDFC's app offers past statements month by month. Whether HDFC/ICICI net banking still offer XLS for unbilled/billed card transactions is **[unverified]**: check in each portal and add a preset if one exists.

### Fold and CRED (for #1)

- **Fold:** the web app at **view.money** exports **CSV only**: one unified bank-and-card file plus a **separate credit-card-only file** (Fold help centre; Excel/PDF "planned"). The help page does not list columns, so whether Fold's categories/tags and card last 4 are included is still **[unverified]**: export once and inspect. Our importer already maps `category`/`tag`/`tags` and `card`/`account`/`source` headers, so it may work with no change.
- **CRED:** no transaction or statement export found. "Smart Statements" show analysis in-app only. **Not a route.**

### Step-by-step plan: Option 1 (today, ~1 hour)

1. In Fold web (view.money) export the **credit-card-only CSV** for the last 3–6 months.
2. Import it through the existing Expenses → Import flow. If columns don't auto-map, add a **"Fold CSV" preset** (header synonyms only) in `src/app/app/expenses/import-utils.ts`.
3. Make sure each card exists in the wallet with its **last 4** (`UserCard.last4`), so the `card` column can map rows to cards.
4. If HSBC (or any card) is missing in Fold: install **Cashiro** from F-Droid, grant SMS read, let it parse, **Export as CSV**, import the same way. (Android 13+ may require "Allow restricted settings" for sideloaded SMS apps **[verify]**.) Remove the app afterwards if you don't want it holding SMS access.

### Step-by-step plan: Option 3 (Gmail connector, ~1 week) — Option 2 is the same parsers in Apps Script

**Google Cloud setup (≈1–2 h):**
1. New Google Cloud project "swipewise-dev" (keep it separate from the future production project). Enable **Gmail API**.
2. OAuth consent screen: **External**, app name, support email, add your Gmail as a **test user**. Scope: **`https://www.googleapis.com/auth/gmail.readonly` only** (least privilege; `gmail.metadata` cannot read bodies, and we need bodies). Leave status **Testing** (or try "In production, unverified" to avoid weekly re-consent [verify]).
3. Create an OAuth **Web client**; redirect URI `http://localhost:3000/api/gmail/callback` (+ the deployed URL). Put client ID/secret in env, never in the repo.

**What Swipewise needs to build:**
1. **OAuth routes**: `/api/gmail/connect` (offline access, `prompt=consent`) and `/api/gmail/callback`. Store **only the refresh token**, encrypted at rest (AES-GCM with a server key from env), in a new `GmailConnection` row per user (email, encrypted token, `lastHistoryId`, `lastSyncAt`). Add **Disconnect** = revoke token at Google + delete row. Handle `invalid_grant` by showing "Reconnect Gmail".
2. **Sync job** (button first, cron later): `users.messages.list` with a narrow query, e.g.
   `from:(axis.bank.in OR axisbank.com OR hdfcbank.net OR hdfcbank.bank.in OR icicibank.com OR icici.bank.in OR sbicard.com) newer_than:90d -in:spam`
   (refine the sender list from the discovery search above), then `messages.get` (format `full`) per new ID. Incremental runs: `newer_than:2d` or `users.history.list` from `lastHistoryId`. Deduplicate by Gmail message ID (store a hash of the ID, not the mail).
3. **Sender/auth check**: allow-listed From domain **and** DKIM pass in `Authentication-Results`; otherwise skip.
4. **Per-bank alert parsers** (pure functions, unit tested like `import-utils.test.ts`): one regex per bank template → `{ amount, currency, merchantText, last4, date, type: debit|credit|reversal }`. Ignore OTP, payment-received and promo mails. Collect 3–5 real samples per bank from your inbox (redacted) as test fixtures. Expect templates to change; log unmatched alert emails (subject + sender only) so we notice.
5. **Card mapping**: `last4` + issuer → `UserCard`; unknown last 4 → "Unassigned" bucket with a prompt "Which card ends in 1234?" (pre-suggest the issuer).
6. **Categorise**: run `categorize({ description: merchantText, currency })` from `src/lib/categorize.ts`, then write `Expense` rows through the same path as `importExpenses`, with source = `gmail` and the message-ID hash for dedupe.
7. **Statements (phase 2 of the connector)**: query `from:(cc.statements@axis.bank.in OR …) has:attachment filename:pdf`, but **don't decrypt server-side**. Either just notify "your Axis statement arrived — upload it", or download the attachment to the browser and unlock with pdf.js there.
8. **Privacy**: never persist raw email bodies, PDFs or passwords; keep only parsed fields + card last 4; log no email content; a "delete all Gmail-derived data" button; a short notice stating what is read and why.

**Option 2 variant (Apps Script, no token in Swipewise):** script.google.com → new project in your account → time-driven trigger every 15 min → `GmailApp.search(sameQuery)` → parse (or send the plain-text body) → `UrlFetchApp.fetch("https://<swipewise>/api/ingest/alerts", { headers: { Authorization: "Bearer <per-user secret>" }, payload })` → label the thread `swipewise/ingested`. Swipewise only builds the ingest endpoint (secret check, parsers, card mapping, `categorize()`, dedupe). Downside: it is a personal hack, not a product flow.

**Option 4 note (forwarding):** Gmail requires each forwarding address to be **confirmed via a link Gmail emails to it**, so the inbound handler must surface that first message (log it or show it in the app). Then create a Gmail filter (`from:(…allow-list…)` → *Forward it*). Forwarded mail loses the original DKIM context unless the provider preserves ARC, so spoofing checks are weaker. Use a random per-user address (`u_<random>@in.swipewise.app`). Cost: **Cloudflare Email Routing + Email Workers** is free on the Workers free plan (25 MiB message limit; CPU limits can bite on large mails); **Postmark inbound starts on its paid Pro plan (~$16.50/mo)** per pricing summaries **[verify]**; Mailgun/SendGrid inbound parse also work. Pros vs Gmail API: no Google scope, no tokens, no verification ever. Cons: no history backfill, extra setup per user, and alerts the user deletes or that skip the filter are lost.

---

## Things we could not confirm

- Whether **any** bank has a live **CREDIT_CARD** FI type on AA in Oct 2026 (all evidence says no). The field list of the ReBIT credit card schema (MCC? variant?).
- AA, bureau, BBPS and statement-analyser **pricing** (none public).
- Whether bureau aggregators will serve a **non-lending** consumer app, and the current CIC direction text on third-party access.
- The **current 2026 list** of credit card issuers live on BBPS, the exact response fields per issuer, and whether "fetch only, no payment" is allowed.
- **CRED's** current card-discovery mechanism and ToS text. **Jupiter's** and **Kiwi's** data sources.
- Exact columns of **Fold's CSV export** (do categories and tags come through?).
- Bank statement **password formats** (secondary sources, some conflicting).
- Exact **alert sender addresses and templates** for HDFC, ICICI and SBI Card (only Axis's `alerts@axis.bank.in` is from an issuer document), and whether **HSBC India** sends card alerts by email at all.
- Whether an **unverified "In production"** OAuth app avoids the 7-day refresh-token expiry for gmail.readonly in practice. Current **Apps Script** consumer quotas.
- Whether HDFC/ICICI/Axis net banking still offer **XLS/CSV** card transaction downloads.

## Sources

**Account Aggregator**
- Sahamati – Data (FI types) available on AA: https://sahamati.org.in/data-fi-types-available-on-aa/
- Sahamati – FI types activated by non-banking FIPs: https://sahamati.org.in/fi-types-activated-by-non-banking-fips-on-aa/
- Sahamati – Account types activated by banks: https://sahamati.org.in/account-types-activated-by-banks-on-aas/
- Sahamati – FIP-AA mapping: https://sahamati.org.in/fip-aa-mapping
- Sahamati – FIU page: https://sahamati.org.in/financial-information-user-fiu
- Sahamati – How to join the AA network: https://sahamati.org.in/how-to-join-the-account-aggregator-network-to-share-and-access-financial-data/
- Sahamati – TSPs: https://sahamati.org.in/tsp/fip-fiu-tsp
- Sahamati – RBI SRO recognition: https://sahamati.org.in/media-article/rbi-sro-recognition-account-aggregator-ecosystem/
- Sahamati – AA standards (GitHub): https://github.com/Sahamati/account-aggregator-standards
- MediaNama – AA interoperability (Oct 2026): https://www.medianama.com/2026/10/223-sahamati-bg-mahesh-rbi-account-aggregator-interoperability/
- Setu AA FI data types: https://docs.setu.co/data/account-aggregator/fi-data-types
- Setu AA quickstart: https://docs.setu.co/data/account-aggregator/quickstart
- OneMoney/Moneyone docs: https://docs.moneyone.in/tech/ , https://docs.onemoney.in/api
- HyperVerge – AA selection guide (May 2026, vendor): https://hyperverge.co/blog/best-account-aggregators/
- CASParser – State of AA 2026 (vendor): https://casparser.in/blog/state-of-account-aggregator-2026/
- DFS – AA framework: https://financialservices.gov.in/beta/en/account-aggregator-framework

**Fold / CRED / comparables**
- Fold – How Fold tracks credit card transactions: https://help.fold.money/hc/en-us/articles/17447765364114-How-does-Fold-track-my-credit-card-transactions
- Fold – Export to CSV: https://help.fold.money/hc/en-us/articles/17257745724178-Does-Fold-support-export-of-financial-data-from-Fold-in-an-Excel-PDF-or-CSV-format
- Fold ToS – third-party services (Finvu): https://docs.fold.money/terms-of-service/third-party-services
- Fold – known AA issues: https://docs.fold.money/known-issues-aa
- Unofficial Fold API write-up (do not use): https://www.mintlify.com/georgejohnsonoff-business/spendwiselygeorge/integrations/fold-money
- YourStory – CRED (2018): https://yourstory.com/2018/12/app-friday-kunal-shah-cred
- CRED privacy: https://cred.club/privacy
- Jupiter community thread on CRED email access: https://community.jupiter.money/t/regarding-cred-app/16039
- Jupiter: https://jupiter.money/money
- Experian–OneScore (2019): https://www.experian.in/2019/12/19/experian-india-builds-on-their-consumer-credit-education-journey-by-collaborating-with-fpl-technologies/
- cardtrail.in – card spend tracking apps: https://cardtrail.in/basics/credit-card-spend-tracking-apps-india/

**Bureau**
- CIBIL report guide (PDF): https://WWW.CIBIL.COM/content/dam/cibil/consumer/CIBIL-Report-Understanding1.pdf
- FinBox – bureau data API providers: https://research.finbox.in/blog/best-credit-bureau-data-api-providers-india/
- MediaNama – RBI credit info norms (Jan 2025): https://www.medianama.com/2025/01/223-rbi-mandates-stricter-norms-credit-information-sharing/
- BIIA – RBI restricts access to credit data: https://www.biia.com/rbi-restricts-access-to-credit-data-of-consumers

**Gmail / Google**
- Google – Restricted scope security assessment: https://support.google.com/cloud/answer/13465431
- Google – OAuth production readiness / user caps: https://developers.google.com/identity/protocols/oauth2/production-readiness/overview
- DeepStrike – CASA costs: https://deepstrike.io/blog/google-casa-security-assessment-2025
- Nango – Google security review: https://docs.nango.dev/integrations/google-security-review
- Password formats: https://www.adobe.com/in/acrobat/roc/blog/credit-card-statement-password-guide , https://cleartax.in/s/hdfc-bank-statement-password , https://cleartax.in/s/axis-bank-statement-password , https://cleartax.in/s/sbi-statement-password

**SMS**
- Google Play – SMS/Call Log permitted uses and exceptions: https://support.google.com/googleplay/android-developer/answer/10208820
- Google Play – SMS/Call Log policy: https://support.google.com/googleplay/android-developer/answer/9047303
- Bluecoins – SMS permission removal (2019): https://bluecoinsapp.com/?p=9286

**Statement analysis**
- Perfios document analysers: https://perfios.ai/in/products/document-analysers/
- Perfios Credit Card Statement Analyser (marketplace): https://platform.softwareone.com/product/credit-card-statement-analyser/PCP-3820-2140
- Signzy bank statement analysis: https://www.signzy.com/fintech-apis/bank-statement-analysis-api
- FinBox – BSA in India: https://research.finbox.in/blog/bank-statement-analyser-india/
- xfina (PyPI): https://pypi.org/project/xfina/

**BBPS**
- NBBL circular NPCI/2026-27/BBPS/006 (9 Jun 2026): https://www.bharat-connect.com/strapi/uploads/Reiteration_of_Guidelines_on_Usage_of_BBPS_Customer_Data_9ac9f9fb6a.pdf
- NBBL CCBP data security framework (Aug 2024): https://bharat-connect.com/pdfs/circulars/2024/Data-Security-and-Privacy-Standard-Framework-for-CCBP.pdf
- NPCI circular 007 (2018) on consent for bill presentment: https://www.npci.org.in/PDF/npci/bbp/circular/2018/Circular-007%2001.11.2018%20Customer%20consent%20for%20bill%20presentment%20and%20auto%20payment.pdf
- Setu BBPS COU docs – objects: https://docs.setu.co/payments/billpay/api-integration/objects
- Setu BBPS: https://setu.co/payments/bbps
- Cashfree BBPS COU: https://www.cashfree.com/docs/api-reference/other-apis/bbps-cou/overview.md
- Axis Bank – BBPS agent: https://www.axis.bank.in/business-banking/bharat-bill-payment-system/agent
- Business Standard – issuers live on BBPS (Jul 2024): https://www.business-standard.com/finance/news/major-credit-card-issuers-go-live-on-bharat-bill-payment-systems-124071200982_1.html
- Business Standard – third-party apps still usable (Jul 2024): https://www.business-standard.com/finance/personal-finance/credit-card-users-can-still-use-third-party-apps-for-repayment-know-more-124070100588_1.html
- JSA – BBPS Master Directions 2024: https://www.jsalaw.com/wp-content/uploads/2024/03/JSA-Prism-Fintech-March-2024-BBPS.Final_.pdf
- Dhan Bank – BBPS credit card FAQ: https://www.dhan.bank.in/bbps-faq/

**Personal / pilot testing (added 21 Oct 2026)**
- Google – Using OAuth 2.0 (7-day refresh tokens in Testing; 100 tokens per account per client): https://developers.google.com/identity/protocols/oauth2
- Google – When verification is not needed (personal use, testing, internal): https://support.google.com/cloud/answer/13464323
- Google – Unverified apps (test users, warning screen, 100-user cap): https://support.google.com/cloud/answer/7454865 , https://support.google.com/cloud/answer/15549945
- Nylas – Fix Google "access denied" (Testing-mode behaviour): https://developer.nylas.com/docs/cookbook/use-cases/build/fix-google-access-denied/
- Gmail – Automatically forward messages / forward via filters (verification step): https://support.google.com/mail/answer/10957
- Axis Bank RBI notice booklet (alerts@axis.bank.in, cc.statements@axis.bank.in): https://application.axis.bank.in/docs/Axis_Bank_RBI_Notice_Booklet.pdf
- HDFC InstaAlerts (card alerts separate; email alerts free): https://www.hdfc.bank.in/ways-to-bank/digital-banking/phone-banking/instaalerts
- HSBC India mobile alerts terms (alerts = SMS): https://forms.hsbc.co.in/content/dam/hsbc/in/documents/mobile_alerts.pdf
- HSBC India SMS/OTP FAQ: https://hsbc.co.in/content/dam/hsbc/in/documents/sms-otp-faq.pdf
- SBI Card alert sample (user complaint, secondary): https://www.consumercomplaints.in/bycompany/sbccreditcardo-a580457.html
- TechnoFino – Axis/ICICI email transaction tracker thread (alert samples, regex): https://technofino.in/community/threads/axis-automatic-credit-card-transaction-and-rewards-tracker.5469/
- RBI – '.bank.in' domain migration circular (deadline 31 Oct 2025): https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12837
- TaxGuru – banks still mailing from legacy domains: https://taxguru.in/?p=1053665
- StableMoney – SBI Card statement password (DOB + last 4): https://stablemoney.in/credit-card/how-to-check-sbi-credit-card-statement
- HSBC Singapore e-statement password (shows HSBC uses card-based passwords elsewhere): https://www.hsbc.com.sg/ways-to-bank/electronic-statements/faq/
- CardQL (local statement PDF parser incl. Axis, HDFC, HSBC, ICICI, SBI): https://pypi.org/project/cardql/
- Cashiro – open-source Android SMS expense tracker with CSV export (F-Droid): https://f-droid.org/en/packages/com.ritesh.cashiro/
- Cloudflare Email Routing limits: https://developers.cloudflare.com/email-routing/limits
- Postmark pricing (inbound on Pro and above): https://postmarkapp.com/pricing

**DPDP**
- Hogan Lovells – DPDP Act in force: https://www.hoganlovells.com/en/publications/indias-digital-personal-data-protection-act-2023-brought-into-force-
- Deccan Herald – DPDP Rules phased rollout: https://www.deccanherald.com/amp/story/india%2Fcentre-notifies-dpdp-rules-implementation-planned-in-phases-spread-over-12-18-months-3798465
- Mondaq – closer look at DPDP Rules 2025: https://webiis08.mondaq.com/india/data-protection/1706890/a-closer-look-at-the-dpdp-rules-2025
