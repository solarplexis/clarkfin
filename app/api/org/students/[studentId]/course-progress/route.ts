import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import { getStudentCurrentWeekProgress } from "@/src/lib/calculations/org-course-grid";
import {
  getSemesterById,
  getStudentEnrollment,
  getStudentRecordById
} from "@/src/lib/data/repositories";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const { studentId } = await params;
    const student = await getStudentRecordById(studentId);

    if (!student || student.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "That student could not be found." }, { status: 404 });
    }

    if (!student.authUserId) {
      return NextResponse.json({ ok: true, progress: null });
    }

    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get("semesterId")?.trim();
    const rawWeek = (searchParams.get("week") ?? "").trim();
    const week = rawWeek ? Number(rawWeek) : undefined;

    if (!semesterId) {
      return NextResponse.json({ error: "semesterId query parameter is required." }, { status: 400 });
    }

    if (week !== undefined && (!Number.isInteger(week) || week < 1)) {
      return NextResponse.json({ error: "week must be a positive integer." }, { status: 400 });
    }

    const enrollment = await getStudentEnrollment(student.authUserId, semesterId);

    if (!enrollment || enrollment.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "That student is not enrolled in that course." }, { status: 404 });
    }

    const semester = await getSemesterById(semesterId);

    if (!semester || semester.orgId !== user.organizationId) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const progress = await getStudentCurrentWeekProgress({
      organizationId: user.organizationId,
      userId: student.authUserId,
      semester,
      weekNumber: week
    });

    return NextResponse.json({ ok: true, progress });
  } catch (error) {
    if (error instanceof Error && error.message.includes("week must be between")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load student course progress." },
      { status: 500 }
    );
  }
}
