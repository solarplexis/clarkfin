import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  deleteStudentInvite,
  getStudentInviteById,
  updateStudentInviteStatus
} from "@/src/lib/data/repositories";

export async function GET(
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

    return NextResponse.json({ ok: true, invite });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load invite." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const { inviteId } = await params;
    const body = (await request.json()) as { status?: string };
    const status = String(body.status ?? "").trim();

    if (!["pending", "redeemed", "revoked"].includes(status)) {
      return NextResponse.json({ error: "Invalid status value." }, { status: 400 });
    }

    const invite = await updateStudentInviteStatus({
      inviteId,
      organizationId: user.organizationId,
      status: status as "pending" | "redeemed" | "revoked"
    });

    return NextResponse.json({ ok: true, invite });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update invite." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const { inviteId } = await params;

    await deleteStudentInvite(inviteId, user.organizationId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete invite." },
      { status: 500 }
    );
  }
}
