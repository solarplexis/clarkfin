import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding-wizard";
import { requireRole, resolveStudentWorkspace } from "@/src/lib/auth/session";
import { getAllocationTarget, listDebts, listGoals, listIncomeEntries } from "@/src/lib/data/repositories";

export const metadata: Metadata = {
  title: "Student Onboarding"
};

export default async function OnboardingPage() {
  const user = await requireRole("STUDENT");

  const workspace = await resolveStudentWorkspace(user);
  const semesterId = workspace?.activeEnrollment?.semesterId;

  if (!semesterId || !user.organizationId) {
    redirect("/app/student");
  }

  const [initialDebts, initialGoals, allocationTarget, baselineEntries] = await Promise.all([
    listDebts(user.uid, semesterId),
    listGoals(user.uid, semesterId),
    getAllocationTarget(user.uid, semesterId),
    listIncomeEntries(user.uid, semesterId, { periodYear: 0, periodMonth: 0 })
  ]);

  // Step 4 (income baseline + allocation) is the only place that writes the
  // data the rest of the app depends on. If a student skipped it via
  // "Finish later", currentAge alone isn't enough to consider them done —
  // send them back here instead of permanently locking them out.
  const onboardingComplete = Boolean(user.currentAge) && Boolean(allocationTarget) && baselineEntries.length > 0;

  if (onboardingComplete) {
    redirect("/app/student");
  }

  return (
    <OnboardingWizard
      user={user}
      semesterId={semesterId}
      organizationId={user.organizationId}
      initialDebts={initialDebts}
      initialGoals={initialGoals}
      initialStep={user.currentAge ? 4 : 0}
    />
  );
}
