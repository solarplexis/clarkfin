import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  createExpenseEntry,
  getStudentEnrollment,
  listExpenseEntries,
  VALID_EXPENSE_CATEGORIES
} from "@/src/lib/data/repositories";
import type { ExpenseCategory } from "@/types/domain";

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

    const periodYear = searchParams.has("periodYear") ? Number(searchParams.get("periodYear")) : undefined;
    const periodMonth = searchParams.has("periodMonth") ? Number(searchParams.get("periodMonth")) : undefined;

    const entries = await listExpenseEntries(user.uid, semesterId, { periodYear, periodMonth });

    return NextResponse.json({ ok: true, entries });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load expense entries." },
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

    const category = body.category as ExpenseCategory;

    if (!VALID_EXPENSE_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_EXPENSE_CATEGORIES.join(", ")}.` },
        { status: 400 }
      );
    }

    const entry = await createExpenseEntry({
      userId: user.uid,
      organizationId: user.organizationId,
      semesterId,
      periodYear: Number(body.periodYear ?? 0),
      periodMonth: Number(body.periodMonth ?? 0),
      periodWeek: Number(body.periodWeek ?? 0),
      category,
      label: String(body.label ?? ""),
      amount: Number(body.amount ?? 0),
      isRecurring: Boolean(body.isRecurring ?? false)
    });

    return NextResponse.json({ ok: true, entry }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create expense entry." },
      { status: 500 }
    );
  }
}
