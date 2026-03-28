"use client";

import { useRef, useState } from "react";

import { BudgetAssistantDrawer } from "@/components/budget-assistant-drawer";
import { EndDrawer } from "@/components/end-drawer";
import type { ActualItem, BudgetActuals, BudgetDraft, BudgetFrequency, BudgetItem } from "@/types/domain";

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

function createActualItem(): ActualItem {
  return { id: Math.random().toString(36).slice(2, 8), label: "", amount: 0 };
}

function BvaRow({
  label,
  budgeted,
  actual,
  higherActualIsGood
}: {
  label: string;
  budgeted: number;
  actual: number;
  higherActualIsGood: boolean;
}) {
  const variance = actual - budgeted;
  const isGood = higherActualIsGood ? variance >= 0 : variance <= 0;
  const pct = budgeted > 0 ? Math.abs((variance / budgeted) * 100).toFixed(0) : null;
  return (
    <tr>
      <td>{label}</td>
      <td className="budget-table-num">{fmtCurrency(budgeted)}</td>
      <td className="budget-table-num">{fmtCurrency(actual)}</td>
      <td
        className="budget-table-num"
        style={{ color: isGood ? "#0a9e74" : "var(--danger)", fontWeight: 600 }}
      >
        {variance >= 0 ? "+" : ""}{fmtCurrency(variance)}
        {pct !== null && (
          <span style={{ opacity: 0.6, fontSize: "0.8em", marginLeft: 4 }}>({pct}%)</span>
        )}
      </td>
    </tr>
  );
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
  initialActuals,
  semesterId,
  semesterLabel
}: {
  initialDraft: BudgetDraft | null;
  initialActuals: BudgetActuals | null;
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

  const [actualIncome, setActualIncome] = useState<ActualItem[]>(
    initialActuals?.actualIncome ?? []
  );
  const [actualSavings, setActualSavings] = useState<ActualItem[]>(
    initialActuals?.actualSavings ?? []
  );
  const [actualExpenses, setActualExpenses] = useState<ActualItem[]>(
    initialActuals?.actualExpenses ?? []
  );
  const [actualsNotes, setActualsNotes] = useState(initialActuals?.notes ?? "");
  const [isActualsOpen, setIsActualsOpen] = useState(false);
  const [isReceiptScanning, setIsReceiptScanning] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [isActualsPending, setIsActualsPending] = useState(false);
  const [actualsMessage, setActualsMessage] = useState<string | null>(null);

  const totalIncome = income.reduce((sum, item) => sum + toMonthly(item), 0);
  const totalSavings = savings.reduce((sum, item) => sum + toMonthly(item), 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + toMonthly(item), 0);
  const monthlyBalance = Number((totalIncome - totalSavings - totalExpenses).toFixed(2));
  const annualBalance = Number((monthlyBalance * 12).toFixed(2));
  const balancePositive = monthlyBalance >= 0;

  const totalActualIncome = actualIncome.reduce((sum, i) => sum + i.amount, 0);
  const totalActualSavings = actualSavings.reduce((sum, i) => sum + i.amount, 0);
  const totalActualExpenses = actualExpenses.reduce((sum, i) => sum + i.amount, 0);
  const actualBalance = Number((totalActualIncome - totalActualSavings - totalActualExpenses).toFixed(2));
  const hasActuals = actualIncome.length > 0 || actualSavings.length > 0 || actualExpenses.length > 0;

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

  async function saveActuals() {
    setIsActualsPending(true);
    setActualsMessage(null);
    try {
      const response = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "budget.actuals.save",
          semesterId,
          actualIncome,
          actualSavings,
          actualExpenses,
          notes: actualsNotes
        })
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        setActualsMessage(json.error ?? "Unable to save actuals.");
        return;
      }
      setIsActualsOpen(false);
    } finally {
      setIsActualsPending(false);
    }
  }

  function updateActualItem(
    collection: ActualItem[],
    setter: (items: ActualItem[]) => void,
    id: string,
    field: "label" | "amount" | "date" | "category",
    value: string
  ) {
    setter(
      collection.map((item) =>
        item.id === id
          ? { ...item, [field]: field === "amount" ? Number(value || "0") : value }
          : item
      )
    );
  }

  function addActualIncomeItem() { setActualIncome((c) => [...c, createActualItem()]); }
  function addActualSavingsItem() { setActualSavings((c) => [...c, createActualItem()]); }
  function addActualExpenseItem() { setActualExpenses((c) => [...c, createActualItem()]); }

  async function handleReceiptUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = ""; // reset so the same file can be re-selected
    setIsReceiptScanning(true);
    setActualsMessage("");
    try {
      const fd = new FormData();
      fd.append("receipt", file);
      const budgetLabels = expenses.map((e) => e.label).filter(Boolean);
      if (budgetLabels.length > 0) fd.append("budgetLabels", JSON.stringify(budgetLabels));
      const res = await fetch("/api/student/budget/actuals/receipt", { method: "POST", body: fd });
      const json = await res.json() as { ok?: boolean; label?: string; amount?: number; category?: string; error?: string };
      if (!res.ok || !json.ok) {
        setActualsMessage(json.error ?? "Receipt scan failed.");
        return;
      }
      const newItem: ActualItem = {
        id: Math.random().toString(36).slice(2, 8),
        label: json.label ?? "",
        amount: json.amount ?? 0,
        ...(json.category ? { category: json.category } : {})
      };
      setActualExpenses((c) => [...c, newItem]);
    } finally {
      setIsReceiptScanning(false);
    }
  }
  function removeActualIncomeItem(id: string) { setActualIncome((c) => c.filter((i) => i.id !== id)); }
  function removeActualSavingsItem(id: string) { setActualSavings((c) => c.filter((i) => i.id !== id)); }
  function removeActualExpenseItem(id: string) { setActualExpenses((c) => c.filter((i) => i.id !== id)); }

  async function refreshBudget() {
    if (!semesterId) return;
    try {
      const res = await fetch(`/api/student/budget?semesterId=${encodeURIComponent(semesterId)}`);
      if (!res.ok) return;
      const json = (await res.json()) as { budget?: BudgetDraft | null; actuals?: BudgetActuals | null };
      if (json.budget) {
        setIncome(json.budget.income ?? []);
        setSavings(json.budget.savings ?? []);
        setExpenses(json.budget.expenses ?? []);
        setNotes(json.budget.notes ?? "");
        setIsFinal(Boolean(json.budget.isFinal));
      }
      if (json.actuals) {
        setActualIncome(json.actuals.actualIncome ?? []);
        setActualSavings(json.actuals.actualSavings ?? []);
        setActualExpenses(json.actuals.actualExpenses ?? []);
        setActualsNotes(json.actuals.notes ?? "");
      }
    } catch {
      // silent — assistant will still work
    }
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
          <EndDrawer
            description="Record what you actually earned, saved, and spent — including interest, dividends, and investment returns."
            footer={
              <button
                className="button"
                disabled={isActualsPending || !semesterId}
                type="button"
                onClick={() => { void saveActuals(); }}
              >
                {isActualsPending ? "Saving..." : "Save Actuals"}
              </button>
            }
            title="Record Actuals"
            triggerLabel="Record your actual income, savings, and expenses"
            triggerChildren={<span>Record Actuals</span>}
            triggerClassName="btn"
            open={isActualsOpen}
            onOpenChange={setIsActualsOpen}
          >
            <div className="stack">
              <div className="stack">
                <h3>Actual Income</h3>
                <p style={{ margin: "0 0 4px", color: "var(--muted)", fontSize: "0.82rem" }}>
                  Include wages, tips, side income, interest earned, dividends, and investment returns.
                </p>
                {actualIncome.map((item) => (
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }} key={item.id}>
                    <div className="form-grid" style={{ flex: 1 }}>
                      <div className="field">
                        <label>Label</label>
                        <input
                          placeholder="e.g. Paycheck, Dividend – AAPL"
                          value={item.label}
                          onChange={(event) => {
                            updateActualItem(actualIncome, setActualIncome, item.id, "label", event.target.value);
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Actual amount / mo</label>
                        <input
                          inputMode="decimal"
                          placeholder="0.00"
                          value={item.amount === 0 ? "" : String(item.amount)}
                          onChange={(event) => {
                            if (/^\d*\.?\d*$/.test(event.target.value)) {
                              updateActualItem(actualIncome, setActualIncome, item.id, "amount", event.target.value);
                            }
                          }}
                        />
                      </div>
                    </div>
                    <button
                      aria-label={`Remove ${item.label}`}
                      className="icon-button"
                      style={{ marginBottom: "2px", color: "var(--danger)" }}
                      type="button"
                      onClick={() => removeActualIncomeItem(item.id)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
                <button className="btn-secondary button-secondary" type="button" onClick={addActualIncomeItem}>
                  + Add income entry
                </button>
              </div>

              <div className="stack">
                <h3>Actual Savings</h3>
                <p style={{ margin: "0 0 4px", color: "var(--muted)", fontSize: "0.82rem" }}>
                  Amounts you actually contributed to savings, investments, or goals this month.
                </p>
                {actualSavings.map((item) => (
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }} key={item.id}>
                    <div className="form-grid" style={{ flex: 1 }}>
                      <div className="field">
                        <label>Label</label>
                        <input
                          placeholder="e.g. Emergency Fund, Roth IRA"
                          value={item.label}
                          onChange={(event) => {
                            updateActualItem(actualSavings, setActualSavings, item.id, "label", event.target.value);
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Actual amount / mo</label>
                        <input
                          inputMode="decimal"
                          placeholder="0.00"
                          value={item.amount === 0 ? "" : String(item.amount)}
                          onChange={(event) => {
                            if (/^\d*\.?\d*$/.test(event.target.value)) {
                              updateActualItem(actualSavings, setActualSavings, item.id, "amount", event.target.value);
                            }
                          }}
                        />
                      </div>
                    </div>
                    <button
                      aria-label={`Remove ${item.label}`}
                      className="icon-button"
                      style={{ marginBottom: "2px", color: "var(--danger)" }}
                      type="button"
                      onClick={() => removeActualSavingsItem(item.id)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
                <button className="btn-secondary button-secondary" type="button" onClick={addActualSavingsItem}>
                  + Add savings entry
                </button>
              </div>

              <div className="stack">
                <h3>Actual Expenses</h3>
                {actualExpenses.map((item) => (
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }} key={item.id}>
                    <div className="form-grid" style={{ flex: 1 }}>
                      <div className="field">
                        <label>Label</label>
                        <input
                          placeholder="e.g. Rent, Groceries"
                          value={item.label}
                          onChange={(event) => {
                            updateActualItem(actualExpenses, setActualExpenses, item.id, "label", event.target.value);
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Actual amount / mo</label>
                        <input
                          inputMode="decimal"
                          placeholder="0.00"
                          value={item.amount === 0 ? "" : String(item.amount)}
                          onChange={(event) => {
                            if (/^\d*\.?\d*$/.test(event.target.value)) {
                              updateActualItem(actualExpenses, setActualExpenses, item.id, "amount", event.target.value);
                            }
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Date</label>
                        <input
                          type="date"
                          value={item.date ?? ""}
                          onChange={(event) => {
                            updateActualItem(actualExpenses, setActualExpenses, item.id, "date", event.target.value);
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Budget category</label>
                        <select
                          value={item.category ?? ""}
                          onChange={(event) => {
                            updateActualItem(actualExpenses, setActualExpenses, item.id, "category", event.target.value);
                          }}
                        >
                          <option value="">— Unassigned —</option>
                          {expenses.filter((e) => e.label).map((e) => (
                            <option key={e.id} value={e.label}>{e.label}</option>
                          ))}
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                    <button
                      aria-label={`Remove ${item.label}`}
                      className="icon-button"
                      style={{ marginBottom: "2px", color: "var(--danger)" }}
                      type="button"
                      onClick={() => removeActualExpenseItem(item.id)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn-secondary button-secondary" type="button" onClick={addActualExpenseItem}>
                    + Add expense entry
                  </button>
                  <button
                    className="btn-secondary button-secondary"
                    type="button"
                    disabled={isReceiptScanning}
                    onClick={() => receiptInputRef.current?.click()}
                  >
                    {isReceiptScanning ? "Scanning…" : "📷 Scan receipt"}
                  </button>
                  <input
                    ref={receiptInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={handleReceiptUpload}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="actuals-notes">Notes</label>
                <textarea
                  id="actuals-notes"
                  value={actualsNotes}
                  onChange={(event) => setActualsNotes(event.target.value)}
                />
              </div>
              {actualsMessage ? <p style={{ margin: 0, color: "var(--accent)" }}>{actualsMessage}</p> : null}
            </div>
          </EndDrawer>
          <BudgetAssistantDrawer
            budget={{
              income,
              savings,
              expenses,
              notes,
              monthlyBalance,
              actualIncome,
              actualSavings,
              actualExpenses
            }}
            semesterId={semesterId}
            onBudgetUpdated={() => { void refreshBudget(); }}
          />
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
        {hasActuals && (
          <div className="fin-stat">
            <div className="fin-stat-label">Actual Cash Flow</div>
            <div className={`fin-stat-value ${actualBalance >= 0 ? "fin-positive" : "fin-negative"}`}>
              {actualBalance >= 0 ? "+" : ""}{fmtCurrency(actualBalance)}
            </div>
            <div className="fin-stat-sub" style={{ color: actualBalance >= monthlyBalance ? "#0a9e74" : "var(--danger)" }}>
              {actualBalance >= monthlyBalance ? "+" : ""}{fmtCurrency(actualBalance - monthlyBalance)} vs budget
            </div>
          </div>
        )}
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

      {/* ── Budget vs Actual ──────────────────────────────────── */}
      {hasActuals && (
        <div className="card">
          <div className="budget-table-section-header" style={{ marginBottom: 16 }}>
            <span>Budget vs Actual</span>
            <span style={{ color: "var(--muted)", fontSize: "0.8rem", fontWeight: 400 }}>Monthly comparison</span>
          </div>
          <table className="budget-table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="budget-table-num">Budget / mo</th>
                <th className="budget-table-num">Actual / mo</th>
                <th className="budget-table-num">Variance</th>
              </tr>
            </thead>
            <tbody>
              <BvaRow label="Income" budgeted={totalIncome} actual={totalActualIncome} higherActualIsGood={true} />
              {(totalSavings > 0 || totalActualSavings > 0) && (
                <BvaRow label="Savings &amp; Goals" budgeted={totalSavings} actual={totalActualSavings} higherActualIsGood={true} />
              )}
              {expenses.length > 0 ? (
                expenses.map((expItem) => {
                  const budgeted = toMonthly(expItem);
                  const actual = actualExpenses
                    .filter((a) => a.category === expItem.label)
                    .reduce((s, a) => s + a.amount, 0);
                  return actual > 0 || budgeted > 0 ? (
                    <BvaRow key={expItem.id} label={expItem.label || "Unlabeled"} budgeted={budgeted} actual={actual} higherActualIsGood={false} />
                  ) : null;
                })
              ) : (
                <BvaRow label="Expenses" budgeted={totalExpenses} actual={totalActualExpenses} higherActualIsGood={false} />
              )}
              {actualExpenses.filter((a) => !a.category || a.category === "Other" || !expenses.find((e) => e.label === a.category)).length > 0 && (
                <BvaRow
                  label="Other / Unassigned"
                  budgeted={0}
                  actual={actualExpenses.filter((a) => !a.category || a.category === "Other" || !expenses.find((e) => e.label === a.category)).reduce((s, a) => s + a.amount, 0)}
                  higherActualIsGood={false}
                />
              )}
            </tbody>
          </table>
          <div className="budget-table-totals">
            <span>Free Cash Flow</span>
            <span>
              <span className={monthlyBalance >= 0 ? "fin-positive" : "fin-negative"} style={{ marginRight: 20 }}>
                Budget: {monthlyBalance >= 0 ? "+" : ""}{fmtCurrency(monthlyBalance)}
              </span>
              <span className={actualBalance >= 0 ? "fin-positive" : "fin-negative"}>
                Actual: {actualBalance >= 0 ? "+" : ""}{fmtCurrency(actualBalance)}
              </span>
            </span>
          </div>
          {actualIncome.length > 0 && (
            <div className="budget-table-section">
              <div className="budget-table-section-header">
                <span>Actual Income</span>
                <span style={{ color: "#0a9e74", fontWeight: 700 }}>{fmtCurrency(totalActualIncome)} / mo</span>
              </div>
              <table className="budget-table">
                <thead><tr><th>Label</th><th className="budget-table-num">Amount / mo</th></tr></thead>
                <tbody>
                  {actualIncome.map((item) => (
                    <tr key={item.id}>
                      <td>{item.label || <em style={{ color: "var(--muted)" }}>Unlabeled</em>}</td>
                      <td className="budget-table-num" style={{ color: "#0a9e74", fontWeight: 600 }}>{fmtCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {actualSavings.length > 0 && (
            <div className="budget-table-section">
              <div className="budget-table-section-header">
                <span>Actual Savings</span>
                <span style={{ color: "var(--accent)", fontWeight: 700 }}>{fmtCurrency(totalActualSavings)} / mo</span>
              </div>
              <table className="budget-table">
                <thead><tr><th>Label</th><th className="budget-table-num">Amount / mo</th></tr></thead>
                <tbody>
                  {actualSavings.map((item) => (
                    <tr key={item.id}>
                      <td>{item.label || <em style={{ color: "var(--muted)" }}>Unlabeled</em>}</td>
                      <td className="budget-table-num" style={{ color: "var(--accent)", fontWeight: 600 }}>{fmtCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {actualExpenses.length > 0 && (
            <div className="budget-table-section">
              <div className="budget-table-section-header">
                <span>Actual Expenses</span>
                <span style={{ color: "var(--ink)", fontWeight: 700 }}>{fmtCurrency(totalActualExpenses)} / mo</span>
              </div>
              <table className="budget-table">
                <thead><tr><th>Label</th><th>Category</th><th className="budget-table-num">Amount / mo</th><th className="budget-table-num">Date</th></tr></thead>
                <tbody>
                  {actualExpenses.map((item) => (
                    <tr key={item.id}>
                      <td>{item.label || <em style={{ color: "var(--muted)" }}>Unlabeled</em>}</td>
                      <td>{item.category ?? <em style={{ color: "var(--muted)" }}>—</em>}</td>
                      <td className="budget-table-num" style={{ fontWeight: 600 }}>{fmtCurrency(item.amount)}</td>
                      <td className="budget-table-num">{item.date ?? <em style={{ color: "var(--muted)" }}>—</em>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {message && <p style={{ margin: 0, color: "var(--accent)" }}>{message}</p>}
    </div>
  );
}

const TrashIcon = () => (
  <svg fill="none" height="14" viewBox="0 0 16 16" width="14" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4h12M5 4V2h6v2M3 4l1 10h8l1-10M6 7v4M10 7v4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
  </svg>
);
