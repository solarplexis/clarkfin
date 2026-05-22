import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard-shell";
import { DebtManager } from "@/components/debt-manager";
import { requireRole, resolveStudentWorkspace } from "@/src/lib/auth/session";
import { listDebts } from "@/src/lib/data/repositories";

export const metadata: Metadata = {
  title: "Debt"
};

export default async function DebtPage() {
  const user = await requireRole("STUDENT");
  const workspace = await resolveStudentWorkspace(user);
  const semesterId = workspace?.activeEnrollment?.semesterId;
  const debts = semesterId ? await listDebts(user.uid, semesterId) : [];
  const semesterLabel = workspace?.activeSemester
    ? `${workspace.activeSemester.courseCode} · ${workspace.activeSemester.title}`
    : undefined;

  return (
    <DashboardShell user={user}>
      <DebtManager
        initialDebts={debts}
        semesterId={semesterId}
        semesterLabel={semesterLabel}
      />
    </DashboardShell>
  );
}
