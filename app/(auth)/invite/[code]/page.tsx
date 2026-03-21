import Link from "next/link";
import { notFound } from "next/navigation";

import { InviteRedemptionForm } from "@/components/invite-redemption-form";
import {
  getOrganizationById,
  getSemesterById,
  getStudentInviteByCode
} from "@/src/lib/data/repositories";

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
    <main className="page grid two">
      <section className="hero stack">
        <span className="eyebrow">Invite-only enrollment</span>
        <h1 style={{ maxWidth: "12ch" }}>Set up your student account.</h1>
        <p className="lede">
          You are registering for {semester.title} ({semester.courseCode}) at{" "}
          {organization?.name ?? semester.orgId}. This invite is reserved for{" "}
          {invite.studentFirstName} {invite.studentLastName} and will place your activity inside
          the correct organization and course silo from day one.
        </p>
        <p className="muted">
          Invited email: <strong>{invite.studentEmail}</strong>
        </p>
        <p className="muted">
          If you already have a ClarkFin account, use the same email and your existing password to
          add this new enrollment.
        </p>
        <Link className="button-secondary" href="/login">
          Already have an account?
        </Link>
      </section>
      <InviteRedemptionForm
        inviteCode={code}
        invitedEmail={invite.studentEmail}
        invitedFirstName={invite.studentFirstName}
        invitedLastName={invite.studentLastName}
      />
    </main>
  );
}
