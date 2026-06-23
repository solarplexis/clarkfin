import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  createActivityLog,
  deleteExpenseEntry,
  getStudentEnrollment,
  updateExpenseEntry,
  VALID_EXPENSE_CATEGORIES
} from "@/src/lib/data/repositories";
import type { ExpenseCategory } from "@/types/domain";

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

    const category = body.category as ExpenseCategory;

    if (!VALID_EXPENSE_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_EXPENSE_CATEGORIES.join(", ")}.` },
        { status: 400 }
      );
    }

    const entry = await updateExpenseEntry({
      entryId,
      userId: user.uid,
      semesterId,
      category,
      label: String(body.label ?? ""),
      amount: Number(body.amount ?? 0),
      periodYear: Number(body.periodYear ?? 0),
      periodMonth: Number(body.periodMonth ?? 0),
      periodWeek: Number(body.periodWeek ?? 0),
      isRecurring: Boolean(body.isRecurring ?? false)
    });

    await createActivityLog({
      userId: user.uid,
      organizationId: user.organizationId,
      semesterId,
      module: "budget",
      action: "expense_updated",
      status: "completed",
      summary: `Expense updated: ${String(body.label ?? "")}`,
      payload: { entryId, category, amount: Number(body.amount ?? 0) }
    });

    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update expense entry." },
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

    await deleteExpenseEntry(entryId, user.uid, semesterId);

    await createActivityLog({
      userId: user.uid,
      organizationId: user.organizationId,
      semesterId,
      module: "budget",
      action: "expense_deleted",
      status: "completed",
      summary: "Expense deleted",
      payload: { entryId }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete expense entry." },
      { status: 500 }
    );
  }
}
