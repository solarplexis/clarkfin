import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BalanceSheetTool } from "@/components/balance-sheet-tool";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole, resolveStudentWorkspace } from "@/src/lib/auth/session";
import { listAssets, listDebts } from "@/src/lib/data/repositories";

export const metadata: Metadata = {
  title: "Balance Sheet"
};

export default async function BalanceSheetPage() {
  const user = await requireRole("STUDENT");

  if (!user.currentAge) {
    redirect("/app/student/onboarding");
  }

  const workspace = await resolveStudentWorkspace(user);
  const semesterId = workspace?.activeEnrollment?.semesterId;

  if (!semesterId) {
    redirect("/app/student");
  }

  const [assets, debts] = await Promise.all([
    listAssets(user.uid, semesterId),
    listDebts(user.uid, semesterId)
  ]);

  return (
    <DashboardShell user={user}>
      <BalanceSheetTool
        user={user}
        initialAssets={assets}
        debts={debts}
        semesterId={semesterId}
      />
    </DashboardShell>
  );
}
