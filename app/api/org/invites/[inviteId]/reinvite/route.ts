import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  createStudentInvite,
  deleteStudentInvite,
  getStudentInviteById
} from "@/src/lib/data/repositories";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const { inviteId } = await params;
    const invite = await getStudentInviteById(inviteId);

    if (!invite || invite.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "That invite could not be found." }, { status: 404 });
    }

    await deleteStudentInvite(invite.inviteId, user.organizationId);

    const newInvite = await createStudentInvite({
      studentId: invite.studentId,
      organizationId: user.organizationId,
      semesterId: invite.semesterId,
      createdByUid: user.uid
    });

    return NextResponse.json({ ok: true, invite: newInvite });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to re-invite student." },
      { status: 500 }
    );
  }
}
