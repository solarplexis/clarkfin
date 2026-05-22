import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard-shell";
import { OrgCourseGrid } from "@/components/org-course-grid";
import { requireRole } from "@/src/lib/auth/session";
import { listSemestersForOrganization } from "@/src/lib/data/repositories";

export const metadata: Metadata = {
  title: "Course Progress"
};

export default async function OrgCourseGridPage() {
  const user = await requireRole("ORG_ADMIN");
  const orgId = user.organizationId ?? "";

  const semesters = await listSemestersForOrganization(orgId);
  const initialSemesterId = semesters[0]?.semesterId ?? "";

  return (
    <DashboardShell user={user}>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Course Progress</h1>
          <p>View weekly pass/fail status for enrolled students by course.</p>
        </div>
      </div>

      {semesters.length === 0 ? (
        <div className="card" style={{ color: "var(--muted)" }}>
          Create a course first to generate course progress.
        </div>
      ) : (
        <OrgCourseGrid semesters={semesters} initialSemesterId={initialSemesterId} />
      )}
    </DashboardShell>
  );
}
