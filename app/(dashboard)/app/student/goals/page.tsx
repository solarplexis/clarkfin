import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { GoalTimelineTool } from "@/components/goal-timeline-tool";
import { requireRole, resolveStudentWorkspace } from "@/src/lib/auth/session";
import {
  getAllocationTarget,
  listAssets,
  listDebts,
  listGoals,
  listIncomeEntries
} from "@/src/lib/data/repositories";

export default async function GoalsPage() {
  const user = await requireRole("STUDENT");

  if (!user.currentAge) {
    redirect("/app/student/onboarding");
  }

  const workspace = await resolveStudentWorkspace(user);
  const semesterId = workspace?.activeEnrollment?.semesterId;

  if (!semesterId) {
    redirect("/app/student");
  }

  const activeSemester = workspace?.activeSemester ?? null;

  const [goals, debts, assets, allocationTarget, baselineEntries] = await Promise.all([
    listGoals(user.uid, semesterId),
    listDebts(user.uid, semesterId),
    listAssets(user.uid, semesterId),
    getAllocationTarget(user.uid, semesterId),
    listIncomeEntries(user.uid, semesterId, { periodYear: 0, periodMonth: 0 })
  ]);

  const totalAssets = assets.reduce((s, a) => s + a.currentValue, 0);
  const currentNetWorth = totalAssets - debts.reduce((s, d) => s + d.currentBalance, 0);

  return (
    <DashboardShell user={user}>
      <GoalTimelineTool
        user={user}
        goals={goals}
        debts={debts}
        allocationTarget={allocationTarget}
        baselineEntries={baselineEntries}
        currentNetWorth={currentNetWorth}
        activeSemester={activeSemester}
        semesterId={semesterId}
      />
    </DashboardShell>
  );
}
