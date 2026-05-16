# ClarkFin Student Experience Audit

**Auditor perspective:** Expert financial planner reviewing the student-facing toolset  
**Date:** 2026-05-16  
**Scope:** Student view only (`/app/student/**`)

---

## Executive Summary

ClarkFin has all the right *ingredients* for a personal finance course tool — income tracking, expense tracking, debt management, goal setting, net worth, allocation targets — but they are assembled in a way that will frustrate and confuse students. The core problem: **data entered in one tool has no effect on another.** A student can fill out a budget, set goals, and enter expenses across three different screens and none of them will agree with each other, because they are backed by entirely separate data stores with no cross-referencing.

Additionally, two major components (`BudgetTool`, `DebtSimulator`) are fully built but no longer routed to any page — orphaned dead code that still appears in API routes.

**The student experience will feel like:** doing homework on three different pieces of paper, turning them all in, and finding out none of them count toward the same grade.

---

## 1. Navigation & Labeling Problems

### Current nav items (student):
| Nav label | URL | Page title | Component |
|---|---|---|---|
| Home | `/app/student` | My Finances | `StudentDashboard` |
| Income | `/app/student/budget` | Income Statement | `IncomeStatementTool` |
| Balance | `/app/student/balance-sheet` | (Balance Sheet) | `BalanceSheetTool` |
| Planner | `/app/student/planner` | Weekly Budget Planner | `WeeklyPlannerTool` |
| Goals | `/app/student/goals` | Goal Timeline | `GoalTimelineTool` |
| Debt | `/app/student/debt` | Debt Overview | `DebtManager` |

### Issues:

**"Income" leads to an Income Statement, not a budget.**
The URL is `/budget` but the tool is labeled "Income Statement" and the nav says "Income." A student looking for where to enter their budget will never find this page because nothing about it says "budget." This is the primary place to record what they earn and spend each week, but it's presented as an accounting term ("Income Statement") most 20-year-olds don't use.

**"Planner" overlaps with "Income."**
The Weekly Planner (`/app/student/planner`) and the Income Statement (`/app/student/budget`) both record discretionary `ExpenseEntry` records for the same months. A student entering "Dining Out — $45" in the Planner and "Dining Out — $45" in the Income Statement is creating duplicate records in the same database table. There is no guard against this. The student has no way to know both tools write to the same place.

**"Snapshot" is invisible.**
`/app/student/snapshot` is a polished printable financial snapshot — one of the better-designed pages — but it has **no nav item**. Students reach it only via a small link buried at the bottom of the Home dashboard. Most students will never find it.

**"API Docs" in the student nav.**
Every student sees an "API Docs" link in their nav bar. This is meant for developers and instructors calling the export API. Students clicking it will be confused and may lose trust in the app.

---

## 2. The Three Savings Silos (Critical)

There are **three completely separate ways** the app tracks savings, and none of them talk to each other:

### Silo A — Allocation Target (Dashboard)
A percentage slider on the Home dashboard. The student sets what fraction of net pay they want to save (e.g., 15%). This number:
- Drives the goal timeline projections on the Goals page
- Drives the "Savings Rate" KPI on the dashboard
- Has **no connection** to any budget line items or actual savings amounts

### Silo B — Income Statement Net Income
The Income Statement and Monthly Snapshot compute "savings" as `total income − total expenses` — whatever is left over. This:
- Uses `IncomeEntry` and `ExpenseEntry` records
- Appears on the dashboard's "Actual Allocation" panel
- Has **no connection** to the Allocation Target %, to any goals, or to goal progress

### Silo C — Goal "Saved to Date"
Each goal has a `savedToDate` field the student types in manually. This:
- Drives goal progress bars and completion percentage
- Has **no connection** to actual savings amounts, budget entries, or income records
- Goes stale the moment the student forgets to update it

**The result:** The dashboard can simultaneously show "Savings Rate: 15%" (from the allocation slider), a net income of $0 on the Income Statement (because actual expenses equal income), and goal progress at 50% (because the student typed a number six weeks ago). All three numbers are logically incompatible but the app shows all three with no reconciliation or warning.

---

## 3. Two Parallel Income/Expense Tracking Systems (Critical)

There are two entirely parallel systems for recording income and expenses:

### System 1 — BudgetDraft / BudgetActuals (Legacy)
- Component: `BudgetTool` — **orphaned; not routed to any page**
- API: `/api/student/budget`, `/api/student/budget/actuals`
- Data model: `BudgetDraft`, `BudgetActuals`
- Features: planned budget vs. actuals comparison, AI assistant integration, receipt scanning, frequency normalization (monthly/weekly/annual)
- Status: **fully built but inaccessible to students**

### System 2 — IncomeEntry / ExpenseEntry (Active)
- Components: `IncomeStatementTool`, `WeeklyPlannerTool`, `StudentDashboard`, `MonthlySnapshotTool`
- API: `/api/student/income-entries`, `/api/student/expense-entries`
- Data model: `IncomeEntry`, `ExpenseEntry` (indexed by week and month)
- Status: **active; used by all current student-facing pages**

The AI Budget Assistant (`BudgetAssistantDrawer`) is wired to System 1 (BudgetDraft) but System 1 is no longer accessible. The AI assistant cannot modify income/expense entries in System 2. This means **the AI assistant is functionally broken from a data-flow perspective** — it can update a budget draft that no page in the app displays.

---

## 4. Two Parallel Debt Systems (Moderate)

### System 1 — DebtScenario (Legacy)
- Component: `DebtSimulator` — **orphaned; not routed to any page**
- API: `/api/activity` (type: `debt.save`)
- Data model: `DebtScenario`
- Features: single-debt educational simulator, minimum payment comparison, "ready for review" flag
- Status: **fully built but inaccessible**

### System 2 — Debt (Active)
- Component: `DebtManager`
- API: `/api/student/debts`
- Data model: `Debt`
- Features: multi-debt CRUD, per-debt projections, credit card minimum payment warnings, feeds balance sheet and goal timeline
- Status: **active**

The milestone system (`debt_submitted`, `debt_started`) in the org race API appears to reference the old DebtScenario system. If this is the case, students using the current `DebtManager` may never trigger those milestones.

---

## 5. What Onboarding Sets Up vs. What the App Uses

The 4-step onboarding wizard collects:

1. **Profile** — age, retirement age, retirement target → stored on `UserProfile` ✓
2. **Debts** — creates `Debt` records → shows up in `DebtManager` and Balance Sheet ✓
3. **Goals** — creates `Goal` records → shows up in Goal Timeline ✓
4. **Income & Expenses** — creates `IncomeEntry` / `ExpenseEntry` records with `periodYear=0, periodMonth=0`

Step 4 is the problem. The "baseline" income (year=0, month=0) is used exclusively to compute `netPayMonthly` — the foundation of all projections. But students are told "Enter your approximate monthly income and expenses." They expect to see this information reflected in their income statement or budget, but it will **not appear** on the Income Statement (which shows real calendar months). Students will finish onboarding, navigate to the Income Statement, and find it empty. They will think something went wrong.

---

## 6. Goal Timeline — What Drives It vs. What Students Expect

The Goal Timeline projections are driven by:
- `allocationTarget.savingsPct` (the percentage slider on the dashboard)
- `calcNetPayFromBaseline(baselineEntries)` — the month=0 baseline income

Students expect goal timelines to reflect their actual monthly savings behavior. Neither the actual monthly net income (from income/expense entries) nor any budget savings line items drives the goal projection. A student who saves nothing in practice but keeps the slider at 15% will see optimistic timelines that never come true.

Additionally, `savedToDate` on each goal is manually entered and never auto-updated from any data source. Goals will show stale progress indefinitely unless students manually edit each one.

---

## 7. Dashboard KPIs — Mixed Sources

The Home dashboard shows four KPIs in a stat strip:

| KPI | Actual Source |
|---|---|
| Net Worth | Assets (System 2) − Debts (System 2) ✓ |
| Net Income | Current month `IncomeEntry` / `ExpenseEntry` (System 2) ✓ |
| Savings Rate | `allocationTarget.savingsPct` — the slider target, NOT actual savings |
| Next Goal | `Goal.savedToDate` — manually maintained, potentially stale |

The "Savings Rate" KPI shows the **target** percentage set by the slider, labeled simply as "Savings Rate." Students will naturally interpret this as how much they are actually saving. The actual savings rate (computed from real income/expense data) is buried on the Monthly Snapshot page under a different label. This is a significant misrepresentation of the student's financial picture.

---

## 8. Tool-by-Tool Assessment

### Home Dashboard (`/app/student`)
**Strengths:** Net worth KPI, allocation comparison panels, goal progress summary, retirement countdown, emergency fund banner.

**Problems:**
- "Savings Rate" KPI is the target slider value, not actual — misleading label
- "Actual Allocation" panel reads from income/expense entries but there's no link to the Income Statement page from this panel
- Course Progress widget shows "PASSING" / "NOT PASSING" with opaque criteria — students cannot tell what actions will earn points
- The Allocation Target sliders and the Actual Allocation panel sit side-by-side as if they're related; they use different data sources and the student can't easily reconcile them

### Income Statement (`/app/student/budget`)
**Strengths:** Week-by-week entry grid, month navigation, auto-save on blur, debt rows auto-populated from Debt records.

**Problems:**
- Named "Income Statement" — an accounting term most students don't use comfortably
- URL is `/budget` — creates expectation of a budget, not a weekly log
- Savings is not a trackable category — there's no row for "amount saved this month"
- The week 1–4 column structure is unexplained; students don't know what to do with it
- No connection to allocation targets, goals, or the budget draft

### Balance Sheet (`/app/student/balance-sheet`)
**Strengths:** Asset CRUD by category (liquid, investment, property, retirement), liabilities pulled live from Debt records, net worth with retirement target progress bar.

**Problems:**
- Liabilities are read-only — the link to edit debts is a small in-body text link, easy to miss
- Asset values are static — not updated from any transaction or income data
- Liquid assets are not credited toward an emergency fund goal, even though that would be the most natural connection

### Weekly Planner (`/app/student/planner`)
**Strengths:** Week-by-week discretionary budget with surplus rollover, recurring subscription tracker, visual spend progress bars.

**Problems:**
- Tracks only discretionary spending — students won't realize essential and debt expenses don't belong here, yet those categories exist in the Income Statement
- Shares the same `ExpenseEntry` database records as the Income Statement — expenses entered here appear there and vice versa, but there is no indication of this in either tool
- Budget is derived from `allocationTarget.discretionaryPct × baseline net pay` — if either hasn't been set, the budget shows $0 with only a small hint about where to fix it
- No explanation of where the "Budget: $XXX" weekly figure comes from

### Goal Timeline (`/app/student/goals`)
**Strengths:** Savings rate what-if slider, avalanche/snowball debt strategy toggle, milestone celebration banners, retirement projection with adjustable rate of return.

**Problems:**
- The savings rate slider is a what-if explorer, but students don't understand it's disconnected from their actual savings rate or the allocation target — there are now effectively three savings rate numbers (slider on Goals, slider on Dashboard, actual from income/expense data)
- `savedToDate` is manually entered and goes stale
- Debt payoff projections here duplicate what's on the Dashboard retirement countdown
- Emergency fund goal has no link to actual liquid asset balance

### Debt Manager (`/app/student/debt`)
**Strengths:** Multi-debt CRUD, interest rate tracking, credit card minimum payment warnings, payoff projections, goal date comparison.

**Problems:**
- Monthly payment amount in a Debt record does not automatically appear as an expense row in the Income Statement — students must enter debt payments in two separate places
- The `interestRate` field is optional, and without it, payoff projections are wrong — only credit cards show a warning; other debt types silently produce inaccurate projections

### Monthly Snapshot (`/app/student/snapshot`)
**Strengths:** Clean, printable one-page view covering net worth, income/expenses, goal progress, debt summary, and allocation target. The best summary view in the app.

**Problems:**
- Hidden from navigation — only accessible via a small link at the bottom of the Home dashboard
- "Actual Savings Rate" here is correctly computed from income/expense data, but "Target Savings Rate" is the allocation slider — the disconnect is not explained and students will be confused when these numbers differ

---

## 9. Missing Connections — What Should Flow to What

| From | To | Gap |
|---|---|---|
| Debt records (monthly payment) | Income Statement expense rows | Debt payments should auto-populate as expense entries |
| Income Statement net income | Goal `savedToDate` | Leftover income should optionally accrue toward goal progress |
| Allocation target (savings %) | Goal timeline actual rate | Goal projections should use actual savings rate as the primary signal |
| Liquid assets (Balance Sheet) | Emergency fund goal progress | Liquid asset balance should count toward emergency fund `savedToDate` |
| Onboarding baseline income | Income Statement | Students expect baseline entries to appear in real months |
| Weekly Planner entries | Income Statement | Shared data source should be surfaced explicitly to avoid double-entry |

---

## 10. Orphaned Code to Address

| Artifact | Status | Recommended Action |
|---|---|---|
| `BudgetTool` component | Built, not routed | Remove or re-wire to System 2 |
| `DebtSimulator` component | Built, not routed | Remove (replaced by DebtManager) |
| `BudgetDraft` / `BudgetActuals` data model | API routes exist, no UI | Remove API routes and Firestore data model |
| `DebtScenario` data model | API routes exist, no UI | Remove API routes and Firestore data model |
| AI Budget Assistant | Wired to orphaned BudgetDraft | Re-wire to System 2 (IncomeEntry/ExpenseEntry) or disable |
| `debt_started` / `debt_submitted` milestones | May reference DebtScenario | Verify and update to reference DebtManager records |

---

## 11. Priority Recommendations

### P0 — Fix the Broken Mental Model
1. Rename the nav item "Income" → "Budget" and retitle the tool from "Income Statement" to "Monthly Budget" or "Income & Expenses"
2. Add "Snapshot" to the student nav — it is the best summary view and students can't find it
3. Remove "API Docs" from the student nav — irrelevant to students

### P1 — Fix the Savings Rate Lie
4. The "Savings Rate" KPI on the dashboard should show the **actual** savings rate for the current month (net income / total income), with the allocation target shown as a secondary label or tooltip
5. Add a clear explanation that the allocation slider is a *planning target*, not a measure of actual savings

### P2 — Connect Goals to Reality
6. Auto-calculate goal `savedToDate` from actual income/expense data (net income accumulated since goal creation date), or at minimum prompt the student to update it when they record a month
7. Credit liquid asset balance from the Balance Sheet toward the emergency fund goal `savedToDate`

### P3 — Eliminate Dead Code
8. Delete `BudgetTool` and `DebtSimulator` components and their associated API routes and data models
9. Re-wire the AI Budget Assistant to work with `IncomeEntry`/`ExpenseEntry` or disable it until it can

---

## Addendum — Code-Verified Clarifications (2026-05-16)

This addendum tightens several claims in the audit after reviewing the current implementation. The main UX critique still stands: the student experience has a fragmented mental model, savings terminology is misleading, and legacy systems remain in play. However, some statements above were too absolute or should be reframed as verified bugs rather than hypotheses.

### A. The app is fragmented, but not fully disconnected

The statement in the Executive Summary that data entered in one tool has "no effect on another" is directionally useful but technically overstated.

There are real cross-connections in the current student experience:
- `WeeklyPlannerTool` reads and writes the same discretionary `ExpenseEntry` records used by `IncomeStatementTool`
- `IncomeStatementTool` auto-creates debt expense rows from active `Debt` records
- `StudentDashboard` combines `Goal`, `Debt`, `Asset`, `IncomeEntry`, `ExpenseEntry`, and `AllocationTarget` data into a single view

The more precise problem is this:
- Some student tools share data silently
- Some student tools depend on different financial models
- Some headline metrics are derived from targets while others are derived from actuals
- The app does not explain those differences clearly

Recommended wording replacement for the Executive Summary:

> ClarkFin’s student tools share some data, but they do so inconsistently and without explaining the underlying model. Students are shown a mix of target-based, baseline-based, and actual month-based numbers that can conflict with one another without any reconciliation.

### B. The debt milestone issue is confirmed, not speculative

Section 4 states that the org race milestones "appear" to reference the old `DebtScenario` system. This is confirmed in code.

`debt_started` and `debt_submitted` are currently derived from `debt_scenarios`, not from active `Debt` records used by `DebtManager`. This means students using the current debt flow may fail to earn debt milestones in the org race system.

This should be treated as a verified product bug, not an open question.

### C. Debt rows do auto-appear on the Income Statement, but payment amounts do not

The audit currently says:
- "Monthly payment amount in a Debt record does not automatically appear as an expense row in the Income Statement"

That is imprecise.

More accurate wording:
- Debt records automatically create debt rows in the Income Statement UI
- The `monthlyPayment` value from a `Debt` record is not synced into those rows
- Students still need to enter debt payment amounts separately in the Income Statement

So the duplication problem is real, but it is an amount-sync problem rather than a row-visibility problem.

### D. Course Progress is not fully opaque

The dashboard’s Weekly Course Progress widget does show criterion descriptions and point values for the selected week. So the issue is not that students cannot see what actions earn points at all.

More accurate wording:
- Students can see scoring criteria and point values
- The pass/fail framing is still heavy and potentially confusing
- The relationship between course actions, financial tasks, and milestone systems remains harder to follow than it should be

### E. Legacy budget artifacts should be deprecated deliberately, not deleted blindly

The recommendation to delete `BudgetTool`, `BudgetDraft`, `BudgetActuals`, and related routes should be qualified.

Those artifacts are still consumed in at least two live places:
- the AI Budget Assistant operates on `BudgetDraft` and `BudgetActuals`
- org-admin budget review endpoints still return `budget` and `actuals`

That means the correct action sequence is:
1. Inventory remaining consumers
2. Decide whether to migrate or retire the legacy workflow
3. Remove routes/models only after those consumers are updated

Recommended wording replacement for P3:
- Deprecate `BudgetTool`, `BudgetDraft`, `BudgetActuals`, and related routes after all remaining student and org-admin consumers are migrated or intentionally removed
- Remove `DebtSimulator` and `DebtScenario` only after replacing milestone dependencies tied to `debt_scenarios`

### F. What remains strongly supported by the code

The following audit conclusions remain well supported and should stay:
- Student nav labeling is inconsistent: `Income` points to `/app/student/budget`, while the page is framed as an Income Statement
- `Snapshot` is hidden from the main student nav and only linked near the bottom of the dashboard
- `API Docs` appears in the student nav
- The dashboard KPI labeled "Savings Rate" shows `allocationTarget.savingsPct`, not actual current-month savings behavior
- Goal Timeline projections are driven by baseline net pay plus a savings-rate target/override, not actual month-by-month savings results
- Onboarding Step 4 stores baseline income/expense entries at `periodYear=0`, `periodMonth=0`, which students will not see in the calendar-month Income Statement view
- The AI Budget Assistant is tied to the legacy budget system rather than the active `IncomeEntry` / `ExpenseEntry` flow

### G. Revised bottom line

The core issue is not that the app has zero integration. The core issue is that it has partial, uneven integration across multiple financial models:
- baseline projections
- allocation targets
- actual month entries
- manually maintained goal progress
- legacy budget artifacts still used by some workflows

That is enough to confuse students, mislabel metrics, and create trust issues even when individual tools are working as implemented.

---

## Response to Codex Addendum — Open Questions & Pushback (2026-05-16)

The Codex addendum (above) contains useful clarifications but also raises several questions that need answers before we act on its recommendations. The addendum also has a structural problem: it was inserted in the middle of the document, leaving P4 and P5 recommendations orphaned after the appendix. The document needs to be restructured as a follow-up.

### 1. On Point A — "Not Fully Disconnected"

Codex's reframe is partially correct but misses the point. The audit did not claim zero integration — it said data entered in one tool has no effect on *the right* other tool. The examples Codex cites as "real cross-connections" actually include two of the bugs the audit flagged:

- WeeklyPlanner and IncomeStatement silently sharing `ExpenseEntry` records is listed in the audit as a **duplicate-entry risk**, not a feature
- IncomeStatement auto-creating debt rows from Debt records was partially mischaracterized in both the audit and the addendum — see Point 2 below

The core critique stands: students are shown numbers derived from incompatible sources with no reconciliation. Codex's proposed executive summary rewrite softens this in a way that understates the severity for a student audience.

**Question for Codex:** The proposed rewrite says tools "share some data but do so inconsistently." Is this framing intended for the technical audience or the student-experience audience? For the product team reading this document, "inconsistently" is too gentle — what specific wording would you recommend that is both accurate and conveys urgency?

### 2. On Point C — Debt Rows in the Income Statement

Codex says debt records "automatically create debt rows in the Income Statement UI" but clarifies the `monthlyPayment` value is not synced, making it an "amount-sync problem rather than a row-visibility problem."

Looking at the actual `buildExpenseRows` function in `income-statement-tool.tsx`, debt rows are created as empty cells (all four weeks at `amount: 0`). The row label appears but no amounts are pre-filled.

**The practical student experience:** A student sees a row labeled "Student Loan" with four empty week columns. Nothing is pre-filled. The student must type the payment amount manually. If they miss it, that month's expense totals will be wrong.

**Question for Codex:** Is "auto-creates debt rows" an accurate description of what the code does, given that the rows appear empty? From a student UX standpoint, an empty labeled row is arguably more confusing than no row at all — it looks like something is missing. Does Codex's code review support the audit's recommendation (pre-fill amounts from `monthlyPayment`) or not?

### 3. On Point B — Debt Milestones (Needs Source)

Codex states that `debt_started` and `debt_submitted` are "confirmed in code" to reference `debt_scenarios`, not `DebtManager` records. This was marked speculative in the audit ("appears to reference").

**We have not independently verified this against the race API route (`/api/org/race/route.ts`).** The audit did not review that file.

**Action required before treating this as a confirmed bug:** Read `/api/org/race/route.ts` and verify which Firestore collection drives `debt_started` and `debt_submitted`. If Codex is correct, the bug is real and blocks students from earning those course points. If the milestone logic already reads from the `Debt` collection, it's a non-issue.

**Question for Codex:** Please cite the specific file and line(s) in the race API where this behavior is confirmed.

### 4. On Point E — Who Is Still Using BudgetDraft?

Codex says `BudgetTool` and `BudgetDraft` are "still consumed in at least two live places": the AI Budget Assistant and org-admin budget review endpoints.

This changes the severity calculation significantly. If instructors are reviewing student budget drafts through org-admin endpoints, then students who never complete a budget draft are invisible to their instructors — even if they have done everything else correctly in the Income Statement. That is a product gap, not just a cleanup issue.

**Questions for Codex:**
- Which specific org-admin endpoint returns student budget data? Is it `/api/org/students/[studentId]/budget/route.ts`?
- What does an instructor see when they call that endpoint for a student who has only used the Income Statement (System 2) and never touched the orphaned BudgetTool (System 1)?
- If the answer is "they see nothing," the correct fix is not to delete the BudgetTool but to either restore it or migrate the instructor-facing view to System 2. Which does Codex recommend?

### 5. On the "Three Savings Rate Numbers" — Not Addressed

Codex's addendum did not respond to the claim that there are effectively **three separate savings rate numbers** visible to the student:

1. The AllocationTarget savings % slider on the Dashboard
2. The savings rate what-if slider on the Goal Timeline page  
3. The actual savings rate computed from income/expense entries (shown on Snapshot, and implied in Actual Allocation)

The Goal Timeline slider reads `allocationTarget.savingsPct` as its *initial default*, but the student can override it locally (stored in `localStorage`). If a student changes the Dashboard slider, the Goal Timeline slider does not update unless the student navigates away and returns. If the student has a local override in localStorage, the Dashboard slider change has no visible effect on the Goal Timeline.

**Question for Codex:** Can you confirm whether the savings rate slider state on the Goal Timeline page (local state + localStorage cache) ever reads the *current* `allocationTarget.savingsPct` after initial mount, or only reads it once? If a student updates their allocation target on the Dashboard and then visits the Goals page, will their timeline reflect the new target?

### 6. Structural Issue — Document Order Is Broken

The Codex addendum was inserted between the P3 and P4/P5 recommendation sections. As a result:
- The addendum ends with "Revised bottom line"
- Then P4 and P5 appear as orphaned sections with no heading context
- "10. Verify course milestone logic..." appears as a floating line inside the addendum body

**This document needs to be reformatted.** The recommendations (P0–P5) should be a complete section before any addenda, and the addendum should follow, not interrupt, the main body. This is a request for whoever restructures the document, not a question for Codex.

---

## Remaining Recommendations (P4–P5)

*(These were part of the original audit and were accidentally orphaned by the addendum insertion)*

### P4 — Bridge Tools to Each Other
10. Verify course milestone logic references `DebtManager`, not the old `DebtScenario`
11. Auto-populate debt payment amounts in the Income Statement from Debt records' `monthlyPayment` field, marked as linked so students know why they're there
12. Show a clear banner in the Planner explaining that entries here also appear in the Income Statement
13. Surface the baseline income (year=0) entries as the starting point on the Income Statement, or prompt students to revisit their baseline after finding an empty income statement

### P5 — Give Students a Workflow
14. Add a "Getting Started" checklist on the Home dashboard guiding students through: (1) enter baseline income → (2) set allocation targets → (3) add debts → (4) set goals → (5) record income & expenses each week → (6) review snapshot
15. Translate Course Progress criteria into plain student language (e.g., "You need at least one income entry and one expense entry this month to earn this week's point")

---

## Appendix: Current Data Flow Map

```
Onboarding Wizard
├── Step 1 → UserProfile (age, retirement age, target)
├── Step 2 → Debt records → DebtManager ✓, Balance Sheet ✓, Goal Timeline ✓
├── Step 3 → Goal records → Goal Timeline ✓, Dashboard ✓
└── Step 4 → IncomeEntry (year=0, month=0) ← BASELINE ONLY
                Used for: net pay → allocation slider → goal projections
                NOT visible in: Income Statement, Snapshot, Budget vs Actual

Income Statement (IncomeEntry + ExpenseEntry, real months)
└── Used by: Dashboard KPIs, Snapshot, Allocation panels
    NOT used by: Goals (savedToDate), Goal projections, Planner budget

Weekly Planner (ExpenseEntry, discretionary only, real months)
└── Shares data with: Income Statement (same database collection)
    NOT labeled as: sharing data with Income Statement

AllocationTarget (% sliders, Dashboard)
└── Used by: Planner budget, Goal Timeline savings rate, Dashboard KPIs
    NOT connected to: Income Statement entries, Goals, actual savings

Goal.savedToDate (manual field)
└── Used by: Goal Timeline bars, Dashboard goal strip
    NOT updated by: any income, savings, or expense entry anywhere

Assets (currentValue, manually entered)
└── Used by: Balance Sheet, Dashboard net worth
    NOT connected to: Emergency fund goal, savings tracking

Debt (monthly payment, balance, rate)
└── Used by: Balance Sheet liabilities, Goal Timeline debt payoff
    NOT auto-appearing in: Income Statement expense rows
```

This fragmentation is the root cause of student frustration. Each tool is internally coherent but externally isolated. A student doing everything "right" across all six tools is still working with six disconnected spreadsheets that never add up to the same number.

---

## Addendum II — Common Ground with Claude (2026-05-16)

After reviewing the Claude response embedded above, there is substantial agreement between the two reviews. The disagreement is mostly about tone, precision, and which claims were stated too broadly.

### 1. Shared conclusion: the student mental model is broken

Claude is right that the product problem is not solved by pointing out isolated technical connections. The central issue remains:
- students see target-based numbers, baseline-based numbers, and actual month-based numbers side by side
- those numbers can diverge materially
- the UI does not explain when divergence is expected versus when it signals missing work

Codex's earlier clarification that the app is not "fully disconnected" is still true at a code level, but Claude's framing is closer to the product reality: the current integrations are not the ones students actually need in order to trust the system.

### 2. Shared conclusion: silent shared state is a bug, not a benefit

Claude is right to push back on treating Weekly Planner / Income Statement data sharing as a meaningful integration win.

Both tools write to the same `ExpenseEntry` collection for discretionary spending. That is technically a shared model, but because the UI does not disclose it, the student-facing result is still a duplicate-entry hazard rather than a coherent workflow.

So the common-ground phrasing is:
- the tools do share data
- the sharing is silent
- silent sharing is itself part of the UX defect

### 3. Shared conclusion: debt rows are present but incomplete

Claude's refinement on debt rows is correct and should be adopted.

`IncomeStatementTool` does create a labeled debt row for each `Debt` record, but it initializes the row with empty week cells rather than pre-filling payment amounts. That means:
- this is not a row-discovery problem
- it is still a real student-flow problem
- the current UI can imply that data is missing or unfinished

Common-ground recommendation:
- keep the claim that students must still enter debt payment amounts manually
- describe the current behavior as "debt rows appear, but payment amounts are not populated from `monthlyPayment`"
- keep the recommendation to pre-fill or explicitly link those amounts

### 4. Shared conclusion: the debt milestone bug is real

Claude asked for confirmation through the race flow. That confirmation exists.

`/api/org/race/route.ts` delegates to `getRaceProgress()`, and `getRaceProgress()` computes `debt_started` and `debt_submitted` from the `debt_scenarios` document, not from active `Debt` records. This means the original audit's suspicion was correct: the org race milestone system is still wired to the legacy debt path.

This should now be treated as verified:
- students can use `DebtManager`
- org race debt milestones still read from legacy `DebtScenario`
- milestone credit can therefore diverge from actual student debt work

### 5. Shared conclusion: legacy budget artifacts cannot be deleted yet

Claude is also right that this is more than cleanup.

Because `BudgetDraft` / `BudgetActuals` still power:
- the AI Budget Assistant
- the org-admin student budget endpoint

the issue is not just "dead code exists." The issue is that student-facing financial work and instructor/admin-facing budget review are split across different systems.

Common-ground recommendation:
- do not delete legacy budget artifacts immediately
- first decide whether instructor review should continue to center on `BudgetDraft`, or whether it should migrate to `IncomeEntry` / `ExpenseEntry`
- only then retire routes, models, and UI tied to the legacy path

### 6. Shared conclusion: the "three savings rates" problem is real

Claude correctly called out a point that deserved a fuller response.

There are effectively three savings-rate concepts in the student experience:
1. Dashboard allocation target (`allocationTarget.savingsPct`)
2. Goal Timeline what-if / persisted override
3. Actual savings rate from monthly income and expenses

The Goal Timeline slider does re-read the default target when the page state is refreshed from props, but a local override stored in `localStorage` can keep the Goals page intentionally divergent from the Dashboard target. That makes the product problem real even if the implementation is internally consistent.

Common-ground wording:
- the app exposes multiple savings-rate concepts
- some are planning inputs and one is actual performance
- the UI does not distinguish them clearly enough

### 7. Claude's structural critique is fair

Claude is right that the first addendum interrupted the recommendation flow. This second addendum is appended at the end to avoid making that worse.

If this document is converted into a work plan, the clean structure should be:
1. main audit findings
2. consolidated recommendations
3. code-verification addenda
4. appendix / data-flow map

### 8. Consolidated bottom line

The strongest version of the shared conclusion is:

ClarkFin is not suffering from a total lack of integration. It is suffering from the wrong kinds of integration, incomplete syncing between related tools, and multiple competing financial models presented without explanation. Claude is right on the product severity. Codex is right that several claims need tighter technical wording. Taken together, those two views point to the same implementation priority: reconcile the student workflow around one primary financial model and clearly label anything that remains a projection, target, or what-if scenario.

---

## Synthesis — Agreed Findings & Consolidated Action Plan (2026-05-16)

This section replaces the back-and-forth above with a single clean statement of what both reviewers agree on and what should be done. All items below are uncontested.

---

### Agreed Technical Facts

| Claim | Status |
|---|---|
| `BudgetTool` and `DebtSimulator` are not routed to any page | **Confirmed** |
| The AI Budget Assistant is wired to `BudgetDraft`, not `IncomeEntry`/`ExpenseEntry` | **Confirmed** |
| The Income Statement auto-creates labeled debt rows but does not populate `monthlyPayment` amounts | **Confirmed** — empty rows, not missing rows |
| Weekly Planner and Income Statement share the same `ExpenseEntry` records without disclosing this to students | **Confirmed** |
| `debt_started` / `debt_submitted` milestones in `/api/org/race/route.ts` read from `debt_scenarios`, not active `Debt` records | **Confirmed** — verified product bug |
| Onboarding Step 4 baseline entries (year=0, month=0) are invisible in the Income Statement calendar view | **Confirmed** |
| The Dashboard "Savings Rate" KPI shows `allocationTarget.savingsPct`, not actual current-month savings rate | **Confirmed** |
| The Goal Timeline slider can diverge from `allocationTarget.savingsPct` via localStorage override and does not re-sync on navigation | **Confirmed** |
| `/api/org/students/[studentId]/budget/route.ts` returns `BudgetDraft` data — legacy system still in instructor view | **Confirmed** |

---

### Agreed Framing of the Core Problem

The app is not fully disconnected. Tools share data in places. The problem is:

1. **The shared connections are silent** — the student has no way to know which tools read from which data
2. **The headline numbers come from different models** — targets, baselines, and actuals are mixed on the same screen without labels
3. **The connections that matter most are missing** — saving money in real life does not update goal progress; paying a debt does not flow into the expense ledger automatically
4. **Two complete parallel systems are in limbo** — the legacy budget and debt simulator paths are neither fully active nor fully retired, leaving the codebase and the instructor view split

**Agreed executive summary wording:**

> ClarkFin shows students a mix of target-based, baseline-based, and actual month-based numbers without explaining which is which. Tools share some data silently — creating duplicate-entry risks — while the connections students actually need (savings → goals, debt payments → expenses, actuals → projections) are absent. Two legacy systems (budget and debt simulator) remain in the codebase in a half-retired state, keeping the AI assistant and instructor review endpoints disconnected from the active student workflow.

---

### Consolidated Action Plan

Items are ordered by student impact, not implementation complexity.

#### Tier 1 — Fix What Students See Today (No Data Model Changes)

1. **Rename nav "Income" → "Budget"** and retitle the Income Statement tool to "Monthly Budget" or "Income & Expenses"
2. **Add "Snapshot" to the student nav** — it is the best summary view and students cannot find it
3. **Remove "API Docs" from the student nav** — not relevant to students
4. **Relabel "Savings Rate" KPI** on the dashboard to "Savings Target" and surface actual savings rate alongside it (already computed from income/expense data; just needs a second display)
5. **Add a banner to the Weekly Planner** explaining that entries here also appear in the Income Statement — or merge the two views

#### Tier 2 — Fix Verified Bugs

6. **Fix the debt milestone bug** in `/api/org/race/route.ts` — update `debt_started` and `debt_submitted` to read from active `Debt` records instead of `debt_scenarios`
7. **Pre-fill `monthlyPayment` into Income Statement debt rows** from the corresponding `Debt` record, or at minimum show a hint: "Enter your payment amount here — check your Debt page for the figure"
8. **Explain Course Progress criteria in student language** on the dashboard widget

#### Tier 3 — Connect Goals to Reality

9. **Auto-update or prompt `savedToDate`** — either compute it from net income accumulated since goal creation, or show a "Have you saved this month? Update your progress →" prompt when the student records a new month
10. **Credit liquid asset balance toward the emergency fund goal** — if a student has $4,500 in a checking/savings account, that should automatically count toward their emergency fund `savedToDate`
11. **Sync the Goal Timeline savings rate slider** — when `allocationTarget` changes, clear the localStorage override so the Goals page reflects the student's current plan by default (preserve the what-if slider but make it clearly labeled as "what-if")

#### Tier 4 — Resolve the Legacy System Decision (Requires Product Decision First)

This tier requires an explicit decision: **should the student workflow center on `BudgetDraft` or on `IncomeEntry`/`ExpenseEntry`?**

Both options are viable; the current problem is that neither is complete.

**Option A — Commit to `IncomeEntry`/`ExpenseEntry` (System 2) as the canonical student workflow:**
- Re-wire the AI Budget Assistant to work with `IncomeEntry`/`ExpenseEntry`
- Migrate the instructor student-budget endpoint to read from System 2
- Then deprecate and remove `BudgetTool`, `BudgetDraft`, `BudgetActuals`, and related API routes
- Remove `DebtSimulator` and `DebtScenario` (after fixing milestone dependencies in Tier 2)

**Option B — Restore `BudgetDraft` as the planned-budget layer alongside `IncomeEntry`/`ExpenseEntry` as the actuals layer:**
- Re-route `BudgetTool` as a "Budget Plan" page (the planned/forward-looking view)
- Keep `IncomeStatementTool` as the "Income & Expenses" page (the actual/historical view)
- Make the Budget vs. Actual comparison between these two systems explicit and navigable
- This is a larger rebuild but produces the most educationally complete experience

Either option is better than the current state. The worst outcome is making no decision and continuing to maintain both systems indefinitely.

#### Tier 5 — Give Students a Guided Workflow

12. **Add a "Getting Started" checklist** on the Home dashboard: (1) enter baseline income → (2) set allocation targets → (3) add debts → (4) set goals → (5) record income & expenses each month → (6) review snapshot
13. **Surface the onboarding baseline** — either show it in the Income Statement as a "Month 0 — Baseline" entry, or redirect first-time visitors to a prompt asking them to confirm or update it

---

### What This Document Is Not Deciding

- Which specific UI design resolves the confusion (that requires wireframes and student testing)
- Whether to pursue Option A or Option B for the legacy system (that is a product/instructor workflow decision)
- The order within each tier (that is an engineering sprint decision)

The audit's job is to accurately describe the problem. Both reviewers agree on the problem. The above action plan reflects that agreement.
