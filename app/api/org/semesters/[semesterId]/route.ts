import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  deleteSemesterForOrganization,
  getSemesterById,
  updateSemesterForOrganization
} from "@/src/lib/data/repositories";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ semesterId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const { semesterId } = await params;
    const semester = await getSemesterById(semesterId);

    if (!semester || semester.orgId !== user.organizationId) {
      return NextResponse.json({ error: "That course could not be found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, semester });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load course." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ semesterId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const { semesterId } = await params;
    const body = (await request.json()) as {
      title?: string;
      courseCode?: string;
      durationWeeks?: number;
      startsAt?: string;
      endsAt?: string;
      isActive?: boolean;
    };

    const title = String(body.title ?? "").trim();
    const courseCode = String(body.courseCode ?? "").trim();
    const durationWeeks = Number(body.durationWeeks ?? 8);
    const startsAt = String(body.startsAt ?? "").trim();
    const endsAt = String(body.endsAt ?? "").trim();
    const isActive = body.isActive !== false;

    if (!title || !courseCode) {
      return NextResponse.json(
        { error: "Title and course code are required." },
        { status: 400 }
      );
    }

    if (![8, 10].includes(durationWeeks)) {
      return NextResponse.json({ error: "Duration must be 8 or 10 weeks." }, { status: 400 });
    }

    const semester = await updateSemesterForOrganization({
      semesterId,
      orgId: user.organizationId,
      title,
      courseCode,
      durationWeeks,
      startsAt: startsAt || undefined,
      endsAt: endsAt || undefined,
      isActive
    });

    return NextResponse.json({ ok: true, semester });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update course." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ semesterId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const { semesterId } = await params;
    await deleteSemesterForOrganization(semesterId, user.organizationId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete course." },
      { status: 500 }
    );
  }
}
