import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  createAsset,
  getStudentEnrollment,
  listAssets,
  VALID_ASSET_CATEGORIES
} from "@/src/lib/data/repositories";
import type { AssetCategory } from "@/types/domain";

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

    const assets = await listAssets(user.uid, semesterId);

    return NextResponse.json({ ok: true, assets });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load assets." },
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

    const category = body.category as AssetCategory;
    const label = String(body.label ?? "").trim();

    if (!VALID_ASSET_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_ASSET_CATEGORIES.join(", ")}.` },
        { status: 400 }
      );
    }

    if (!label) {
      return NextResponse.json({ error: "label is required." }, { status: 400 });
    }

    const asset = await createAsset({
      userId: user.uid,
      organizationId: user.organizationId,
      semesterId,
      category,
      label,
      currentValue: Number(body.currentValue ?? 0)
    });

    return NextResponse.json({ ok: true, asset }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create asset." },
      { status: 500 }
    );
  }
}
