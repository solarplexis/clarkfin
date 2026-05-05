import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding-wizard";
import { requireRole, resolveStudentWorkspace } from "@/src/lib/auth/session";
import { listDebts, listGoals } from "@/src/lib/data/repositories";

export default async function OnboardingPage() {
  const user = await requireRole("STUDENT");

  if (user.currentAge) {
    redirect("/app/student");
  }

  const workspace = await resolveStudentWorkspace(user);
  const semesterId = workspace?.activeEnrollment?.semesterId;

  if (!semesterId || !user.organizationId) {
    redirect("/app/student");
  }

  const [initialDebts, initialGoals] = await Promise.all([
    listDebts(user.uid, semesterId),
    listGoals(user.uid, semesterId)
  ]);

  return (
    <OnboardingWizard
      user={user}
      semesterId={semesterId}
      organizationId={user.organizationId}
      initialDebts={initialDebts}
      initialGoals={initialGoals}
    />
  );
}
