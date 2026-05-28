"use client";

import { useCallback, useState } from "react";

import { PageConnect } from "@/components/page-connect";
import { projectGoals } from "@/src/lib/calculations/timeline";
import type {
  AllocationTarget,
  Debt,
  ExpenseCategory,
  ExpenseEntry,
  Goal,
  IncomeEntry,
  IncomeEntryCategory,
  Semester
} from "@/types/domain";

// ─── Types ─────────────────────────────────────────────────────

type Week = 1 | 2 | 3 | 4;
const WEEKS: Week[] = [1, 2, 3, 4];

type CellState = { entryId?: string; amount: number };

type WindowSlot = {
  courseWeek: number;
  periodYear: number;
  periodMonth: number;
  periodWeek: number;
};

function emptyCells(): Record<Week, CellState> {
  return { 1: { amount: 0 }, 2: { amount: 0 }, 3: { amount: 0 }, 4: { amount: 0 } };
}

function suggestedDebtCells(monthlyPayment: number): Record<Week, CellState> {
  const cells = emptyCells();
  if (monthlyPayment > 0) {
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

// ─── Helpers ───────────────────────────────────────────────────

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function rk(category: string, label: string) {
  return `${category}:${label}`;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function rowTotal(cells: Record<Week, CellState>): number {
  return WEEKS.reduce((s, w) => s + cells[w].amount, 0);
}

function parseSemesterStart(startsAt: string): Date | null {
  const trimmed = startsAt.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(startsAt);
  return isNaN(d.getTime()) ? null : d;
}

function courseWeekToCalendar(
  startsAt: string | undefined,
  courseWeek: number
): { periodYear: number; periodMonth: number; periodWeek: number } {
  if (startsAt) {
    const semStart = parseSemesterStart(startsAt);
    if (semStart) {
      const weekStart = new Date(semStart.getTime() + (courseWeek - 1) * MS_PER_WEEK);
      const year = weekStart.getUTCFullYear();
      const month = weekStart.getUTCMonth() + 1;
      const day = weekStart.getUTCDate();
      return { periodYear: year, periodMonth: month, periodWeek: Math.min(4, Math.ceil(day / 7)) };
    }
  }
  const month = Math.ceil(courseWeek / 4);
  const periodWeek = ((courseWeek - 1) % 4) + 1;
  return { periodYear: new Date().getFullYear(), periodMonth: month, periodWeek };
}

function getCurrentCourseWeek(semester: Semester | null): number {
  const duration = semester?.durationWeeks ?? 4;
  if (semester?.startsAt) {
    const semStart = parseSemesterStart(semester.startsAt);
    if (semStart) {
      const diffMs = Date.now() - semStart.getTime();
      return Math.min(Math.max(1, Math.ceil(diffMs / MS_PER_WEEK)), duration);
    }
  }
  return Math.min(4, Math.ceil(new Date().getDate() / 7));
}

// ─── Row builders ──────────────────────────────────────────────

function buildIncomeRows(entries: IncomeEntry[], slots: WindowSlot[]): IncomeRow[] {
  const map = new Map<string, IncomeRow>();

  for (const { label, category } of INCOME_PRESETS) {
    const key = rk(category, label);
    map.set(key, { rowKey: key, label, isPreset: true, isPending: false, category, savedInDb: false, cells: emptyCells() });
  }

  for (const entry of entries) {
    if (entry.periodWeek < 1 || entry.periodWeek > 4) continue;
    const colIdx = slots.findIndex(s =>
      s.periodYear === entry.periodYear &&
      s.periodMonth === entry.periodMonth &&
      s.periodWeek === entry.periodWeek
    );
    if (colIdx === -1) continue;
    const w = (colIdx + 1) as Week;
    const key = rk(entry.category, entry.label);
    if (!map.has(key)) {
      map.set(key, { rowKey: key, label: entry.label, isPreset: false, isPending: false, category: entry.category, savedInDb: true, cells: emptyCells() });
    }
    const row = map.get(key)!;
    row.cells[w] = { entryId: entry.id, amount: entry.amount };
    row.savedInDb = true;
  }

  return Array.from(map.values());
}

function buildExpenseRows(entries: ExpenseEntry[], debts: Debt[], slots: WindowSlot[]): ExpenseRow[] {
  const map = new Map<string, ExpenseRow>();

  for (const { label, category } of EXPENSE_PRESETS) {
    const key = rk(category, label);
    map.set(key, { rowKey: key, label, isPreset: true, isPending: false, isDebt: false, category, savedInDb: false, cells: emptyCells() });
  }

  for (const debt of debts) {
    const key = rk("debt", debt.label);
    if (!map.has(key)) {
      map.set(key, { rowKey: key, label: debt.label, isPreset: false, isPending: false, isDebt: true, category: "debt", savedInDb: false, cells: suggestedDebtCells(debt.monthlyPayment) });
    }
  }

  for (const entry of entries) {
    if (entry.periodWeek < 1 || entry.periodWeek > 4) continue;
    const colIdx = slots.findIndex(s =>
      s.periodYear === entry.periodYear &&
      s.periodMonth === entry.periodMonth &&
      s.periodWeek === entry.periodWeek
    );
    if (colIdx === -1) continue;
    const w = (colIdx + 1) as Week;
    const key = rk(entry.category, entry.label);
    if (!map.has(key)) {
      map.set(key, { rowKey: key, label: entry.label, isPreset: false, isPending: false, isDebt: false, category: entry.category, savedInDb: true, cells: emptyCells() });
    }
    const row = map.get(key)!;
    row.cells[w] = { entryId: entry.id, amount: entry.amount };
    row.savedInDb = true;
  }

  return Array.from(map.values());
}

// ─── Component ─────────────────────────────────────────────────

export function IncomeStatementTool({
  semesterId,
  semester,
  initialIncomeEntries,
  initialExpenseEntries,
  debts,
  goals = [],
  allocationTarget = null
}: {
  semesterId: string;
  semester: Semester | null;
  initialIncomeEntries: IncomeEntry[];
  initialExpenseEntries: ExpenseEntry[];
  debts: Debt[];
  goals?: Goal[];
  allocationTarget?: AllocationTarget | null;
}) {
  const durationWeeks = semester?.durationWeeks ?? 4;

  // Default window: the group of 4 containing the current course week
  const currentWeek = getCurrentCourseWeek(semester);
  const defaultWindowStart = Math.floor((currentWeek - 1) / 4) * 4 + 1;

  const [windowStart, setWindowStart] = useState(defaultWindowStart);
  const [allIncomeEntries] = useState(initialIncomeEntries);
  const [allExpenseEntries] = useState(initialExpenseEntries);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Window slots: 4 course week positions mapped to calendar coords ──

  const windowSlots: WindowSlot[] = Array.from({ length: 4 }, (_, i) => {
    const courseWeek = windowStart + i;
    return { courseWeek, ...courseWeekToCalendar(semester?.startsAt, courseWeek) };
  });

  const windowEnd = Math.min(windowStart + 3, durationWeeks);
  const canGoPrev = windowStart > 1;
  const canGoNext = windowStart + 4 <= durationWeeks;

  // ── Rows: rebuilt from all entries filtered to the current window ──

  const [incomeRows, setIncomeRows] = useState<IncomeRow[]>(() =>
    buildIncomeRows(initialIncomeEntries, windowSlots)
  );
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>(() =>
    buildExpenseRows(initialExpenseEntries, debts, windowSlots)
  );

  function navigateWindow(nextStart: number) {
    const nextSlots: WindowSlot[] = Array.from({ length: 4 }, (_, i) => {
      const courseWeek = nextStart + i;
      return { courseWeek, ...courseWeekToCalendar(semester?.startsAt, courseWeek) };
    });
    setWindowStart(nextStart);
    setIncomeRows(buildIncomeRows(allIncomeEntries, nextSlots));
    setExpenseRows(buildExpenseRows(allExpenseEntries, debts, nextSlots));
  }

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

  const essentialTotal = expenseRows.filter(r => r.category === "essential").reduce((s, r) => s + rowTotal(r.cells), 0);
  const debtTotal = expenseRows.filter(r => r.category === "debt").reduce((s, r) => s + rowTotal(r.cells), 0);
  const discretionaryTotal = expenseRows.filter(r => r.category === "discretionary").reduce((s, r) => s + rowTotal(r.cells), 0);
  const totalExpenses = essentialTotal + debtTotal + discretionaryTotal;
  const netIncome = totalIncome - totalExpenses;

  const savingsRate = totalIncome > 0 ? (netIncome / totalIncome) * 100 : null;
  const targetSavingsPct = allocationTarget?.savingsPct ?? 0;
  const nonRetirementGoals = goals.filter(g => g.goalType !== "retirement");
  const goalProjections = totalIncome > 0 && netIncome > 0
    ? projectGoals(nonRetirementGoals, netIncome)
    : projectGoals(nonRetirementGoals, (totalIncome * targetSavingsPct) / 100);
  const nextGoal = goalProjections.find(p => p.monthsRemaining !== 0 && p.monthsRemaining !== null);

  // ── Save income cell ──────────────────────────────────────────

  const saveIncomeCell = useCallback(
    async (rowKey: string, colIdx: Week, amount: number) => {
      const row = incomeRows.find(r => r.rowKey === rowKey);
      if (!row || !row.label.trim()) return;

      const slot = windowSlots[colIdx - 1];
      const ck = `i:${rowKey}:${colIdx}`;
      setSavingKey(ck);
      setError(null);

      try {
        const body = {
          semesterId,
          periodYear: slot.periodYear,
          periodMonth: slot.periodMonth,
          periodWeek: slot.periodWeek,
          category: row.category,
          label: row.label,
          amount
        };
        const cell = row.cells[colIdx];
        const resp = cell.entryId
          ? await fetch(`/api/student/income-entries/${cell.entryId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
          : await fetch("/api/student/income-entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error ?? "Save failed");

        setIncomeRows(prev =>
          prev.map(r =>
            r.rowKey !== rowKey ? r : {
              ...r,
              savedInDb: true,
              cells: { ...r.cells, [colIdx]: { entryId: data.entry.id, amount } }
            }
          )
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSavingKey(null);
      }
    },
    [incomeRows, windowSlots, semesterId]
  );

  // ── Save expense cell ─────────────────────────────────────────

  const saveExpenseCell = useCallback(
    async (rowKey: string, colIdx: Week, amount: number) => {
      const row = expenseRows.find(r => r.rowKey === rowKey);
      if (!row || !row.label.trim()) return;

      const slot = windowSlots[colIdx - 1];
      const ck = `e:${rowKey}:${colIdx}`;
      setSavingKey(ck);
      setError(null);

      try {
        const body = {
          semesterId,
          periodYear: slot.periodYear,
          periodMonth: slot.periodMonth,
          periodWeek: slot.periodWeek,
          category: row.category,
          label: row.label,
          amount
        };
        const cell = row.cells[colIdx];
        const resp = cell.entryId
          ? await fetch(`/api/student/expense-entries/${cell.entryId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
          : await fetch("/api/student/expense-entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error ?? "Save failed");

        setExpenseRows(prev =>
          prev.map(r =>
            r.rowKey !== rowKey ? r : {
              ...r,
              savedInDb: true,
              cells: { ...r.cells, [colIdx]: { entryId: data.entry.id, amount } }
            }
          )
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSavingKey(null);
      }
    },
    [expenseRows, windowSlots, semesterId]
  );

  // ── Add / remove pending rows ─────────────────────────────────

  function addIncomeRow() {
    setIncomeRows(prev => [...prev, {
      rowKey: `pending:i:${Date.now()}`,
      label: "", isPreset: false, isPending: true,
      category: "other" as IncomeEntryCategory, savedInDb: false, cells: emptyCells()
    }]);
  }

  function addExpenseRow(category: ExpenseCategory) {
    setExpenseRows(prev => [...prev, {
      rowKey: `pending:e:${Date.now()}`,
      label: "", isPreset: false, isPending: true,
      isDebt: false, category, savedInDb: false, cells: emptyCells()
    }]);
  }

  function removePending(rowKey: string) {
    setIncomeRows(prev => prev.filter(r => r.rowKey !== rowKey));
    setExpenseRows(prev => prev.filter(r => r.rowKey !== rowKey));
  }

  // ── Row renderers ─────────────────────────────────────────────

  function incomeAmountCell(row: IncomeRow, colIdx: Week) {
    const slot = windowSlots[colIdx - 1];
    const isDisabled = slot.courseWeek > durationWeeks;
    const cell = row.cells[colIdx];
    const ck = `i:${row.rowKey}:${colIdx}`;
    return (
      <td key={colIdx} style={{ position: "relative" }}>
        <input
          className="is-amount-input"
          type="number"
          min="0"
          step="1"
          disabled={isDisabled}
          defaultValue={cell.amount || ""}
          placeholder={isDisabled ? "" : "—"}
          onBlur={e => !isDisabled && saveIncomeCell(row.rowKey, colIdx, Number(e.target.value) || 0)}
        />
        {savingKey === ck && <span className="is-saving-dot" />}
      </td>
    );
  }

  function expenseAmountCell(row: ExpenseRow, colIdx: Week) {
    const slot = windowSlots[colIdx - 1];
    const isDisabled = slot.courseWeek > durationWeeks;
    const cell = row.cells[colIdx];
    const ck = `e:${row.rowKey}:${colIdx}`;
    return (
      <td key={colIdx} style={{ position: "relative" }}>
        <input
          className="is-amount-input"
          type="number"
          min="0"
          step="1"
          disabled={isDisabled}
          defaultValue={cell.amount || ""}
          placeholder={isDisabled ? "" : "—"}
          onBlur={e => !isDisabled && saveExpenseCell(row.rowKey, colIdx, Number(e.target.value) || 0)}
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
                onChange={e => setIncomeRows(prev => prev.map(r => r.rowKey === row.rowKey ? { ...r, label: e.target.value } : r))}
                autoFocus
              />
              <button className="btn-ghost btn-sm" style={{ padding: "2px 6px", minWidth: 0, lineHeight: 1 }} onClick={() => removePending(row.rowKey)}>✕</button>
            </span>
          ) : row.label}
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
                onChange={e => setExpenseRows(prev => prev.map(r => r.rowKey === row.rowKey ? { ...r, label: e.target.value } : r))}
                autoFocus
              />
              <button className="btn-ghost btn-sm" style={{ padding: "2px 6px", minWidth: 0, lineHeight: 1 }} onClick={() => removePending(row.rowKey)}>✕</button>
            </span>
          ) : row.label}
        </td>
        {WEEKS.map(w => expenseAmountCell(row, w))}
        <td>{fmt(rowTotal(row.cells))}</td>
      </tr>
    );
  }

  const tableKey = `window-${windowStart}`;
  const debtRows = expenseRows.filter(r => r.category === "debt");

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="stack">
      <PageConnect
        storageKey="income"
        text="Your net income here is your actual monthly savings — the number that drives goal projections on the Goals page and the Savings Rate KPI on your Dashboard. Debt payments logged here also update your payoff timelines on the Debt page."
        links={[
          { href: "/app/student", label: "See Dashboard →" },
          { href: "/app/student/goals", label: "View goal timelines →" },
          { href: "/app/student/debt", label: "Track debt payoff →" }
        ]}
      />

      {totalIncome > 0 ? (
        <div className="is-story-strip">
          <div className="is-story-row">
            <div className="is-story-stat">
              <span className="is-story-label">Net Income</span>
              <span className={`is-story-value ${netIncome >= 0 ? "is-story-positive" : "is-story-negative"}`}>
                {fmt(netIncome)}
              </span>
            </div>
            {savingsRate !== null && (
              <div className="is-story-stat">
                <span className="is-story-label">Savings Rate</span>
                <span className={`is-story-value ${savingsRate >= (targetSavingsPct || 10) ? "is-story-positive" : "is-story-warn"}`}>
                  {savingsRate.toFixed(1)}%
                  {targetSavingsPct > 0 && <span className="is-story-target"> (target {targetSavingsPct}%)</span>}
                </span>
              </div>
            )}
            {nextGoal && (
              <div className="is-story-stat">
                <span className="is-story-label">Next Goal</span>
                <span className="is-story-value is-story-goal">
                  {nextGoal.label}
                  {nextGoal.monthsRemaining != null && <span className="is-story-target"> · {nextGoal.monthsRemaining} months away</span>}
                </span>
              </div>
            )}
          </div>
          {savingsRate !== null && targetSavingsPct > 0 && savingsRate < targetSavingsPct && (
            <div className="is-story-nudge">
              You&apos;re saving {savingsRate.toFixed(1)}% — your target is {targetSavingsPct}%.
              Closing that gap by {fmt((targetSavingsPct - savingsRate) / 100 * totalIncome)} more this period
              {nextGoal?.monthsRemaining != null ? ` moves your ${nextGoal.label} closer.` : "."}
            </div>
          )}
        </div>
      ) : (
        <div className="is-story-empty">
          Log your income below to see your savings rate and how this period connects to your goals.
          Everything you track here flows to your <a href="/app/student">Dashboard</a> and{" "}
          <a href="/app/student/goals">Goal projections</a>.
        </div>
      )}

      {/* Header */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Income &amp; Expenses</h2>
            <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: "0.82rem" }}>
              Your complete record — income in, expenses out, net savings. This is the source of truth for your Dashboard and Goals.
            </p>
            <div className="is-month-nav">
              <button
                className="is-nav-btn"
                onClick={() => navigateWindow(windowStart - 4)}
                disabled={!canGoPrev}
                aria-label="Previous 4 weeks"
              >
                ‹
              </button>
              <span className="is-month-label">
                Weeks {windowStart}–{windowEnd}
                <span style={{ color: "var(--muted)", fontWeight: 400, marginLeft: 6 }}>of {durationWeeks}</span>
              </span>
              <button
                className="is-nav-btn"
                onClick={() => navigateWindow(windowStart + 4)}
                disabled={!canGoNext}
                aria-label="Next 4 weeks"
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

        {error && <p style={{ marginTop: 10, fontSize: "0.85rem", color: "var(--danger)" }}>{error}</p>}

        <p style={{ marginTop: 10, fontSize: "0.8rem", color: "var(--muted)" }}>
          Discretionary expenses logged on the Budget (planner) page appear here automatically — enter them in one place only.
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
                {windowSlots.map(s => (
                  <th key={s.courseWeek} style={{ opacity: s.courseWeek > durationWeeks ? 0.3 : 1 }}>
                    Week {s.courseWeek}
                  </th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {incomeRows.filter(r => r.category === "gross_pay" || r.category === "taxes").map(r => renderIncomeRow(r))}
              <tr className="is-calc-row">
                <td>Net Pay</td>
                {WEEKS.map(w => <td key={w} />)}
                <td>{fmt(netPay)}</td>
              </tr>
              {incomeRows.filter(r => r.category !== "gross_pay" && r.category !== "taxes").map(r => renderIncomeRow(r))}
              <tr className="is-add-row">
                <td colSpan={6}>
                  <button className="is-add-btn" onClick={addIncomeRow}>+ Add Income Row</button>
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
                {windowSlots.map(s => (
                  <th key={s.courseWeek} style={{ opacity: s.courseWeek > durationWeeks ? 0.3 : 1 }}>
                    Week {s.courseWeek}
                  </th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="is-section-row"><td colSpan={6}>Essential</td></tr>
              {expenseRows.filter(r => r.category === "essential").map(r => renderExpenseRow(r))}
              <tr className="is-add-row">
                <td colSpan={6}><button className="is-add-btn" onClick={() => addExpenseRow("essential")}>+ Add Essential Row</button></td>
              </tr>

              <tr className="is-section-row"><td colSpan={6}>Debt Payments</td></tr>
              {debtRows.length > 0
                ? debtRows.map(r => renderExpenseRow(r))
                : <tr><td colSpan={6} style={{ color: "var(--muted)", fontSize: "0.85rem", paddingLeft: 0, fontStyle: "italic" }}>No debts on record — add debts on the Debt page.</td></tr>
              }

              <tr className="is-section-row"><td colSpan={6}>Discretionary</td></tr>
              {expenseRows.filter(r => r.category === "discretionary").map(r => renderExpenseRow(r))}
              <tr className="is-add-row">
                <td colSpan={6}><button className="is-add-btn" onClick={() => addExpenseRow("discretionary")}>+ Add Discretionary Row</button></td>
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
        <span>Net Income — Weeks {windowStart}–{windowEnd}</span>
        <span className={netIncome >= 0 ? "is-positive" : "is-negative"} style={{ fontSize: "1.2rem" }}>
          {fmt(netIncome)}
        </span>
      </div>

    </div>
  );
}
