import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InviteRedemptionForm } from "@/components/invite-redemption-form";
import {
  getOrganizationById,
  getSemesterById,
  getStudentInviteByCode
} from "@/src/lib/data/repositories";

export const metadata: Metadata = {
  title: "Accept Invite"
};

export default async function InvitePage({
  params
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const invite = await getStudentInviteByCode(code);

  if (!invite || invite.status !== "pending") {
    notFound();
  }

  const semester = await getSemesterById(invite.semesterId);

  if (!semester || !semester.isActive) {
    notFound();
  }

  const organization = await getOrganizationById(invite.organizationId);

  return (
    <main className="auth-centered">
      <div className="auth-box" style={{ maxWidth: 480 }}>
        <div className="auth-box-header">
          <span className="auth-box-logo">ClarkFin</span>
          <h1>Accept your invite</h1>
          <p>
            {semester.courseCode} · {semester.title}
            {organization ? ` — ${organization.name}` : ""}
          </p>
        </div>
        <InviteRedemptionForm
          inviteCode={code}
          invitedEmail={invite.studentEmail}
          invitedFirstName={invite.studentFirstName}
          invitedLastName={invite.studentLastName}
        />
      </div>
    </main>
  );
}
