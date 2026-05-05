import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import { updateUserProfile } from "@/src/lib/data/repositories";

function normalizeImageDataUrl(value: unknown) {
  const candidate = typeof value === "string" ? value.trim() : "";

  if (!candidate) {
    return undefined;
  }

  if (!candidate.startsWith("data:image/")) {
    throw new Error("Profile images must be uploaded as image files.");
  }

  if (candidate.length > 1_000_000) {
    throw new Error("Profile image is too large. Please choose a smaller file.");
  }

  return candidate;
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Authenticated session required." }, { status: 401 });
    }

    return NextResponse.json({ ok: true, profile: user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load profile." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Authenticated session required." }, { status: 401 });
    }

    const body = (await request.json()) as {
      fullName?: string;
      avatarUrl?: string;
      currentAge?: number;
      targetRetirementAge?: number;
      retirementNetWorthTarget?: number;
    };

    const fullName = String(body.fullName ?? "").trim();

    if (!fullName) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }

    const currentAge = body.currentAge != null ? Number(body.currentAge) : undefined;
    const targetRetirementAge = body.targetRetirementAge != null ? Number(body.targetRetirementAge) : undefined;
    const retirementNetWorthTarget = body.retirementNetWorthTarget != null ? Number(body.retirementNetWorthTarget) : undefined;

    const profile = await updateUserProfile({
      uid: user.uid,
      fullName,
      avatarUrl: normalizeImageDataUrl(body.avatarUrl),
      currentAge,
      targetRetirementAge,
      retirementNetWorthTarget
    });

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update profile." },
      { status: 500 }
    );
  }
}
