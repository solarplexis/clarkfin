import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { IncomeStatementTool } from "@/components/income-statement-tool";
import { requireRole, resolveStudentWorkspace } from "@/src/lib/auth/session";
import {
  getAllocationTarget,
  listDebts,
  listExpenseEntries,
  listGoals,
  listIncomeEntries
} from "@/src/lib/data/repositories";

export const metadata: Metadata = {
  title: "Income"
};

export default async function IncomePage() {
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

  const [incomeEntries, expenseEntries, debts, goals, allocationTarget] = await Promise.all([
    listIncomeEntries(user.uid, semesterId),
    listExpenseEntries(user.uid, semesterId),
    listDebts(user.uid, semesterId),
    listGoals(user.uid, semesterId),
    getAllocationTarget(user.uid, semesterId)
  ]);

  return (
    <DashboardShell user={user}>
      <IncomeStatementTool
        semesterId={semesterId}
        semester={semester}
        initialIncomeEntries={incomeEntries}
        initialExpenseEntries={expenseEntries}
        debts={debts}
        goals={goals}
        allocationTarget={allocationTarget}
      />
    </DashboardShell>
  );
}
