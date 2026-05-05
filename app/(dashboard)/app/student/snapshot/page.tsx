import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { MonthlySnapshotTool } from "@/components/monthly-snapshot-tool";
import { requireRole, resolveStudentWorkspace } from "@/src/lib/auth/session";
import {
  getAllocationTarget,
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

export default async function SnapshotPage() {
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

  const [
    allocationTarget,
    baselineEntries,
    incomeEntries,
    expenseEntries,
    assets,
    debts,
    goals
  ] = await Promise.all([
    getAllocationTarget(user.uid, semesterId),
    listIncomeEntries(user.uid, semesterId, { periodYear: 0, periodMonth: 0 }),
    listIncomeEntries(user.uid, semesterId, { periodYear: currentYear, periodMonth: currentMonth }),
    listExpenseEntries(user.uid, semesterId, { periodYear: currentYear, periodMonth: currentMonth }),
    listAssets(user.uid, semesterId),
    listDebts(user.uid, semesterId),
    listGoals(user.uid, semesterId)
  ]);

  const totalAssets = assets.reduce((s, a) => s + a.currentValue, 0);

  return (
    <DashboardShell user={user}>
      <MonthlySnapshotTool
        user={user}
        semesterId={semesterId}
        allocationTarget={allocationTarget}
        baselineEntries={baselineEntries}
        incomeEntries={incomeEntries}
        expenseEntries={expenseEntries}
        totalAssets={totalAssets}
        debts={debts}
        goals={goals}
        currentYear={currentYear}
        currentMonth={currentMonth}
        currentMonthLabel={currentMonthLabel}
      />
    </DashboardShell>
  );
}
