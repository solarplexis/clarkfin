"use client";

import { useState, useTransition } from "react";

import { EndDrawer } from "@/components/end-drawer";
import type { BudgetDraft, BudgetItem } from "@/types/domain";

function createItem(label: string, amount = 0): BudgetItem {
  return {
    id: `${label.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    amount
  };
}

export function BudgetTool({
  initialDraft,
  semesterId,
  semesterLabel
}: {
  initialDraft: BudgetDraft | null;
  semesterId?: string;
  semesterLabel?: string;
}) {
  const [income, setIncome] = useState<BudgetItem[]>(
    initialDraft?.income ?? [createItem("Paycheck"), createItem("Grants")]
  );
  const [expenses, setExpenses] = useState<BudgetItem[]>(
    initialDraft?.expenses ?? [createItem("Rent"), createItem("Groceries"), createItem("Transit")]
  );
  const [notes, setNotes] = useState(initialDraft?.notes ?? "");
  const [isFinal, setIsFinal] = useState(Boolean(initialDraft?.isFinal));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
  const monthlyBalance = Number((totalIncome - totalExpenses).toFixed(2));

  async function saveDraft() {
    setMessage(null);

    const response = await fetch("/api/activity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "budget.save",
        semesterId,
        income,
        expenses,
        notes,
        isFinal,
        monthlyBalance
      })
    });

    const json = (await response.json()) as { error?: string; message?: string };

    if (!response.ok) {
      throw new Error(json.error ?? "Unable to save budget draft.");
    }

    setMessage(json.message ?? "Budget saved.");
  }

  function updateItem(
    collection: BudgetItem[],
    setter: (items: BudgetItem[]) => void,
    id: string,
    field: "label" | "amount",
    value: string
  ) {
    setter(
      collection.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: field === "amount" ? Number(value || "0") : value
            }
          : item
      )
    );
  }

  function addIncomeItem() {
    setIncome((current) => [...current, createItem("New income source")]);
  }

  function addExpenseItem() {
    setExpenses((current) => [...current, createItem("New expense")]);
  }

  return (
    <section className="grid two">
      <div className="panel stack">
        <h2>Budget Builder</h2>
        <p className="muted">
          Manage line items in a consistent end drawer. Every save writes the latest draft and
          creates an activity log for reporting.
        </p>
        <p className="muted">
          Workspace: {semesterLabel ?? "No course selected"}
        </p>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="pill">{isFinal ? "Marked final" : "Working draft"}</span>
          <EndDrawer
            description="Edit income, expenses, and notes before saving your latest budget draft."
            title="Budget editor"
            triggerLabel="Open budget form"
          >
            <div className="stack">
              <div className="stack">
                <h3>Income</h3>
                {income.map((item) => (
                  <div className="form-grid" key={item.id}>
                    <div className="field">
                      <label>Label</label>
                      <input
                        value={item.label}
                        onChange={(event) => {
                          updateItem(income, setIncome, item.id, "label", event.target.value);
                        }}
                      />
                    </div>
                    <div className="field">
                      <label>Amount</label>
                      <input
                        min="0"
                        step="0.01"
                        type="number"
                        value={item.amount}
                        onChange={(event) => {
                          updateItem(income, setIncome, item.id, "amount", event.target.value);
                        }}
                      />
                    </div>
                  </div>
                ))}
                <button className="button-secondary" type="button" onClick={addIncomeItem}>
                  Add income line
                </button>
              </div>

              <div className="stack">
                <h3>Expenses</h3>
                {expenses.map((item) => (
                  <div className="form-grid" key={item.id}>
                    <div className="field">
                      <label>Label</label>
                      <input
                        value={item.label}
                        onChange={(event) => {
                          updateItem(expenses, setExpenses, item.id, "label", event.target.value);
                        }}
                      />
                    </div>
                    <div className="field">
                      <label>Amount</label>
                      <input
                        min="0"
                        step="0.01"
                        type="number"
                        value={item.amount}
                        onChange={(event) => {
                          updateItem(expenses, setExpenses, item.id, "amount", event.target.value);
                        }}
                      />
                    </div>
                  </div>
                ))}
                <button className="button-secondary" type="button" onClick={addExpenseItem}>
                  Add expense line
                </button>
              </div>

              <div className="field">
                <label htmlFor="budget-notes">Notes</label>
                <textarea
                  id="budget-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
              <label className="row" style={{ alignItems: "center" }}>
                <input
                  checked={isFinal}
                  type="checkbox"
                  onChange={(event) => setIsFinal(event.target.checked)}
                />
                Mark this budget as ready for instructor review
              </label>
              {message ? <p style={{ margin: 0, color: "var(--accent)" }}>{message}</p> : null}
              <button
                className="button"
                type="button"
                disabled={isPending || !semesterId}
                onClick={() => {
                  startTransition(() => {
                    void saveDraft();
                  });
                }}
              >
                {isPending ? "Saving..." : "Save budget"}
              </button>
            </div>
          </EndDrawer>
        </div>
        <p className="muted">Current status: {isFinal ? "Ready for review" : "Working draft"}</p>
        {message ? <p style={{ margin: 0, color: "var(--accent)" }}>{message}</p> : null}
      </div>
      <aside className="panel stack">
        <h2>Budget Snapshot</h2>
        <div className="stats">
          <div className="stat">
            <div className="muted">Income</div>
            <div className="stat-value">${totalIncome.toFixed(2)}</div>
          </div>
          <div className="stat">
            <div className="muted">Expenses</div>
            <div className="stat-value">${totalExpenses.toFixed(2)}</div>
          </div>
          <div className="stat">
            <div className="muted">Monthly balance</div>
            <div className="stat-value">${monthlyBalance.toFixed(2)}</div>
          </div>
        </div>
        <p className="note muted">
          A positive balance suggests this plan is sustainable. A negative balance can be a
          useful prompt for class discussion about tradeoffs and prioritization.
        </p>
      </aside>
    </section>
  );
}
