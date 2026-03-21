import { DashboardShell } from "@/components/dashboard-shell";
import { DebtSimulator } from "@/components/debt-simulator";
import { requireRole, resolveStudentWorkspace } from "@/src/lib/auth/session";
import { getDebtScenario } from "@/src/lib/data/repositories";

export default async function DebtPage() {
  const user = await requireRole("STUDENT");
  const workspace = await resolveStudentWorkspace(user);
  const semesterId = workspace?.activeEnrollment?.semesterId;
  const scenario = semesterId ? await getDebtScenario(user.uid, semesterId) : null;
  const semesterLabel = workspace?.activeSemester
    ? `${workspace.activeSemester.courseCode} · ${workspace.activeSemester.title}`
    : undefined;

  return (
    <DashboardShell user={user}>
      <DebtSimulator
        initialScenario={scenario}
        semesterId={semesterId}
        semesterLabel={semesterLabel}
      />
    </DashboardShell>
  );
}
