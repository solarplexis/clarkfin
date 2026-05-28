import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { WeeklyPlannerTool } from "@/components/weekly-planner-tool";
import { requireRole, resolveStudentWorkspace } from "@/src/lib/auth/session";
import {
  getAllocationTarget,
  listDebts,
  listExpenseEntries,
  listGoals,
  listIncomeEntries
} from "@/src/lib/data/repositories";

export const metadata: Metadata = {
  title: "Weekly Planner"
};

export default async function PlannerPage() {
  const user = await requireRole("STUDENT");

  if (!user.currentAge) {
    redirect("/app/student/onboarding");
  }

  const workspace = await resolveStudentWorkspace(user);
  const semesterId = workspace?.activeEnrollment?.semesterId;
  const semester = workspace?.activeSemester ?? null;

  if (!semesterId) {
    redirect("/app/student");
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [allocationTarget, baselineEntries, allExpenseEntries, currentMonthIncomeEntries, debts, goals] = await Promise.all([
    getAllocationTarget(user.uid, semesterId),
    listIncomeEntries(user.uid, semesterId, { periodYear: 0, periodMonth: 0 }),
    listExpenseEntries(user.uid, semesterId),
    listIncomeEntries(user.uid, semesterId, { periodYear: currentYear, periodMonth: currentMonth }),
    listDebts(user.uid, semesterId),
    listGoals(user.uid, semesterId)
  ]);

  return (
    <DashboardShell user={user}>
      <WeeklyPlannerTool
        user={user}
        semesterId={semesterId}
        semester={semester}
        allocationTarget={allocationTarget}
        baselineEntries={baselineEntries}
        initialEntries={allExpenseEntries}
        debts={debts}
        goals={goals}
        currentMonthIncomeEntries={currentMonthIncomeEntries}
      />
    </DashboardShell>
  );
}
