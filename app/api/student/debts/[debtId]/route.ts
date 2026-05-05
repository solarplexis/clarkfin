import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  deleteDebt,
  getStudentEnrollment,
  updateDebt,
  VALID_DEBT_CATEGORIES
} from "@/src/lib/data/repositories";
import type { DebtCategory } from "@/types/domain";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ debtId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const { debtId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const semesterId = String(body.semesterId ?? user.activeSemesterId ?? "").trim();

    if (!semesterId) {
      return NextResponse.json({ error: "semesterId is required." }, { status: 400 });
    }

    const enrollment = await getStudentEnrollment(user.uid, semesterId);

    if (!enrollment || enrollment.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "You are not enrolled in that course." }, { status: 403 });
    }

    const category = body.category as DebtCategory;
    const label = String(body.label ?? "").trim();

    if (!VALID_DEBT_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_DEBT_CATEGORIES.join(", ")}.` },
        { status: 400 }
      );
    }

    if (!label) {
      return NextResponse.json({ error: "label is required." }, { status: 400 });
    }

    const debt = await updateDebt({
      debtId,
      userId: user.uid,
      semesterId,
      category,
      label,
      originalBalance: Number(body.originalBalance ?? 0),
      currentBalance: Number(body.currentBalance ?? 0),
      monthlyPayment: Number(body.monthlyPayment ?? 0),
      interestRate: Number(body.interestRate ?? 0),
      repaymentGoalDate: body.repaymentGoalDate ? String(body.repaymentGoalDate) : undefined
    });

    return NextResponse.json({ ok: true, debt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update debt." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ debtId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const { debtId } = await params;
    const { searchParams } = new URL(request.url);
    const semesterId = (searchParams.get("semesterId") ?? user.activeSemesterId ?? "").trim();

    if (!semesterId) {
      return NextResponse.json({ error: "semesterId is required." }, { status: 400 });
    }

    const enrollment = await getStudentEnrollment(user.uid, semesterId);

    if (!enrollment || enrollment.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "You are not enrolled in that course." }, { status: 403 });
    }

    await deleteDebt(debtId, user.uid, semesterId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete debt." },
      { status: 500 }
    );
  }
}
