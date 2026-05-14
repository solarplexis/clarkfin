# New Screen (and API) for Org Admins

1. Purpose of the page is for all courses to show a grid of enrolled students (row) and weekly pass/fail (column)
2. Pass / fail is determined by whether the student entered enough data for the week. You'll have to calculate the different weekly inputs and we can establish a passing threshold
  a. By 'weekly input', we mean 'course week', e.g. Week 1 of the course, etc.
3. There should be a course selector at the top of the page that refreshes on selection change
4. The rows are the students enrolled in the course
5. The columns are the weeks in the course
6. Any weeks not yet begun should be disabled
7. There should be an equivalent API for this (added to the API Docs page of course), with a 'week' filter. It's purpose is to have an AI retrieve the information for the week and populate the 3rd party application Canvas with the student grade information (e.g. Claude Cowork, not a Canvas API)
8. This may require that we pin a course week to a specific/real date range which I don't think we have yet.

# Questions to be answered
Course model and date mapping
Do you want us to add explicit start/end dates per course week now, or infer week windows from semester start date plus week number?
    a. Infer week windows

Passing threshold definition
What exact weekly inputs count toward pass/fail?
Example candidates: income entries, expense entries, debt updates, budget check-in, goals update, feedback submission.
    a. You suggest and we'll revise as necessary

Threshold granularity
Should threshold be global for all courses, configurable per course, or configurable per organization?
    a. Global

Enrollment source of truth
Which existing data model should define enrolled students for this grid (course roster, org roster with course assignment, invite acceptance, or another source)?
    a. There's an existing model for course enrolled students

Week enablement rule
For not-yet-started weeks, should cells be disabled only in UI, or should API also omit/flag those weeks as unavailable?
    a. Parity on UI/API

Historical locking
Can past weeks be recalculated if a student adds late data, or should weekly status freeze after week end?
    a. Lenience is key, so accept edits in past weeks

API contract shape
For the API response, do you prefer:

student-major format: one student with all week statuses, or
week-major format: one week with all students (better for Canvas sync job)?
Week filter semantics
For the week filter, should it accept course week number, date, or both?
    a. week-major format
    b. course week number

Canvas export behavior
Should the API return binary pass/fail only, or include a normalized score plus reason codes for auditability?
    a. Pass/fail for now (we might change this later)

Permissions
Who can access this page/API: org admin only, org staff too, super admin too?
    a. org admin / org staff (but I don't think we have org staff, TBH)

Performance expectations
Largest expected class size and week count?
This affects pagination, caching, and whether we precompute weekly status.
    a. no pagination required

API docs expectations
Do you want this listed only in the in-app API docs page, or also in README.md and/or docs/api/page.tsx-adjacent docs?
    a. API Docs page only
    b. High level feature description added to README.md as appropriate

# Decisions Locked (May 14, 2026)

1. Pass/fail model
    a. Use a score threshold model (not strict all-or-nothing checks).
    b. Keep output as binary pass/fail for now.

2. Permissions
    a. Access for this feature is org admin only.

3. Course length and UI limits
    a. Maximum course length is 20 weeks.
    b. No pagination required for this grid.

# Planning Baseline (No Implementation Yet)

# Implementation Status (May 14, 2026)

- [x] 1) Scoring specification implemented (score-threshold model; binary pass/fail output)
- [x] 2) Week/date mapping implemented (semester start + week number inference)
- [x] 3) API contract implemented (`GET /api/org/course-grid` with `semesterId` and optional `week`)
- [x] 4) UI behavior implemented (course selector + weekly grid + disabled future weeks)
- [x] 5) Authorization implemented (org admin only for page/API)
- [x] 6) Documentation implemented (API Docs page + README high-level note)
- [ ] 7) Validation/testing intentionally deferred until all implementation is complete

## Recent implementation delta
- [x] Hardened date parsing for course starts (plain YYYY-MM-DD treated as UTC).
- [x] Added explicit scoring rubric metadata (`budget_touched`, `debt_touched`, `activity_volume`) with max score.
- [x] Added API-level week range guard (week must be within course duration).
- [x] Scoped activity aggregation to organization + semester for cleaner query semantics.
- [x] Added UI week focus selector (`All weeks` or a specific course week) that maps to API `week` filter.
- [x] Fixed weekly signal aggregation so a qualifying budget/debt action cannot be overwritten back to false by later non-qualifying logs.
- [x] Added dual authentication support on `GET /api/org/course-grid`: org-admin session (UI) or org API key via `X-API-KEY` / `Authorization: Bearer <key>` (external sync workflows such as Claude Cowork).
- [x] Updated in-app API docs entry for `/api/org/course-grid` to document dual auth and explicit query param semantics.

## 1) Scoring specification
- [x] Define the weekly scoring inputs and point weights.
- [x] Define global pass threshold value and tie behavior.
- [x] Define how missing data is treated in score computation.
- [x] Confirm score model computes binary pass/fail output only.

## 2) Week/date mapping specification
- [x] Infer week ranges from semester start date plus course week number.
- [x] Define canonical week boundary rules (timezone, start day, end day).
- [x] Define "future week" determination for UI/API parity.

## 3) API contract specification
- [x] Add org-admin endpoint for week-major response shape.
- [x] Require course selector input and support week filter by course week number.
- [x] Include week availability state (available/unavailable) so future weeks can be disabled.
- [x] Return per-student pass/fail for the selected week.

## 4) UI behavior specification
- [x] Add course selector and refresh grid on selection change.
- [x] Render students as rows and weeks (1..N, N<=20) as columns.
- [x] Disable not-yet-started weeks based on shared availability logic.
- [x] Add loading, empty, and error states.

## 5) Authorization specification
- [x] Enforce org admin access for page and API.
- [x] Define unauthorized/forbidden response behavior.

## 6) Documentation specification
- [x] Add endpoint to API Docs page.
- [x] Add a high-level feature note to README.

## 7) Validation checklist
- [ ] Week calculations match expected semester-derived windows.
- [ ] Future week behavior matches on both UI and API.
- [ ] Score threshold generates binary pass/fail output from weekly activity signals.
- [ ] Late edits to past-week data are reflected via recalculation on each request.
- [ ] Authorization rejects non-org-admin users.
- [ ] Docs updates are complete and accurate.