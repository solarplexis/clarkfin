import OpenAI from "openai";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPEN_AI_KEY });
  }
  return _openai;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts
  });

  return response.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
}

export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}
