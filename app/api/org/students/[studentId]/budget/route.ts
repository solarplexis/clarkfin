import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  getBudgetActuals,
  getBudgetDraft,
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
      return NextResponse.json({ ok: true, budget: null, actuals: null });
    }

    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get("semesterId")?.trim();

    if (!semesterId) {
      return NextResponse.json({ error: "semesterId query parameter is required." }, { status: 400 });
    }

    const enrollment = await getStudentEnrollment(student.authUserId, semesterId);

    if (!enrollment || enrollment.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "That student is not enrolled in that course." }, { status: 404 });
    }

    const [budget, actuals] = await Promise.all([
      getBudgetDraft(student.authUserId, semesterId),
      getBudgetActuals(student.authUserId, semesterId)
    ]);

    return NextResponse.json({ ok: true, budget, actuals });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load budget." },
      { status: 500 }
    );
  }
}
