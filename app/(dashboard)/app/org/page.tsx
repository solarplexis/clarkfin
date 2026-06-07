import type { Metadata } from "next";
import { CreateSemesterForm } from "@/components/create-semester-form";
import { DashboardShell } from "@/components/dashboard-shell";
import { SelectedCourseSection } from "@/components/selected-course-section";
import { requireRole } from "@/src/lib/auth/session";
import {
  getOrganizationById,
  listOrganizationStudentsWithLatestActivity,
  listSemestersForOrganization,
  listStudentsForOrganization,
  listStudentInvitesForOrganization,
  listStudentFeedbacksForOrganization
} from "@/src/lib/data/repositories";

export const metadata: Metadata = {
  title: "Organization Dashboard"
};

export default async function OrganizationDashboardPage() {
  const user = await requireRole("ORG_ADMIN");
  const orgId = user.organizationId ?? "";
  const [organization, students, semesters, invites, roster, feedbacks] = await Promise.all([
    getOrganizationById(orgId),
    listOrganizationStudentsWithLatestActivity(orgId),
    listSemestersForOrganization(orgId),
    listStudentInvitesForOrganization(orgId),
    listStudentsForOrganization(orgId),
    listStudentFeedbacksForOrganization(orgId)
  ]);
  const semestersById = new Map(semesters.map((semester) => [semester.semesterId, semester]));

  return (
    <DashboardShell user={user}>
      <div className="page-header">
        <div className="page-header-text">
          <h1>{organization?.name ?? orgId}</h1>
          <p>Manage courses, invites, and student engagement.</p>
        </div>
        <a className="button-secondary" href="/app/org/course-grid">
          Open Course Progress
        </a>
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

      <div className="card">
        <div className="card-header">
          <h2>Student Activity</h2>
        </div>
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
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Courses</h2>
          <CreateSemesterForm />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Course code</th>
                <th>ID</th>
                <th>Start date</th>
                <th>Duration</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {semesters.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--muted)" }}>
                    No courses yet. Create one before inviting students.
                  </td>
                </tr>
              ) : (
                semesters.map((semester) => (
                  <tr key={semester.semesterId}>
                    <td>{semester.title}</td>
                    <td>{semester.courseCode}</td>
                    <td><span className="semester-card-code">{semester.semesterId}</span></td>
                    <td>
                      {semester.startsAt
                        ? new Date(semester.startsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
                        : <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td>
                      {semester.durationWeeks
                        ? `${semester.durationWeeks}w`
                        : <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td>
                      <span className={`badge ${semester.isActive ? "badge-teal" : "badge-default"}`}>
                        {semester.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <a
                        className="button-secondary"
                        href={`/app/org/courses/${semester.semesterId}/edit`}
                        style={{ fontSize: "0.8125rem", padding: "4px 10px" }}
                      >
                        Edit
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SelectedCourseSection
        enrolledStudents={students}
        feedbacks={feedbacks}
        invites={invites}
        roster={roster}
        semesters={semesters}
      />
    </DashboardShell>
  );
}
