import { NextResponse } from "next/server";

import { getAdminAuth } from "@/src/lib/firebase/admin";
import {
  createActivityLog,
  createUserProfile,
  getOrganizationById,
  getSemesterByInviteCode
} from "@/src/lib/data/repositories";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      inviteCode?: string;
      fullName?: string;
      email?: string;
      password?: string;
    };

    const inviteCode = String(body.inviteCode ?? "").trim();
    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!inviteCode || !fullName || !email || password.length < 8) {
      return NextResponse.json(
        { error: "Invite code, full name, email, and an 8+ character password are required." },
        { status: 400 }
      );
    }

    const semester = await getSemesterByInviteCode(inviteCode);

    if (!semester || !semester.isActive) {
      return NextResponse.json({ error: "This invite code is invalid or inactive." }, { status: 404 });
    }

    const organization = await getOrganizationById(semester.orgId);
    const allowedDomains = organization?.settings?.allowedEmailDomains ?? [];

    if (allowedDomains.length > 0) {
      const domain = email.split("@")[1] ?? "";

      if (!allowedDomains.includes(domain)) {
        return NextResponse.json(
          { error: `Email domain must be one of: ${allowedDomains.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const adminAuth = getAdminAuth();

    try {
      await adminAuth.getUserByEmail(email);

      return NextResponse.json({ error: "An account already exists for this email." }, { status: 409 });
    } catch {
      // Safe to continue when the user does not already exist.
    }

    const authUser = await adminAuth.createUser({
      email,
      password,
      displayName: fullName
    });

    await createUserProfile({
      uid: authUser.uid,
      email,
      fullName,
      role: "STUDENT",
      organizationId: semester.orgId,
      semesterId: semester.semesterId
    });

    await createActivityLog({
      userId: authUser.uid,
      organizationId: semester.orgId,
      semesterId: semester.semesterId,
      module: "auth",
      action: "invite_redeemed",
      status: "system",
      summary: "Student account created from invite code.",
      payload: {
        inviteCode,
        email
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to redeem invite."
      },
      { status: 500 }
    );
  }
}
