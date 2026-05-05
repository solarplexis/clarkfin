# FRD v2.0 Reconciliation — ClarkFin
**Date:** May 2026 | **Source:** ClarkFin_FRD_v2.docx

---

## Summary

The FRD v2 expands ClarkFin from a course-tracking tool (budget draft + single debt) into a full personal financial literacy platform. Five structured modules replace the current loosely-organized student experience. The org/admin infrastructure remains valid and does not conflict.

**Overall gap:** ~80% of the FRD's student-facing functionality is not yet built.

---

## What's Already Built ✅

| Area | Status | Notes |
|---|---|---|
| Auth: email/password, invite, auto-login | ✅ Built | Solid; no FRD conflict |
| User profile (name, avatar) | ✅ Built | Needs 3 new fields (see gaps) |
| Student dashboard: budget gauges, BvA, expense chart, debt snapshot, activity feed, month nav | ✅ Built | Will be replaced by the Module 1 dashboard overhaul |
| Budget Tool: Income/Savings/Expenses draft | ✅ Built | Replaced by Income Statement (Module 2) |
| Actuals entry + BvA table | ✅ Built | Replaced by Income Statement actuals columns |
| AI Budget Assistant (chatbot) | ✅ Built | Kept; expand context as new modules are added |
| Debt Simulator: single scenario, payoff calc | ✅ Built | Replaced by multi-debt model (Module 4) |
| Org Admin: roster, courses, invites, activity | ✅ Built | No FRD conflict — FRD is student-facing only |
| System Admin: org management | ✅ Built | No FRD conflict |
| API Key, CSV export, Race/Progress API | ✅ Built | No FRD conflict |
| Activity logging | ✅ Built | Expand to cover new modules |

---

## Gaps — Not Built ❌

### Module 1 — Dashboard Overhaul

**Onboarding Wizard (4 steps)** — not built
- Step 1: Collect `currentAge`, `targetRetirementAge`, `retirementNetWorthTarget` (none of these are in `UserProfile`)
- Step 2: Multiple debts with categories (student loan, mortgage, credit card, car, other) and repayment goal dates
- Step 3: Financial goals — short-term (1–3 yr), long-term (3+ yr), emergency fund, retirement
- Step 4: Income & expense baseline (seeds the Income Statement)

**Guided Training Sub-Module (FRD §3.0)** — not built
- Optional 8-step interactive tour embedded in the wizard
- Tooltip-per-field approach; tour state persisted so students can resume
- Help & Glossary tab for re-access after onboarding

**Dashboard Ongoing View** — partially built, needs replacement panels
- Present Allocations panel: auto-calculated Essential%, Debt%, Discretionary% from Income Statement — not built
- Target Allocation panel: 4 sliders (Essential, Debt, Discretionary, Savings) summing to 100%; drives all projections — not built
- Goal Progress Summary panel: per-goal progress bars, projected completion dates — not built
- Retirement Countdown: years remaining, % of net worth target reached, on-track badge — not built

---

### Module 2 — Income Statement ❌ (entirely new)

Replaces the current Budget Draft and Actuals entry. The FRD Income Statement is:
- A **rolling weekly/monthly timeline** (Month 0 baseline, then Month 1 Weeks 1–4, Month 2 Weeks 1–4, ...)
- **Gross Pay → Taxes → Net Pay** auto-calculation (currently no gross/net distinction)
- Three structured expense categories with preset rows:
  - **Essential:** utilities, health, groceries, rent/housing, transportation (fixed)
  - **Debt Payments:** mortgage, student loan, car, credit card (with minimum-payment flag)
  - **Discretionary:** dining, shopping, entertainment, subscriptions, travel, personal care, pets
- **Net Income row** auto-calculated: Total Income − Total Expenses (the savings-available figure)
- Nameable rows; rows can't be deleted (only zeroed) to preserve history

---

### Module 3 — Balance Sheet ❌ (entirely new)

- **Assets:** liquid (checking/savings), investments, personal property, retirement accounts — all manual entry
- **Liabilities:** auto-populated from debt entries (current + long-term)
- **Net Worth** = Total Assets − Total Liabilities, displayed large and color-coded
- Net worth vs. retirement target: current value, gap remaining, % of retirement goal achieved
- Net Worth History chart (line graph, month over month) — recommended high-priority

---

### Module 4 — Goal Timeline Engine ❌ (entirely new; the core feature)

This is the primary behavioral-change mechanism: every savings rate change instantly updates all goal dates.

- **Monthly Savings Amount** = Net Monthly Income × (Savings% ÷ 100)
- **Short-term goal projections:** Years to Goal = (Target − Saved) ÷ Monthly Savings ÷ 12; progress bar; sensitivity nudge (+5% → X months sooner)
- **Debt payoff timelines:** per-debt projected payoff vs. repayment goal date (green/red); credit card minimum-payment warning with true cost calculation
- **Long-term goal projections:** same formula; ranked by projected completion date; student-reorderable priority
- **Retirement projection:** linear (confirmed for v1) — Current Net Worth + (Monthly Savings × 12 × Years Remaining); on-track badge; back-calculated required savings rate
- **What-If savings rate slider:** adjust rate → all goal timelines update simultaneously in real time

---

### Module 5 — Budget Planner (Weekly Discretionary Tool) ❌ (entirely new)

Translates allocation targets into a weekly spending constraint:

- **Weekly Discretionary Budget** = (Net Monthly Income × Discretionary%) ÷ 4.33
- Per-category weekly entry: dining, shopping, entertainment, etc.
- Running total: green (under), yellow (within 10%), red (over)
- Entries roll into the Income Statement — no double-entry
- Credit card banner if discretionary spending is charged to a card
- YNAB-style weekly roll-over for unspent balance (confirmed for v1)

---

### Recommended Features (§8) — Priority-Ordered

| Priority | Feature | Status |
|---|---|---|
| HIGH | 8.4 Credit Card Warning & Payoff Accelerator | ❌ Not built |
| HIGH | 8.5 Emergency Fund Auto-Suggestion during onboarding | ❌ Not built |
| HIGH | 8.1 Dashboard KPI Summary Cards (net worth, net income, savings rate gauge, weekly budget remaining, next goal) | ❌ Partial |
| HIGH | 8.2 Financial Education Tooltips & Glossary | ❌ Not built |
| MEDIUM | 8.7 Debt Payoff Strategy Selector (Avalanche vs. Snowball) | ❌ Not built |
| MEDIUM | 8.8 Monthly Financial Snapshot Report | ❌ Not built |
| MEDIUM | 8.6 Goal Milestone Celebrations (25/50/75%, payoff) | ❌ Not built |
| MEDIUM | 8.3 Subscription Tracker within Discretionary section | ❌ Not built |

---

## Data Model Gaps

All new entities are scoped per enrollment (`organizationId` + `semesterId`), consistent with the existing pattern.

| Entity | Gap |
|---|---|
| `UserProfile` | Missing: `currentAge`, `targetRetirementAge`, `retirementNetWorthTarget` |
| `Goal` | New: `goalId`, `userId`, `organizationId`, `semesterId`, `label`, `goalType` (short_term/long_term/emergency_fund/retirement), `targetAmount`, `targetDate?`, `savedToDate`, `priorityOrder` |
| `Debt` | New multi-debt model (replaces `DebtScenario`): `debtId`, `userId`, `organizationId`, `semesterId`, `category` (student_loan/mortgage/credit_card/car/other), `label`, `originalBalance`, `currentBalance`, `monthlyPayment`, `repaymentGoalDate`, `isCreditCard` |
| `IncomeEntry` | New: `entryId`, `userId`, `organizationId`, `semesterId`, `periodYear`, `periodMonth`, `periodWeek` (1–4), `category`, `label`, `amount` |
| `ExpenseEntry` | New: `entryId`, `userId`, `organizationId`, `semesterId`, `periodYear`, `periodMonth`, `periodWeek`, `category` (essential/debt/discretionary), `label`, `amount` |
| `Asset` | New: `assetId`, `userId`, `organizationId`, `semesterId`, `category` (liquid/investment/property/retirement/other), `label`, `currentValue` |
| `AllocationTarget` | New: `userId`, `organizationId`, `semesterId`, `essentialPct`, `debtPct`, `discretionaryPct`, `savingsPct` (must sum to 100) |

---

## Implementation Plan

### Phase 1 — Data Model Foundation
*Prerequisite for everything else. No UI yet.*

1. Extend `UserProfile` with `currentAge`, `targetRetirementAge`, `retirementNetWorthTarget`
2. Create `Goal` Firestore collection + CRUD API (`/api/student/goals`)
3. Create multi-debt `Debt` collection + CRUD API (`/api/student/debts`)
4. Create `IncomeEntry` and `ExpenseEntry` collections + CRUD APIs
5. Create `Asset` collection + CRUD API (`/api/student/assets`)
6. Create `AllocationTarget` document per enrollment + API (`/api/student/allocation`)

---

### Phase 2 — Onboarding Wizard
*The entry point for all new students; unlocks every other module.*

1. Build 4-step wizard component (Profile → Debts → Goals → Income Baseline)
2. Wire to new data model APIs
3. Gate the student dashboard: redirect to wizard if onboarding incomplete
4. Add Guided Training tooltip layer (JSON-driven, same wizard components; tooltip state persisted)
5. Add Help & Glossary tab re-surfacing all training content

---

### Phase 3 — Income Statement (Module 2)
*Replaces Budget Draft and Actuals entry entirely.*

1. Build rolling weekly/monthly grid UI
2. Implement Gross → Taxes → Net Pay calculation
3. Three structured expense categories: Essential / Debt Payments / Discretionary
4. Add preset rows + nameable rows; zero-only (no delete) enforcement
5. Net Income row auto-calculation; color-coded display
6. Replace `/app/student/budget` with the Income Statement; remove Budget Draft and old Actuals UI

---

### Phase 4 — Goal Timeline Engine (Module 4)
*Core calculation feature; builds on Phase 1 + 3 data.*

1. Implement server-side calculation service: Monthly Savings Amount formula
2. Short-term and long-term goal projections with progress bars
3. Multi-debt payoff timelines
4. Credit card minimum-payment warning (FRD §8.4) — required educational feature
5. Retirement net worth linear projection + on-track badge + required savings rate back-calculation
6. What-If savings rate slider — real-time recalculation across all goals simultaneously

---

### Phase 5 — Dashboard Overhaul (Module 1 ongoing view)
*Now that data exists, build the live summary panels.*

1. KPI Summary Cards: Net Worth, Net Income, Savings Rate gauge, Weekly Budget remaining, Next Goal milestone
2. Target Allocation panel (4 sliders, must sum to 100%) — drives Timeline Engine
3. Present Allocations panel (auto-calculated from Income Statement)
4. Goal Progress Summary panel — all goals with progress bars and projected dates
5. Retirement Countdown panel
6. Emergency Fund auto-suggestion prompt (FRD §8.5) if no emergency fund goal exists

---

### Phase 6 — Balance Sheet (Module 3)
*Depends on Phase 1 (Asset model) and Phase 4 (debt balances).*

1. Asset entry UI (liquid, investments, property, retirement accounts)
2. Liabilities auto-populated from Debt records
3. Net Worth headline + color coding
4. Net Worth vs. retirement target: gap + progress bar
5. Net Worth History line chart (monthly snapshots)

---

### Phase 7 — Weekly Budget Planner (Module 5)
*Depends on Phase 3 (Income Statement) and Phase 5 (allocation targets).*

1. Weekly discretionary budget calculation from allocation targets
2. Per-category weekly entry with running total (green/yellow/red)
3. Entries feed back into Income Statement week column
4. Credit card banner for discretionary card charges
5. YNAB-style weekly roll-over for unspent balance

---

### Phase 8 — Mobile Responsiveness (Student View)
*Student-facing pages only. Org Admin and System Admin views are desktop-only.*

1. Audit all student pages for mobile breakpoints (`/app/student/*`, `/invite/*`, `/login`)
2. Stack / reflow dashboard panels for small screens
3. Income Statement grid: horizontal scroll or collapsed weekly view on mobile
4. Weekly Budget Planner: single-column card layout on mobile
5. Touch-friendly drawer interactions (Budget Assistant, Debt Editor, etc.)

---

### Phase 9 — Recommended Features
*Polish and engagement. Sequence by priority.*

1. Debt Payoff Strategy Selector (Avalanche vs. Snowball) — Medium priority
2. Monthly Financial Snapshot Report — Medium priority
3. Goal Milestone Celebrations (25/50/75/100%) — Medium priority
4. Subscription Tracker within Discretionary — Medium priority
5. Financial Tip of the Week on Dashboard — Low priority

---

## What the FRD Does Not Address (Existing Infrastructure — Keep As-Is)

The FRD is purely student-facing. These features have no FRD counterpart but are core to the product and should be preserved:

- Org Admin experience (roster, courses, invites, activity table)
- System Admin (org provisioning)
- API Key management and rotation
- CSV Export API
- Race/Progress API
- AI Budget Assistant (expand its context as new modules launch)
- Auto-login URL feature
- Activity logging (expand to cover new modules)

---

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Goals/debts/assets — student-level or per enrollment? | **Per enrollment** (scoped to `semesterId`) |
| 2 | YNAB-style weekly roll-over — v1 or deferred? | **v1** |
| 3 | Linear vs. compound growth projection at launch? | **Linear confirmed for v1**; compound growth deferred to v2 |
| 4 | Mobile responsiveness — required before launch? | **Yes — student view only**; Org Admin and System Admin remain desktop |
