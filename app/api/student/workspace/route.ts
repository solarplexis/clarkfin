import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  getStudentEnrollment,
  setUserActiveSemester
} from "@/src/lib/data/repositories";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT") {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const body = (await request.json()) as {
      semesterId?: string;
    };
    const semesterId = String(body.semesterId ?? "").trim();

    if (!semesterId) {
      return NextResponse.json({ error: "A course selection is required." }, { status: 400 });
    }

    const enrollment = await getStudentEnrollment(user.uid, semesterId);

    if (!enrollment) {
      return NextResponse.json({ error: "You are not enrolled in that course." }, { status: 403 });
    }

    await setUserActiveSemester(user.uid, semesterId);

    return NextResponse.json({ ok: true, semesterId });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to change workspace."
      },
      { status: 500 }
    );
  }
}
