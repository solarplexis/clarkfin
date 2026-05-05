import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { IncomeStatementTool } from "@/components/income-statement-tool";
import { requireRole, resolveStudentWorkspace } from "@/src/lib/auth/session";
import { listDebts, listExpenseEntries, listIncomeEntries } from "@/src/lib/data/repositories";

export default async function IncomeStatementPage() {
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
  const initialYear = now.getFullYear();
  const initialMonth = now.getMonth() + 1;

  const [incomeEntries, expenseEntries, debts] = await Promise.all([
    listIncomeEntries(user.uid, semesterId, { periodYear: initialYear, periodMonth: initialMonth }),
    listExpenseEntries(user.uid, semesterId, { periodYear: initialYear, periodMonth: initialMonth }),
    listDebts(user.uid, semesterId)
  ]);

  return (
    <DashboardShell user={user}>
      <IncomeStatementTool
        semesterId={semesterId}
        initialYear={initialYear}
        initialMonth={initialMonth}
        initialIncomeEntries={incomeEntries}
        initialExpenseEntries={expenseEntries}
        debts={debts}
      />
    </DashboardShell>
  );
}
