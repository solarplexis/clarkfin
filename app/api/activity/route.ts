import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import { calculateDebtScenario } from "@/src/lib/activity/debt";
import {
  createActivityLog,
  getStudentEnrollment,
  upsertBudgetDraft,
  upsertDebtScenario
} from "@/src/lib/data/repositories";
import type { BudgetItem } from "@/types/domain";

function sanitizeBudgetItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    const candidate = item as Partial<BudgetItem>;

    return {
      id: String(candidate.id ?? Math.random().toString(36).slice(2, 8)),
      label: String(candidate.label ?? ""),
      amount: Number(candidate.amount ?? 0)
    } satisfies BudgetItem;
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "STUDENT" || !user.organizationId) {
    return NextResponse.json({ error: "Student session required." }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const type = String(body.type ?? "");
  const semesterId = String(body.semesterId ?? user.activeSemesterId ?? "").trim();

  if (!semesterId) {
    return NextResponse.json({ error: "Select an active course workspace first." }, { status: 400 });
  }

  const enrollment = await getStudentEnrollment(user.uid, semesterId);

  if (!enrollment || enrollment.organizationId !== user.organizationId) {
    return NextResponse.json({ error: "You are not enrolled in that course." }, { status: 403 });
  }

  if (type === "budget.save") {
    const income = sanitizeBudgetItems(body.income);
    const expenses = sanitizeBudgetItems(body.expenses);
    const notes = String(body.notes ?? "");
    const isFinal = Boolean(body.isFinal ?? false);
    const monthlyBalance = Number(body.monthlyBalance ?? 0);

    await upsertBudgetDraft({
      userId: user.uid,
      organizationId: user.organizationId,
      semesterId,
      income,
      expenses,
      notes,
      monthlyBalance,
      isFinal
    });

    await createActivityLog({
      userId: user.uid,
      organizationId: user.organizationId,
      semesterId,
      module: "budget",
      action: isFinal ? "submitted" : "saved",
      status: isFinal ? "completed" : "draft",
      summary: isFinal ? "Budget marked ready for review." : "Budget draft saved.",
      payload: {
        incomeCount: income.length,
        expenseCount: expenses.length,
        monthlyBalance
      }
    });

    return NextResponse.json({ ok: true, message: "Budget saved." });
  }

  if (type === "debt.save") {
    const debtName = String(body.debtName ?? "");
    const balance = Number(body.balance ?? 0);
    const interestRate = Number(body.interestRate ?? 0);
    const minimumPayment = Number(body.minimumPayment ?? 0);
    const plannedPayment = Number(body.plannedPayment ?? 0);
    const notes = String(body.notes ?? "");
    const isFinal = Boolean(body.isFinal ?? false);
    const simulation = calculateDebtScenario({ balance, interestRate, plannedPayment });

    await upsertDebtScenario({
      userId: user.uid,
      organizationId: user.organizationId,
      semesterId,
      debtName,
      balance,
      interestRate,
      minimumPayment,
      plannedPayment,
      payoffMonths: simulation.payoffMonths,
      totalInterest: simulation.totalInterest,
      notes,
      isFinal
    });

    await createActivityLog({
      userId: user.uid,
      organizationId: user.organizationId,
      semesterId,
      module: "debt",
      action: isFinal ? "submitted" : "saved",
      status: isFinal ? "completed" : "draft",
      summary: isFinal ? "Debt strategy marked ready for review." : "Debt scenario saved.",
      payload: {
        debtName,
        balance,
        interestRate,
        plannedPayment,
        payoffMonths: simulation.payoffMonths,
        totalInterest: simulation.totalInterest
      }
    });

    return NextResponse.json({ ok: true, message: "Debt scenario saved." });
  }

  return NextResponse.json({ error: "Unsupported activity type." }, { status: 400 });
}
