import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  getAllocationTarget,
  getStudentEnrollment,
  upsertAllocationTarget
} from "@/src/lib/data/repositories";

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

    const allocation = await getAllocationTarget(user.uid, semesterId);

    return NextResponse.json({ ok: true, allocation });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load allocation target." },
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
      return NextResponse.json({ error: "semesterId is required." }, { status: 400 });
    }

    const enrollment = await getStudentEnrollment(user.uid, semesterId);

    if (!enrollment || enrollment.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "You are not enrolled in that course." }, { status: 403 });
    }

    const essentialPct = Number(body.essentialPct ?? 0);
    const debtPct = Number(body.debtPct ?? 0);
    const discretionaryPct = Number(body.discretionaryPct ?? 0);
    const savingsPct = Number(body.savingsPct ?? 0);
    const total = essentialPct + debtPct + discretionaryPct + savingsPct;

    if (Math.abs(total - 100) > 0.01) {
      return NextResponse.json(
        { error: `Allocation percentages must sum to 100 (got ${total.toFixed(2)}).` },
        { status: 400 }
      );
    }

    const allocation = await upsertAllocationTarget({
      userId: user.uid,
      organizationId: user.organizationId,
      semesterId,
      essentialPct,
      debtPct,
      discretionaryPct,
      savingsPct
    });

    return NextResponse.json({ ok: true, allocation });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save allocation target." },
      { status: 500 }
    );
  }
}
