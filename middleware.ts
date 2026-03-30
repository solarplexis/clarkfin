import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "clarkfin_session";
const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // refresh when < 7 days remain

function getSessionExp(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload)) as { exp?: number };
    return typeof decoded.exp === "number" ? decoded.exp : null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) return NextResponse.next();

  const exp = getSessionExp(sessionCookie);
  if (!exp) return NextResponse.next();

  const remainingMs = exp * 1000 - Date.now();

  if (remainingMs < REFRESH_THRESHOLD_MS) {
    const refreshUrl = new URL("/api/session/refresh", request.url);
    refreshUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(refreshUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"]
};
