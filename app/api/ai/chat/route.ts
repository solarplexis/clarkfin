import { NextResponse } from "next/server";
import OpenAI from "openai";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  getStudentEnrollment,
  createExpenseEntry,
  createIncomeEntry,
  createDebt,
  listExpenseEntries,
  listIncomeEntries,
  listDebts
} from "@/src/lib/data/repositories";
import { retrieveSyllabusContext } from "@/src/lib/ai/rag";

// ─── OpenAI client (lazy init) ────────────────────────────────

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPEN_AI_KEY });
  }
  return _client;
}

// ─── Tool definitions ─────────────────────────────────────────

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_expense_entry",
      description:
        "Record a new expense for the student. Use for spending events: 'I spent $X at Y', 'I paid rent', 'I bought groceries'. Choose category: 'essential' for necessities (rent, utilities, groceries), 'debt' for debt payments, 'discretionary' for optional spending (coffee, entertainment, dining out).",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string", description: "Short description of the expense (e.g. 'Starbucks', 'Rent', 'Groceries')" },
          amount: { type: "number", description: "Amount in dollars (positive number)" },
          category: { type: "string", enum: ["essential", "debt", "discretionary"] },
          periodYear: { type: "integer", description: "Year of the expense (e.g. 2026)" },
          periodMonth: { type: "integer", description: "Month of the expense (1-12)" },
          periodWeek: { type: "integer", description: "Week of month (1-4)" },
          isRecurring: { type: "boolean", description: "True for recurring monthly expenses like rent" }
        },
        required: ["label", "amount", "category", "periodYear", "periodMonth", "periodWeek"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_income_entry",
      description:
        "Record a new income entry for the student. Use for money coming in: 'I got paid', 'I received a bonus', 'I earned interest'. For informal income like 'my friend paid me back', use category 'other'.",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string", description: "Short description of the income source (e.g. 'Paycheck', 'Freelance')" },
          amount: { type: "number", description: "Amount in dollars (positive number)" },
          category: {
            type: "string",
            enum: ["gross_pay", "taxes", "bonus", "interest", "other"],
            description: "Use 'taxes' for withholdings (negative effect), 'other' for informal income."
          },
          periodYear: { type: "integer" },
          periodMonth: { type: "integer", description: "Month (1-12)" },
          periodWeek: { type: "integer", description: "Week of month (1-4)" }
        },
        required: ["label", "amount", "category", "periodYear", "periodMonth", "periodWeek"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_debt",
      description:
        "Record a new debt. Use when the student borrowed money or took on new debt: 'my friend loaned me $50', 'I took out a loan'. Do NOT use for regular expense payments.",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string", description: "What the debt is for (e.g. 'Friend loan', 'Student loan')" },
          category: {
            type: "string",
            enum: ["student_loan", "mortgage", "credit_card", "car", "other"],
            description: "Use 'other' for personal loans from friends/family."
          },
          originalBalance: { type: "number", description: "Original loan amount in dollars" },
          currentBalance: { type: "number", description: "Current outstanding balance" },
          monthlyPayment: { type: "number", description: "Expected monthly payment. Use 0 if unknown." },
          interestRate: { type: "number", description: "Annual interest rate as a decimal (e.g. 0.05 for 5%). Use 0 for informal loans." }
        },
        required: ["label", "category", "originalBalance", "currentBalance", "monthlyPayment"]
      }
    }
  }
];

// ─── Navigation link map ──────────────────────────────────────

const NAV_LINKS: Record<string, string> = {
  dashboard: "/app/student",
  budget: "/app/student/budget",
  income: "/app/student/budget",
  "balance sheet": "/app/student/balance-sheet",
  "net worth": "/app/student/balance-sheet",
  goals: "/app/student/goals",
  debt: "/app/student/debt",
  planner: "/app/student/planner",
  snapshot: "/app/student/snapshot",
  report: "/app/student/snapshot"
};

// ─── System prompt builder ────────────────────────────────────

function buildSystemPrompt(ctx: {
  studentName: string;
  today: string;
  syllabusContext: string | null;
  syllabusError: string | null;
  recentExpenses: string;
  recentIncome: string;
  recentDebts: string;
}): string {
  const navMap = Object.entries(NAV_LINKS)
    .map(([k, v]) => `  - "${k}" → ${v}`)
    .join("\n");

  return `You are the ClarkFin financial assistant helping ${ctx.studentName} manage their personal finances as part of a financial literacy course.

Today's date: ${ctx.today}

## Your role
- Answer personal finance questions clearly and practically
- Help log financial transactions by calling the provided tools
- Answer questions about the course syllabus (if context is provided below)
- Answer navigation questions by providing markdown links to the correct app pages
- Be encouraging and educational — this is a learning environment

## Guardrails
- ONLY discuss personal finance topics. If asked about anything unrelated to personal finance, budgeting, investing, debt, the ClarkFin app, or the course syllabus, politely decline and redirect.
- Never provide specific investment advice about individual securities.

## Available app pages (use markdown links when navigating)
${navMap}

When a student asks "where do I log income?" respond with a helpful explanation AND a markdown link, e.g. "You can log that on the [Budget page](/app/student/budget)."

## Financial data tools
When a student describes a transaction, call the appropriate tool:
- Expense: "I spent $X", "I paid rent", "I bought groceries" → create_expense_entry
- Income: "I got paid", "I earned $X", "I received a bonus" → create_income_entry
- New debt: "my friend loaned me $50", "I borrowed $X" → create_debt

For date fields use today: year=${ctx.today.slice(0, 4)}, month=${parseInt(ctx.today.slice(5, 7))}, week=1 unless the student specifies otherwise.

After calling a tool, confirm what was recorded. If a student wants to edit or delete an entry, direct them to the relevant page — you can only add new entries.

## Student's recent financial activity
${ctx.recentExpenses ? `Recent expenses:\n${ctx.recentExpenses}` : "No recent expenses logged."}

${ctx.recentIncome ? `Recent income:\n${ctx.recentIncome}` : "No recent income logged."}

${ctx.recentDebts ? `Debts on file:\n${ctx.recentDebts}` : "No debts on file."}

## Course syllabus
${
  ctx.syllabusContext
    ? `The following are the most relevant excerpts from the course syllabus. Use them to answer any syllabus questions:\n\n${ctx.syllabusContext}`
    : ctx.syllabusError
      ? `Syllabus retrieval failed due to a technical error. If the student asks about the syllabus, tell them: "I wasn't able to retrieve your course syllabus right now due to a technical issue — please check back later or contact your instructor directly."`
      : `No syllabus content was found for this course. If the student asks about the syllabus, tell them: "No course syllabus is available yet. Your instructor may not have uploaded one yet."`
}`;
}

// ─── POST /api/ai/chat ────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const body = (await request.json()) as {
      semesterId?: string;
      messages?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    const semesterId = String(body.semesterId ?? user.activeSemesterId ?? "").trim();
    if (!semesterId) {
      return NextResponse.json({ error: "semesterId is required." }, { status: 400 });
    }

    const enrollment = await getStudentEnrollment(user.uid, semesterId);
    if (!enrollment || enrollment.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "You are not enrolled in that course." }, { status: 403 });
    }

    const messages = (body.messages ?? []).filter(
      (m) => m.role === "user" || m.role === "assistant"
    );

    if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
      return NextResponse.json({ error: "Last message must be from the user." }, { status: 400 });
    }

    // ── Gather context in parallel ───────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    const lastUserMessage = messages[messages.length - 1].content;

    let syllabusContext: string | null = null;
    let syllabusError: string | null = null;

    const [expenses, incomeEntries, debts] = await Promise.all([
      listExpenseEntries(user.uid, semesterId).catch(() => []),
      listIncomeEntries(user.uid, semesterId).catch(() => []),
      listDebts(user.uid, semesterId).catch(() => [])
    ]);

    try {
      syllabusContext = await retrieveSyllabusContext(semesterId, lastUserMessage);
    } catch (err) {
      syllabusError = err instanceof Error ? err.message : String(err);
      console.error("[AI chat] RAG retrieval failed:", syllabusError);
    }

    const recentExpenses = expenses
      .slice(-5)
      .map((e) => `  ${e.label}: $${e.amount} (${e.category})`)
      .join("\n");

    const recentIncome = incomeEntries
      .slice(-5)
      .map((i) => `  ${i.label}: $${i.amount} (${i.category})`)
      .join("\n");

    const recentDebts = debts
      .slice(-5)
      .map((d) => `  ${d.label}: $${d.currentBalance} remaining`)
      .join("\n");

    const systemPrompt = buildSystemPrompt({
      studentName: user.fullName ?? "Student",
      today,
      syllabusContext,
      syllabusError,
      recentExpenses,
      recentIncome,
      recentDebts
    });

    // ── Agentic tool loop (max 3 iterations) ─────────────────
    const client = getClient();
    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content } as OpenAI.Chat.ChatCompletionMessageParam))
    ];

    let dataUpdated = false;
    let finalText = "";

    for (let iteration = 0; iteration < 3; iteration++) {
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: chatMessages,
        tools: TOOLS,
        tool_choice: "auto"
      });

      const choice = response.choices[0];

      if (choice.finish_reason === "stop") {
        finalText = choice.message.content ?? "";
        break;
      }

      if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
        chatMessages.push(choice.message);

        const toolResults: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];

        for (const call of choice.message.tool_calls) {
          if (call.type !== "function") continue;
          let result: string;
          try {
            const args = JSON.parse(call.function.arguments) as Record<string, unknown>;
            result = await executeTool(call.function.name, args, {
              userId: user.uid,
              organizationId: user.organizationId!,
              semesterId
            });
            dataUpdated = true;
          } catch (err) {
            result = `Error: ${err instanceof Error ? err.message : "Tool execution failed"}`;
          }

          toolResults.push({
            role: "tool",
            tool_call_id: call.id,
            content: result
          });
        }

        chatMessages.push(...toolResults);
        continue;
      }

      // Unexpected finish reason — take whatever text is available
      finalText = choice.message.content ?? "";
      break;
    }

    return NextResponse.json({ message: finalText, dataUpdated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Assistant unavailable." },
      { status: 500 }
    );
  }
}

// ─── Tool executor ────────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: { userId: string; organizationId: string; semesterId: string }
): Promise<string> {
  if (name === "create_expense_entry") {
    const entry = await createExpenseEntry({
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      semesterId: ctx.semesterId,
      label: String(input.label),
      amount: Number(input.amount),
      category: input.category as "essential" | "debt" | "discretionary",
      periodYear: Number(input.periodYear),
      periodMonth: Number(input.periodMonth),
      periodWeek: Number(input.periodWeek),
      isRecurring: Boolean(input.isRecurring ?? false)
    });
    return `Expense recorded: ${entry.label} — $${entry.amount} (${entry.category}, ID: ${entry.id})`;
  }

  if (name === "create_income_entry") {
    const entry = await createIncomeEntry({
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      semesterId: ctx.semesterId,
      label: String(input.label),
      amount: Number(input.amount),
      category: input.category as "gross_pay" | "taxes" | "bonus" | "interest" | "other",
      periodYear: Number(input.periodYear),
      periodMonth: Number(input.periodMonth),
      periodWeek: Number(input.periodWeek)
    });
    return `Income recorded: ${entry.label} — $${entry.amount} (${entry.category}, ID: ${entry.id})`;
  }

  if (name === "create_debt") {
    const debt = await createDebt({
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      semesterId: ctx.semesterId,
      label: String(input.label),
      category: input.category as "student_loan" | "mortgage" | "credit_card" | "car" | "other",
      originalBalance: Number(input.originalBalance),
      currentBalance: Number(input.currentBalance),
      monthlyPayment: Number(input.monthlyPayment),
      interestRate: Number(input.interestRate ?? 0)
    });
    return `Debt recorded: ${debt.label} — $${debt.currentBalance} (${debt.category}, ID: ${debt.id})`;
  }

  throw new Error(`Unknown tool: ${name}`);
}
