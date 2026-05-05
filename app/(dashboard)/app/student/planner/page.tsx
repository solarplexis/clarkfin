import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { WeeklyPlannerTool } from "@/components/weekly-planner-tool";
import { requireRole, resolveStudentWorkspace } from "@/src/lib/auth/session";
import {
  getAllocationTarget,
  listDebts,
  listExpenseEntries,
  listIncomeEntries
} from "@/src/lib/data/repositories";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default async function PlannerPage() {
  const user = await requireRole("STUDENT");

  if (!user.currentAge) {
    redirect("/app/student/onboarding");
  }

  const workspace = await resolveStudentWorkspace(user);
  const semesterId = workspace?.activeEnrollment?.semesterId;

  if (!semesterId) {
    redirect("/app/student");
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentMonthLabel = `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`;

  const [allocationTarget, baselineEntries, currentMonthEntries, debts] = await Promise.all([
    getAllocationTarget(user.uid, semesterId),
    listIncomeEntries(user.uid, semesterId, { periodYear: 0, periodMonth: 0 }),
    listExpenseEntries(user.uid, semesterId, { periodYear: currentYear, periodMonth: currentMonth }),
    listDebts(user.uid, semesterId)
  ]);

  return (
    <DashboardShell user={user}>
      <WeeklyPlannerTool
        user={user}
        semesterId={semesterId}
        allocationTarget={allocationTarget}
        baselineEntries={baselineEntries}
        initialEntries={currentMonthEntries}
        debts={debts}
        currentYear={currentYear}
        currentMonth={currentMonth}
        currentMonthLabel={currentMonthLabel}
      />
    </DashboardShell>
  );
}
