import Link from "next/link";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";
type AuthMode = "Public" | "Session" | "API Key";

type EndpointDoc = {
  id: string;
  method: HttpMethod;
  path: string;
  title: string;
  auth: AuthMode;
  role?: string;
  description: string;
  requestExample?: string;
  responseExample: string;
};

type EndpointGroup = {
  id: string;
  label: string;
  intro: string;
  endpoints: EndpointDoc[];
};

const endpointGroups: EndpointGroup[] = [
  {
    id: "auth",
    label: "Auth & Session",
    intro: "Firebase Auth establishes the browser identity, then ClarkFin exchanges the Firebase ID token for a secure server session cookie.",
    endpoints: [
      {
        id: "session-read",
        method: "GET",
        path: "/api/session",
        title: "Get current session",
        auth: "Session",
        description: "Returns the currently authenticated ClarkFin user profile, or `null` when no session cookie is present.",
        responseExample: `{
  "user": {
    "uid": "student_123",
    "email": "alex@college.edu",
    "fullName": "Alex Rivera",
    "role": "STUDENT",
    "organizationId": "clark-college",
    "activeSemesterId": "fall-2026-fin101"
  }
}`
      },
      {
        id: "session-login",
        method: "POST",
        path: "/api/session/login",
        title: "Create session cookie",
        auth: "Public",
        description: "Establishes a server session cookie. Accepts either a Firebase `idToken` (browser flow) or plain `email` + `password` credentials (server-to-server or invite redemption flow). Both paths validate the ClarkFin profile before writing the cookie.",
        requestExample: `// Option A — Firebase idToken (browser flow)
{
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}

// Option B — credentials (server-to-server)
{
  "email": "alex@college.edu",
  "password": "StrongPass123!"
}`,
        responseExample: `{
  "ok": true,
  "role": "ORG_ADMIN"
}`
      },
      {
        id: "session-logout",
        method: "POST",
        path: "/api/session/logout",
        title: "Clear session",
        auth: "Session",
        description: "Deletes the current ClarkFin session cookie.",
        responseExample: `{
  "ok": true
}`
      }
    ]
  },
  {
    id: "organizations",
    label: "Organizations",
    intro: "System admins can provision organizations and view the current tenant list. Each organization gets its own API key for server-to-server exports.",
    endpoints: [
      {
        id: "organizations-list",
        method: "GET",
        path: "/api/admin/organizations",
        title: "List organizations",
        auth: "Session",
        role: "ADMIN",
        description: "Returns all organizations with their API key preview and current settings.",
        responseExample: `{
  "ok": true,
  "organizations": [
    {
      "orgId": "clark-college",
      "name": "Clark College",
      "apiKeyPreview": "ck_live_...9d2a",
      "settings": {
        "supportEmail": "finlit@clark.edu",
        "allowedEmailDomains": ["clark.edu"]
      }
    }
  ]
}`
      },
      {
        id: "organizations-create",
        method: "POST",
        path: "/api/admin/organizations",
        title: "Create organization and default org admin",
        auth: "Session",
        role: "ADMIN",
        description: "Creates the organization record, generates the per-organization export API key, and provisions the default org admin account.",
        requestExample: `{
  "orgId": "clark-college",
  "name": "Clark College",
  "supportEmail": "finlit@clark.edu",
  "allowedEmailDomains": "clark.edu",
  "brandColor": "#0f6b5f",
  "orgAdminFullName": "Dana Heath",
  "orgAdminEmail": "dana@clark.edu",
  "orgAdminPassword": "ChangeMe123!"
}`,
        responseExample: `{
  "ok": true,
  "organization": {
    "orgId": "clark-college",
    "name": "Clark College"
  },
  "orgAdmin": {
    "email": "dana@clark.edu",
    "role": "ORG_ADMIN"
  },
  "apiKey": "ck_live_..."
}`
      }
    ]
  },
  {
    id: "profiles",
    label: "Profiles",
    intro: "Profile routes are session-based. Student, org admin, and system admin users all use the same session endpoint for their own account data.",
    endpoints: [
      {
        id: "profile-read",
        method: "GET",
        path: "/api/profile",
        title: "Get current user profile",
        auth: "Session",
        description: "Returns the authenticated user's ClarkFin profile.",
        responseExample: `{
  "ok": true,
  "profile": {
    "uid": "org_admin_123",
    "email": "dana@clark.edu",
    "fullName": "Dana Heath",
    "role": "ORG_ADMIN",
    "organizationId": "clark-college"
  }
}`
      },
      {
        id: "profile-update",
        method: "PATCH",
        path: "/api/profile",
        title: "Update current user profile",
        auth: "Session",
        description: "Updates the current user's display name and avatar data URL.",
        requestExample: `{
  "fullName": "Dana Heath",
  "avatarUrl": "data:image/png;base64,..."
}`,
        responseExample: `{
  "ok": true,
  "profile": {
    "fullName": "Dana Heath"
  }
}`
      },
      {
        id: "org-profile-read",
        method: "GET",
        path: "/api/org/profile",
        title: "Get organization profile",
        auth: "Session",
        role: "ORG_ADMIN",
        description: "Returns the authenticated org admin's organization profile and branding settings.",
        responseExample: `{
  "ok": true,
  "organization": {
    "orgId": "clark-college",
    "name": "Clark College",
    "settings": {
      "supportEmail": "finlit@clark.edu",
      "brandColor": "#0f6b5f"
    }
  }
}`
      },
      {
        id: "org-profile-update",
        method: "PATCH",
        path: "/api/org/profile",
        title: "Update organization profile",
        auth: "Session",
        role: "ORG_ADMIN",
        description: "Updates org name, support email, brand color, and logo data URL for the current organization.",
        requestExample: `{
  "name": "Clark College",
  "supportEmail": "finlit@clark.edu",
  "brandColor": "#0f6b5f",
  "logoUrl": "data:image/png;base64,..."
}`,
        responseExample: `{
  "ok": true,
  "organization": {
    "name": "Clark College"
  }
}`
      }
    ]
  },
  {
    id: "students",
    label: "Students",
    intro: "Student roster records belong to an organization and become linked to the authenticated student account when an invite is redeemed for the first time.",
    endpoints: [
      {
        id: "students-list",
        method: "GET",
        path: "/api/org/students",
        title: "List roster students",
        auth: "Session",
        role: "ORG_ADMIN",
        description: "Returns the organization's student roster.",
        responseExample: `{
  "ok": true,
  "students": [
    {
      "studentId": "stu_123",
      "firstName": "Alex",
      "lastName": "Rivera",
      "email": "alex@college.edu",
      "status": "invited"
    }
  ]
}`
      },
      {
        id: "students-create",
        method: "POST",
        path: "/api/org/students",
        title: "Create roster student",
        auth: "Session",
        role: "ORG_ADMIN",
        description: "Creates a student roster record that future invites will target.",
        requestExample: `{
  "firstName": "Alex",
  "lastName": "Rivera",
  "email": "alex@college.edu",
  "status": "prospect"
}`,
        responseExample: `{
  "ok": true,
  "student": {
    "studentId": "stu_123",
    "status": "prospect"
  }
}`
      },
      {
        id: "students-read",
        method: "GET",
        path: "/api/org/students/{studentId}",
        title: "Get roster student",
        auth: "Session",
        role: "ORG_ADMIN",
        description: "Returns one student roster record from the current organization.",
        responseExample: `{
  "ok": true,
  "student": {
    "studentId": "stu_123",
    "firstName": "Alex",
    "lastName": "Rivera",
    "email": "alex@college.edu"
  }
}`
      },
      {
        id: "students-update",
        method: "PATCH",
        path: "/api/org/students/{studentId}",
        title: "Update roster student",
        auth: "Session",
        role: "ORG_ADMIN",
        description: "Updates first name, last name, status, and email for a roster record. Linked student email changes are blocked.",
        requestExample: `{
  "firstName": "Alex",
  "lastName": "Rivera",
  "email": "alex@college.edu",
  "status": "active"
}`,
        responseExample: `{
  "ok": true,
  "student": {
    "studentId": "stu_123",
    "status": "active"
  }
}`
      },
      {
        id: "students-delete",
        method: "DELETE",
        path: "/api/org/students/{studentId}",
        title: "Delete roster student",
        auth: "Session",
        role: "ORG_ADMIN",
        description: "Deletes an unlinked roster record. Linked students must be marked inactive instead.",
        responseExample: `{
  "ok": true
}`
      }
    ]
  },
  {
    id: "courses",
    label: "Courses",
    intro: "Courses are represented by the `semesters` collection today. They act as enrollment workspaces and invite targets.",
    endpoints: [
      {
        id: "courses-list",
        method: "GET",
        path: "/api/org/semesters",
        title: "List courses",
        auth: "Session",
        role: "ORG_ADMIN",
        description: "Returns the current organization's course runs.",
        responseExample: `{
  "ok": true,
  "semesters": [
    {
      "semesterId": "fall-2026-fin101",
      "title": "Fall 2026 Personal Finance",
      "courseCode": "FIN101",
      "isActive": true
    }
  ]
}`
      },
      {
        id: "courses-create",
        method: "POST",
        path: "/api/org/semesters",
        title: "Create course",
        auth: "Session",
        role: "ORG_ADMIN",
        description: "Creates a course run for the current organization.",
        requestExample: `{
  "semesterId": "fall-2026-fin101",
  "title": "Fall 2026 Personal Finance",
  "courseCode": "FIN101",
  "startsAt": "2026-08-20",
  "endsAt": "2026-12-15",
  "isActive": true
}`,
        responseExample: `{
  "ok": true,
  "semester": {
    "semesterId": "fall-2026-fin101",
    "courseCode": "FIN101"
  }
}`
      },
      {
        id: "courses-read",
        method: "GET",
        path: "/api/org/semesters/{semesterId}",
        title: "Get course",
        auth: "Session",
        role: "ORG_ADMIN",
        description: "Returns one course for the current organization.",
        responseExample: `{
  "ok": true,
  "semester": {
    "semesterId": "fall-2026-fin101",
    "title": "Fall 2026 Personal Finance"
  }
}`
      },
      {
        id: "courses-update",
        method: "PATCH",
        path: "/api/org/semesters/{semesterId}",
        title: "Update course",
        auth: "Session",
        role: "ORG_ADMIN",
        description: "Updates course metadata and active status.",
        requestExample: `{
  "title": "Fall 2026 Personal Finance",
  "courseCode": "FIN101",
  "startsAt": "2026-08-20",
  "endsAt": "2026-12-15",
  "isActive": true
}`,
        responseExample: `{
  "ok": true,
  "semester": {
    "semesterId": "fall-2026-fin101",
    "isActive": true
  }
}`
      },
      {
        id: "courses-delete",
        method: "DELETE",
        path: "/api/org/semesters/{semesterId}",
        title: "Delete course",
        auth: "Session",
        role: "ORG_ADMIN",
        description: "Deletes a course only when it has no invites and no enrollments.",
        responseExample: `{
  "ok": true
}`
      }
    ]
  },
  {
    id: "invites",
    label: "Invites",
    intro: "Invites are student-and-course specific. Each invite points at one roster student and one course run.",
    endpoints: [
      {
        id: "invites-list",
        method: "GET",
        path: "/api/org/invites",
        title: "List invites",
        auth: "Session",
        role: "ORG_ADMIN",
        description: "Returns all invites for the current organization, ordered by newest first.",
        responseExample: `{
  "ok": true,
  "invites": [
    {
      "inviteId": "invite_123",
      "inviteCode": "CF-AB12CD",
      "studentEmail": "alex@college.edu",
      "semesterId": "fall-2026-fin101",
      "status": "pending"
    }
  ]
}`
      },
      {
        id: "invites-create",
        method: "POST",
        path: "/api/org/invites",
        title: "Create invite",
        auth: "Session",
        role: "ORG_ADMIN",
        description: "Creates a single-use invite for one student roster record and one course.",
        requestExample: `{
  "studentId": "stu_123",
  "semesterId": "fall-2026-fin101"
}`,
        responseExample: `{
  "ok": true,
  "invite": {
    "inviteId": "invite_123",
    "inviteCode": "CF-AB12CD",
    "status": "pending"
  }
}`
      },
      {
        id: "invites-read",
        method: "GET",
        path: "/api/org/invites/{inviteId}",
        title: "Get invite",
        auth: "Session",
        role: "ORG_ADMIN",
        description: "Returns one invite belonging to the current organization.",
        responseExample: `{
  "ok": true,
  "invite": {
    "inviteId": "invite_123",
    "studentEmail": "alex@college.edu",
    "status": "pending"
  }
}`
      },
      {
        id: "invites-update",
        method: "PATCH",
        path: "/api/org/invites/{inviteId}",
        title: "Update invite status",
        auth: "Session",
        role: "ORG_ADMIN",
        description: "Updates invite status to `pending`, `redeemed`, or `revoked`.",
        requestExample: `{
  "status": "revoked"
}`,
        responseExample: `{
  "ok": true,
  "invite": {
    "inviteId": "invite_123",
    "status": "revoked"
  }
}`
      },
      {
        id: "invites-delete",
        method: "DELETE",
        path: "/api/org/invites/{inviteId}",
        title: "Delete invite",
        auth: "Session",
        role: "ORG_ADMIN",
        description: "Deletes an invite unless it has already been redeemed.",
        responseExample: `{
  "ok": true
}`
      },
      {
        id: "invites-redeem",
        method: "POST",
        path: "/api/invite/redeem",
        title: "Redeem invite",
        auth: "Public",
        description: "Creates or links the student account, creates the enrollment, and marks the invite as redeemed.",
        requestExample: `{
  "inviteCode": "CF-AB12CD",
  "firstName": "Alex",
  "lastName": "Rivera",
  "email": "alex@college.edu",
  "password": "StrongPass123!"
}`,
        responseExample: `{
  "ok": true
}`
      }
    ]
  },
  {
    id: "student-workflow",
    label: "Student Workflow",
    intro: "These routes support the authenticated student experience once the invite has been redeemed.",
    endpoints: [
      {
        id: "workspace-update",
        method: "POST",
        path: "/api/student/workspace",
        title: "Switch active course workspace",
        auth: "Session",
        role: "STUDENT",
        description: "Updates the student's active course workspace to one they are already enrolled in.",
        requestExample: `{
  "semesterId": "spring-2027-fin102"
}`,
        responseExample: `{
  "ok": true,
  "semesterId": "spring-2027-fin102"
}`
      },
      {
        id: "activity-post",
        method: "POST",
        path: "/api/activity",
        title: "Save budget or debt activity",
        auth: "Session",
        role: "STUDENT",
        description: "Saves budget drafts or debt scenarios and writes the corresponding activity log entry. Budget items (income, savings, and expenses) each carry a `frequency` field that normalizes the amount to monthly. The `savings` section represents pay-yourself-first allocations deducted from income before expenses.",
        requestExample: `{
  "type": "budget.save",
  "semesterId": "fall-2026-fin101",
  "income": [{"id": "job", "label": "Work study", "amount": 450, "frequency": "biweekly"}],
  "savings": [{"id": "ef", "label": "Emergency Fund", "amount": 50, "frequency": "monthly"}],
  "expenses": [{"id": "rent", "label": "Rent", "amount": 600, "frequency": "monthly"}],
  "notes": "Initial draft",
  "monthlyBalance": 122,
  "isFinal": false
}`,
        responseExample: `{
  "ok": true,
  "message": "Budget saved."
}`
      }
    ]
  },
  {
    id: "student-finance",
    label: "Student Finance",
    intro: "Read endpoints for the student's own budget draft, debt scenario, and activity log. All routes require a student session and verify enrollment in the target course.",
    endpoints: [
      {
        id: "student-budget-read",
        method: "GET",
        path: "/api/student/budget",
        title: "Get own budget draft",
        auth: "Session",
        role: "STUDENT",
        description: "Returns the student's budget draft for the specified course. Defaults to the active workspace semester when `semesterId` is omitted. `monthlyBalance` = income − savings − expenses, all normalized to monthly.",
        responseExample: `{
  "ok": true,
  "budget": {
    "semesterId": "fall-2026-fin101",
    "income": [{"id": "job", "label": "Work study", "amount": 450, "frequency": "biweekly"}],
    "savings": [{"id": "ef", "label": "Emergency Fund", "amount": 50, "frequency": "monthly"}],
    "expenses": [{"id": "rent", "label": "Rent", "amount": 600, "frequency": "monthly"}],
    "monthlyBalance": 122,
    "isFinal": false
  }
}`
      },
      {
        id: "student-debt-read",
        method: "GET",
        path: "/api/student/debt",
        title: "Get own debt scenario",
        auth: "Session",
        role: "STUDENT",
        description: "Returns the student's debt scenario for the specified course. Defaults to the active workspace semester when `semesterId` is omitted.",
        responseExample: `{
  "ok": true,
  "debt": {
    "semesterId": "fall-2026-fin101",
    "debtName": "Credit Card",
    "balance": 2400,
    "interestRate": 19.99,
    "plannedPayment": 150,
    "payoffMonths": 20,
    "totalInterest": 412.30,
    "isFinal": false
  }
}`
      },
      {
        id: "activity-get",
        method: "GET",
        path: "/api/activity",
        title: "Get own activity log",
        auth: "Session",
        role: "STUDENT",
        description: "Returns the student's recent activity log entries. Supports a `limit` query parameter (max 100, default 20).",
        responseExample: `{
  "ok": true,
  "logs": [
    {
      "id": "log_abc",
      "module": "budget",
      "action": "saved",
      "status": "draft",
      "summary": "Budget draft saved.",
      "occurredAt": "2026-03-22T14:00:00.000Z"
    }
  ]
}`
      }
    ]
  },
  {
    id: "org-finance",
    label: "Instructor Finance View",
    intro: "Read endpoints for org admins to inspect student budget drafts, debt scenarios, and activity logs across their organization.",
    endpoints: [
      {
        id: "org-student-budget-read",
        method: "GET",
        path: "/api/org/students/{studentId}/budget",
        title: "Get student budget draft",
        auth: "Session",
        role: "ORG_ADMIN",
        description: "Returns the budget draft for a specific enrolled student. Requires a `semesterId` query parameter. Returns `null` if the student has not yet linked their account.",
        responseExample: `{
  "ok": true,
  "budget": {
    "semesterId": "fall-2026-fin101",
    "income": [{"id": "job", "label": "Work study", "amount": 450, "frequency": "biweekly"}],
    "savings": [{"id": "ef", "label": "Emergency Fund", "amount": 50, "frequency": "monthly"}],
    "expenses": [{"id": "rent", "label": "Rent", "amount": 600, "frequency": "monthly"}],
    "monthlyBalance": 122,
    "isFinal": true
  }
}`
      },
      {
        id: "org-student-debt-read",
        method: "GET",
        path: "/api/org/students/{studentId}/debt",
        title: "Get student debt scenario",
        auth: "Session",
        role: "ORG_ADMIN",
        description: "Returns the debt scenario for a specific enrolled student. Requires a `semesterId` query parameter.",
        responseExample: `{
  "ok": true,
  "debt": {
    "semesterId": "fall-2026-fin101",
    "debtName": "Credit Card",
    "balance": 2400,
    "payoffMonths": 20,
    "isFinal": true
  }
}`
      },
      {
        id: "org-activity-get",
        method: "GET",
        path: "/api/org/activity",
        title: "Get organization activity log",
        auth: "Session",
        role: "ORG_ADMIN",
        description: "Returns activity log entries for the organization. Optionally filter by `semesterId`. Supports a `limit` query parameter (max 200, default 50).",
        responseExample: `{
  "ok": true,
  "logs": [
    {
      "id": "log_abc",
      "userId": "student_123",
      "semesterId": "fall-2026-fin101",
      "module": "budget",
      "action": "submitted",
      "status": "completed",
      "summary": "Budget marked ready for review.",
      "occurredAt": "2026-03-22T14:00:00.000Z"
    }
  ]
}`
      }
    ]
  },
  {
    id: "enrollment",
    label: "Auto-Enrollment",
    intro: "Server-to-server endpoint for bulk-enrolling students into a course. Accepts the organization API key so external agents can call it directly without a browser session. Each enrolled student receives a unique auto-login URL that signs them into the app without a manual login.",
    endpoints: [
      {
        id: "enroll-bulk",
        method: "POST",
        path: "/api/org/enroll",
        title: "Bulk enroll students",
        auth: "API Key",
        description: "Idempotently provisions student accounts and course enrollments, then returns a unique auto-login URL per student. Re-posting the same student and course is a no-op. Partial success is supported — `enrolled` and `errors` are both always present in the response.",
        requestExample: `{
  "semesterId": "fall-2026-fin101",
  "students": [
    { "firstName": "Alex", "lastName": "Rivera", "email": "alex@college.edu" },
    { "firstName": "Jordan", "lastName": "Lee", "email": "jordan@college.edu" }
  ]
}`,
        responseExample: `{
  "ok": true,
  "enrolled": [
    {
      "email": "alex@college.edu",
      "autoLoginUrl": "https://app.clarkfin.com/api/auto-login?t=<token>"
    },
    {
      "email": "jordan@college.edu",
      "autoLoginUrl": "https://app.clarkfin.com/api/auto-login?t=<token>"
    }
  ],
  "errors": []
}`
      }
    ]
  },
  {
    id: "exports",
    label: "Exports",
    intro: "Server-to-server consumers should use the organization API key. This feed is the main bridge for systems like n8n, agent tools, and institutional data pipelines.",
    endpoints: [
      {
        id: "export-feed",
        method: "GET",
        path: "/api/export",
        title: "Get organization export feed",
        auth: "API Key",
        description: "Returns export-ready student activity records for the organization associated with the provided `X-API-KEY` header.",
        responseExample: `{
  "organization": {
    "orgId": "clark-college",
    "name": "Clark College"
  },
  "exportedAt": "2026-03-21T18:42:11.118Z",
  "records": [
    {
      "studentEmail": "alex@college.edu",
      "module": "budget",
      "action": "saved",
      "status": "draft"
    }
  ]
}`
      }
    ]
  }
];

const authModes = [
  {
    label: "Session Cookie",
    value: "For browser or trusted agent flows after Firebase login."
  },
  {
    label: "X-API-KEY",
    value: "For organization-scoped export integrations."
  },
  {
    label: "Public",
    value: "Only for login bootstrap and invite redemption."
  }
];

function MethodBadge({ method }: { method: HttpMethod }) {
  return <span className={`api-method api-method-${method.toLowerCase()}`}>{method}</span>;
}

function EndpointCard({ endpoint }: { endpoint: EndpointDoc }) {
  return (
    <section className="api-endpoint-card" id={endpoint.id}>
      <div className="api-endpoint-topline">
        <MethodBadge method={endpoint.method} />
        <code>{endpoint.path}</code>
      </div>
      <div className="api-endpoint-heading">
        <h3>{endpoint.title}</h3>
        <div className="api-meta-row">
          <span className="api-pill">{endpoint.auth}</span>
          {endpoint.role ? <span className="api-pill">{endpoint.role}</span> : null}
        </div>
      </div>
      <p>{endpoint.description}</p>
      <div className="api-example-grid">
        {endpoint.requestExample ? (
          <div className="api-example-card">
            <div className="api-example-label">Request</div>
            <pre>{endpoint.requestExample}</pre>
          </div>
        ) : null}
        <div className="api-example-card">
          <div className="api-example-label">Response</div>
          <pre>{endpoint.responseExample}</pre>
        </div>
      </div>
    </section>
  );
}

export function ApiDocsPage() {
  return (
    <div className="api-docs-shell">
      <header className="api-docs-topbar">
        <Link className="api-docs-brand" href="/login">
          ClarkFin
          <span>API Reference</span>
        </Link>
        <div className="api-docs-topbar-actions">
          <Link className="button-secondary" href="/login">Sign In</Link>
        </div>
      </header>

      <div className="api-docs-layout">
        <aside className="api-docs-sidebar">
          <div className="api-sidebar-group">
            <div className="api-sidebar-label">Overview</div>
            <a href="#overview">Introduction</a>
            <a href="#authentication">Authentication</a>
            <a href="#quickstart">Quickstart</a>
          </div>

          {endpointGroups.map((group) => (
            <div className="api-sidebar-group" key={group.id}>
              <div className="api-sidebar-label">{group.label}</div>
              {group.endpoints.map((endpoint) => (
                <a href={`#${endpoint.id}`} key={endpoint.id}>
                  {endpoint.title}
                </a>
              ))}
            </div>
          ))}
        </aside>

        <main className="api-docs-main">
          <section className="api-hero" id="overview">
            <div className="api-hero-kicker">ClarkFin API Reference</div>
            <h1>API Reference</h1>
            <p>
              Every operational workflow in ClarkFin is moving toward an API-first contract so
              browser UI, agent workflows, and institutional integrations all use the same
              permissioned backend capabilities.
            </p>
            <div className="api-hero-chips">
              <span className="api-pill">Session APIs</span>
              <span className="api-pill">API Key Exports</span>
              <span className="api-pill">Role-aware Access</span>
            </div>
          </section>

          <section className="api-intro-card" id="authentication">
            <h2>Authentication</h2>
            <p>
              ClarkFin uses two authentication modes: secure browser session cookies for product
              users and `X-API-KEY` for organization-scoped export consumers.
            </p>
            <div className="api-auth-grid">
              {authModes.map((item) => (
                <div className="api-auth-card" key={item.label}>
                  <div className="api-auth-label">{item.label}</div>
                  <p>{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          {endpointGroups.map((group) => (
            <section className="api-group" id={group.id} key={group.id}>
              <div className="api-group-header">
                <h2>{group.label}</h2>
                <p>{group.intro}</p>
              </div>
              <div className="api-group-stack">
                {group.endpoints.map((endpoint) => (
                  <EndpointCard endpoint={endpoint} key={endpoint.id} />
                ))}
              </div>
            </section>
          ))}
        </main>

        <aside className="api-docs-aside">
          <div className="api-sticky-panel">
            <div className="api-sticky-label" id="quickstart">Quickstart</div>
            <h3>Start with export access</h3>
            <p>
              The export feed is the cleanest first integration because it uses the org API key
              and does not depend on browser sessions.
            </p>
            <pre>{`curl -X GET \\
  /api/export \\
  -H "X-API-KEY: ck_live_..."`}</pre>

            <div className="api-sticky-divider" />

            <div className="api-sticky-label">Session flow</div>
            <pre>{`1. Sign in with Firebase on the client
2. POST /api/session/login with { idToken }
3. Call session-protected routes with the cookie`}</pre>

            <div className="api-sticky-divider" />

            <div className="api-sticky-label">Conventions</div>
            <ul className="api-sticky-list">
              <li>JSON request and response bodies everywhere.</li>
              <li>`ok: true` on success for mutable routes.</li>
              <li>Role checks enforced server-side on every protected route.</li>
              <li>Org admins only operate within their own organization.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
