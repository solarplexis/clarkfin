"use client";

import { useState } from "react";

import { EndDrawer } from "@/components/end-drawer";
import type { BudgetDraft, BudgetFrequency, BudgetItem } from "@/types/domain";

const FREQUENCIES: { value: BudgetFrequency; label: string; perMonth: number }[] = [
  { value: "monthly",     label: "Monthly",      perMonth: 1 },
  { value: "semimonthly", label: "Twice per Month",   perMonth: 2 },
  { value: "biweekly",   label: "Bi-weekly",     perMonth: 26 / 12 },
  { value: "weekly",     label: "Weekly",        perMonth: 52 / 12 },
  { value: "annual",     label: "Annual",        perMonth: 1 / 12 },
];

function toMonthly(item: BudgetItem): number {
  const freq = FREQUENCIES.find((f) => f.value === item.frequency) ?? FREQUENCIES[0];
  return item.amount * freq.perMonth;
}

function createItem(frequency: BudgetFrequency = "monthly"): BudgetItem {
  return {
    id: Math.random().toString(36).slice(2, 8),
    label: "",
    amount: 0,
    frequency
  };
}

function fmtCurrency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Frequency label abbreviated for the table */
function freqLabel(freq: BudgetFrequency): string {
  switch (freq) {
    case "monthly":     return "Monthly";
    case "semimonthly": return "2× / mo";
    case "biweekly":    return "Bi-weekly";
    case "weekly":      return "Weekly";
    case "annual":      return "Annual";
  }
}

interface SectionTableProps {
  title: string;
  items: BudgetItem[];
  sectionTotal: number;
  accentColor: string;
  emptyMessage: string;
}

function SectionTable({ title, items, sectionTotal, accentColor, emptyMessage }: SectionTableProps) {
  return (
    <div className="budget-table-section">
      <div className="budget-table-section-header">
        <span>{title}</span>
        <span style={{ color: accentColor, fontWeight: 700 }}>{fmtCurrency(sectionTotal)} / mo</span>
      </div>
      {items.length === 0 ? (
        <div className="budget-table-empty">{emptyMessage}</div>
      ) : (
        <table className="budget-table">
          <thead>
            <tr>
              <th>Label</th>
              <th className="budget-table-num">Amount</th>
              <th className="budget-table-num">Frequency</th>
              <th className="budget-table-num">Monthly</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.label || <em style={{ color: "var(--muted)" }}>Unlabeled</em>}</td>
                <td className="budget-table-num">{fmtCurrency(item.amount)}</td>
                <td className="budget-table-num">{freqLabel(item.frequency)}</td>
                <td className="budget-table-num" style={{ color: accentColor, fontWeight: 600 }}>
                  {fmtCurrency(toMonthly(item))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
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
    initialDraft?.income ?? [createItem()]
  );
  const [savings, setSavings] = useState<BudgetItem[]>(
    initialDraft?.savings ?? []
  );
  const [expenses, setExpenses] = useState<BudgetItem[]>(
    initialDraft?.expenses ?? [createItem()]
  );
  const [notes, setNotes] = useState(initialDraft?.notes ?? "");
  const [isFinal, setIsFinal] = useState(Boolean(initialDraft?.isFinal));
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const totalIncome = income.reduce((sum, item) => sum + toMonthly(item), 0);
  const totalSavings = savings.reduce((sum, item) => sum + toMonthly(item), 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + toMonthly(item), 0);
  const monthlyBalance = Number((totalIncome - totalSavings - totalExpenses).toFixed(2));
  const annualBalance = Number((monthlyBalance * 12).toFixed(2));
  const balancePositive = monthlyBalance >= 0;

  async function saveDraft() {
    setIsPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: "budget.save",
          semesterId,
          income,
          savings,
          expenses,
          notes,
          isFinal,
          monthlyBalance
        })
      });

      const json = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setMessage(json.error ?? "Unable to save budget draft.");
        return;
      }

      setIsOpen(false);
    } finally {
      setIsPending(false);
    }
  }

  function updateItem(
    collection: BudgetItem[],
    setter: (items: BudgetItem[]) => void,
    id: string,
    field: "label" | "amount" | "frequency",
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
    setIncome((current) => [...current, createItem()]);
  }

  function addSavingsItem() {
    setSavings((current) => [...current, createItem()]);
  }

  function addExpenseItem() {
    setExpenses((current) => [...current, createItem()]);
  }

  function removeIncomeItem(id: string) {
    setIncome((current) => current.filter((item) => item.id !== id));
  }

  function removeSavingsItem(id: string) {
    setSavings((current) => current.filter((item) => item.id !== id));
  }

  function removeExpenseItem(id: string) {
    setExpenses((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className="stack">
      {/* ── Page header ───────────────────────────────────────── */}
      <div className="page-header">
        <div className="page-header-text">
          <h1>Budget Builder</h1>
          <p>{semesterLabel ?? "No course selected"}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className={`badge ${isFinal ? "badge-teal" : "badge-default"}`}>
            {isFinal ? "Ready for review" : "Working draft"}
          </span>
          <EndDrawer
            description="Edit income, savings, and expenses before saving your latest budget draft."
            footer={
              <button
                className="button"
                disabled={isPending || !semesterId}
                type="button"
                onClick={() => { void saveDraft(); }}
              >
                {isPending ? "Saving..." : "Save Budget"}
              </button>
            }
            title="Budget Editor"
            triggerLabel="Open Budget Editor"
            triggerChildren={<span>Edit Budget</span>}
            triggerClassName="btn"
            open={isOpen}
            onOpenChange={setIsOpen}
          >
            <div className="stack">
              <div className="stack">
                <h3>Income</h3>
                {income.map((item) => (
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }} key={item.id}>
                    <div className="form-grid" style={{ flex: 1 }}>
                      <div className="field">
                        <label>Label</label>
                        <input
                          placeholder="e.g. Paycheck"
                          value={item.label}
                          onChange={(event) => {
                            updateItem(income, setIncome, item.id, "label", event.target.value);
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Amount</label>
                        <input
                          inputMode="decimal"
                          placeholder="0.00"
                          value={item.amount === 0 ? "" : String(item.amount)}
                          onChange={(event) => {
                            if (/^\d*\.?\d*$/.test(event.target.value)) {
                              updateItem(income, setIncome, item.id, "amount", event.target.value);
                            }
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Frequency</label>
                        <select
                          value={item.frequency ?? "monthly"}
                          onChange={(event) => {
                            updateItem(income, setIncome, item.id, "frequency", event.target.value);
                          }}
                        >
                          {FREQUENCIES.map((f) => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      aria-label={`Remove ${item.label}`}
                      className="icon-button"
                      style={{ marginBottom: "2px", color: "var(--danger)" }}
                      type="button"
                      onClick={() => removeIncomeItem(item.id)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
                <button className="btn-secondary button-secondary" type="button" onClick={addIncomeItem}>
                  + Add income line
                </button>
              </div>

              <div className="stack">
                <h3>Savings &amp; Goals</h3>
                <p style={{ margin: "0 0 4px", color: "var(--muted)", fontSize: "0.82rem" }}>
                  Pay yourself first — allocate savings before tracking expenses.
                </p>
                {savings.map((item) => (
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }} key={item.id}>
                    <div className="form-grid" style={{ flex: 1 }}>
                      <div className="field">
                        <label>Label</label>
                        <input
                          placeholder="e.g. Emergency Fund"
                          value={item.label}
                          onChange={(event) => {
                            updateItem(savings, setSavings, item.id, "label", event.target.value);
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Amount</label>
                        <input
                          inputMode="decimal"
                          placeholder="0.00"
                          value={item.amount === 0 ? "" : String(item.amount)}
                          onChange={(event) => {
                            if (/^\d*\.?\d*$/.test(event.target.value)) {
                              updateItem(savings, setSavings, item.id, "amount", event.target.value);
                            }
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Frequency</label>
                        <select
                          value={item.frequency ?? "monthly"}
                          onChange={(event) => {
                            updateItem(savings, setSavings, item.id, "frequency", event.target.value);
                          }}
                        >
                          {FREQUENCIES.map((f) => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      aria-label={`Remove ${item.label}`}
                      className="icon-button"
                      style={{ marginBottom: "2px", color: "var(--danger)" }}
                      type="button"
                      onClick={() => removeSavingsItem(item.id)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
                <button className="btn-secondary button-secondary" type="button" onClick={addSavingsItem}>
                  + Add savings goal
                </button>
              </div>

              <div className="stack">
                <h3>Expenses</h3>
                {expenses.map((item) => (
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }} key={item.id}>
                    <div className="form-grid" style={{ flex: 1 }}>
                      <div className="field">
                        <label>Label</label>
                        <input
                          placeholder="e.g. Rent"
                          value={item.label}
                          onChange={(event) => {
                            updateItem(expenses, setExpenses, item.id, "label", event.target.value);
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Amount</label>
                        <input
                          inputMode="decimal"
                          placeholder="0.00"
                          value={item.amount === 0 ? "" : String(item.amount)}
                          onChange={(event) => {
                            if (/^\d*\.?\d*$/.test(event.target.value)) {
                              updateItem(expenses, setExpenses, item.id, "amount", event.target.value);
                            }
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Frequency</label>
                        <select
                          value={item.frequency ?? "monthly"}
                          onChange={(event) => {
                            updateItem(expenses, setExpenses, item.id, "frequency", event.target.value);
                          }}
                        >
                          {FREQUENCIES.map((f) => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      aria-label={`Remove ${item.label}`}
                      className="icon-button"
                      style={{ marginBottom: "2px", color: "var(--danger)" }}
                      type="button"
                      onClick={() => removeExpenseItem(item.id)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
                <button className="btn-secondary button-secondary" type="button" onClick={addExpenseItem}>
                  + Add expense line
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
              <label className="check-row">
                <input
                  checked={isFinal}
                  type="checkbox"
                  onChange={(event) => setIsFinal(event.target.checked)}
                />
                Mark this budget as ready for instructor review
              </label>
              {message ? <p style={{ margin: 0, color: "var(--accent)" }}>{message}</p> : null}
            </div>
          </EndDrawer>
        </div>
      </div>

      {/* ── Stat strip ────────────────────────────────────────── */}
      <div className="fin-stat-strip">
        <div className="fin-stat">
          <div className="fin-stat-label">Monthly Income</div>
          <div className="fin-stat-value fin-positive">{fmtCurrency(totalIncome)}</div>
          <div className="fin-stat-sub">{fmtCurrency(totalIncome * 12)} / yr</div>
        </div>
        {totalSavings > 0 && (
          <div className="fin-stat">
            <div className="fin-stat-label">Monthly Savings</div>
            <div className="fin-stat-value" style={{ color: "var(--accent)" }}>{fmtCurrency(totalSavings)}</div>
            <div className="fin-stat-sub">{fmtCurrency(totalSavings * 12)} / yr</div>
          </div>
        )}
        <div className="fin-stat">
          <div className="fin-stat-label">Monthly Expenses</div>
          <div className="fin-stat-value">{fmtCurrency(totalExpenses)}</div>
          <div className="fin-stat-sub">{fmtCurrency(totalExpenses * 12)} / yr</div>
        </div>
        <div className="fin-stat">
          <div className="fin-stat-label">Free Cash Flow</div>
          <div className={`fin-stat-value ${balancePositive ? "fin-positive" : "fin-negative"}`}>
            {balancePositive ? "+" : ""}{fmtCurrency(monthlyBalance)}
          </div>
          <div className="fin-stat-sub">{balancePositive ? "+" : ""}{fmtCurrency(annualBalance)} / yr</div>
        </div>
      </div>

      {/* ── P&L table ─────────────────────────────────────────── */}
      <div className="card">
        <SectionTable
          title="Income"
          items={income}
          sectionTotal={totalIncome}
          accentColor="#0a9e74"
          emptyMessage="No income sources yet. Open the editor to add some."
        />
        <SectionTable
          title="Savings & Goals"
          items={savings}
          sectionTotal={totalSavings}
          accentColor="var(--accent)"
          emptyMessage="No savings goals yet."
        />
        <SectionTable
          title="Expenses"
          items={expenses}
          sectionTotal={totalExpenses}
          accentColor="var(--ink)"
          emptyMessage="No expenses yet. Open the editor to add some."
        />

        {/* Footer totals row */}
        <div className="budget-table-totals">
          <span>Free Cash Flow</span>
          <span className={balancePositive ? "fin-positive" : "fin-negative"}>
            {balancePositive ? "+" : ""}{fmtCurrency(monthlyBalance)} / mo
            <span style={{ marginLeft: 12, opacity: 0.7 }}>
              ({balancePositive ? "+" : ""}{fmtCurrency(annualBalance)} / yr)
            </span>
          </span>
        </div>
      </div>

      {message && <p style={{ margin: 0, color: "var(--accent)" }}>{message}</p>}
    </div>
  );
}

const TrashIcon = () => (
  <svg fill="none" height="14" viewBox="0 0 16 16" width="14" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4h12M5 4V2h6v2M3 4l1 10h8l1-10M6 7v4M10 7v4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
  </svg>
);
