import { BudgetTool } from "@/components/budget-tool";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole, resolveStudentWorkspace } from "@/src/lib/auth/session";
import { getBudgetDraft } from "@/src/lib/data/repositories";

export default async function BudgetPage() {
  const user = await requireRole("STUDENT");
  const workspace = await resolveStudentWorkspace(user);
  const semesterId = workspace?.activeEnrollment?.semesterId;
  const draft = semesterId ? await getBudgetDraft(user.uid, semesterId) : null;
  const semesterLabel = workspace?.activeSemester
    ? `${workspace.activeSemester.courseCode} · ${workspace.activeSemester.title}`
    : undefined;

  return (
    <DashboardShell user={user}>
      <BudgetTool initialDraft={draft} semesterId={semesterId} semesterLabel={semesterLabel} />
    </DashboardShell>
  );
}
