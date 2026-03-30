import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import { buildAutoLoginUrl, provisionAutoLoginStudent } from "@/src/lib/auth/auto-login";
import { findOrganizationByApiKeyHash, getOrganizationById, getSemesterById } from "@/src/lib/data/repositories";
import { sha256 } from "@/src/lib/security/hash";

interface EnrollStudent {
  firstName: string;
  lastName: string;
  email: string;
}

interface EnrollBody {
  semesterId?: string;
  students?: unknown[];
}

async function resolveOrg(request: Request): Promise<{ orgId: string } | null> {
  const apiKey = request.headers.get("x-api-key");

  if (apiKey) {
    const org = await findOrganizationByApiKeyHash(sha256(apiKey));
    return org ? { orgId: org.orgId } : null;
  }

  const user = await getCurrentUser();

  if (user && user.role === "ORG_ADMIN" && user.organizationId) {
    return { orgId: user.organizationId };
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const resolved = await resolveOrg(request);

    if (!resolved) {
      return NextResponse.json(
        { error: "Valid X-API-KEY header or ORG_ADMIN session required." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as EnrollBody;
    const semesterId = String(body.semesterId ?? "").trim();

    if (!semesterId) {
      return NextResponse.json({ error: "semesterId is required." }, { status: 400 });
    }

    if (!Array.isArray(body.students) || body.students.length === 0) {
      return NextResponse.json({ error: "students array is required and must not be empty." }, { status: 400 });
    }

    const org = await getOrganizationById(resolved.orgId);
    const semester = await getSemesterById(semesterId);

    if (!org) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }

    if (!semester || semester.orgId !== resolved.orgId) {
      return NextResponse.json({ error: "Course not found for this organization." }, { status: 404 });
    }

    const results: { email: string; autoLoginUrl: string }[] = [];
    const errors: { email: string; error: string }[] = [];

    for (const raw of body.students) {
      const s = raw as Partial<EnrollStudent>;
      const firstName = String(s.firstName ?? "").trim();
      const lastName = String(s.lastName ?? "").trim();
      const email = String(s.email ?? "").trim().toLowerCase();

      if (!firstName || !lastName || !email) {
        errors.push({ email: email || "(unknown)", error: "firstName, lastName, and email are required." });
        continue;
      }

      try {
        await provisionAutoLoginStudent({ firstName, lastName, email, orgId: resolved.orgId, semesterId });

        results.push({
          email,
          autoLoginUrl: buildAutoLoginUrl({ firstName, lastName, email, orgId: resolved.orgId, semesterId })
        });
      } catch (err) {
        errors.push({ email, error: err instanceof Error ? err.message : "Failed to enroll student." });
      }
    }

    return NextResponse.json({ ok: true, enrolled: results, errors });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Enrollment failed." },
      { status: 500 }
    );
  }
}
