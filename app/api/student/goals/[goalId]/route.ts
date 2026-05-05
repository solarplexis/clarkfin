import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  deleteGoal,
  getStudentEnrollment,
  updateGoal,
  VALID_GOAL_TYPES
} from "@/src/lib/data/repositories";
import type { GoalType } from "@/types/domain";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ goalId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const { goalId } = await params;
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

    const goal = await updateGoal({
      goalId,
      userId: user.uid,
      semesterId,
      label,
      goalType,
      targetAmount: Number(body.targetAmount ?? 0),
      targetDate: body.targetDate ? String(body.targetDate) : undefined,
      savedToDate: Number(body.savedToDate ?? 0),
      priorityOrder: Number(body.priorityOrder ?? 0)
    });

    return NextResponse.json({ ok: true, goal });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update goal." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ goalId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const { goalId } = await params;
    const { searchParams } = new URL(request.url);
    const semesterId = (searchParams.get("semesterId") ?? user.activeSemesterId ?? "").trim();

    if (!semesterId) {
      return NextResponse.json({ error: "semesterId is required." }, { status: 400 });
    }

    const enrollment = await getStudentEnrollment(user.uid, semesterId);

    if (!enrollment || enrollment.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "You are not enrolled in that course." }, { status: 403 });
    }

    await deleteGoal(goalId, user.uid, semesterId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete goal." },
      { status: 500 }
    );
  }
}
