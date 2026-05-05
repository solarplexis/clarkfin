import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  createDebt,
  getStudentEnrollment,
  listDebts,
  VALID_DEBT_CATEGORIES
} from "@/src/lib/data/repositories";
import type { DebtCategory } from "@/types/domain";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const semesterId = (searchParams.get("semesterId") ?? user.activeSemesterId ?? "").trim();

    if (!semesterId) {
      return NextResponse.json({ error: "Select an active course workspace first." }, { status: 400 });
    }

    const enrollment = await getStudentEnrollment(user.uid, semesterId);

    if (!enrollment || enrollment.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "You are not enrolled in that course." }, { status: 403 });
    }

    const debts = await listDebts(user.uid, semesterId);

    return NextResponse.json({ ok: true, debts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load debts." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

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

    const debt = await createDebt({
      userId: user.uid,
      organizationId: user.organizationId,
      semesterId,
      category,
      label,
      originalBalance: Number(body.originalBalance ?? 0),
      currentBalance: Number(body.currentBalance ?? 0),
      monthlyPayment: Number(body.monthlyPayment ?? 0),
      interestRate: Number(body.interestRate ?? 0),
      repaymentGoalDate: body.repaymentGoalDate ? String(body.repaymentGoalDate) : undefined
    });

    return NextResponse.json({ ok: true, debt }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create debt." },
      { status: 500 }
    );
  }
}
