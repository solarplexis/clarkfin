import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAdminAuth } from "@/src/lib/firebase/admin";
import { getSessionCookieName } from "@/src/lib/env";
import { exchangeCustomTokenForIdToken } from "@/src/lib/auth/auto-login";

const MAX_SESSION_MS = 14 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/app/student";
  const safePath = next.startsWith("/") && !next.includes("://") ? next : "/app/student";

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(getSessionCookieName())?.value;

    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const customToken = await adminAuth.createCustomToken(decoded.uid);
    const idToken = await exchangeCustomTokenForIdToken(customToken);
    const newSessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: MAX_SESSION_MS });

    cookieStore.set(getSessionCookieName(), newSessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: Math.floor(MAX_SESSION_MS / 1000),
      path: "/"
    });

    return NextResponse.redirect(new URL(safePath, request.url));
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}
