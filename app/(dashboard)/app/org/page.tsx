import type { Metadata } from "next";
import { CreateSemesterForm } from "@/components/create-semester-form";
import { DashboardShell } from "@/components/dashboard-shell";
import { SelectedCourseSection } from "@/components/selected-course-section";
import { StudentRosterManager } from "@/components/student-roster-manager";
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
                <th>Last action</th>
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
                    <td>
                      {student.latestActivitySummary
                        ? student.latestActivitySummary
                        : <span style={{ color: "var(--muted)" }}>No activity yet</span>}
                    </td>
                    <td>
                      {student.latestActivityAt
                        ? new Date(student.latestActivityAt).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
                        : <span style={{ color: "var(--muted)" }}>No activity yet</span>}
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
                    <td>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <a
                          aria-label="Edit Course"
                          className="icon-button"
                          data-tooltip="Edit Course"
                          href={`/app/org/courses/${semester.semesterId}/edit`}
                        >
                          <svg fill="none" height="14" viewBox="0 0 16 16" width="14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 2.474L5.81 11.577l-2.827.636.636-2.828L11.013 1.427Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
                          </svg>
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <StudentRosterManager students={roster} />
    </DashboardShell>
  );
}
