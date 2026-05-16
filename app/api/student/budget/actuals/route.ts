// @deprecated legacy BudgetTool actuals endpoint. GET now derives from IncomeEntry/ExpenseEntry via getBudgetActualsByMonth fallback.
// PUT still writes to the legacy `budget_actuals_monthly` collection. Remove both after BudgetTool UI is retired.
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  createActivityLog,
  getBudgetActualsByMonth,
  getStudentEnrollment,
  upsertBudgetActualsByMonth
} from "@/src/lib/data/repositories";
import type { ActualItem } from "@/types/domain";

function sanitizeActualItems(value: unknown): ActualItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const candidate = item as Partial<ActualItem>;
    return {
      id: String(candidate.id ?? Math.random().toString(36).slice(2, 8)),
      label: String(candidate.label ?? ""),
      amount: Number(candidate.amount ?? 0),
      ...(candidate.date ? { date: String(candidate.date) } : {}),
      ...(candidate.category ? { category: String(candidate.category) } : {})
    } satisfies ActualItem;
  });
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const semesterId = (searchParams.get("semesterId") ?? user.activeSemesterId ?? "").trim();
    const month = (searchParams.get("month") ?? "").trim();

    if (!semesterId) {
      return NextResponse.json(
        { error: "semesterId is required (or set an active workspace first)." },
        { status: 400 }
      );
    }

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month is required (format: YYYY-MM)." }, { status: 400 });
    }

    const enrollment = await getStudentEnrollment(user.uid, semesterId);

    if (!enrollment || enrollment.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "You are not enrolled in that course." }, { status: 403 });
    }

    const actuals = await getBudgetActualsByMonth(user.uid, semesterId, month);

    return NextResponse.json({ ok: true, actuals });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load budget actuals." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const semesterId = String(body.semesterId ?? user.activeSemesterId ?? "").trim();
    const month = String(body.month ?? "").trim();

    if (!semesterId) {
      return NextResponse.json(
        { error: "semesterId is required (or set an active workspace first)." },
        { status: 400 }
      );
    }

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month is required (format: YYYY-MM)." }, { status: 400 });
    }

    const enrollment = await getStudentEnrollment(user.uid, semesterId);

    if (!enrollment || enrollment.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "You are not enrolled in that course." }, { status: 403 });
    }

    const actualIncome = sanitizeActualItems(body.actualIncome);
    const actualSavings = sanitizeActualItems(body.actualSavings);
    const actualExpenses = sanitizeActualItems(body.actualExpenses);
    const notes = String(body.notes ?? "");

    await upsertBudgetActualsByMonth({
      userId: user.uid,
      organizationId: user.organizationId,
      semesterId,
      actualIncome,
      actualSavings,
      actualExpenses,
      notes
    }, month);

    await createActivityLog({
      userId: user.uid,
      organizationId: user.organizationId,
      semesterId,
      module: "budget",
      action: "actuals_saved",
      status: "completed",
      summary: "Budget actuals recorded.",
      payload: {
        actualIncomeCount: actualIncome.length,
        actualSavingsCount: actualSavings.length,
        actualExpenseCount: actualExpenses.length
      }
    });

    const actuals = await getBudgetActualsByMonth(user.uid, semesterId, month);

    return NextResponse.json({ ok: true, actuals });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save budget actuals." },
      { status: 500 }
    );
  }
}
