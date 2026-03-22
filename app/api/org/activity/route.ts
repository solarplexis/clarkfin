import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import { listActivityLogsForOrganization } from "@/src/lib/data/repositories";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get("semesterId")?.trim() || undefined;
    const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);

    const logs = await listActivityLogsForOrganization(user.organizationId, { semesterId, limit });

    return NextResponse.json({ ok: true, logs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load activity." },
      { status: 500 }
    );
  }
}
