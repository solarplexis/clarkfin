# ClarkFin — Product Document

ClarkFin is a course-embedded personal finance web application. Students enrolled in a financial literacy course use it to build budgets, track actuals, and model debt payoff — while their instructor observes progress and engagement through an admin dashboard and data export API.

---

## User Roles

| Role | Description |
|---|---|
| **ADMIN** | System administrator. Provisions organizations and has global visibility. |
| **ORG_ADMIN** | Organization administrator (course instructor / professor). Manages courses, students, and invites within their organization. |
| **STUDENT** | Enrolled student. Uses the personal finance tools scoped to their active course enrollment. |

---

## Authentication & Session

### Email / Password Login
Students and org admins log in at `/login` with email and password. Firebase Authentication handles credential verification; the server exchanges the resulting ID token for a secure HttpOnly session cookie.

### Invite-Based Onboarding
New students receive a unique invite link (`/invite/[code]`). The invite page shows the course name and organization, and the student sets a password to activate their account. This creates both the Firebase auth user and the ClarkFin enrollment record in a single step. Invite codes become invalid once redeemed or revoked.

### Auto-Login (Passwordless URL)
An alternate authentication path encodes student identity (first name, last name, email) directly into a URL. An external agent can generate these URLs and distribute them to students, removing the need for explicit login entirely. The existing email/password flow is preserved in parallel.

### Session Management
- `GET /api/session` returns the current user profile.
- `POST /api/session/logout` clears the session cookie.
- `POST /api/session/refresh` re-issues the session cookie from a fresh Firebase ID token.

---

## Account & Profile

All authenticated users can edit their profile at `/app/profile`.

### User Profile
- Edit first and last name.
- Upload or change a profile picture (avatar), stored as a data URL.
- Avatar initial fallback displays when no image is set.

### Account Menu
The app bar contains an account menu (avatar + name) that opens a popover with:
- **Edit Profile** — navigates to `/app/profile`.
- **Sign Out** — clears session and redirects to login.

---

## Student Experience

Students are routed to `/app/student` after login. Their entire experience is scoped to an **enrollment** in a specific course (semester).

### Workspace Switcher
If a student is enrolled in multiple courses, a dropdown lets them switch their active workspace. The active course name is shown in the page header throughout the app.

### Home Dashboard (`/app/student`)
A summary view with:
- **Monthly budget snapshot** — total income, expenses, savings, and net balance from the current budget draft, displayed as ring-chart gauges.
- **Actual vs. Budgeted summary** — side-by-side comparison of planned vs. actual income, savings, and expenses for the selected month.
- **Expense breakdown** — horizontal bar chart ranking expense categories by amount.
- **Debt snapshot** — balance, interest rate, and payoff timeline pulled from the active debt scenario.
- **Recent activity feed** — the last several logged actions across all modules (budget, debt, auth).
- **Month navigation** — arrow buttons to page backward and forward through months to view historical actuals.

### Budget Tool (`/app/student/budget`)

#### Budget Builder (Draft)
A structured form with three sections — **Income**, **Savings**, and **Expenses** — each supporting multiple line items. Each item has:
- Label / description
- Dollar amount
- Frequency (Monthly, Twice per Month, Bi-weekly, Weekly, Annual)

All amounts are normalized to a monthly figure for totals and balance calculation. The monthly balance (`income − savings − expenses`) is displayed prominently. Drafts auto-save on each save action and are marked either "Working draft" or "Ready for review" via an `isFinal` flag.

#### Actuals Entry
Alongside the budget draft, students enter what actually happened for a given month:
- **Actual Income** — line items with label, amount, and date.
- **Actual Savings** — line items with label and amount.
- **Actual Expenses** — line items with label, amount, date, and spending category.

#### Budget vs. Actuals (BvA) Table
A comparison table showing budgeted vs. actual amounts with a variance column (signed dollar and percentage) color-coded green or red based on whether the variance is favorable.

#### AI Budget Assistant (Left-Drawer Chatbot)
An AI assistant drawer slides in from the right side of the screen without disrupting the budget form. Capabilities:
- Answer questions about financial planning.
- Modify line items in the budget using natural language commands.
- Make retirement projections.
- Input classification routes requests to appropriate execution contexts.
- Changes are applied as auto-save API operations — identical to manual edits.
- Conversation history is stored per-enrollment and can be browsed in a "History" view within the drawer.

### Debt Simulator (`/app/student/debt`)
Models a single debt payoff scenario (e.g., a credit card). Inputs:
- Debt name
- Current balance
- Annual interest rate (%)
- Minimum monthly payment
- Planned monthly payment

Outputs (calculated live):
- Payoff timeline (months)
- Total interest paid

The form opens in a side drawer ("Debt Editor"). Each save creates an activity log entry visible to the instructor. The scenario can be marked "Ready for review" (`isFinal`).

---

## Org Admin Experience

Org admins are routed to `/app/org` after login.

### Organization Dashboard (`/app/org`)

**Summary stats:**
- Total roster students
- Total courses
- Pending invites

**Student Activity Table:**
Lists all enrolled students with columns for name, email, active course, enrollment count, and timestamp of latest activity.

**Courses Table:**
- Lists all semesters (courses) with title, course code, ID, and active/inactive status badge.
- **Create Course** — form to add a new semester with title, course code, start/end dates, and active status.
- **Edit Course** — inline drawer to update any course field.

**Invites Section:**
- Table of all student invites with name, email, course, invite status (pending / redeemed / revoked), and a copyable invite link button.
- **Create Invite** — form that selects a student from the roster and a course, generating a unique invite code.
- **Edit Invite** — update or revoke an existing invite.

**Student Roster Manager:**
- Full CRUD for student records (name, email, status).
- Statuses: `prospect`, `invited`, `active`, `inactive`.
- Create, edit, and delete students directly in the roster.

### Organization Profile (`/app/profile` — ORG_ADMIN view)
Org admins see an additional **Organization Settings** section on the profile page:
- Organization name
- Support email
- Brand color (hex)
- Logo (upload, stored as data URL / URL)

---

## System Admin Experience

System admins are routed to `/app/admin` after login.

### System Admin Dashboard (`/app/admin`)

**Summary stats:**
- Total organizations
- Total courses across all organizations

**Organization Cards:**
Each organization card shows:
- Organization name and ID
- API key status badge (set / not set)
- Course count badge
- List of courses with title, course code, and semester ID

**Create Organization:**
Form to provision a new organization (name, org ID). An API key is generated on creation.

---

## API Key & Export

### API Key Management
Each organization has a hashed API key. The preview (first few characters) is visible in the admin UI. Org admins can rotate their API key via `POST /api/org/api-key/rotate`.

### Activity Export (`GET /api/export`)
Authenticated by organization API key. Returns a flat CSV-compatible record set of all activity logs for the organization, with columns including: student name, email, semester, module, action, status, summary, payload, and timestamp. Intended for bulk download by the instructor or an external agent.

### Race / Progress API (`GET /api/org/race?semesterId=...`)
Authenticated by organization API key. Returns progress data for every enrolled student in a course, structured as milestone completions. Used by external AI agents to render leaderboard or race-lane visualizations.

**Static milestones (6):**
| Key | Condition |
|---|---|
| `enrolled` | Student redeemed their invite |
| `budget_started` | Budget draft has ≥1 income or expense item |
| `budget_submitted` | Budget draft marked `isFinal` |
| `debt_started` | Any debt scenario exists for the enrollment |
| `debt_submitted` | Debt scenario marked `isFinal` |
| `assistant_used` | At least one AI chat conversation exists |

**Dynamic monthly milestones:**
One milestone per calendar month in the semester date range. A month is complete when the student has recorded at least one actual income item and one actual expense item with dates in that month.

**Score:** `completed static milestones + completed monthly milestones`

---

## Activity Logging

Every significant student action creates an `ActivityLog` record tied to the user, organization, and semester. Logged modules:
- `auth` — invite redemption, login events
- `budget` — draft saves, actuals saves
- `debt` — scenario saves
- `system` — administrative events

Activity is visible to org admins in the Student Activity table and available in full via the export API.

---

## Navigation

| Role | Navigation items |
|---|---|
| STUDENT | Home · Budget · Debt · API Docs |
| ORG_ADMIN | Dashboard · API Docs |
| ADMIN | System Admin · API Docs |

All roles share the account menu (avatar → Edit Profile / Sign Out) in the app bar.

---

## API Documentation Page (`/docs/api`)

An in-app reference page documenting all REST endpoints grouped by domain: Auth & Session, Organizations, Students, Semesters, Invites, Profile, Budget, Debt, Export, and Race. Each endpoint shows method, path, auth mode, required role, description, and example request/response payloads.

---

## Setup & Bootstrap

New deployments are bootstrapped via `/setup/admin`, which provisions the first system admin account. This one-time route is protected against re-use once an admin exists.

---

## Data Model Summary

| Entity | Key fields |
|---|---|
| `Organization` | `orgId`, `name`, `apiKeyHash`, settings (logo, brand color, support email, allowed email domains) |
| `Semester` | `semesterId`, `orgId`, `title`, `courseCode`, `isActive`, `startsAt`, `endsAt` |
| `StudentRecord` | `studentId`, `organizationId`, `firstName`, `lastName`, `email`, `status` |
| `StudentInvite` | `inviteId`, `inviteCode`, `studentId`, `semesterId`, `status` (pending / redeemed / revoked) |
| `StudentEnrollment` | `enrollmentId`, `userId`, `organizationId`, `semesterId`, `status` |
| `UserProfile` | `uid`, `email`, `fullName`, `avatarUrl`, `role`, `organizationId`, `activeSemesterId` |
| `BudgetDraft` | `income[]`, `savings[]`, `expenses[]` (each with label, amount, frequency), `monthlyBalance`, `isFinal` |
| `BudgetActuals` | `actualIncome[]`, `actualSavings[]`, `actualExpenses[]` (each with label, amount, date?, category?) |
| `DebtScenario` | `debtName`, `balance`, `interestRate`, `minimumPayment`, `plannedPayment`, `payoffMonths`, `totalInterest`, `isFinal` |
| `ActivityLog` | `userId`, `organizationId`, `semesterId`, `module`, `action`, `status`, `summary`, `payload`, `occurredAt` |
| `ChatConversation` | `userId`, `organizationId`, `semesterId`, `title`, `messages[]` |
