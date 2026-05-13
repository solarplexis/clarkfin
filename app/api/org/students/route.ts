import { NextResponse } from "next/server";

import {
  createStudentRecord,
  deleteStudentRecordsBulk,
  listStudentsForOrganization
} from "@/src/lib/data/repositories";
import { getCurrentUser } from "@/src/lib/auth/session";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const students = await listStudentsForOrganization(user.organizationId);

    return NextResponse.json({ ok: true, students });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load students."
      },
      { status: 500 }
    );
  }
}

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

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const body = (await request.json()) as { studentIds?: unknown };
    const studentIds = Array.isArray(body.studentIds)
      ? body.studentIds.map((studentId) => String(studentId ?? "").trim()).filter(Boolean)
      : [];

    if (studentIds.length === 0) {
      return NextResponse.json({ error: "At least one student ID is required." }, { status: 400 });
    }

    const result = await deleteStudentRecordsBulk({
      organizationId: user.organizationId,
      studentIds
    });

    return NextResponse.json({
      ok: true,
      deletedCount: result.deletedIds.length,
      deletedIds: result.deletedIds,
      skippedCount: result.skipped.length,
      skipped: result.skipped
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to delete students."
      },
      { status: 500 }
    );
  }
}
