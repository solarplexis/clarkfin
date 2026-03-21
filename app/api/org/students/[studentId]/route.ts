import { NextResponse } from "next/server";

import {
  deleteStudentRecord,
  getStudentRecordById,
  updateStudentRecord
} from "@/src/lib/data/repositories";
import { getCurrentUser } from "@/src/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const { studentId } = await params;
    const student = await getStudentRecordById(studentId);

    if (!student || student.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "That student could not be found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, student });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load student."
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const { studentId } = await params;
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

    const student = await updateStudentRecord({
      studentId,
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
        error: error instanceof Error ? error.message : "Unable to update student."
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const { studentId } = await params;
    await deleteStudentRecord(studentId, user.organizationId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to delete student."
      },
      { status: 500 }
    );
  }
}
