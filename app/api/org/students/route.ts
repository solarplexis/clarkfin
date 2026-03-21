import { NextResponse } from "next/server";

import {
  createStudentRecord
} from "@/src/lib/data/repositories";
import { getCurrentUser } from "@/src/lib/auth/session";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const body = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      email?: string;
      status?: "prospect" | "invited" | "active" | "inactive";
    };

    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const status = (body.status ?? "prospect") as "prospect" | "invited" | "active" | "inactive";

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "Student first name, last name, and email are required." },
        { status: 400 }
      );
    }

    const student = await createStudentRecord({
      organizationId: user.organizationId,
      firstName,
      lastName,
      email,
      status
    });

    return NextResponse.json({ ok: true, student });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create student."
      },
      { status: 500 }
    );
  }
}
