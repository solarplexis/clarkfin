import { DashboardShell } from "@/components/dashboard-shell";
import { StudentFinanceDashboard } from "@/components/student-finance-dashboard";
import { requireRole, resolveStudentWorkspace } from "@/src/lib/auth/session";
import {
  getBudgetDraft,
  getDebtScenario,
  getSemesterById,
  listRecentActivityForStudent
} from "@/src/lib/data/repositories";

export default async function StudentHomePage() {
  const user = await requireRole("STUDENT");
  const workspace = await resolveStudentWorkspace(user);
  const semesterId = workspace?.activeEnrollment?.semesterId;

  const [recentActivity, budget, debt, enrollmentOptions] = await Promise.all([
    listRecentActivityForStudent(user.uid),
    semesterId ? getBudgetDraft(user.uid, semesterId) : Promise.resolve(null),
    semesterId ? getDebtScenario(user.uid, semesterId) : Promise.resolve(null),
    Promise.all(
      (workspace?.enrollments ?? []).map(async (enrollment) => {
        const semester = await getSemesterById(enrollment.semesterId);
        return {
          semesterId: enrollment.semesterId,
          label: semester ? `${semester.courseCode} · ${semester.title}` : enrollment.semesterId
        };
      })
    )
  ]);

  return (
    <DashboardShell user={user}>
      <StudentFinanceDashboard
        user={user}
        budget={budget}
        debt={debt}
        recentActivity={recentActivity}
        workspace={workspace}
        enrollmentOptions={enrollmentOptions}
      />
    </DashboardShell>
  );
}
