import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  createStudentInvite,
  getSemesterById
} from "@/src/lib/data/repositories";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const body = (await request.json()) as {
      semesterId?: string;
      studentId?: string;
    };

    const semesterId = String(body.semesterId ?? "").trim();
    const studentId = String(body.studentId ?? "").trim();

    if (!semesterId || !studentId) {
      return NextResponse.json(
        { error: "Course and student selection are required." },
        { status: 400 }
      );
    }

    const semester = await getSemesterById(semesterId);

    if (!semester || semester.orgId !== user.organizationId) {
      return NextResponse.json({ error: "That course could not be found." }, { status: 404 });
    }

    const invite = await createStudentInvite({
      studentId,
      organizationId: user.organizationId,
      semesterId,
      createdByUid: user.uid
    });

    return NextResponse.json({ ok: true, invite });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create invite."
      },
      { status: 500 }
    );
  }
}
