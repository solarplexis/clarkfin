import { CreateSemesterForm } from "@/components/create-semester-form";
import { CreateStudentInviteForm } from "@/components/create-student-invite-form";
import { DashboardShell } from "@/components/dashboard-shell";
import { StudentRosterManager } from "@/components/student-roster-manager";
import { requireRole } from "@/src/lib/auth/session";
import {
  getOrganizationById,
  listOrganizationStudentsWithLatestActivity,
  listSemestersForOrganization,
  listStudentsForOrganization,
  listStudentInvitesForOrganization
} from "@/src/lib/data/repositories";

export default async function OrganizationDashboardPage() {
  const user = await requireRole("ORG_ADMIN");
  const orgId = user.organizationId ?? "";
  const [organization, students, semesters, invites, roster] = await Promise.all([
    getOrganizationById(orgId),
    listOrganizationStudentsWithLatestActivity(orgId),
    listSemestersForOrganization(orgId),
    listStudentInvitesForOrganization(orgId),
    listStudentsForOrganization(orgId)
  ]);
  const semestersById = new Map(semesters.map((semester) => [semester.semesterId, semester]));

  return (
    <DashboardShell user={user}>
      <div className="page-header">
        <div className="page-header-text">
          <h1>{organization?.name ?? orgId}</h1>
          <p>Manage courses, invites, and student engagement.</p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <CreateStudentInviteForm semesters={semesters} students={roster} />
          <CreateSemesterForm />
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-label">Roster students</div>
          <div className="stat-card-value">{roster.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Courses</div>
          <div className="stat-card-value">{semesters.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Pending invites</div>
          <div className="stat-card-value">
            {invites.filter((invite) => invite.status === "pending").length}
          </div>
        </div>
      </div>

      <StudentRosterManager students={roster} />

      <div className="section-title">Courses</div>
      {semesters.length === 0 ? (
        <div className="empty-state">No courses yet. Create one before inviting students.</div>
      ) : (
        <div className="grid-2">
          {semesters.map((semester) => (
            <div className="semester-card" key={semester.semesterId}>
              <div>
                <div className="semester-card-title">{semester.title}</div>
                <div className="semester-card-meta">{semester.courseCode}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <span className="semester-card-code">{semester.semesterId}</span>
                <span className={`badge ${semester.isActive ? "badge-teal" : "badge-default"}`}>
                  {semester.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-title" style={{ marginTop: 32 }}>Invites</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Email</th>
              <th>Course</th>
              <th>Invite code</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)" }}>
                  No invites yet.
                </td>
              </tr>
            ) : (
              invites.map((invite) => {
                const semester = semestersById.get(invite.semesterId);

                return (
                  <tr key={invite.inviteId}>
                    <td>{invite.studentFirstName} {invite.studentLastName}</td>
                    <td>{invite.studentEmail}</td>
                    <td>{semester ? `${semester.courseCode} · ${semester.title}` : invite.semesterId}</td>
                    <td><span className="semester-card-code">{invite.inviteCode}</span></td>
                    <td>
                      <span
                        className={`badge ${
                          invite.status === "pending"
                            ? "badge-teal"
                            : invite.status === "redeemed"
                              ? "badge-accent"
                              : "badge-default"
                        }`}
                      >
                        {invite.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="section-title" style={{ marginTop: 32 }}>Student activity</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Email</th>
              <th>Active course</th>
              <th>Enrollments</th>
              <th>Latest activity</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)" }}>
                  No enrolled students yet.
                </td>
              </tr>
            ) : (
              students.map((student) => (
                <tr key={student.uid}>
                  <td>{student.fullName}</td>
                  <td>{student.email}</td>
                  <td>
                    {student.activeSemesterId
                      ? (() => {
                          const semester = semestersById.get(student.activeSemesterId);

                          return semester
                            ? `${semester.courseCode} · ${semester.title}`
                            : student.activeSemesterId;
                        })()
                      : "No active course"}
                  </td>
                  <td>{student.enrollmentCount}</td>
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
