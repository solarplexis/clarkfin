import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BudgetTool } from "@/components/budget-tool";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole, resolveStudentWorkspace } from "@/src/lib/auth/session";
import { getBudgetActuals, getBudgetDraft } from "@/src/lib/data/repositories";

export const metadata: Metadata = {
  title: "Budget"
};

export default async function BudgetPage() {
  const user = await requireRole("STUDENT");

  if (!user.currentAge) {
    redirect("/app/student/onboarding");
  }

  const workspace = await resolveStudentWorkspace(user);
  const semesterId = workspace?.activeEnrollment?.semesterId;
  const semesterLabel = workspace?.activeSemester?.title ?? workspace?.activeEnrollment?.semesterId;

  if (!semesterId) {
    redirect("/app/student");
  }

  const [initialDraftResult, initialActualsResult] = await Promise.allSettled([
    getBudgetDraft(user.uid, semesterId),
    getBudgetActuals(user.uid, semesterId)
  ]);

  const initialDraft = initialDraftResult.status === "fulfilled" ? initialDraftResult.value : null;
  const initialActuals = initialActualsResult.status === "fulfilled" ? initialActualsResult.value : null;

  return (
    <DashboardShell user={user}>
      <BudgetTool
        initialDraft={initialDraft}
        initialActuals={initialActuals}
        semesterId={semesterId}
        semesterLabel={semesterLabel}
      />
    </DashboardShell>
  );
}
