import Link from "next/link";

import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/src/lib/auth/session";
import { listRecentActivityForStudent } from "@/src/lib/data/repositories";

export default async function StudentHomePage() {
  const user = await requireRole("STUDENT");
  const recentActivity = await listRecentActivityForStudent(user.uid);

  return (
    <DashboardShell user={user}>
      <section className="grid two">
        <article className="panel stack">
          <h2>Student tools</h2>
          <p className="muted">
            Each save records both the latest draft and a structured activity event for your
            instructors and export pipeline.
          </p>
          <div className="actions">
            <Link className="button" href="/app/student/budget">
              Open budget builder
            </Link>
            <Link className="button-secondary" href="/app/student/debt">
              Open debt simulator
            </Link>
          </div>
        </article>
        <article className="panel stack">
          <h2>Enrollment context</h2>
          <div className="pill">Organization: {user.organizationId}</div>
          <div className="pill">Semester: {user.semesterId}</div>
          <p className="muted">
            Your work is automatically scoped to this organization and semester for data
            isolation and export safety.
          </p>
        </article>
      </section>
      <section className="panel section stack">
        <h2>Recent activity</h2>
        {recentActivity.length === 0 ? (
          <p className="empty">No activity yet. Start with the budget tool or debt simulator.</p>
        ) : (
          <ul className="list">
            {recentActivity.map((item) => (
              <li key={item.id}>
                <strong>{item.summary}</strong>
                <div className="muted">
                  {item.module} · {item.action} · {new Date(item.occurredAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardShell>
  );
}
