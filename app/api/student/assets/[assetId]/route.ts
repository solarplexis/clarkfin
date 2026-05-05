import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  deleteAsset,
  getStudentEnrollment,
  updateAsset,
  VALID_ASSET_CATEGORIES
} from "@/src/lib/data/repositories";
import type { AssetCategory } from "@/types/domain";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const { assetId } = await params;
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

    const asset = await updateAsset({
      assetId,
      userId: user.uid,
      semesterId,
      category,
      label,
      currentValue: Number(body.currentValue ?? 0)
    });

    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update asset." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const { assetId } = await params;
    const { searchParams } = new URL(request.url);
    const semesterId = (searchParams.get("semesterId") ?? user.activeSemesterId ?? "").trim();

    if (!semesterId) {
      return NextResponse.json({ error: "semesterId is required." }, { status: 400 });
    }

    const enrollment = await getStudentEnrollment(user.uid, semesterId);

    if (!enrollment || enrollment.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "You are not enrolled in that course." }, { status: 403 });
    }

    await deleteAsset(assetId, user.uid, semesterId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete asset." },
      { status: 500 }
    );
  }
}
