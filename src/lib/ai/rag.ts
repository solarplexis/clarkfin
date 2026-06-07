import { querySyllabusChunks } from "@/src/lib/data/repositories";
import { embedText } from "./embeddings";

export async function retrieveSyllabusContext(
  semesterId: string,
  question: string
): Promise<string | null> {
  const queryEmbedding = await embedText(question);
  const chunks = await querySyllabusChunks(semesterId, queryEmbedding);

  if (!chunks || chunks.length === 0) return null;

  return chunks
    .map((c) => (c.heading ? `## ${c.heading}\n\n${c.plainText}` : c.plainText))
    .join("\n\n---\n\n");
}
