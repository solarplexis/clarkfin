import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import { getCourseWeek, getCourseMilestones } from "@/src/lib/calculations/course";
import { calcNetPayFromBaseline } from "@/src/lib/calculations/timeline";
import { getResendKey } from "@/src/lib/env";
import {
  createStudentFeedback,
  getAllocationTarget,
  getOrganizationById,
  getSemesterById,
  getStudentEnrollment,
  getStudentFeedback,
  listAssets,
  listDebts,
  listExpenseEntries,
  listGoals,
  listIncomeEntries
} from "@/src/lib/data/repositories";

function letterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function computeGrade(data: {
  allExpenseEntries: { periodYear: number; periodMonth: number }[];
  totalIncome: number;
  totalExpenses: number;
  savingsPct: number;
  goals: { savedToDate: number; targetAmount: number }[];
  durationWeeks: number;
  startsAt: string;
}): { score: number; gradeLetter: string; breakdown: { engagement: number; savings: number; goals: number } } {
  const milestones = getCourseMilestones(data.startsAt, data.durationWeeks);
  const finalMilestone = milestones[milestones.length - 1];
  const allMonths = finalMilestone?.months ?? [];
  const expectedMonths = Math.max(1, allMonths.length);

  const monthsWithData = new Set(
    data.allExpenseEntries
      .filter(e => e.periodYear > 0)
      .map(e => `${e.periodYear}-${e.periodMonth}`)
  ).size;

  const engagementScore = Math.round(Math.min(monthsWithData / expectedMonths, 1) * 40);

  const actualSavingsRate = data.totalIncome > 0
    ? ((data.totalIncome - data.totalExpenses) / data.totalIncome) * 100
    : 0;
  const savingsScore = data.savingsPct > 0
    ? Math.round(Math.min(actualSavingsRate / data.savingsPct, 1) * 35)
    : 35;

  const goalsWithProgress = data.goals.filter(g => g.savedToDate > 0).length;
  const goalScore = data.goals.length > 0
    ? Math.round((goalsWithProgress / data.goals.length) * 25)
    : 25;

  const score = Math.min(100, engagementScore + savingsScore + goalScore);
  return { score, gradeLetter: letterGrade(score), breakdown: { engagement: engagementScore, savings: savingsScore, goals: goalScore } };
}

async function sendFeedbackEmail(params: {
  resendKey: string;
  toEmail: string;
  studentName: string;
  studentEmail: string;
  courseCode: string;
  courseTitle: string;
  grade: number;
  gradeLetter: string;
  breakdown: { engagement: number; savings: number; goals: number };
  comments: string;
}) {
  const subject = `[ClarkFin] End-of-Course Feedback — ${params.studentName} — ${params.courseCode}`;
  const html = `
    <h2>ClarkFin — End-of-Course Student Feedback</h2>
    <p><strong>Student:</strong> ${params.studentName} (${params.studentEmail})</p>
    <p><strong>Course:</strong> ${params.courseCode} · ${params.courseTitle}</p>
    <hr/>
    <h3>Performance Grade: ${params.grade}/100 (${params.gradeLetter})</h3>
    <table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
      <tr><td><strong>Engagement (data entry)</strong></td><td>${params.breakdown.engagement}/40</td></tr>
      <tr><td><strong>Savings achievement</strong></td><td>${params.breakdown.savings}/35</td></tr>
      <tr><td><strong>Goal engagement</strong></td><td>${params.breakdown.goals}/25</td></tr>
    </table>
    <hr/>
    <h3>Student Comments</h3>
    <p style="white-space:pre-wrap">${params.comments || "(No comments submitted)"}</p>
    <hr/>
    <p style="font-size:12px;color:#999">Sent by ClarkFin · This grade is a starting point — adjust as needed before entering into Canvas.</p>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.resendKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "ClarkFin <noreply@clarkfin.app>",
      to: [params.toEmail],
      reply_to: params.studentEmail,
      subject,
      html
    })
  });
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "STUDENT") {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const semesterId = (searchParams.get("semesterId") ?? user.activeSemesterId ?? "").trim();
    if (!semesterId) return NextResponse.json({ feedback: null });

    const feedback = await getStudentFeedback(user.uid, semesterId);
    return NextResponse.json({ ok: true, feedback });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load feedback." },
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

    const body = (await request.json()) as { semesterId?: string; comments?: string };
    const semesterId = String(body.semesterId ?? user.activeSemesterId ?? "").trim();
    const comments = String(body.comments ?? "").trim();

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
        { error: "Feedback is only available during the last week of the course." },
        { status: 400 }
      );
    }

    const existing = await getStudentFeedback(user.uid, semesterId);
    if (existing) {
      return NextResponse.json({ ok: true, feedback: existing, alreadySubmitted: true });
    }

    const [baselineEntries, allIncomeEntries, allExpenseEntries, goals, debts, assets, allocationTarget, org] =
      await Promise.all([
        listIncomeEntries(user.uid, semesterId, { periodYear: 0, periodMonth: 0 }),
        listIncomeEntries(user.uid, semesterId),
        listExpenseEntries(user.uid, semesterId),
        listGoals(user.uid, semesterId),
        listDebts(user.uid, semesterId),
        listAssets(user.uid, semesterId),
        getAllocationTarget(user.uid, semesterId),
        getOrganizationById(user.organizationId)
      ]);

    const netPayMonthly = calcNetPayFromBaseline(baselineEntries);
    const savingsPct = allocationTarget?.savingsPct ?? 0;

    const realIncome = allIncomeEntries.filter(e => e.periodYear > 0);
    const gross = realIncome.filter(e => e.category === "gross_pay").reduce((s, e) => s + e.amount, 0);
    const taxes = realIncome.filter(e => e.category === "taxes").reduce((s, e) => s + e.amount, 0);
    const otherInc = realIncome.filter(e => e.category !== "gross_pay" && e.category !== "taxes").reduce((s, e) => s + e.amount, 0);
    const totalIncome = Math.max(0, gross - taxes) + otherInc;
    const totalExpenses = allExpenseEntries.filter(e => e.periodYear > 0).reduce((s, e) => s + e.amount, 0);

    const { score, gradeLetter, breakdown } = computeGrade({
      allExpenseEntries,
      totalIncome,
      totalExpenses,
      savingsPct,
      goals,
      durationWeeks: semester.durationWeeks,
      startsAt: semester.startsAt ?? ""
    });

    let emailSent = false;
    const instructorEmail = org?.settings?.supportEmail;
    const resendKey = getResendKey();

    if (resendKey && instructorEmail) {
      try {
        await sendFeedbackEmail({
          resendKey,
          toEmail: instructorEmail,
          studentName: user.fullName ?? "Student",
          studentEmail: user.email,
          courseCode: semester.courseCode,
          courseTitle: semester.title,
          grade: score,
          gradeLetter,
          breakdown,
          comments
        });
        emailSent = true;
      } catch {
        // Email failure is non-fatal — feedback is still stored
      }
    }

    const feedback = await createStudentFeedback({
      userId: user.uid,
      organizationId: user.organizationId,
      semesterId,
      comments,
      grade: score,
      gradeLetter,
      gradeBreakdown: breakdown,
      emailSent
    });

    return NextResponse.json({ ok: true, feedback, emailSent });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit feedback." },
      { status: 500 }
    );
  }
}
