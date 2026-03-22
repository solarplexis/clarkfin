import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import { getOpenAIKey } from "@/src/lib/env";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface OpenAIResponse {
  choices: Array<{ message: { content: string } }>;
}

interface ParsedReceipt {
  label?: string;
  amount?: number;
  category?: string | null;
  error?: string;
}

const FALLBACK_CATEGORIES = [
  "Housing", "Food & Dining", "Transportation", "Utilities",
  "Entertainment", "Healthcare", "Education", "Clothing",
  "Personal Care", "Subscriptions", "Other"
];

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
    }

    const formData = await request.formData();
    const rawLabels = formData.get("budgetLabels");
    let labelList: string[];
    try {
      const parsed = rawLabels ? (JSON.parse(String(rawLabels)) as unknown) : null;
      const arr = Array.isArray(parsed) ? (parsed as string[]).filter((s) => typeof s === "string" && s.trim()) : [];
      labelList = arr.length > 0 ? [...arr, "Other"] : FALLBACK_CATEGORIES;
    } catch {
      labelList = FALLBACK_CATEGORIES;
    }
    const file = formData.get("receipt");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "receipt field is required." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Image must be JPEG, PNG, or WebP." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();

    if (arrayBuffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image must be under 5 MB." }, { status: 400 });
    }

    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    const apiKey = getOpenAIKey();

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a professional receipt extraction OCR. Your goal is to extract structured data into valid JSON.

### Schema:
{
  "label": "Merchant name (max 40 chars)",
  "amount": Total as a number (e.g., 28.50),
  "category": "One of: ${labelList.join(", ")}"
}

### Constraints:
- Return ONLY valid JSON.
- No markdown code blocks (no \`\`\`json).
- No conversational filler.
- If the total is missing, return { "error": "Unable to parse receipt." }.

IMAGE ANALYSIS:
Extract the data from the provided image.`
              },
              {
                type: "image_url",
                image_url: { url: dataUrl, detail: "low" }
              }
            ]
          }
        ]
      })
    });

    if (!openaiRes.ok) {
      console.error("OpenAI error:", openaiRes.status, await openaiRes.text());
      return NextResponse.json({ error: "AI service unavailable." }, { status: 502 });
    }

    const openaiJson = (await openaiRes.json()) as OpenAIResponse;
    const raw = openaiJson.choices?.[0]?.message?.content?.trim() ?? "";

    let parsed: ParsedReceipt;

    try {
      // Strip markdown code fences if the model added them despite instructions
      const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      parsed = JSON.parse(clean) as ParsedReceipt;
    } catch {
      console.error("Receipt parse error — raw content:", raw);
      return NextResponse.json({ error: "Could not parse AI response." }, { status: 502 });
    }

    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 422 });
    }

    const amount = Math.max(0, Number(parsed.amount ?? 0));
    const label = String(parsed.label ?? "").slice(0, 40);
    const category = typeof parsed.category === "string" && labelList.includes(parsed.category)
      ? parsed.category
      : "Other";

    return NextResponse.json({ ok: true, label, amount, category });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Receipt scan failed." },
      { status: 500 }
    );
  }
}
