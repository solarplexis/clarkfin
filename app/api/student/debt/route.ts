import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import { getDebtScenario, getStudentEnrollment } from "@/src/lib/data/repositories";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const semesterId = (searchParams.get("semesterId") ?? user.activeSemesterId ?? "").trim();

    if (!semesterId) {
      return NextResponse.json(
        { error: "Select an active course workspace first." },
        { status: 400 }
      );
    }

    const enrollment = await getStudentEnrollment(user.uid, semesterId);

    if (!enrollment || enrollment.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "You are not enrolled in that course." }, { status: 403 });
    }

    const debt = await getDebtScenario(user.uid, semesterId);

    return NextResponse.json({ ok: true, debt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load debt scenario." },
      { status: 500 }
    );
  }
}
