// @deprecated legacy BudgetTool endpoint. GET now derives from IncomeEntry/ExpenseEntry via getBudgetDraft fallback.
// PUT still writes to the legacy `budget_drafts` collection. Remove both after BudgetTool UI is retired.
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  createActivityLog,
  getBudgetActuals,
  getBudgetDraft,
  getStudentEnrollment,
  upsertBudgetDraft
} from "@/src/lib/data/repositories";
import type { BudgetFrequency, BudgetItem } from "@/types/domain";

const VALID_FREQUENCIES: BudgetFrequency[] = ["monthly", "semimonthly", "biweekly", "weekly", "annual"];

function sanitizeBudgetItems(value: unknown): BudgetItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const candidate = item as Partial<BudgetItem>;
    const freq = candidate.frequency;
    return {
      id: String(candidate.id ?? Math.random().toString(36).slice(2, 8)),
      label: String(candidate.label ?? ""),
      amount: Number(candidate.amount ?? 0),
      frequency: (freq && VALID_FREQUENCIES.includes(freq) ? freq : "monthly") as BudgetFrequency
    } satisfies BudgetItem;
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

    const [budget, actuals] = await Promise.all([
      getBudgetDraft(user.uid, semesterId),
      getBudgetActuals(user.uid, semesterId)
    ]);

    return NextResponse.json({ ok: true, budget, actuals });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load budget." },
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

    if (!semesterId) {
      return NextResponse.json(
        { error: "semesterId is required (or set an active workspace first)." },
        { status: 400 }
      );
    }

    const enrollment = await getStudentEnrollment(user.uid, semesterId);

    if (!enrollment || enrollment.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "You are not enrolled in that course." }, { status: 403 });
    }

    const income = sanitizeBudgetItems(body.income);
    const savings = sanitizeBudgetItems(body.savings);
    const expenses = sanitizeBudgetItems(body.expenses);
    const notes = String(body.notes ?? "");
    const isFinal = Boolean(body.isFinal ?? false);

    const totalIncome = income.reduce((sum, item) => {
      const freq = VALID_FREQUENCIES.indexOf(item.frequency) >= 0 ? item.frequency : "monthly";
      const perMonthMap: Record<BudgetFrequency, number> = {
        monthly: 1, semimonthly: 2, biweekly: 26 / 12, weekly: 52 / 12, annual: 1 / 12
      };
      return sum + item.amount * perMonthMap[freq];
    }, 0);
    const totalSavings = savings.reduce((sum, item) => {
      const perMonthMap: Record<BudgetFrequency, number> = {
        monthly: 1, semimonthly: 2, biweekly: 26 / 12, weekly: 52 / 12, annual: 1 / 12
      };
      return sum + item.amount * perMonthMap[item.frequency];
    }, 0);
    const totalExpenses = expenses.reduce((sum, item) => {
      const perMonthMap: Record<BudgetFrequency, number> = {
        monthly: 1, semimonthly: 2, biweekly: 26 / 12, weekly: 52 / 12, annual: 1 / 12
      };
      return sum + item.amount * perMonthMap[item.frequency];
    }, 0);
    const monthlyBalance = Number((totalIncome - totalSavings - totalExpenses).toFixed(2));

    await upsertBudgetDraft({
      userId: user.uid,
      organizationId: user.organizationId,
      semesterId,
      income,
      savings,
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
      payload: { incomeCount: income.length, savingsCount: savings.length, expenseCount: expenses.length, monthlyBalance }
    });

    const budget = await getBudgetDraft(user.uid, semesterId);

    return NextResponse.json({ ok: true, budget });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save budget." },
      { status: 500 }
    );
  }
}
