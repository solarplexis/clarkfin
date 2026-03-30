# Course Instructor — Race UI

## Overview

An exportable progress-visualization API for course instructors. For a given course (semester), it returns every enrolled student and their relative progress through a defined set of milestones. The primary consumer is a `GET` API that an external AI agent can call and render as a race-lane or leaderboard visualization.

---

## Design Decisions

| Question | Decision |
|---|---|
| Progress metric | Count of completed milestones (will likely evolve) |
| Output format | JSON |
| Scope | Per course (semesterId) |
| Activity source | App behavior (no quizzes) |
| Auth | Org API key (existing `apiKeyHash` on `Organization`) |

---

## Data Model Change Required

`ActualItem.date` is currently documented as expenses-only. To support monthly income tracking, **`date` must be promoted to apply to `actualIncome` items as well.**

### Change to `types/domain.ts`

```ts
export interface ActualItem {
  id: string;
  label: string;
  /** Monthly dollar amount actually received / spent / saved */
  amount: number;
  /** ISO date string for when this item occurred, e.g. "2026-03-15".
   *  Required for income and expense items to enable monthly milestone tracking.
   *  Optional for savings. */
  date?: string;
  /** Spending category for grouping and budget comparison (expenses only) */
  category?: string;
}
```

The UI for entering income actuals will also need a date field added.

---

## Milestones

### Static milestones (6)

These are binary — either done or not — and do not vary by course duration.

| Key | Condition |
|---|---|
| `enrolled` | Student redeemed their invite (`auth / invite_redeemed` activity log) |
| `budget_started` | Budget draft exists with ≥1 income or expense item |
| `budget_submitted` | `BudgetDraft.isFinal === true` |
| `debt_started` | Any `DebtScenario` document exists for student + semester |
| `debt_submitted` | `DebtScenario.isFinal === true` |
| `assistant_used` | At least one `chat_conversations` document for student + semester |

### Dynamic monthly milestones

One milestone per calendar month spanned by `Semester.startsAt → Semester.endsAt`.

A month is **complete** if the student has:
- ≥1 `actualIncome` item with a `date` in that month, **and**
- ≥1 `actualExpenses` item with a `date` in that month

Example: semester Jan 15 – May 10 → months `2026-01`, `2026-02`, `2026-03`, `2026-04`, `2026-05` → 5 monthly milestones.

### Score

`score = (static milestones completed) + (monthly actuals months completed)`

`maxScore = 6 + (number of months in semester)`

---

## API

### Endpoint

```
GET /api/org/race?semesterId={semesterId}
```

Auth: `Authorization: Bearer {orgApiKey}` header (same key used for `/api/export`).

### Response shape

```json
{
  "semesterId": "spring-2026",
  "courseCode": "PF101",
  "title": "Personal Finance Spring 2026",
  "maxScore": 11,
  "staticMilestones": [
    "enrolled",
    "budget_started",
    "budget_submitted",
    "debt_started",
    "debt_submitted",
    "assistant_used"
  ],
  "actualMonths": ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"],
  "students": [
    {
      "studentId": "abc123",
      "firstName": "Jane",
      "lastName": "Doe",
      "score": 8,
      "milestones": {
        "enrolled": true,
        "budget_started": true,
        "budget_submitted": true,
        "debt_started": true,
        "debt_submitted": false,
        "assistant_used": true,
        "actuals": {
          "2026-01": true,
          "2026-02": true,
          "2026-03": false,
          "2026-04": false,
          "2026-05": false
        }
      }
    }
  ]
}
```

---

## Implementation Checklist

- [ ] Promote `ActualItem.date` comment to cover income (types/domain.ts)
- [ ] Add `date` field to the income actuals UI entry form
- [ ] Add `getRaceProgress(semesterId)` repository function
- [ ] Add `GET /api/org/race` route with org API key auth
- [ ] Update API docs page