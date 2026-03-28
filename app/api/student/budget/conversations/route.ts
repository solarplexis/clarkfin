import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import { getStudentEnrollment, listChatConversations } from "@/src/lib/data/repositories";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const semesterId = (searchParams.get("semesterId") ?? user.activeSemesterId ?? "").trim();

    if (!semesterId) {
      return NextResponse.json({ error: "No active semester." }, { status: 400 });
    }

    const enrollment = await getStudentEnrollment(user.uid, semesterId);

    if (!enrollment || enrollment.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Not enrolled in that course." }, { status: 403 });
    }

    const conversations = await listChatConversations(user.uid, semesterId);

    return NextResponse.json({ ok: true, conversations });
  } catch (error) {
    console.error("[GET /conversations]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load conversations." },
      { status: 500 }
    );
  }
}
