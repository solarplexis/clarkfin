import { NextResponse } from "next/server";

import { getCurrentUser } from "@/src/lib/auth/session";
import {
  createChatConversation,
  getBudgetActuals,
  getBudgetDraft,
  getStudentEnrollment,
  updateChatConversation,
  upsertBudgetActuals,
  upsertBudgetDraft
} from "@/src/lib/data/repositories";
import { getOpenAIKey } from "@/src/lib/env";
import type { ActualItem, BudgetFrequency, BudgetItem } from "@/types/domain";

// ─── Types ────────────────────────────────────────────────────

import type { ChatMessage } from "@/types/domain";

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface OpenAIResponse {
  choices?: Array<{
    message: OpenAIMessage;
    finish_reason: string;
  }>;
  error?: { message: string };
}

interface ToolArgs {
  action: "add" | "update" | "remove";
  section: "income" | "savings" | "expenses";
  item: Partial<BudgetItem & ActualItem>;
}

// ─── Helpers ──────────────────────────────────────────────────

const PER_MONTH: Record<BudgetFrequency, number> = {
  monthly: 1, semimonthly: 2, biweekly: 26 / 12, weekly: 52 / 12, annual: 1 / 12
};

const VALID_FREQ: BudgetFrequency[] = ["monthly", "semimonthly", "biweekly", "weekly", "annual"];

function calcBalance(income: BudgetItem[], savings: BudgetItem[], expenses: BudgetItem[]): number {
  const sum = (items: BudgetItem[]) =>
    items.reduce((s, i) => s + i.amount * PER_MONTH[i.frequency ?? "monthly"], 0);
  return Number((sum(income) - sum(savings) - sum(expenses)).toFixed(2));
}

function formatBudgetContext(budget: Record<string, unknown>): string {
  const toItem = (raw: unknown): BudgetItem | null => {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const freq = String(r.frequency ?? "monthly");
    return {
      id: String(r.id ?? ""),
      label: String(r.label ?? ""),
      amount: Number(r.amount ?? 0),
      frequency: (VALID_FREQ.includes(freq as BudgetFrequency) ? freq : "monthly") as BudgetFrequency
    };
  };
  const toActual = (raw: unknown): ActualItem | null => {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      label: String(r.label ?? ""),
      amount: Number(r.amount ?? 0),
      ...(r.date ? { date: String(r.date) } : {}),
      ...(r.category ? { category: String(r.category) } : {})
    };
  };

  const income = ((budget.income as unknown[]) ?? []).map(toItem).filter(Boolean) as BudgetItem[];
  const savings = ((budget.savings as unknown[]) ?? []).map(toItem).filter(Boolean) as BudgetItem[];
  const expenses = ((budget.expenses as unknown[]) ?? []).map(toItem).filter(Boolean) as BudgetItem[];
  const actualIncome = ((budget.actualIncome as unknown[]) ?? []).map(toActual).filter(Boolean) as ActualItem[];
  const actualSavings = ((budget.actualSavings as unknown[]) ?? []).map(toActual).filter(Boolean) as ActualItem[];
  const actualExpenses = ((budget.actualExpenses as unknown[]) ?? []).map(toActual).filter(Boolean) as ActualItem[];

  const fmtItem = (i: BudgetItem) =>
    `  • ${i.label || "(unlabeled)"} [id:${i.id}] — $${i.amount} ${i.frequency}`;
  const fmtActual = (i: ActualItem) =>
    `  • ${i.label || "(unlabeled)"} [id:${i.id}] — $${i.amount}/mo` +
    (i.date ? ` on ${i.date}` : "") +
    (i.category ? ` (${i.category})` : "");

  const lines: string[] = ["BUDGET DRAFT:"];
  lines.push("Income:" + (income.length === 0 ? " (none)" : ""));
  income.forEach((i) => lines.push(fmtItem(i)));
  lines.push("Savings & Goals:" + (savings.length === 0 ? " (none)" : ""));
  savings.forEach((i) => lines.push(fmtItem(i)));
  lines.push("Expenses:" + (expenses.length === 0 ? " (none)" : ""));
  expenses.forEach((i) => lines.push(fmtItem(i)));
  if (budget.monthlyBalance !== undefined) lines.push(`Monthly Balance: $${budget.monthlyBalance}`);
  if (budget.notes) lines.push(`Notes: ${budget.notes}`);

  lines.push("\nBUDGET ACTUALS:");
  lines.push("Actual Income:" + (actualIncome.length === 0 ? " (none)" : ""));
  actualIncome.forEach((i) => lines.push(fmtActual(i)));
  lines.push("Actual Savings:" + (actualSavings.length === 0 ? " (none)" : ""));
  actualSavings.forEach((i) => lines.push(fmtActual(i)));
  lines.push("Actual Expenses:" + (actualExpenses.length === 0 ? " (none)" : ""));
  actualExpenses.forEach((i) => lines.push(fmtActual(i)));

  return lines.join("\n");
}

function buildSystemPrompt(budgetContext: string): string {
  return `You are a personal finance assistant built into ClarkFin, a student budgeting app. You help students with:

1. **Budget modifications** — adding, updating, or removing items from their draft budget or actuals.
2. **Financial planning questions** — explaining concepts and giving general guidance.
3. **Retirement planning** — guide the student through a series of questions one at a time, then synthesize their answers with their current budget data to provide a personalized projection. Standard assumptions: 7% average annual return, 4% safe withdrawal rate.

## Rules
- For **budget draft** modifications: propose the change in plain language first, then ask the user to confirm with "yes". Only call update_budget_draft after explicit confirmation.
- For **actuals** modifications: apply the change immediately without asking for confirmation.
- For retirement planning: ask one question at a time. Use the student's actual income and savings numbers to ground your projections.
- Keep responses concise and friendly.
- When updating or removing an item, always use the exact id from the budget context below.

## Current Budget
${budgetContext}`;
}

// ─── Tools ────────────────────────────────────────────────────

const TOOLS = [
  {
    type: "function",
    function: {
      name: "update_budget_draft",
      description:
        "Add, update, or remove a line item in the student's budget draft (income, savings, or expenses). Only call this after the user has explicitly confirmed.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["add", "update", "remove"] },
          section: { type: "string", enum: ["income", "savings", "expenses"] },
          item: {
            type: "object",
            properties: {
              id: { type: "string", description: "Required for update and remove" },
              label: { type: "string" },
              amount: { type: "number" },
              frequency: {
                type: "string",
                enum: ["monthly", "weekly", "biweekly", "semimonthly", "annual"]
              }
            }
          }
        },
        required: ["action", "section", "item"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_budget_actuals",
      description:
        "Add, update, or remove a line item in the student's budget actuals. Apply immediately without asking for confirmation.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["add", "update", "remove"] },
          section: { type: "string", enum: ["income", "savings", "expenses"] },
          item: {
            type: "object",
            properties: {
              id: { type: "string", description: "Required for update and remove" },
              label: { type: "string" },
              amount: { type: "number" },
              date: { type: "string", description: "ISO date string, expenses only" },
              category: { type: "string", description: "Spending category, expenses only" }
            }
          }
        },
        required: ["action", "section", "item"]
      }
    }
  }
];

// ─── OpenAI call ──────────────────────────────────────────────

async function callOpenAI(apiKey: string, messages: OpenAIMessage[]): Promise<OpenAIResponse> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      max_tokens: 1000
    })
  });
  return res.json() as Promise<OpenAIResponse>;
}

// ─── Tool executors ───────────────────────────────────────────

async function executeDraftUpdate(
  userId: string,
  organizationId: string,
  semesterId: string,
  args: ToolArgs
): Promise<string> {
  const draft = await getBudgetDraft(userId, semesterId);

  let income = [...(draft?.income ?? [])];
  let savings = [...(draft?.savings ?? [])];
  let expenses = [...(draft?.expenses ?? [])];

  let target = args.section === "income" ? income : args.section === "savings" ? savings : expenses;

  if (args.action === "add") {
    const freq = args.item.frequency;
    target = [
      ...target,
      {
        id: Math.random().toString(36).slice(2, 8),
        label: args.item.label ?? "",
        amount: Number(args.item.amount ?? 0),
        frequency: (freq && VALID_FREQ.includes(freq) ? freq : "monthly") as BudgetFrequency
      }
    ];
  } else if (args.action === "update") {
    if (!target.find((i) => i.id === args.item.id)) return "Item not found — no changes made.";
    target = target.map((i) => (i.id === args.item.id ? ({ ...i, ...args.item } as BudgetItem) : i));
  } else {
    const before = target.length;
    target = target.filter((i) => i.id !== args.item.id);
    if (target.length === before) return "Item not found — no changes made.";
  }

  if (args.section === "income") income = target;
  else if (args.section === "savings") savings = target;
  else expenses = target;

  await upsertBudgetDraft({
    userId,
    organizationId,
    semesterId,
    income,
    savings,
    expenses,
    notes: draft?.notes ?? "",
    monthlyBalance: calcBalance(income, savings, expenses),
    isFinal: draft?.isFinal ?? false
  });

  const verb = args.action === "add" ? "Added" : args.action === "update" ? "Updated" : "Removed";
  return `${verb} "${args.item.label ?? "item"}" in ${args.section}.`;
}

async function executeActualsUpdate(
  userId: string,
  organizationId: string,
  semesterId: string,
  args: ToolArgs
): Promise<string> {
  const actuals = await getBudgetActuals(userId, semesterId);

  let actualIncome = [...(actuals?.actualIncome ?? [])];
  let actualSavings = [...(actuals?.actualSavings ?? [])];
  let actualExpenses = [...(actuals?.actualExpenses ?? [])];

  let target =
    args.section === "income" ? actualIncome : args.section === "savings" ? actualSavings : actualExpenses;

  if (args.action === "add") {
    target = [
      ...target,
      {
        id: Math.random().toString(36).slice(2, 8),
        label: args.item.label ?? "",
        amount: Number(args.item.amount ?? 0),
        ...(args.item.date ? { date: args.item.date } : {}),
        ...(args.item.category ? { category: args.item.category } : {})
      }
    ];
  } else if (args.action === "update") {
    if (!target.find((i) => i.id === args.item.id)) return "Item not found — no changes made.";
    target = target.map((i) => (i.id === args.item.id ? ({ ...i, ...args.item } as ActualItem) : i));
  } else {
    const before = target.length;
    target = target.filter((i) => i.id !== args.item.id);
    if (target.length === before) return "Item not found — no changes made.";
  }

  if (args.section === "income") actualIncome = target;
  else if (args.section === "savings") actualSavings = target;
  else actualExpenses = target;

  await upsertBudgetActuals({
    userId,
    organizationId,
    semesterId,
    actualIncome,
    actualSavings,
    actualExpenses,
    notes: actuals?.notes ?? ""
  });

  const verb = args.action === "add" ? "Added" : args.action === "update" ? "Updated" : "Removed";
  return `${verb} "${args.item.label ?? "item"}" in ${args.section} actuals.`;
}

// ─── Route handler ────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "STUDENT" || !user.organizationId) {
      return NextResponse.json({ error: "Student session required." }, { status: 401 });
    }

    const body = (await request.json()) as {
      messages?: ChatMessage[];
      semesterId?: string;
      budget?: Record<string, unknown>;
      conversationId?: string;
    };

    const semesterId = String(body.semesterId ?? user.activeSemesterId ?? "").trim();

    if (!semesterId) {
      return NextResponse.json({ error: "No active semester." }, { status: 400 });
    }

    const enrollment = await getStudentEnrollment(user.uid, semesterId);

    if (!enrollment || enrollment.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Not enrolled in that course." }, { status: 403 });
    }

    const incomingMessages = Array.isArray(body.messages) ? body.messages.slice(-40) : [];
    const budgetContext = formatBudgetContext(body.budget ?? {});
    const systemPrompt = buildSystemPrompt(budgetContext);
    const apiKey = getOpenAIKey();

    const openaiMessages: OpenAIMessage[] = [
      { role: "system", content: systemPrompt },
      ...incomingMessages.map((m) => ({ role: m.role, content: m.content }))
    ];

    let budgetUpdated = false;
    let actualsUpdated = false;

    let aiResponse = await callOpenAI(apiKey, openaiMessages);

    if (aiResponse.error) {
      return NextResponse.json(
        { error: "AI service error: " + aiResponse.error.message },
        { status: 502 }
      );
    }

    const firstChoice = aiResponse.choices?.[0];

    if (!firstChoice) {
      return NextResponse.json({ error: "No response from AI." }, { status: 502 });
    }

    // Handle tool calls
    if (firstChoice.finish_reason === "tool_calls" && firstChoice.message.tool_calls?.length) {
      openaiMessages.push(firstChoice.message);

      for (const toolCall of firstChoice.message.tool_calls) {
        let toolResult = "";

        try {
          const args = JSON.parse(toolCall.function.arguments) as ToolArgs;

          if (toolCall.function.name === "update_budget_draft") {
            toolResult = await executeDraftUpdate(user.uid, user.organizationId, semesterId, args);
            budgetUpdated = true;
          } else if (toolCall.function.name === "update_budget_actuals") {
            toolResult = await executeActualsUpdate(user.uid, user.organizationId, semesterId, args);
            actualsUpdated = true;
          } else {
            toolResult = "Unknown tool.";
          }
        } catch (err) {
          toolResult = `Error: ${err instanceof Error ? err.message : "Tool execution failed."}`;
        }

        openaiMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult
        });
      }

      // Second call for final response
      aiResponse = await callOpenAI(apiKey, openaiMessages);

      if (aiResponse.error) {
        return NextResponse.json(
          { error: "AI service error: " + aiResponse.error.message },
          { status: 502 }
        );
      }
    }

    const message =
      aiResponse.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a response.";

    // Auto-save conversation
    const allMessages: ChatMessage[] = [
      ...incomingMessages,
      { role: "assistant", content: message }
    ];
    const title = allMessages.find((m) => m.role === "user")?.content.slice(0, 50) ?? "Conversation";
    let conversationId = body.conversationId ?? null;

    if (conversationId) {
      await updateChatConversation(conversationId, allMessages);
    } else {
      conversationId = await createChatConversation({
        userId: user.uid,
        organizationId: user.organizationId,
        semesterId,
        title,
        messages: allMessages
      });
    }

    return NextResponse.json({ ok: true, message, budgetUpdated, actualsUpdated, conversationId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Assistant unavailable." },
      { status: 500 }
    );
  }
}
