"use client";

import { useCallback, useState } from "react";

import type {
  Debt,
  ExpenseCategory,
  ExpenseEntry,
  IncomeEntry,
  IncomeEntryCategory
} from "@/types/domain";

// ─── Types ─────────────────────────────────────────────────────

type Week = 1 | 2 | 3 | 4;
const WEEKS: Week[] = [1, 2, 3, 4];

type CellState = { entryId?: string; amount: number };

function emptyCells(): Record<Week, CellState> {
  return { 1: { amount: 0 }, 2: { amount: 0 }, 3: { amount: 0 }, 4: { amount: 0 } };
}

function suggestedDebtCells(monthlyPayment: number): Record<Week, CellState> {
  const cells = emptyCells();
  if (monthlyPayment > 0) {
    // Use week 1 as the default monthly payment slot; students can move it if their due date differs.
    cells[1] = { amount: monthlyPayment };
  }
  return cells;
}

type IncomeRow = {
  rowKey: string;
  label: string;
  isPreset: boolean;
  isPending: boolean;
  category: IncomeEntryCategory;
  savedInDb: boolean;
  cells: Record<Week, CellState>;
};

type ExpenseRow = {
  rowKey: string;
  label: string;
  isPreset: boolean;
  isPending: boolean;
  isDebt: boolean;
  category: ExpenseCategory;
  savedInDb: boolean;
  cells: Record<Week, CellState>;
};

// ─── Presets ───────────────────────────────────────────────────

const INCOME_PRESETS: Array<{ label: string; category: IncomeEntryCategory }> = [
  { label: "Gross Pay", category: "gross_pay" },
  { label: "Taxes & Withholding", category: "taxes" }
];

const EXPENSE_PRESETS: Array<{ label: string; category: ExpenseCategory }> = [
  { label: "Housing / Rent", category: "essential" },
  { label: "Groceries", category: "essential" },
  { label: "Transportation", category: "essential" },
  { label: "Utilities", category: "essential" },
  { label: "Dining Out", category: "discretionary" },
  { label: "Entertainment", category: "discretionary" }
];

// ─── Row builders ──────────────────────────────────────────────

function rk(category: string, label: string) {
  return `${category}:${label}`;
}

function buildIncomeRows(entries: IncomeEntry[]): IncomeRow[] {
  const map = new Map<string, IncomeRow>();

  for (const { label, category } of INCOME_PRESETS) {
    const key = rk(category, label);
    map.set(key, {
      rowKey: key,
      label,
      isPreset: true,
      isPending: false,
      category,
      savedInDb: false,
      cells: emptyCells()
    });
  }

  for (const entry of entries) {
    const w = entry.periodWeek as Week;
    if (w < 1 || w > 4) continue;
    const key = rk(entry.category, entry.label);
    if (!map.has(key)) {
      map.set(key, {
        rowKey: key,
        label: entry.label,
        isPreset: false,
        isPending: false,
        category: entry.category,
        savedInDb: true,
        cells: emptyCells()
      });
    }
    const row = map.get(key)!;
    row.cells[w] = { entryId: entry.id, amount: entry.amount };
    row.savedInDb = true;
  }

  return Array.from(map.values());
}

function buildExpenseRows(entries: ExpenseEntry[], debts: Debt[]): ExpenseRow[] {
  const map = new Map<string, ExpenseRow>();

  for (const { label, category } of EXPENSE_PRESETS) {
    const key = rk(category, label);
    map.set(key, {
      rowKey: key,
      label,
      isPreset: true,
      isPending: false,
      isDebt: false,
      category,
      savedInDb: false,
      cells: emptyCells()
    });
  }

  for (const debt of debts) {
    const key = rk("debt", debt.label);
    if (!map.has(key)) {
      map.set(key, {
        rowKey: key,
        label: debt.label,
        isPreset: false,
        isPending: false,
        isDebt: true,
        category: "debt",
        savedInDb: false,
        cells: suggestedDebtCells(debt.monthlyPayment)
      });
    }
  }

  for (const entry of entries) {
    const w = entry.periodWeek as Week;
    if (w < 1 || w > 4) continue;
    const key = rk(entry.category, entry.label);
    if (!map.has(key)) {
      map.set(key, {
        rowKey: key,
        label: entry.label,
        isPreset: false,
        isPending: false,
        isDebt: false,
        category: entry.category,
        savedInDb: true,
        cells: emptyCells()
      });
    }
    const row = map.get(key)!;
    row.cells[w] = { entryId: entry.id, amount: entry.amount };
    row.savedInDb = true;
  }

  return Array.from(map.values());
}

// ─── Helpers ───────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
}

function rowTotal(cells: Record<Week, CellState>): number {
  return WEEKS.reduce((s, w) => s + cells[w].amount, 0);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function prevMonth(y: number, m: number): [number, number] {
  return m === 1 ? [y - 1, 12] : [y, m - 1];
}

function nextMonth(y: number, m: number): [number, number] {
  return m === 12 ? [y + 1, 1] : [y, m + 1];
}

// ─── Component ─────────────────────────────────────────────────

export function IncomeStatementTool({
  semesterId,
  initialYear,
  initialMonth,
  initialIncomeEntries,
  initialExpenseEntries,
  debts
}: {
  semesterId: string;
  initialYear: number;
  initialMonth: number;
  initialIncomeEntries: IncomeEntry[];
  initialExpenseEntries: ExpenseEntry[];
  debts: Debt[];
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [incomeRows, setIncomeRows] = useState<IncomeRow[]>(() =>
    buildIncomeRows(initialIncomeEntries)
  );
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>(() =>
    buildExpenseRows(initialExpenseEntries, debts)
  );
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Calculations ──────────────────────────────────────────────

  const grossPayTotal = rowTotal(
    (incomeRows.find(r => r.category === "gross_pay") ?? { cells: emptyCells() }).cells
  );
  const taxTotal = rowTotal(
    (incomeRows.find(r => r.category === "taxes") ?? { cells: emptyCells() }).cells
  );
  const netPay = grossPayTotal - taxTotal;

  const otherIncomeTotal = incomeRows
    .filter(r => r.category !== "gross_pay" && r.category !== "taxes")
    .reduce((s, r) => s + rowTotal(r.cells), 0);
  const totalIncome = netPay + otherIncomeTotal;

  const essentialTotal = expenseRows
    .filter(r => r.category === "essential")
    .reduce((s, r) => s + rowTotal(r.cells), 0);
  const debtTotal = expenseRows
    .filter(r => r.category === "debt")
    .reduce((s, r) => s + rowTotal(r.cells), 0);
  const discretionaryTotal = expenseRows
    .filter(r => r.category === "discretionary")
    .reduce((s, r) => s + rowTotal(r.cells), 0);
  const totalExpenses = essentialTotal + debtTotal + discretionaryTotal;
  const netIncome = totalIncome - totalExpenses;

  // ── Month navigation ──────────────────────────────────────────

  async function navigateMonth(y: number, m: number) {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({
        semesterId,
        periodYear: String(y),
        periodMonth: String(m)
      });
      const [ir, er] = await Promise.all([
        fetch(`/api/student/income-entries?${p}`),
        fetch(`/api/student/expense-entries?${p}`)
      ]);
      const [id, ed] = await Promise.all([ir.json(), er.json()]);
      setYear(y);
      setMonth(m);
      setIncomeRows(buildIncomeRows(id.entries ?? []));
      setExpenseRows(buildExpenseRows(ed.entries ?? [], debts));
    } catch {
      setError("Failed to load data for that month.");
    } finally {
      setLoading(false);
    }
  }

  // ── Save income cell ──────────────────────────────────────────

  const saveIncomeCell = useCallback(
    async (rowKey: string, w: Week, amount: number) => {
      const row = incomeRows.find(r => r.rowKey === rowKey);
      if (!row || !row.label.trim()) return;

      const ck = `i:${rowKey}:${w}`;
      setSavingKey(ck);
      setError(null);

      try {
        const body = {
          semesterId,
          periodYear: year,
          periodMonth: month,
          periodWeek: w,
          category: row.category,
          label: row.label,
          amount
        };
        const cell = row.cells[w];
        const resp = cell.entryId
          ? await fetch(`/api/student/income-entries/${cell.entryId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body)
            })
          : await fetch("/api/student/income-entries", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body)
            });

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error ?? "Save failed");

        setIncomeRows(prev =>
          prev.map(r =>
            r.rowKey !== rowKey
              ? r
              : {
                  ...r,
                  savedInDb: true,
                  rowKey: rk(r.category, r.label),
                  cells: { ...r.cells, [w]: { entryId: data.entry.id, amount } }
                }
          )
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSavingKey(null);
      }
    },
    [incomeRows, year, month, semesterId]
  );

  // ── Save expense cell ─────────────────────────────────────────

  const saveExpenseCell = useCallback(
    async (rowKey: string, w: Week, amount: number) => {
      const row = expenseRows.find(r => r.rowKey === rowKey);
      if (!row || !row.label.trim()) return;

      const ck = `e:${rowKey}:${w}`;
      setSavingKey(ck);
      setError(null);

      try {
        const body = {
          semesterId,
          periodYear: year,
          periodMonth: month,
          periodWeek: w,
          category: row.category,
          label: row.label,
          amount
        };
        const cell = row.cells[w];
        const resp = cell.entryId
          ? await fetch(`/api/student/expense-entries/${cell.entryId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body)
            })
          : await fetch("/api/student/expense-entries", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body)
            });

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error ?? "Save failed");

        setExpenseRows(prev =>
          prev.map(r =>
            r.rowKey !== rowKey
              ? r
              : {
                  ...r,
                  savedInDb: true,
                  rowKey: rk(r.category, r.label),
                  cells: { ...r.cells, [w]: { entryId: data.entry.id, amount } }
                }
          )
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSavingKey(null);
      }
    },
    [expenseRows, year, month, semesterId]
  );

  // ── Add / remove pending rows ─────────────────────────────────

  function addIncomeRow() {
    setIncomeRows(prev => [
      ...prev,
      {
        rowKey: `pending:i:${Date.now()}`,
        label: "",
        isPreset: false,
        isPending: true,
        category: "other" as IncomeEntryCategory,
        savedInDb: false,
        cells: emptyCells()
      }
    ]);
  }

  function addExpenseRow(category: ExpenseCategory) {
    setExpenseRows(prev => [
      ...prev,
      {
        rowKey: `pending:e:${Date.now()}`,
        label: "",
        isPreset: false,
        isPending: true,
        isDebt: false,
        category,
        savedInDb: false,
        cells: emptyCells()
      }
    ]);
  }

  function removePending(rowKey: string) {
    setIncomeRows(prev => prev.filter(r => r.rowKey !== rowKey));
    setExpenseRows(prev => prev.filter(r => r.rowKey !== rowKey));
  }

  // ── Row renderers ─────────────────────────────────────────────

  function incomeAmountCell(row: IncomeRow, w: Week) {
    const cell = row.cells[w];
    const ck = `i:${row.rowKey}:${w}`;
    return (
      <td key={w} style={{ position: "relative" }}>
        <input
          className="is-amount-input"
          type="number"
          min="0"
          step="1"
          defaultValue={cell.amount || ""}
          placeholder="—"
          onBlur={e => saveIncomeCell(row.rowKey, w, Number(e.target.value) || 0)}
        />
        {savingKey === ck && <span className="is-saving-dot" />}
      </td>
    );
  }

  function expenseAmountCell(row: ExpenseRow, w: Week) {
    const cell = row.cells[w];
    const ck = `e:${row.rowKey}:${w}`;
    return (
      <td key={w} style={{ position: "relative" }}>
        <input
          className="is-amount-input"
          type="number"
          min="0"
          step="1"
          defaultValue={cell.amount || ""}
          placeholder="—"
          onBlur={e => saveExpenseCell(row.rowKey, w, Number(e.target.value) || 0)}
        />
        {savingKey === ck && <span className="is-saving-dot" />}
      </td>
    );
  }

  function renderIncomeRow(row: IncomeRow) {
    return (
      <tr key={row.rowKey}>
        <td>
          {row.isPending ? (
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                className="is-label-input"
                placeholder="Label (e.g. Side gig)…"
                value={row.label}
                onChange={e =>
                  setIncomeRows(prev =>
                    prev.map(r => r.rowKey === row.rowKey ? { ...r, label: e.target.value } : r)
                  )
                }
                autoFocus
              />
              <button
                className="btn-ghost btn-sm"
                style={{ padding: "2px 6px", minWidth: 0, lineHeight: 1 }}
                onClick={() => removePending(row.rowKey)}
              >
                ✕
              </button>
            </span>
          ) : (
            row.label
          )}
        </td>
        {WEEKS.map(w => incomeAmountCell(row, w))}
        <td>{fmt(rowTotal(row.cells))}</td>
      </tr>
    );
  }

  function renderExpenseRow(row: ExpenseRow) {
    return (
      <tr key={row.rowKey}>
        <td>
          {row.isPending ? (
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                className="is-label-input"
                placeholder="Label (e.g. Phone bill)…"
                value={row.label}
                onChange={e =>
                  setExpenseRows(prev =>
                    prev.map(r => r.rowKey === row.rowKey ? { ...r, label: e.target.value } : r)
                  )
                }
                autoFocus
              />
              <button
                className="btn-ghost btn-sm"
                style={{ padding: "2px 6px", minWidth: 0, lineHeight: 1 }}
                onClick={() => removePending(row.rowKey)}
              >
                ✕
              </button>
            </span>
          ) : (
            row.label
          )}
        </td>
        {WEEKS.map(w => expenseAmountCell(row, w))}
        <td>{fmt(rowTotal(row.cells))}</td>
      </tr>
    );
  }

  const tableKey = `${year}-${month}`;
  const debtRows = expenseRows.filter(r => r.category === "debt");

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="stack">
      {/* Header */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Monthly Budget</h2>
            <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: "0.82rem" }}>
              Use this as your monthly budget log. Week 1-4 columns are for the weeks inside the month.
            </p>
            <div className="is-month-nav">
              <button
                className="is-nav-btn"
                onClick={() => { const [y, m] = prevMonth(year, month); navigateMonth(y, m); }}
                disabled={loading}
                aria-label="Previous month"
              >
                ‹
              </button>
              <span className="is-month-label">
                {loading ? "Loading…" : `${MONTH_NAMES[month - 1]} ${year}`}
              </span>
              <button
                className="is-nav-btn"
                onClick={() => { const [y, m] = nextMonth(year, month); navigateMonth(y, m); }}
                disabled={loading}
                aria-label="Next month"
              >
                ›
              </button>
            </div>
          </div>

          <div className="is-kpi">
            <div className="is-kpi-label">Net Income</div>
            <div className={`is-kpi-value ${netIncome >= 0 ? "is-positive" : "is-negative"}`}>
              {fmt(netIncome)}
            </div>
          </div>
        </div>

        {error && (
          <p style={{ marginTop: 10, fontSize: "0.85rem", color: "var(--danger)" }}>{error}</p>
        )}

        <p style={{ marginTop: 10, fontSize: "0.8rem", color: "var(--muted)" }}>
          Planner note: discretionary expenses entered on the Planner page appear here too. Enter them in one place, not both.
        </p>
      </div>

      {/* Income */}
      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Income</h3>
        <div className="table-wrap" style={{ border: "none", boxShadow: "none", background: "transparent", borderRadius: 0 }}>
          <table className="is-table" key={`income-${tableKey}`}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Line Item</th>
                {WEEKS.map(w => <th key={w}>Week {w}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {incomeRows
                .filter(r => r.category === "gross_pay" || r.category === "taxes")
                .map(r => renderIncomeRow(r))}

              <tr className="is-calc-row">
                <td>Net Pay</td>
                {WEEKS.map(w => <td key={w} />)}
                <td>{fmt(netPay)}</td>
              </tr>

              {incomeRows
                .filter(r => r.category !== "gross_pay" && r.category !== "taxes")
                .map(r => renderIncomeRow(r))}

              <tr className="is-add-row">
                <td colSpan={6}>
                  <button className="is-add-btn" onClick={addIncomeRow}>
                    + Add Income Row
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="budget-table-totals" style={{ paddingTop: 10 }}>
          <span>Total Income</span>
          <span>{fmt(totalIncome)}</span>
        </div>
      </div>

      {/* Expenses */}
      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Expenses</h3>
        <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: "0.8rem" }}>
          Debt rows come from your Debt page. Monthly payment suggestions are loaded into Week 1 so you can confirm or move them before saving.
        </p>
        <div className="table-wrap" style={{ border: "none", boxShadow: "none", background: "transparent", borderRadius: 0 }}>
          <table className="is-table" key={`expense-${tableKey}`}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Line Item</th>
                {WEEKS.map(w => <th key={w}>Week {w}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {/* Essential */}
              <tr className="is-section-row">
                <td colSpan={6}>Essential</td>
              </tr>
              {expenseRows.filter(r => r.category === "essential").map(r => renderExpenseRow(r))}
              <tr className="is-add-row">
                <td colSpan={6}>
                  <button className="is-add-btn" onClick={() => addExpenseRow("essential")}>
                    + Add Essential Row
                  </button>
                </td>
              </tr>

              {/* Debt Payments */}
              <tr className="is-section-row">
                <td colSpan={6}>Debt Payments</td>
              </tr>
              {debtRows.length > 0
                ? debtRows.map(r => renderExpenseRow(r))
                : (
                  <tr>
                    <td
                      colSpan={6}
                      style={{ color: "var(--muted)", fontSize: "0.85rem", paddingLeft: 0, fontStyle: "italic" }}
                    >
                      No debts on record — add debts on the Debt page.
                    </td>
                  </tr>
                )}

              {/* Discretionary */}
              <tr className="is-section-row">
                <td colSpan={6}>Discretionary</td>
              </tr>
              {expenseRows.filter(r => r.category === "discretionary").map(r => renderExpenseRow(r))}
              <tr className="is-add-row">
                <td colSpan={6}>
                  <button className="is-add-btn" onClick={() => addExpenseRow("discretionary")}>
                    + Add Discretionary Row
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="budget-table-totals" style={{ paddingTop: 10 }}>
          <span>Total Expenses</span>
          <span>{fmt(totalExpenses)}</span>
        </div>
      </div>

      {/* Net Income Summary */}
      <div
        className="is-net-card"
        style={{
          background: netIncome >= 0 ? "var(--teal-soft)" : "var(--danger-soft)",
          borderColor: netIncome >= 0 ? "var(--teal)" : "var(--danger)"
        }}
      >
        <span>Net Income — {MONTH_NAMES[month - 1]} {year}</span>
        <span className={netIncome >= 0 ? "is-positive" : "is-negative"} style={{ fontSize: "1.2rem" }}>
          {fmt(netIncome)}
        </span>
      </div>
    </div>
  );
}
