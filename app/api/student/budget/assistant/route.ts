import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import { getStudentEnrollment } from "@/src/lib/data/repositories";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const body = (await request.json()) as {
      semesterId?: string;
    };
    const semesterId = String(body.semesterId ?? user.activeSemesterId ?? "").trim();

    if (!semesterId) {
      return NextResponse.json({ error: "No active semester." }, { status: 400 });
    }

    const enrollment = await getStudentEnrollment(user.uid, semesterId);

    if (!enrollment || enrollment.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Not enrolled in that course." }, { status: 403 });
    }

    // The student budget workflow now centers on IncomeEntry / ExpenseEntry records.
    // Keep the assistant read-only until its tool layer is updated to write to that model.
    return NextResponse.json(
      {
        error:
          "Budget assistant editing is temporarily disabled while legacy budget draft syncing is being removed.",
        budgetUpdated: false,
        actualsUpdated: false,
        readOnly: true
      },
      { status: 409 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Assistant unavailable." },
      { status: 500 }
    );
  }
}
