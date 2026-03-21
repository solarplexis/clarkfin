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
      <section className="grid two">
        <article className="panel stack">
          <h2>{organization?.name ?? orgId}</h2>
          <p className="muted">
            Invite codes and API credentials stay isolated per organization. Share the active
            semester invite code with enrolled students.
          </p>
          <div className="stats">
            <div className="stat">
              <div className="muted">Students</div>
              <div className="stat-value">{students.length}</div>
            </div>
            <div className="stat">
              <div className="muted">Semesters</div>
              <div className="stat-value">{semesters.length}</div>
            </div>
          </div>
        </article>
        <article className="panel stack">
          <h2>Semester invite codes</h2>
          {semesters.length === 0 ? (
            <p className="empty">No semesters configured yet.</p>
          ) : (
            <ul className="list">
              {semesters.map((semester) => (
                <li key={semester.semesterId}>
                  <strong>
                    {semester.title} ({semester.courseCode})
                  </strong>
                  <div className="muted">
                    Invite code: {semester.inviteCode} · {semester.isActive ? "Active" : "Inactive"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
      <CreateSemesterForm />
      <section className="table-card section stack">
        <h2>Student activity overview</h2>
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
                <td className="empty" colSpan={4}>
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
                      : "No activity yet"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </DashboardShell>
  );
}
