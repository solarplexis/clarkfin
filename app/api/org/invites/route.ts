import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  createStudentInvite,
  getSemesterById,
  listStudentInvitesForOrganization
} from "@/src/lib/data/repositories";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const invites = await listStudentInvitesForOrganization(user.organizationId);

    return NextResponse.json({ ok: true, invites });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load invites."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const body = (await request.json()) as {
      semesterId?: string;
      studentId?: string;
      studentIds?: string[];
    };

    const semesterId = String(body.semesterId ?? "").trim();
    const studentIds = Array.isArray(body.studentIds)
      ? Array.from(new Set(body.studentIds.map((id) => String(id).trim()).filter(Boolean)))
      : [];
    const studentId = String(body.studentId ?? "").trim();

    if (!semesterId || (studentIds.length === 0 && !studentId)) {
      return NextResponse.json(
        { error: "Course and student selection are required." },
        { status: 400 }
      );
    }

    const semester = await getSemesterById(semesterId);

    if (!semester || semester.orgId !== user.organizationId) {
      return NextResponse.json({ error: "That course could not be found." }, { status: 404 });
    }

    const targetStudentIds = studentIds.length > 0 ? studentIds : [studentId];
    const invites = [] as Array<Awaited<ReturnType<typeof createStudentInvite>>>;

    for (const targetStudentId of targetStudentIds) {
      const invite = await createStudentInvite({
        studentId: targetStudentId,
        organizationId: user.organizationId,
        semesterId,
        createdByUid: user.uid
      });
      invites.push(invite);
    }

    return NextResponse.json({ ok: true, invites });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create invite."
      },
      { status: 500 }
    );
  }
}
