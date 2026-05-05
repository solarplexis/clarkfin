import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  createGoal,
  getStudentEnrollment,
  listGoals,
  VALID_GOAL_TYPES
} from "@/src/lib/data/repositories";
import type { GoalType } from "@/types/domain";

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

    const goals = await listGoals(user.uid, semesterId);

    return NextResponse.json({ ok: true, goals });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load goals." },
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

    const label = String(body.label ?? "").trim();
    const goalType = body.goalType as GoalType;

    if (!label) {
      return NextResponse.json({ error: "label is required." }, { status: 400 });
    }

    if (!VALID_GOAL_TYPES.includes(goalType)) {
      return NextResponse.json({ error: `goalType must be one of: ${VALID_GOAL_TYPES.join(", ")}.` }, { status: 400 });
    }

    const goal = await createGoal({
      userId: user.uid,
      organizationId: user.organizationId,
      semesterId,
      label,
      goalType,
      targetAmount: Number(body.targetAmount ?? 0),
      targetDate: body.targetDate ? String(body.targetDate) : undefined,
      savedToDate: body.savedToDate != null ? Number(body.savedToDate) : 0
    });

    return NextResponse.json({ ok: true, goal }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create goal." },
      { status: 500 }
    );
  }
}
