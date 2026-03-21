import Link from "next/link";

import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/src/lib/auth/session";
import { listRecentActivityForStudent } from "@/src/lib/data/repositories";

export default async function StudentHomePage() {
  const user = await requireRole("STUDENT");
  const recentActivity = await listRecentActivityForStudent(user.uid);

  return (
    <DashboardShell user={user}>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Student workspace</h1>
          <p>Build your budget and explore debt payoff strategies.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2>Financial tools</h2>
          </div>
          <p style={{ color: "var(--ink-2)", marginBottom: 20 }}>
            Each save records a draft and an activity event for your instructors.
          </p>
          <div className="row" style={{ gap: 10 }}>
            <Link className="btn" href="/app/student/budget">
              Budget builder
            </Link>
            <Link className="btn btn-secondary" href="/app/student/debt">
              Debt simulator
            </Link>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h2>Enrollment</h2>
          </div>
          <div className="stack-sm">
            <div className="row" style={{ gap: 8 }}>
              <span className="badge badge-default">Organization</span>
              <span style={{ color: "var(--ink-2)" }}>{user.organizationId}</span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <span className="badge badge-accent">Semester</span>
              <span style={{ color: "var(--ink-2)" }}>{user.semesterId}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 32 }}>Recent activity</div>
      {recentActivity.length === 0 ? (
        <div className="empty-state">No activity yet. Start with the budget builder or debt simulator.</div>
      ) : (
        <div className="card">
          <ul className="plain-list">
            {recentActivity.map((item) => (
              <li key={item.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ fontWeight: 500 }}>{item.summary}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>
                  {item.module} · {item.action} · {new Date(item.occurredAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardShell>
  );
}
