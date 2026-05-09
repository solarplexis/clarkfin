import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import { calcNetPayFromBaseline } from "@/src/lib/calculations/timeline";
import { getCourseWeek } from "@/src/lib/calculations/course";
import { getOpenAIKey } from "@/src/lib/env";
import {
  getAllocationTarget,
  getSemesterById,
  getStudentEnrollment,
  listAssets,
  listDebts,
  listExpenseEntries,
  listGoals,
  listIncomeEntries
} from "@/src/lib/data/repositories";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function buildContext(data: {
  studentName: string;
  courseTitle: string;
  courseCode: string;
  durationWeeks: number;
  currentWeek: number;
  netPayMonthly: number;
  savingsPct: number;
  totalIncome: number;
  totalExpenses: number;
  essentialExpenses: number;
  debtExpenses: number;
  discretionaryExpenses: number;
  totalAssets: number;
  totalDebt: number;
  netWorth: number;
  goals: Array<{ label: string; targetAmount: number; savedToDate: number; progressPct: number; isComplete: boolean }>;
  debts: Array<{ label: string; originalBalance: number; currentBalance: number; paidDownPct: number }>;
}): string {
  const savingsActual = data.totalIncome > 0
    ? ((data.totalIncome - data.totalExpenses) / data.totalIncome * 100).toFixed(1)
    : "0";

  const lines = [
    `Student: ${data.studentName}`,
    `Course: ${data.courseCode} — ${data.courseTitle} (${data.durationWeeks}-week course, completed week ${Math.min(data.currentWeek, data.durationWeeks)})`,
    ``,
    `FINANCIAL OVERVIEW`,
    `Baseline net pay: ${fmt(data.netPayMonthly)}/mo`,
    `Savings rate target: ${data.savingsPct}%`,
    `Total income recorded: ${fmt(data.totalIncome)}`,
    `Total expenses recorded: ${fmt(data.totalExpenses)}`,
    `  - Essential: ${fmt(data.essentialExpenses)}`,
    `  - Debt payments: ${fmt(data.debtExpenses)}`,
    `  - Discretionary: ${fmt(data.discretionaryExpenses)}`,
    `Actual savings rate this term: ${savingsActual}%`,
    `Net worth: ${fmt(data.netWorth)} (${fmt(data.totalAssets)} assets − ${fmt(data.totalDebt)} debt)`,
    ``,
    `GOALS (${data.goals.length} total)`,
    ...data.goals.map(g =>
      `  ${g.isComplete ? "✓" : "○"} ${g.label}: ${fmt(g.savedToDate)} of ${fmt(g.targetAmount)} (${g.progressPct.toFixed(0)}%)`
    ),
    ``,
    `DEBTS (${data.debts.length} total)`,
    ...data.debts.map(d =>
      `  ${d.label}: ${fmt(d.currentBalance)} remaining of ${fmt(d.originalBalance)} original (${d.paidDownPct.toFixed(0)}% paid down)`
    )
  ];

  return lines.join("\n");
}

async function generateRecommendations(apiKey: string, context: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a personal finance coach writing end-of-course feedback for a student in a college personal finance class. Write 3 specific, encouraging, and actionable paragraphs based on the student's actual data below. Be specific — reference their real numbers. Cover: (1) what they did well, (2) one key area to improve, (3) concrete next steps after the course ends. Write in flowing paragraphs, not bullet points. Keep the tone supportive and realistic."
        },
        { role: "user", content: context }
      ],
      max_tokens: 700
    })
  });
  const json = await res.json() as { choices?: Array<{ message: { content: string } }>; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.choices?.[0]?.message.content ?? "Unable to generate recommendations.";
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const body = (await request.json()) as { semesterId?: string };
    const semesterId = String(body.semesterId ?? user.activeSemesterId ?? "").trim();

    if (!semesterId) {
      return NextResponse.json({ error: "No active semester." }, { status: 400 });
    }

    const enrollment = await getStudentEnrollment(user.uid, semesterId);
    if (!enrollment || enrollment.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Not enrolled in that course." }, { status: 403 });
    }

    const semester = await getSemesterById(semesterId);
    if (!semester) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const currentWeek = semester.startsAt ? getCourseWeek(semester.startsAt) : 0;
    if (currentWeek < semester.durationWeeks) {
      return NextResponse.json(
        { error: "The final report is only available during the last week of the course." },
        { status: 400 }
      );
    }

    const [baselineEntries, allIncomeEntries, allExpenseEntries, goals, debts, assets, allocationTarget] =
      await Promise.all([
        listIncomeEntries(user.uid, semesterId, { periodYear: 0, periodMonth: 0 }),
        listIncomeEntries(user.uid, semesterId),
        listExpenseEntries(user.uid, semesterId),
        listGoals(user.uid, semesterId),
        listDebts(user.uid, semesterId),
        listAssets(user.uid, semesterId),
        getAllocationTarget(user.uid, semesterId)
      ]);

    const netPayMonthly = calcNetPayFromBaseline(baselineEntries);
    const savingsPct = allocationTarget?.savingsPct ?? 0;

    const realIncome = allIncomeEntries.filter(e => e.periodYear > 0);
    const gross = realIncome.filter(e => e.category === "gross_pay").reduce((s, e) => s + e.amount, 0);
    const taxes = realIncome.filter(e => e.category === "taxes").reduce((s, e) => s + e.amount, 0);
    const otherInc = realIncome.filter(e => e.category !== "gross_pay" && e.category !== "taxes").reduce((s, e) => s + e.amount, 0);
    const totalIncome = Math.max(0, gross - taxes) + otherInc;

    const realExpenses = allExpenseEntries.filter(e => e.periodYear > 0);
    const essentialExpenses = realExpenses.filter(e => e.category === "essential").reduce((s, e) => s + e.amount, 0);
    const debtExpenses = realExpenses.filter(e => e.category === "debt").reduce((s, e) => s + e.amount, 0);
    const discretionaryExpenses = realExpenses.filter(e => e.category === "discretionary").reduce((s, e) => s + e.amount, 0);
    const totalExpenses = essentialExpenses + debtExpenses + discretionaryExpenses;

    const totalAssets = assets.reduce((s, a) => s + a.currentValue, 0);
    const totalDebt = debts.reduce((s, d) => s + d.currentBalance, 0);
    const netWorth = totalAssets - totalDebt;

    const goalSummaries = goals.map(g => ({
      label: g.label,
      targetAmount: g.targetAmount,
      savedToDate: g.savedToDate,
      progressPct: g.targetAmount > 0 ? Math.min(100, (g.savedToDate / g.targetAmount) * 100) : 0,
      isComplete: g.savedToDate >= g.targetAmount
    }));

    const debtSummaries = debts.map(d => ({
      label: d.label,
      originalBalance: d.originalBalance,
      currentBalance: d.currentBalance,
      paidDownPct: d.originalBalance > 0
        ? Math.min(100, ((d.originalBalance - d.currentBalance) / d.originalBalance) * 100)
        : 0
    }));

    const contextData = {
      studentName: user.fullName ?? "Student",
      courseTitle: semester.title,
      courseCode: semester.courseCode,
      durationWeeks: semester.durationWeeks,
      currentWeek,
      netPayMonthly,
      savingsPct,
      totalIncome,
      totalExpenses,
      essentialExpenses,
      debtExpenses,
      discretionaryExpenses,
      totalAssets,
      totalDebt,
      netWorth,
      goals: goalSummaries,
      debts: debtSummaries
    };

    const context = buildContext(contextData);
    const apiKey = getOpenAIKey();
    const recommendations = await generateRecommendations(apiKey, context);

    const now = new Date();
    const generatedAt = `${MONTH_NAMES[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

    return NextResponse.json({
      ok: true,
      report: {
        ...contextData,
        recommendations,
        generatedAt,
        savingsActual: totalIncome > 0 ? (totalIncome - totalExpenses) / totalIncome * 100 : 0
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate report." },
      { status: 500 }
    );
  }
}
