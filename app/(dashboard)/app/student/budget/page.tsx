import { BudgetTool } from "@/components/budget-tool";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/src/lib/auth/session";
import { getBudgetDraft } from "@/src/lib/data/repositories";

export default async function BudgetPage() {
  const user = await requireRole("STUDENT");
  const draft = user.semesterId ? await getBudgetDraft(user.uid, user.semesterId) : null;

  return (
    <DashboardShell user={user}>
      <BudgetTool initialDraft={draft} />
    </DashboardShell>
  );
}
