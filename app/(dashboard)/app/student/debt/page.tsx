import { DashboardShell } from "@/components/dashboard-shell";
import { DebtSimulator } from "@/components/debt-simulator";
import { requireRole } from "@/src/lib/auth/session";
import { getDebtScenario } from "@/src/lib/data/repositories";

export default async function DebtPage() {
  const user = await requireRole("STUDENT");
  const scenario = user.semesterId ? await getDebtScenario(user.uid, user.semesterId) : null;

  return (
    <DashboardShell user={user}>
      <DebtSimulator initialScenario={scenario} />
    </DashboardShell>
  );
}
