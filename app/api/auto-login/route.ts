import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { decodeAutoLoginToken, provisionAutoLoginStudent, setAutoLoginSessionCookie } from "@/src/lib/auth/auto-login";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("t") ?? "";

  const data = decodeAutoLoginToken(token);

  if (!data) {
    return NextResponse.json({ error: "Invalid or missing auto-login token." }, { status: 400 });
  }

  try {
    const uid = await provisionAutoLoginStudent(data);
    await setAutoLoginSessionCookie(uid);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Auto-login failed." },
      { status: 500 }
    );
  }

  redirect("/app/student");
}
