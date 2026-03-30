import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import { rotateOrganizationApiKey } from "@/src/lib/data/repositories";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const { apiKey, apiKeyPreview } = await rotateOrganizationApiKey(user.organizationId);

    return NextResponse.json({
      ok: true,
      apiKey,
      apiKeyPreview,
      message: "API key rotated. Save the key now — it will not be shown again."
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to rotate API key." },
      { status: 500 }
    );
  }
}
