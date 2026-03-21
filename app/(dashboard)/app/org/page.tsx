import { CreateSemesterForm } from "@/components/create-semester-form";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/src/lib/auth/session";
import {
  getOrganizationById,
  listOrganizationStudentsWithLatestActivity,
  listSemestersForOrganization
} from "@/src/lib/data/repositories";

export default async function OrganizationDashboardPage() {
  const user = await requireRole("ORG_ADMIN");
  const orgId = user.organizationId ?? "";
  const [organization, students, semesters] = await Promise.all([
    getOrganizationById(orgId),
    listOrganizationStudentsWithLatestActivity(orgId),
    listSemestersForOrganization(orgId)
  ]);

  return (
    <DashboardShell user={user}>
      <div className="page-header">
        <div className="page-header-text">
          <h1>{organization?.name ?? orgId}</h1>
          <p>Manage semesters and track student engagement.</p>
        </div>
        <CreateSemesterForm />
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-label">Enrolled students</div>
          <div className="stat-card-value">{students.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Semesters</div>
          <div className="stat-card-value">{semesters.length}</div>
        </div>
      </div>

      <div className="section-title">Semesters</div>
      {semesters.length === 0 ? (
        <div className="empty-state">No semesters yet. Create one to give students an invite code.</div>
      ) : (
        <div className="grid-2">
          {semesters.map((semester) => (
            <div className="semester-card" key={semester.semesterId}>
              <div>
                <div className="semester-card-title">{semester.title}</div>
                <div className="semester-card-meta">{semester.courseCode}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <span className="semester-card-code">{semester.inviteCode}</span>
                <span className={`badge ${semester.isActive ? "badge-teal" : "badge-default"}`}>
                  {semester.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-title" style={{ marginTop: 32 }}>Student activity</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Email</th>
              <th>Semester</th>
              <th>Latest activity</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--muted)" }}>
                  No enrolled students yet.
                </td>
              </tr>
            ) : (
              students.map((student) => (
                <tr key={student.uid}>
                  <td>{student.fullName}</td>
                  <td>{student.email}</td>
                  <td>{student.semesterId}</td>
                  <td>
                    {student.latestActivityAt
                      ? new Date(student.latestActivityAt).toLocaleString()
                      : <span style={{ color: "var(--muted)" }}>No activity yet</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
