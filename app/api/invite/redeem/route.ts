import { NextResponse } from "next/server";

import { getAdminAuth } from "@/src/lib/firebase/admin";
import {
  createActivityLog,
  createStudentEnrollment,
  createUserProfile,
  getStudentRecordById,
  getSemesterById,
  getUserProfileById,
  getStudentInviteByCode,
  linkStudentRecordToAuthUser,
  redeemStudentInvite,
  setUserActiveSemester
} from "@/src/lib/data/repositories";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      inviteCode?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      password?: string;
    };

    const inviteCode = String(body.inviteCode ?? "").trim();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!inviteCode || !firstName || !lastName || !email || password.length < 8) {
      return NextResponse.json(
        {
          error:
            "Invite code, student first name, last name, email, and an 8+ character password are required."
        },
        { status: 400 }
      );
    }

    const invite = await getStudentInviteByCode(inviteCode);

    if (!invite || invite.status !== "pending") {
      return NextResponse.json({ error: "This invite code is invalid or inactive." }, { status: 404 });
    }

    if (email !== invite.studentEmail) {
      return NextResponse.json(
        { error: "This invite can only be redeemed with the invited student email address." },
        { status: 400 }
      );
    }

    const semester = await getSemesterById(invite.semesterId);
    const studentRecord = await getStudentRecordById(invite.studentId);

    if (!semester || !semester.isActive || !studentRecord) {
      return NextResponse.json({ error: "This course is no longer accepting invites." }, { status: 404 });
    }

    const adminAuth = getAdminAuth();
    let authUser;
    let createdNewUser = false;

    try {
      authUser = await adminAuth.getUserByEmail(email);

      const existingProfile = await getUserProfileById(authUser.uid);

      if (!existingProfile || existingProfile.role !== "STUDENT") {
        return NextResponse.json(
          { error: "This email already belongs to a non-student account." },
          { status: 409 }
        );
      }

      if (existingProfile.organizationId !== invite.organizationId) {
        return NextResponse.json(
          { error: "This student account belongs to a different organization." },
          { status: 409 }
        );
      }
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? error.code : "";

      if (code && code !== "auth/user-not-found") {
        throw error;
      }

      authUser = await adminAuth.createUser({
        email,
        password,
        displayName: fullName
      });
      createdNewUser = true;

      await createUserProfile({
        uid: authUser.uid,
        email,
        fullName,
        role: "STUDENT",
        organizationId: invite.organizationId,
        activeSemesterId: semester.semesterId
      });
    }

    if (!authUser) {
      return NextResponse.json({ error: "Unable to provision the student account." }, { status: 500 });
    }

    await createStudentEnrollment({
      userId: authUser.uid,
      organizationId: invite.organizationId,
      semesterId: semester.semesterId,
      inviteId: invite.inviteId,
      studentEmail: email
    });

    await linkStudentRecordToAuthUser({
      studentId: studentRecord.studentId,
      organizationId: invite.organizationId,
      authUserId: authUser.uid,
      firstName,
      lastName,
      email
    });

    if (createdNewUser) {
      await setUserActiveSemester(authUser.uid, semester.semesterId);
    }

    await redeemStudentInvite(invite.inviteId, authUser.uid);

    await createActivityLog({
      userId: authUser.uid,
      organizationId: invite.organizationId,
      semesterId: semester.semesterId,
      module: "auth",
      action: "invite_redeemed",
      status: "system",
      summary: createdNewUser
        ? "Student account created from invite and enrolled."
        : "Existing student account enrolled through invite.",
      payload: {
        inviteCode,
        email,
        inviteId: invite.inviteId,
        createdNewUser
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
