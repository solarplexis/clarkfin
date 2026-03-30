import { NextResponse } from "next/server";

import { findOrganizationByApiKeyHash, getRaceProgress } from "@/src/lib/data/repositories";
import { sha256 } from "@/src/lib/security/hash";

export async function GET(request: Request) {
  const xApiKey = request.headers.get("x-api-key");
  const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const apiKey = xApiKey ?? bearerToken;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Provide the API key via X-API-KEY header or Authorization: Bearer <key>." },
      { status: 401 }
    );
  }

  const organization = await findOrganizationByApiKeyHash(sha256(apiKey));

  if (!organization) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const semesterId = (searchParams.get("semesterId") ?? "").trim();

  if (!semesterId) {
    return NextResponse.json({ error: "semesterId query parameter is required." }, { status: 400 });
  }

  const result = await getRaceProgress(semesterId, organization.orgId);

  if (!result) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  return NextResponse.json({
    semesterId: result.semester.semesterId,
    courseCode: result.semester.courseCode,
    title: result.semester.title,
    maxScore: result.maxScore,
    staticMilestones: [
      "enrolled",
      "budget_started",
      "budget_submitted",
      "debt_started",
      "debt_submitted",
      "assistant_used"
    ],
    actualMonths: result.actualMonths,
    students: result.students
  });
}
