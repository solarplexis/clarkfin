import Link from "next/link";
import { notFound } from "next/navigation";

import { InviteRedemptionForm } from "@/components/invite-redemption-form";
import {
  getOrganizationById,
  getSemesterByInviteCode
} from "@/src/lib/data/repositories";

export default async function InvitePage({
  params
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const semester = await getSemesterByInviteCode(code);

  if (!semester) {
    notFound();
  }

  const organization = await getOrganizationById(semester.orgId);

  return (
    <main className="page grid two">
      <section className="hero stack">
        <span className="eyebrow">Invite-only enrollment</span>
        <h1 style={{ maxWidth: "12ch" }}>Set up your student account.</h1>
        <p className="lede">
          You are registering for {semester.title} ({semester.courseCode}) at{" "}
          {organization?.name ?? semester.orgId}. This invite places your activity inside the
          correct organization and semester silo from day one.
        </p>
        <p className="muted">
          Invite code: <strong>{code}</strong>
        </p>
        <Link className="button-secondary" href="/login">
          Already have an account?
        </Link>
      </section>
      <InviteRedemptionForm inviteCode={code} />
    </main>
  );
}
