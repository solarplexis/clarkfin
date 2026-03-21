import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getSessionCookieName, getSessionDurationMs } from "@/src/lib/env";
import { getAdminAuth } from "@/src/lib/firebase/admin";
import { getUserProfileById } from "@/src/lib/data/repositories";

export async function POST(request: Request) {
  try {
    const { idToken } = (await request.json()) as { idToken?: string };

    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken." }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(idToken);
    const profile = await getUserProfileById(decoded.uid);

    if (!profile) {
      return NextResponse.json({ error: "No ClarkFin profile found for this user." }, { status: 403 });
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: getSessionDurationMs()
    });

    const cookieStore = await cookies();

    cookieStore.set(getSessionCookieName(), sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: Math.floor(getSessionDurationMs() / 1000),
      path: "/"
    });

    return NextResponse.json({ ok: true, role: profile.role });
  } catch {
    return NextResponse.json({ error: "Unable to establish session." }, { status: 401 });
  }
}
