import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { StudentDashboard } from "@/components/student-dashboard";
import { requireRole, resolveStudentWorkspace } from "@/src/lib/auth/session";
import { getCourseMilestones } from "@/src/lib/calculations/course";
import {
  getAllocationTarget,
  getSemesterById,
  listAssets,
  listDebts,
  listExpenseEntries,
  listGoals,
  listIncomeEntries
} from "@/src/lib/data/repositories";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default async function StudentHomePage() {
  const user = await requireRole("STUDENT");

  if (!user.currentAge) {
    redirect("/app/student/onboarding");
  }

  const workspace = await resolveStudentWorkspace(user);
  const semesterId = workspace?.activeEnrollment?.semesterId;
  const activeSemester = workspace?.activeSemester ?? null;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentMonthLabel = `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`;

  const anyMilestonePassed = activeSemester?.startsAt
    ? getCourseMilestones(activeSemester.startsAt, activeSemester.durationWeeks).some(m => m.isUnlocked)
    : false;

  const [
    goals,
    debts,
    assets,
    allocationTarget,
    currentMonthIncomeEntries,
    currentMonthExpenseEntries,
    baselineEntries,
    allSemesterIncomeEntries,
    allSemesterExpenseEntries,
    enrollmentOptions
  ] = await Promise.all([
    semesterId ? listGoals(user.uid, semesterId) : Promise.resolve([]),
    semesterId ? listDebts(user.uid, semesterId) : Promise.resolve([]),
    semesterId ? listAssets(user.uid, semesterId) : Promise.resolve([]),
    semesterId ? getAllocationTarget(user.uid, semesterId) : Promise.resolve(null),
    semesterId
      ? listIncomeEntries(user.uid, semesterId, { periodYear: currentYear, periodMonth: currentMonth })
      : Promise.resolve([]),
    semesterId
      ? listExpenseEntries(user.uid, semesterId, { periodYear: currentYear, periodMonth: currentMonth })
      : Promise.resolve([]),
    semesterId
      ? listIncomeEntries(user.uid, semesterId, { periodYear: 0, periodMonth: 0 })
      : Promise.resolve([]),
    semesterId && anyMilestonePassed ? listIncomeEntries(user.uid, semesterId) : Promise.resolve([]),
    semesterId && anyMilestonePassed ? listExpenseEntries(user.uid, semesterId) : Promise.resolve([]),
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
      <StudentDashboard
        user={user}
        goals={goals}
        debts={debts}
        totalAssets={assets.reduce((s, a) => s + a.currentValue, 0)}
        allocationTarget={allocationTarget}
        currentMonthIncomeEntries={currentMonthIncomeEntries}
        currentMonthExpenseEntries={currentMonthExpenseEntries}
        baselineEntries={baselineEntries}
        activeSemester={activeSemester}
        allSemesterIncomeEntries={allSemesterIncomeEntries}
        allSemesterExpenseEntries={allSemesterExpenseEntries}
        workspace={workspace}
        enrollmentOptions={enrollmentOptions}
        semesterId={semesterId}
        currentMonthLabel={currentMonthLabel}
      />
    </DashboardShell>
  );
}
