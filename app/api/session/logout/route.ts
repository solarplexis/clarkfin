import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getAppUrl, getSessionCookieName } from "@/src/lib/env";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(getSessionCookieName());

  return NextResponse.redirect(new URL("/login", getAppUrl()));
}
