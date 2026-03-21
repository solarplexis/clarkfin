import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import { updateOrganizationProfile } from "@/src/lib/data/repositories";

function normalizeImageDataUrl(value: unknown) {
  const candidate = typeof value === "string" ? value.trim() : "";

  if (!candidate) {
    return undefined;
  }

  if (!candidate.startsWith("data:image/")) {
    throw new Error("Organization logos must be uploaded as image files.");
  }

  if (candidate.length > 1_000_000) {
    throw new Error("Organization logo is too large. Please choose a smaller file.");
  }

  return candidate;
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const body = (await request.json()) as {
      name?: string;
      supportEmail?: string;
      brandColor?: string;
      logoUrl?: string;
    };

    const name = String(body.name ?? "").trim();
    const supportEmail = String(body.supportEmail ?? "").trim().toLowerCase();
    const brandColor = String(body.brandColor ?? "").trim();

    if (!name) {
      return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
    }

    const organization = await updateOrganizationProfile({
      orgId: user.organizationId,
      name,
      supportEmail: supportEmail || undefined,
      brandColor: brandColor || undefined,
      logoUrl: normalizeImageDataUrl(body.logoUrl)
    });

    return NextResponse.json({ ok: true, organization });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update organization." },
      { status: 500 }
    );
  }
}
