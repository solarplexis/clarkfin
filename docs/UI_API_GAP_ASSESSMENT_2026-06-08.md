# UI/API Gap Assessment
Date: 2026-06-08

## Scope
This assessment compares:
- First-party UI data operations in app pages and components
- Implemented API routes under app/api
- Legacy or deprecated UI surfaces that still leave active API behavior

No code was changed as part of this assessment.

## Method
1. Enumerated API routes and HTTP handlers from app/api.
2. Enumerated UI fetch/form-action calls from components and app.
3. Cross-checked route usage against active page composition.
4. Reviewed repository and route comments for explicit deprecation markers.

## Executive Summary
- Active UI calls generally map to existing API routes (no obvious missing endpoint for current first-party UI).
- There are clear legacy/deprecation gaps where retired UI patterns still have active API write paths.
- Several APIs appear integration-only (documented/external) with no first-party UI caller; these should be governed explicitly as external contracts.

## Findings

### 1) Legacy Budget and Debt flows are deprecated in code comments, but API write paths are still active
Severity: High

Evidence:
- app/api/student/budget/route.ts is explicitly marked deprecated.
- app/api/student/budget/actuals/route.ts is explicitly marked deprecated.
- src/lib/data/repositories.ts marks these legacy writers as deprecated:
  - upsertBudgetDraft
  - upsertBudgetActuals
  - upsertBudgetActualsByMonth
  - upsertDebtScenario
- app/api/activity/route.ts still accepts legacy activity types and writes legacy data:
  - "budget.save"
  - "budget.actuals.save"
  - "debt.save"

Impact:
- Deprecated data models remain mutable via API.
- External or stale clients can continue writing legacy collections.
- Migration cleanup risk: old collections may never truly quiesce.

Recommendation:
- Publish a deprecation schedule for legacy activity types and budget legacy endpoints.
- Add explicit response warnings/deprecation headers now.
- Disable write operations after a grace period.
- Remove legacy repository writers once callers are removed.

### 2) Deprecated UI surfaces still exist in the codebase and are not mounted, but supporting APIs remain
Severity: High

Evidence:
- components/budget-tool.tsx exists and calls:
  - /api/student/budget
  - /api/student/budget/actuals
  - /api/student/budget/actuals/receipt
  - /api/activity (budget.save, budget.actuals.save)
- components/debt-simulator.tsx exists and calls:
  - /api/activity (debt.save)
- These components are not referenced by active app pages.
- app/(dashboard)/app/student/budget/page.tsx currently mounts IncomeStatementTool (new path), not BudgetTool.

Impact:
- Dead UI code can be accidentally reintroduced.
- Legacy API paths appear "alive" because dormant callers still exist in repo.

Recommendation:
- Mark these UI components as deprecated in a single deprecation registry doc.
- Remove or quarantine unused UI components after confirming no internal consumers.
- Deprecate corresponding API behaviors at the same time to avoid partial retirement.

### 3) Orphaned endpoint candidate: /api/student/budget/actuals/receipt
Severity: Medium

Evidence:
- Only caller found is components/budget-tool.tsx.
- No active page currently mounts BudgetTool.

Impact:
- Endpoint maintenance and security footprint without active product usage.

Recommendation:
- Confirm no external client dependency.
- If none, deprecate and remove this endpoint with the rest of legacy budget tooling.

### 4) Multiple authorization models and ownership contexts across endpoints without clear classification
Severity: Medium

Evidence: The following endpoints lack first-party UI fetch callers but are documented/active; they require explicit ownership classification by auth model:

**External/API-key contracts (integration-facing):**
- /api/export (API key required)
- /api/org/race (API key or Bearer token required)

**Hybrid contract (integration and internal):**
- /api/org/enroll (supports API key OR ORG_ADMIN session)

**Internal org-admin session routes (no first-party fetch caller):**
- /api/org/activity (ORG_ADMIN session required)
- /api/org/api-key/rotate (ORG_ADMIN session required)
- /api/org/students/{studentId}/budget (ORG_ADMIN session required)
- /api/org/students/{studentId}/course-progress (ORG_ADMIN session required)

Notes:
- /api/session/refresh is middleware-driven internal behavior (not a gap).
- /api/auto-login is internally referenced by auto-login helper for URL generation (not a gap).

Impact:
- Grouping all of these as "external contracts" blurs ownership and risks incorrect versioning/deprecation policy.
- Internal admin routes without first-party callers need explicit decision: preserve, migrate, or deprecate.
- External contracts need explicit ownership, SLA/SLO, and contract tests separate from internal routes.

Recommendation:
- Split governance by auth model (external-API-key, hybrid, internal-session).
- Define explicit support status for each class:
  - External contracts: versioning policy, sunset timeline if planned.
  - Hybrid: identify primary auth path and document fallback behavior.
  - Internal admin routes: decide whether to preserve as compatibility layer or deprecate/migrate.
- Add usage telemetry per endpoint class before any deprecation decisions.

### 5) Student deletion: both single-delete and bulk-delete are active first-party product pathways
Severity: Low (deprecation decision only)

Evidence:
- /api/org/students DELETE supports bulk deletion by studentIds.
- /api/org/students/[studentId] DELETE supports single deletion.
- Student roster UI actively uses BOTH routes:
  - Single delete via DELETE /api/org/students/{studentId} for individual removal.
  - Bulk delete via DELETE /api/org/students with studentIds for multi-select removal.

Impact:
- Both are confirmed active first-party contracts, not overlapping candidates awaiting product decision.
- Dual behavior is intentional product design.

Recommendation:
- Document both routes as supported dual contracts unless product wants to remove single or bulk variant.
- Update API docs to clarify when each is appropriate (individual UI action vs bulk operation).

## Non-Gap Confirmation
- No clear evidence that active first-party UI fetch calls are pointing to missing API routes.
- The primary issues are deprecation hygiene, overlap, and contract clarity rather than immediate broken wiring.

## Priority Actions
1. Deprecation cleanup plan for legacy budget/debt API writes and activity types.
2. Confirm and retire orphaned BudgetTool-related endpoint(s), especially /api/student/budget/actuals/receipt.
3. Formalize integration-only API ownership/versioning/testing.
4. Decide whether bulk student delete remains first-class.

## Key Files Reviewed
- app/api/student/budget/route.ts
- app/api/student/budget/actuals/route.ts
- app/api/activity/route.ts
- app/api/student/budget/actuals/receipt/route.ts
- app/api/org/enroll/route.ts
- app/api/org/race/route.ts
- app/api/org/activity/route.ts
- app/api/export/route.ts
- app/(dashboard)/app/student/budget/page.tsx
- components/budget-tool.tsx
- components/debt-simulator.tsx
- components/student-dashboard.tsx
- components/debt-manager.tsx
- src/lib/data/repositories.ts
- middleware.ts

## Addendum: Deprecated API/UI Retirement Plan

This addendum provides a safe execution plan for retiring deprecated UI/API surfaces identified above.

### Goals
- Stop new writes to legacy collections without breaking active users or integrations.
- Remove dormant UI and orphaned endpoints in a controlled, observable way.
- Preserve a rollback path at every phase.

### Scope of Retirement
- Legacy UI candidates:
  - components/budget-tool.tsx
  - components/debt-simulator.tsx
- Deprecated or legacy API behaviors:
  - /api/student/budget
  - /api/student/budget/actuals
  - /api/student/budget/actuals/receipt
  - /api/activity payload types: budget.save, budget.actuals.save, debt.save
- Legacy repository writers:
  - upsertBudgetDraft
  - upsertBudgetActuals
  - upsertBudgetActualsByMonth
  - upsertDebtScenario

### Phase 0: Baseline and Ownership (1-2 days)
Checklist:
- Assign an owner for each endpoint and UI artifact.
- Publish target retirement date and support window.
- Inventory external consumers for integration APIs.

Telemetry gates to add/confirm:
- Per-endpoint request counts by route and method.
- Per-activity-type counts for /api/activity payload types.
- Caller segmentation if available (first-party session vs API-key/integration).

Rollback:
- None required; this phase is metadata and observability only.

Exit criteria:
- 7-day baseline traffic report captured and shared.

### Phase 1: Soft Deprecation (3-7 days)
Checklist:
- Add deprecation warnings to responses for deprecated routes/behaviors.
- Add documentation banner in API docs for affected routes.
- Log warning-level telemetry when deprecated types are used.

Telemetry gates:
- Daily traffic trend on deprecated routes is stable or declining.
- Deprecated activity types are attributable to known callers.

Rollback:
- Remove/deactivate warning emission if it causes operational noise.

Exit criteria:
- No unknown caller classes using deprecated routes.

### Phase 2: First-Party Cutover Enforcement (3-5 days)
Checklist:
- Ensure no active page imports legacy components.
- Move legacy UI files to quarantine folder or remove after final verification.
- Block first-party invocation of deprecated activity types where possible.

Telemetry gates:
- Zero first-party calls to deprecated routes for 7 consecutive days.
- Zero first-party use of budget.save, budget.actuals.save, debt.save.

Rollback:
- Re-enable first-party path behind feature flag for one release cycle.

Exit criteria:
- First-party traffic to deprecated surfaces remains at zero.

### Phase 3: API Behavior Freeze (2-4 days)
Checklist:
- Change deprecated write behaviors to fail closed (410 or 400 with migration guidance).
- Keep read-only compatibility only if required by contract.
- **Explicitly handle /api/org/students/{studentId}/budget retirement decision before freezing:**
  - Option A: preserve as compatibility read-only model for org-admin budget review.
  - Option B: migrate org-admin consumers to IncomeEntry/ExpenseEntry-derived output.
  - Option C: deprecate and remove with corresponding admin UI/API replacement plan.
  - (Decision required: determine which option applies before Phase 3 execution.)
- Keep integration-only endpoints explicitly marked as supported or pending deprecation.

Telemetry gates:
- Error-rate impact remains within acceptable threshold.
- Support tickets do not indicate unknown hard dependencies.
- If Option A chosen: no org-admin read traffic loss during freeze.

Rollback:
- Temporarily restore previous behavior behind feature flag.
- Time-box rollback window and require owner sign-off to extend.

Exit criteria:
- No critical production incidents attributable to freeze.
- Org-admin budget review workflow remains functional (or migrated) under selected option.

### Phase 4: Data-Path Removal and Cleanup (3-7 days)
Checklist:
- Remove legacy repository writer functions and dead call paths.
- Remove orphan endpoint(s) confirmed without external dependency, especially /api/student/budget/actuals/receipt.
- Remove stale API docs entries for retired surfaces.

Telemetry gates:
- No post-removal requests reaching removed routes (or only expected 404/410 noise).
- No writes detected in legacy collections after retirement cutoff.

Rollback:
- Revert route removal commit and re-enable route handlers (last-resort only).

Exit criteria:
- Legacy write paths absent from code and runtime traffic.

### Phase 5: Contract Hardening for Integration APIs (ongoing)
Checklist:
- For integration-only APIs, define support status explicitly:
  - Supported long-term contract
  - Versioned contract with sunset date
  - Internal-only (not publicly supported)
- Add contract tests and schema validation.
- Add dashboard alerts for sudden integration traffic changes.

Exit criteria:
- Each integration endpoint has owner, SLA/SLO expectation, and versioning policy.

### Operational Guardrails
- Prefer feature flags over hard deletes until telemetry confirms zero first-party usage.
- Deprecate in docs first, enforce in runtime second, remove code third.
- Require a rollback command list and owner approval before each phase transition.

### Suggested Success Metrics
- Deprecated first-party route usage: 0 for 14 consecutive days.
- Deprecated activity payload type usage: 0 from first-party for 14 days.
- Legacy collection writes: 0 after Phase 4.
- No Sev1/Sev2 incidents caused by retirement.

## Addendum: Review Notes on This Assessment

This addendum captures concerns identified during a code-backed review of the assessment itself.

### 1) Student deletion overlap is mischaracterized
Severity: Medium

Concern:
- Finding #5 understates current first-party usage of the bulk delete route.

Evidence:
- `components/student-roster-manager.tsx` uses single delete via `/api/org/students/${student.studentId}`.
- `components/student-roster-manager.tsx` also uses bulk delete via `DELETE /api/org/students` with `studentIds`.
- `app/api/org/students/route.ts` implements bulk delete.
- `app/api/org/students/[studentId]/route.ts` implements single delete.

Why this matters:
- The current text says the roster UI "currently uses single-delete route," which is incomplete.
- Bulk delete is already live first-party product behavior, not just overlapping API surface awaiting a product decision.

Correction:
- Reframe this finding as: both single-delete and bulk-delete are active first-party contracts and should be documented as intentional dual behavior unless product wants to remove one.

### 2) "Integration-only APIs" groups together endpoints with different ownership/auth models
Severity: Medium

Concern:
- Finding #4 is directionally useful, but the endpoint list is too broad and mixes external contracts with internal org-admin session routes.

Evidence:
- `app/api/export/route.ts` is API-key based.
- `app/api/org/race/route.ts` is API-key based.
- `app/api/org/enroll/route.ts` supports either API key or `ORG_ADMIN` session.
- `app/api/org/api-key/rotate/route.ts` requires `ORG_ADMIN` session.
- `app/api/org/activity/route.ts` requires `ORG_ADMIN` session.
- `app/api/org/students/[studentId]/budget/route.ts` requires `ORG_ADMIN` session.
- `app/api/org/students/[studentId]/course-progress/route.ts` requires `ORG_ADMIN` session.

Why this matters:
- Labeling all of these as "external contract APIs" blurs ownership and could lead to the wrong versioning/deprecation policy.
- Some endpoints are better classified as internal/session-backed admin surfaces with no current first-party fetch caller, not external integrations.

Correction:
- Split the section into:
  - External/API-key contracts: `/api/export`, `/api/org/race`
  - Hybrid contract: `/api/org/enroll`
  - Internal org-admin surfaces without current first-party fetch usage: `/api/org/activity`, `/api/org/api-key/rotate`, `/api/org/students/{studentId}/budget`, `/api/org/students/{studentId}/course-progress`

### 3) Retirement plan does not explicitly account for the active org-admin budget read path
Severity: High

Concern:
- The retirement addendum focuses on deprecated student write paths, but does not explicitly address the still-active org-admin budget read route.

Evidence:
- `app/api/org/students/[studentId]/budget/route.ts` returns `getBudgetDraft()` and `getBudgetActuals()` for instructors/admins.
- The retirement scope lists legacy student endpoints and repository writers, but does not say whether the org-admin budget read should be migrated, preserved, or deprecated in parallel.

Why this matters:
- Removing or freezing legacy budget data paths without a plan for the org-admin consumer risks breaking instructor-facing workflows or leaving an undocumented partial dependency in place.

Correction:
- Add an explicit retirement decision for `/api/org/students/{studentId}/budget`:
  - preserve as compatibility read model,
  - migrate to System 2 income/expense-derived output,
  - or deprecate/remove with a corresponding admin UI/API replacement plan.

## Reviewed Against Code
- `components/student-roster-manager.tsx`
- `app/api/org/students/route.ts`
- `app/api/org/students/[studentId]/route.ts`
- `app/api/export/route.ts`
- `app/api/org/race/route.ts`
- `app/api/org/enroll/route.ts`
- `app/api/org/api-key/rotate/route.ts`
- `app/api/org/activity/route.ts`
- `app/api/org/students/[studentId]/budget/route.ts`
- `app/api/org/students/[studentId]/course-progress/route.ts`
