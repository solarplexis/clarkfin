export type SyllabusChunk = {
  heading: string;
  plainText: string;
};

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function chunkSyllabusHtml(html: string): SyllabusChunk[] {
  if (!html || html.trim() === "" || html === "<p></p>") return [];

  const parts = html.split(/(?=<h[23][\s>])/i);
  const chunks: SyllabusChunk[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const headingMatch = trimmed.match(/^<h[23][^>]*>(.*?)<\/h[23]>/i);
    const heading = headingMatch ? stripTags(headingMatch[1]) : "";
    const plainText = stripTags(trimmed);

    if (plainText) {
      chunks.push({ heading, plainText });
    }
  }

  if (chunks.length === 0) {
    const plainText = stripTags(html);
    if (plainText) chunks.push({ heading: "", plainText });
  }

  return chunks;
}
