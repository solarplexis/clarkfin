import type { Metadata } from "next";
import Link from "next/link";
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

function InviteMessage({ heading, message }: { heading: string; message: string }) {
  return (
    <main className="auth-centered">
      <div className="auth-box" style={{ maxWidth: 480 }}>
        <div className="auth-box-header">
          <span className="auth-box-logo">ClarkFin</span>
          <h1>{heading}</h1>
        </div>
        <p className="note-box">{message}</p>
        <p className="auth-box-footer">
          <Link href="/login">Go to sign in</Link>
        </p>
      </div>
    </main>
  );
}

export default async function InvitePage({
  params
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const invite = await getStudentInviteByCode(code);

  if (!invite) {
    notFound();
  }

  if (invite.status === "redeemed") {
    return (
      <InviteMessage
        heading="Invite already accepted"
        message="This invite has already been used to create an account. If this is your account, sign in below."
      />
    );
  }

  if (invite.status === "revoked") {
    return (
      <InviteMessage
        heading="Invite no longer valid"
        message="This invite has been revoked. Contact your instructor if you still need access."
      />
    );
  }

  const semester = await getSemesterById(invite.semesterId);

  if (!semester || !semester.isActive) {
    return (
      <InviteMessage
        heading="Course no longer active"
        message="This course is no longer accepting invites. Contact your instructor for help."
      />
    );
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
