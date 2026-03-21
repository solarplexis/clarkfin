import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getFirebaseApiKey, getSessionCookieName, getSessionDurationMs } from "@/src/lib/env";
import { getAdminAuth } from "@/src/lib/firebase/admin";
import { getUserProfileById } from "@/src/lib/data/repositories";

async function resolveIdToken(body: {
  idToken?: string;
  email?: string;
  password?: string;
}): Promise<{ idToken: string } | { error: string; status: number }> {
  if (body.idToken) {
    return { idToken: body.idToken };
  }

  if (body.email && body.password) {
    const apiKey = getFirebaseApiKey();
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: body.email, password: body.password, returnSecureToken: true })
      }
    );

    const json = (await res.json()) as { idToken?: string; error?: { message?: string } };

    if (!res.ok || !json.idToken) {
      const msg = json.error?.message ?? "";
      const friendly =
        msg.includes("INVALID_PASSWORD") ||
        msg.includes("EMAIL_NOT_FOUND") ||
        msg.includes("INVALID_LOGIN_CREDENTIALS")
          ? "Incorrect email or password."
          : "Unable to sign in.";
      return { error: friendly, status: 401 };
    }

    return { idToken: json.idToken };
  }

  return { error: "idToken or email+password required.", status: 400 };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      idToken?: string;
      email?: string;
      password?: string;
    };

    const result = await resolveIdToken(body);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(result.idToken);
    const profile = await getUserProfileById(decoded.uid);

    if (!profile) {
      return NextResponse.json({ error: "No ClarkFin profile found for this user." }, { status: 403 });
    }

    const sessionCookie = await adminAuth.createSessionCookie(result.idToken, {
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
