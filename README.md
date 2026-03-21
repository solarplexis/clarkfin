# ClarkFin: Personal Finance Web Application

ClarkFin is a multi-tenant, self-serve educational platform built for community college personal finance courses. It enables students to interact with financial tools while providing administrators with high-fidelity activity data for AI-driven reporting.

## 🚀 Tech Stack
- **Framework:** Next.js (App Router)
- **Hosting:** Netlify
- **Database:** Firebase Firestore
- **Auth:** Firebase Authentication
- **Integration:** REST API for Claude Cowork / Openclaw

## 🛠 Core Architecture Principles
1. **Multi-Tenancy:** Data must be siloed by `organizationId`. No student or admin should ever be able to query data outside their assigned organization.
2. **Event-Driven Activity:** Every student interaction (e.g., creating a budget, running a debt simulation) must write an entry to the `activity_logs` collection.
3. **AI-Ready API:** The `/api/export` endpoint must provide a flattened, context-rich JSON feed of student activity logs for LLM processing.
4. **API-First Operations:** Every meaningful platform operation should have a corresponding API endpoint with explicit role-based access control. This is required for direct product UI usage and for external integrations such as Claude Cowork, Openclaw, n8n, and other workflow/agent systems.

## 🔐 Database Schema (Firestore)
- `/organizations/{orgId}`
- `/semesters/{semesterId}` (linked to orgId)
- `/students/{studentId}` (org-managed roster that links to auth users after first invite acceptance)
- `/student_invites/{inviteId}` (student + course specific invite records)
- `/student_enrollments/{uid}_{semesterId}` (supports overlapping current and upcoming terms)
- `/users/{uid}` (contains role: 'ADMIN' | 'STUDENT')
- `/activity_logs/{logId}` (contextualized by studentId and semesterId)

## 📋 Implementation Tasks for Claude
1. **Auth Scaffolding:** Implement Firebase Auth with a custom invite flow that creates course-specific student enrollments and supports overlapping current and upcoming terms.
2. **Admin Dashboard:** Create a view for `ORG_ADMIN` users to see a list of enrolled students and their latest activity timestamps.
3. **Financial Modules:**
    - Budgeting Tool (Income vs. Expense tracker)
    - Debt Simulator (Credit Card/Student Loan payoff visualizer)
4. **Export API:** Build a Next.js Route Handler protected by an `X-API-KEY` that returns student logs in a format optimized for Claude Cowork.

## 🌐 Deployment
This project is configured for deployment on **Netlify**. Ensure `NEXT_PUBLIC_FIREBASE_CONFIG` and `FIREBASE_SERVICE_ACCOUNT` are set in the Netlify UI environment variables.

## Gemini discussion
1. https://gemini.google.com/share/717713b004d9

## Local setup
1. Copy `.env.example` to `.env.local`.
2. Fill in the Firebase web config and `FIREBASE_SERVICE_ACCOUNT`.
3. Install dependencies with `npm install`.
4. Start the app with `npm run dev`.
5. For the full open-source setup walkthrough, follow [docs/BOOTSTRAP.md](/Users/danaheath/Projects/io/danaheath/clarkfin/docs/BOOTSTRAP.md).

## Current implementation scaffold
- **Framework:** Next.js App Router with TypeScript
- **Auth:** Firebase Auth email/password login plus invite-based student registration
- **Bootstrap:** One-time `/setup/admin` flow for creating the first platform `ADMIN`
- **Session model:** Firebase ID token exchanged for a secure server session cookie
- **Roles:** `ADMIN`, `ORG_ADMIN`, `STUDENT`
- **Student tools:** Budget builder and debt simulator, both persisting drafts and writing activity logs
- **Admin views:** System admin overview plus organization creation UI that also provisions the default `ORG_ADMIN`
- **Export API:** `GET /api/export` protected by `X-API-KEY`, scoped per organization

## API-first expectation
- Every core action should be available through a backend API, not only through the web UI.
- Each API must enforce the correct role boundary for `ADMIN`, `ORG_ADMIN`, and `STUDENT`.
- UI forms should generally be thin clients over those APIs so the same operations can be reused by Claude Cowork, Openclaw, n8n, and similar automation/integration layers.
- New features should be designed assuming they may be triggered by both humans in the UI and external agent/workflow systems.

## Firestore collections in use
- `/organizations/{orgId}`
- `/semesters/{semesterId}`
- `/students/{studentId}`
- `/student_invites/{inviteId}`
- `/student_enrollments/{uid}_{semesterId}`
- `/users/{uid}`
- `/activity_logs/{logId}`
- `/budget_drafts/{semesterId}_{uid}`
- `/debt_scenarios/{semesterId}_{uid}`

## Notes
- Student registration uses student-and-course-specific invite records and writes separate enrollment records so one student can hold multiple concurrent or upcoming course enrollments.
- Org admins manage a student roster first, then create invites by selecting from that roster.
- Student profiles keep an `activeSemesterId` workspace pointer for the UI, but enrollment truth lives in `student_enrollments`.
- Per-organization API keys are expected to be stored as a SHA-256 hash in `organizations.apiKeyHash`.
- Firestore client access is governed by [firestore.rules](/Users/danaheath/Projects/io/danaheath/clarkfin/firestore.rules). Server routes using the Firebase Admin SDK still need explicit auth and tenancy checks because Admin SDK access bypasses Firestore rules.
- If you want, the next step can be adding seed data creation, Firestore security rules, or richer invite lifecycle management for org admins.
