# Parallel Implementation Task List

Source of truth: [docs/APP_AUDIT.md](./APP_AUDIT.md), including the final synthesis and addenda.

Goal for this pass: fix the highest-confidence student experience problems and the confirmed milestone / legacy-flow defects without having Codex and Claude edit the same files.

## Working Agreement

0. Claude to create local refactoring branch to be used by both agents prior to starting the main work
1. No shared-file edits in this pass.
2. No schema changes in this pass unless both agents stop and re-plan.
3. Preserve current route shapes unless a task explicitly says otherwise.
4. Prefer additive clarification and targeted rewiring over broad refactors.

## Agent Split

### Codex owns student-facing UX clarification

Codex should only touch these files:
- `components/dashboard-shell.tsx`
- `components/student-dashboard.tsx`
- `components/income-statement-tool.tsx`
- `components/weekly-planner-tool.tsx`
- `components/goal-timeline-tool.tsx`
- `components/monthly-snapshot-tool.tsx`

Codex must not touch:
- `src/lib/data/repositories.ts`
- `app/api/org/race/route.ts`
- `app/api/org/students/[studentId]/budget/route.ts`
- `app/api/student/budget/**`
- any legacy budget or debt persistence code

### Claude owns backend / legacy-flow reconciliation

Claude should only touch these files:
- `src/lib/data/repositories.ts`
- `app/api/org/race/route.ts`
- `app/api/org/students/[studentId]/budget/route.ts`
- `app/api/student/budget/assistant/route.ts`
- `app/api/student/budget/route.ts`
- `app/api/student/budget/actuals/route.ts`

Claude must not touch:
- `components/dashboard-shell.tsx`
- `components/student-dashboard.tsx`
- `components/income-statement-tool.tsx`
- `components/weekly-planner-tool.tsx`
- `components/goal-timeline-tool.tsx`
- `components/monthly-snapshot-tool.tsx`

## Codex Task List

### C1. Fix student nav and page discoverability

Tasks:
- Rename student nav label `Income` to `Budget` or `Income & Expenses`
- Add `Snapshot` to the student nav
- Remove `API Docs` from the student nav for `STUDENT` users only

Acceptance criteria:
- Students can reach Snapshot directly from the main nav
- No developer-facing nav item appears for students
- Org admin and admin nav behavior remains unchanged

### C2. Fix misleading savings language on the dashboard

Tasks:
- Change the dashboard KPI so it no longer presents `allocationTarget.savingsPct` as plain `Savings Rate`
- Make the target-vs-actual distinction explicit in the dashboard UI
- Keep the allocation panel, but label it clearly as a planning target

Acceptance criteria:
- A student can tell which number is actual current-month performance and which is a target
- The dashboard no longer implies that the target slider equals real savings behavior

### C3. Make shared-state behavior visible to students

Tasks:
- Add a banner or note in `WeeklyPlannerTool` that planner entries also appear in the Income Statement
- Add corresponding clarification in `IncomeStatementTool` for discretionary entries
- Add short helper copy explaining the week 1-4 structure

Acceptance criteria:
- Students are warned before double-entering discretionary expenses
- The month/week entry model is understandable without reading code or docs

### C4. Improve debt-payment UX in the Income Statement

Tasks:
- Pre-fill debt rows from each `Debt.monthlyPayment`
- Make it visually clear that the amount came from the Debt tool and can be adjusted if needed

Acceptance criteria:
- A debt with `monthlyPayment > 0` does not render as four empty cells with no guidance
- The student no longer has to infer that they should manually copy debt payment amounts from the Debt page

Notes:
- Keep this as a UI-level improvement in `IncomeStatementTool`
- Do not change debt persistence or milestone logic

### C5. Clarify Goal Timeline as a planning / what-if tool

Tasks:
- Keep the what-if slider, but label it more explicitly as a projection control
- Make the distinction between dashboard target, goal what-if rate, and actual savings clearer
- Ensure Snapshot labels mirror this terminology

Acceptance criteria:
- The Goals page reads as a planner / simulator, not as actual saved performance
- Snapshot wording matches the same target-vs-actual model

## Claude Task List

### L1. Fix org race debt milestone logic

Tasks:
- Update race-progress computation so `debt_started` and `debt_submitted` are derived from active `Debt` records rather than legacy `DebtScenario`
- Keep the external `/api/org/race` contract stable

Acceptance criteria:
- A student using the current `DebtManager` can satisfy debt milestones
- The race API payload shape does not change

### L2. Make instructor-facing budget review reflect the active student system

Tasks:
- Audit what `/api/org/students/[studentId]/budget` returns when a student only uses `IncomeEntry` / `ExpenseEntry`
- Update the endpoint so instructors do not see an empty or misleading budget view for students using the active system

Implementation guidance:
- Prefer a compatibility layer or derived response over a breaking endpoint redesign in this pass
- If legacy `budget` / `actuals` cannot be truthfully populated, add a clear derived fallback from System 2 data

Acceptance criteria:
- Instructor-facing budget review is no longer blind to students who only use the active student flow
- Endpoint consumers do not need a new request shape in this pass

### L3. Neutralize the legacy AI Budget Assistant mismatch

Tasks:
- Decide one of these approaches for this pass:
- Option A: disable student assistant mutations against legacy budget data and return a clear message
- Option B: keep read-only assistant behavior but block writes that imply the student UI will update

Acceptance criteria:
- The assistant no longer silently updates a budget model the student cannot see in the current flow
- Any remaining assistant behavior is honest about what it can and cannot modify

### L4. Prepare legacy budget paths for later retirement

Tasks:
- Add comments or internal markers documenting which remaining endpoints still depend on `BudgetDraft` / `BudgetActuals`
- Keep behavior stable, but leave the codebase easier to deprecate after the instructor path is resolved

Acceptance criteria:
- The next cleanup pass can identify remaining legacy dependencies quickly
- No student-facing regressions are introduced

## Merge Order

Either order is acceptable because the file ownership is disjoint.

Recommended order:
1. Claude merges first if milestone logic or instructor budget review is considered release-blocking
2. Codex merges second for student-facing UX clarity

## Definition of Done

This parallel pass is complete when:
- students have clearer navigation and savings terminology
- planner / income-statement shared behavior is disclosed
- debt payment rows are no longer empty and unexplained
- org race debt milestones follow the active debt system
- instructor budget review is no longer tied exclusively to the orphaned student budget flow
- the AI budget assistant no longer makes misleading legacy updates

## Explicitly Out of Scope for This Pass

- deleting legacy budget models
- deleting debt scenario models
- rewriting the full student financial architecture around one canonical data model
- changing Firestore schema
- broad redesign of onboarding
