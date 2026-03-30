import { BudgetTool } from "@/components/budget-tool";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole, resolveStudentWorkspace } from "@/src/lib/auth/session";
import { getBudgetActualsByMonth, getBudgetDraft } from "@/src/lib/data/repositories";

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function BudgetPage() {
  const user = await requireRole("STUDENT");
  const workspace = await resolveStudentWorkspace(user);
  const semesterId = workspace?.activeEnrollment?.semesterId;
  const [draft, actuals] = await Promise.all([
    semesterId ? getBudgetDraft(user.uid, semesterId) : null,
    semesterId ? getBudgetActualsByMonth(user.uid, semesterId, currentMonthKey()) : null
  ]);
  const semesterLabel = workspace?.activeSemester
    ? `${workspace.activeSemester.courseCode} · ${workspace.activeSemester.title}`
    : undefined;

  return (
    <DashboardShell user={user}>
      <BudgetTool initialDraft={draft} initialActuals={actuals} semesterId={semesterId} semesterLabel={semesterLabel} />
    </DashboardShell>
  );
}
