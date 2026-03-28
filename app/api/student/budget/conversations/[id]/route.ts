import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import { getAdminDb } from "@/src/lib/firebase/admin";
import { deleteChatConversation } from "@/src/lib/data/repositories";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership before deleting
    const adminDb = getAdminDb();
    const doc = await adminDb.collection("chat_conversations").doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    const data = doc.data() as { userId?: string };

    if (data.userId !== user.uid) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    await deleteChatConversation(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete conversation." },
      { status: 500 }
    );
  }
}
