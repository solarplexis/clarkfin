import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import { getStudentCurrentWeekProgress } from "@/src/lib/calculations/org-course-grid";
import { getSemesterById, getStudentEnrollment } from "@/src/lib/data/repositories";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const semesterId = (searchParams.get("semesterId") ?? user.activeSemesterId ?? "").trim();
    const rawWeek = (searchParams.get("week") ?? "").trim();
    const week = rawWeek ? Number(rawWeek) : undefined;

    if (!semesterId) {
      return NextResponse.json(
        { error: "Select an active course workspace first." },
        { status: 400 }
      );
    }

    if (week !== undefined && (!Number.isInteger(week) || week < 1)) {
      return NextResponse.json({ error: "week must be a positive integer." }, { status: 400 });
    }

    const enrollment = await getStudentEnrollment(user.uid, semesterId);

    if (!enrollment || enrollment.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "You are not enrolled in that course." }, { status: 403 });
    }

    const semester = await getSemesterById(semesterId);

    if (!semester || semester.orgId !== user.organizationId) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const progress = await getStudentCurrentWeekProgress({
      organizationId: user.organizationId,
      userId: user.uid,
      semester,
      weekNumber: week
    });

    return NextResponse.json({ ok: true, ...progress });
  } catch (error) {
    if (error instanceof Error && error.message.includes("week must be between")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load weekly course progress." },
      { status: 500 }
    );
  }
}
