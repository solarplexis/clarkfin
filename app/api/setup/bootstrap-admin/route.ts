import { NextResponse } from "next/server";

import { createUserProfile, hasSystemAdmin } from "@/src/lib/data/repositories";
import { getAdminAuth } from "@/src/lib/firebase/admin";

export async function POST(request: Request) {
  try {
    if (await hasSystemAdmin()) {
      return NextResponse.json(
        { error: "A platform ADMIN already exists. Bootstrap is closed." },
        { status: 409 }
      );
    }

    const body = (await request.json()) as {
      fullName?: string;
      email?: string;
      password?: string;
    };

    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!fullName || !email || password.length < 8) {
      return NextResponse.json(
        { error: "Full name, email, and an 8+ character password are required." },
        { status: 400 }
      );
    }

    const adminAuth = getAdminAuth();

    try {
      await adminAuth.getUserByEmail(email);

      return NextResponse.json(
        { error: "A Firebase Auth user already exists for that email." },
        { status: 409 }
      );
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? error.code : "";

      if (code !== "auth/user-not-found") {
        throw error;
      }
    }

    const authUser = await adminAuth.createUser({
      email,
      password,
      displayName: fullName
    });

    await createUserProfile({
      uid: authUser.uid,
      email,
      fullName,
      role: "ADMIN"
    });

    return NextResponse.json({
      ok: true,
      message: "Platform ADMIN created. You can sign in now."
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to bootstrap admin."
      },
      { status: 500 }
    );
  }
}
