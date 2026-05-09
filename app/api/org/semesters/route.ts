import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  createSemesterForOrganization,
  listSemestersForOrganization
} from "@/src/lib/data/repositories";

function normalizeId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const semesters = await listSemestersForOrganization(user.organizationId);

    return NextResponse.json({ ok: true, semesters });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load courses."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const body = (await request.json()) as {
      semesterId?: string;
      title?: string;
      courseCode?: string;
      durationWeeks?: number;
      startsAt?: string;
      endsAt?: string;
      isActive?: boolean;
    };

    const normalizedSemesterId = normalizeId(String(body.semesterId ?? ""));
    const title = String(body.title ?? "").trim();
    const courseCode = String(body.courseCode ?? "").trim().toUpperCase();
    const durationWeeks = Number(body.durationWeeks ?? 8);
    const startsAt = String(body.startsAt ?? "").trim();
    const endsAt = String(body.endsAt ?? "").trim();
    const isActive = body.isActive !== false;

    if (!normalizedSemesterId || !title || !courseCode) {
      return NextResponse.json(
        { error: "Semester ID, title, and course code are required." },
        { status: 400 }
      );
    }

    if (![8, 10].includes(durationWeeks)) {
      return NextResponse.json({ error: "Duration must be 8 or 10 weeks." }, { status: 400 });
    }

    const semester = await createSemesterForOrganization({
      orgId: user.organizationId,
      semesterId: normalizedSemesterId,
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
      {
        error: error instanceof Error ? error.message : "Unable to create semester."
      },
      { status: 500 }
    );
  }
}
