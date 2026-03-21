import Link from "next/link";

import { DashboardShell } from "@/components/dashboard-shell";
import { StudentWorkspaceSwitcher } from "@/components/student-workspace-switcher";
import { requireRole, resolveStudentWorkspace } from "@/src/lib/auth/session";
import {
  getSemesterById,
  listRecentActivityForStudent
} from "@/src/lib/data/repositories";

export default async function StudentHomePage() {
  const user = await requireRole("STUDENT");
  const workspace = await resolveStudentWorkspace(user);
  const recentActivity = await listRecentActivityForStudent(user.uid);
  const enrollmentOptions = await Promise.all(
    (workspace?.enrollments ?? []).map(async (enrollment) => {
      const semester = await getSemesterById(enrollment.semesterId);

      return {
        semesterId: enrollment.semesterId,
        label: semester ? `${semester.courseCode} · ${semester.title}` : enrollment.semesterId
      };
    })
  );

  return (
    <DashboardShell user={user}>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Student Workspace</h1>
          <p>Build your budget and explore debt payoff strategies</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2>Financial Tools</h2>
          </div>
          <p style={{ color: "var(--ink-2)", marginBottom: 20 }}>
            Each save records a draft and an activity event for your instructors
          </p>
          <div className="row" style={{ gap: 10 }}>
            <Link className="btn" href="/app/student/budget">
              Budget Builder
            </Link>
            <Link className="btn btn-secondary" href="/app/student/debt">
              Debt Simulator
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
              <span className="badge badge-accent">Active Course</span>
              <span style={{ color: "var(--ink-2)" }}>
                {workspace?.activeSemester
                  ? `${workspace.activeSemester.courseCode} · ${workspace.activeSemester.title}`
                  : "No active course selected"}
              </span>
            </div>
            {enrollmentOptions.length > 0 ? (
              <StudentWorkspaceSwitcher
                activeSemesterId={user.activeSemesterId}
                options={enrollmentOptions}
              />
            ) : (
              <div className="empty-state" style={{ padding: 16 }}>
                No course enrollments yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 32 }}>Recent Activity</div>
      {recentActivity.length === 0 ? (
        <div className="empty-state">No activity yet. Start with the Budget Builder or Debt Simulator</div>
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
