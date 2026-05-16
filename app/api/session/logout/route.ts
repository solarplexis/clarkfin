import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import { getSessionCookieName } from "@/src/lib/env";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(getSessionCookieName());

  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost";
  const proto = headerStore.get("x-forwarded-proto") ?? "http";

  return NextResponse.redirect(new URL("/login", `${proto}://${host}`));
}
