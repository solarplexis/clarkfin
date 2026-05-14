import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import { findOrganizationByApiKeyHash, getSemesterById } from "@/src/lib/data/repositories";
import { sha256 } from "@/src/lib/security/hash";
import { buildOrgCourseWeekGrid } from "@/src/lib/calculations/org-course-grid";

/**
 * GET /api/org/course-grid
 *
 * Dual auth:
 *   - Session (ORG_ADMIN) — UI use.
 *   - X-API-KEY or Authorization: Bearer <key> — external tools (Claude Cowork, n8n, etc.).
 *
 * Query params:
 *   semesterId  (required)
 *   week        (optional, course week number 1-N)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const semesterId = (searchParams.get("semesterId") ?? "").trim();

    if (!semesterId) {
      return NextResponse.json({ error: "semesterId query parameter is required." }, { status: 400 });
    }

    const rawWeek = (searchParams.get("week") ?? "").trim();
    const week = rawWeek ? Number(rawWeek) : undefined;

    if (week !== undefined && (!Number.isInteger(week) || week < 1)) {
      return NextResponse.json({ error: "week must be a positive integer." }, { status: 400 });
    }

    // ── Resolve identity from session or API key ────────────────────────
    let organizationId: string | null = null;

    const xApiKey = request.headers.get("x-api-key");
    const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
    const apiKey = xApiKey ?? bearerToken;

    if (apiKey) {
      const org = await findOrganizationByApiKeyHash(sha256(apiKey));
      if (!org) {
        return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
      }
      organizationId = org.orgId;
    } else {
      const user = await getCurrentUser();
      if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
        return NextResponse.json(
          { error: "Provide an ORG_ADMIN session or a valid X-API-KEY." },
          { status: 401 }
        );
      }
      organizationId = user.organizationId;
    }

    // ── Validate course ownership ────────────────────────────────────────
    const semester = await getSemesterById(semesterId);

    if (!semester || semester.orgId !== organizationId) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const result = await buildOrgCourseWeekGrid({
      organizationId,
      semester,
      weekFilter: week
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message.includes("week must be between")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to build course grid." },
      { status: 500 }
    );
  }
}
