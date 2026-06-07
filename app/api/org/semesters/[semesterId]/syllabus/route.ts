import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import { getSemesterById, getSyllabus, upsertSyllabus, indexSyllabusChunks } from "@/src/lib/data/repositories";
import { chunkSyllabusHtml } from "@/src/lib/ai/chunking";
import { embedTexts } from "@/src/lib/ai/embeddings";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ semesterId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const { semesterId } = await params;
    const semester = await getSemesterById(semesterId);

    if (!semester || semester.orgId !== user.organizationId) {
      return NextResponse.json({ error: "That course could not be found." }, { status: 404 });
    }

    const content = await getSyllabus(semesterId);

    return NextResponse.json({ ok: true, content: content ?? "" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load syllabus." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ semesterId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ORG_ADMIN" || !user.organizationId) {
      return NextResponse.json({ error: "ORG_ADMIN session required." }, { status: 401 });
    }

    const { semesterId } = await params;
    const semester = await getSemesterById(semesterId);

    if (!semester || semester.orgId !== user.organizationId) {
      return NextResponse.json({ error: "That course could not be found." }, { status: 404 });
    }

    const body = (await request.json()) as { content?: string };
    const html = String(body.content ?? "").trim();

    await upsertSyllabus(semesterId, html);

    const chunks = chunkSyllabusHtml(html);

    if (chunks.length > 0) {
      const embeddings = await embedTexts(chunks.map((c) => c.plainText));
      const chunksWithEmbeddings = chunks.map((c, i) => ({ ...c, embedding: embeddings[i] }));
      await indexSyllabusChunks(semesterId, chunksWithEmbeddings);
    } else {
      await indexSyllabusChunks(semesterId, []);
    }

    return NextResponse.json({ ok: true, chunksIndexed: chunks.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save syllabus." },
      { status: 500 }
    );
  }
}
