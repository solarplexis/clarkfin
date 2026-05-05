import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  deleteIncomeEntry,
  getStudentEnrollment,
  updateIncomeEntry,
  VALID_INCOME_CATEGORIES
} from "@/src/lib/data/repositories";
import type { IncomeEntryCategory } from "@/types/domain";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const { entryId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const semesterId = String(body.semesterId ?? user.activeSemesterId ?? "").trim();

    if (!semesterId) {
      return NextResponse.json({ error: "semesterId is required." }, { status: 400 });
    }

    const enrollment = await getStudentEnrollment(user.uid, semesterId);

    if (!enrollment || enrollment.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "You are not enrolled in that course." }, { status: 403 });
    }

    const category = body.category as IncomeEntryCategory;

    if (!VALID_INCOME_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_INCOME_CATEGORIES.join(", ")}.` },
        { status: 400 }
      );
    }

    const entry = await updateIncomeEntry({
      entryId,
      userId: user.uid,
      semesterId,
      category,
      label: String(body.label ?? ""),
      amount: Number(body.amount ?? 0),
      periodYear: Number(body.periodYear ?? 0),
      periodMonth: Number(body.periodMonth ?? 0),
      periodWeek: Number(body.periodWeek ?? 0)
    });

    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update income entry." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const { entryId } = await params;
    const { searchParams } = new URL(request.url);
    const semesterId = (searchParams.get("semesterId") ?? user.activeSemesterId ?? "").trim();

    if (!semesterId) {
      return NextResponse.json({ error: "semesterId is required." }, { status: 400 });
    }

    const enrollment = await getStudentEnrollment(user.uid, semesterId);

    if (!enrollment || enrollment.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "You are not enrolled in that course." }, { status: 403 });
    }

    await deleteIncomeEntry(entryId, user.uid, semesterId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete income entry." },
      { status: 500 }
    );
  }
}
