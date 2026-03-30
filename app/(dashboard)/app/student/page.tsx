import { DashboardShell } from "@/components/dashboard-shell";
import { StudentFinanceDashboard } from "@/components/student-finance-dashboard";
import { requireRole, resolveStudentWorkspace } from "@/src/lib/auth/session";
import {
  getBudgetActualsByMonth,
  getBudgetDraft,
  getDebtScenario,
  getSemesterById,
  listRecentActivityForStudent
} from "@/src/lib/data/repositories";

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function StudentHomePage() {
  const user = await requireRole("STUDENT");
  const workspace = await resolveStudentWorkspace(user);
  const semesterId = workspace?.activeEnrollment?.semesterId;
  const initialMonth = currentMonthKey();

  const [recentActivity, budget, actuals, debt, enrollmentOptions] = await Promise.all([
    listRecentActivityForStudent(user.uid),
    semesterId ? getBudgetDraft(user.uid, semesterId) : Promise.resolve(null),
    semesterId ? getBudgetActualsByMonth(user.uid, semesterId, initialMonth) : Promise.resolve(null),
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
        initialActuals={actuals}
        initialMonth={initialMonth}
        debt={debt}
        recentActivity={recentActivity}
        workspace={workspace}
        enrollmentOptions={enrollmentOptions}
        semesterId={semesterId}
      />
    </DashboardShell>
  );
}
