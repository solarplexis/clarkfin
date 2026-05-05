"use client";

import { useState } from "react";

import type {
  AllocationTarget,
  Debt,
  ExpenseEntry,
  Goal,
  IncomeEntry,
  UserProfile
} from "@/types/domain";
import { calcNetPayFromBaseline, projectGoals } from "@/src/lib/calculations/timeline";

// ─── Helpers ─────────────────────────────────────────────────

function fmt(n: number) {
  return Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtSigned(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function pct(n: number) {
  return `${Math.round(n)}%`;
}

function durationLabel(months: number | null): string {
  if (months === null) return "—";
  if (months === 0) return "Complete";
  if (months < 12) return `${months} mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y} yr ${m} mo` : `${y} yr`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// ─── Main component ───────────────────────────────────────────

export function MonthlySnapshotTool({
  user,
  semesterId,
  allocationTarget,
  baselineEntries,
  incomeEntries,
  expenseEntries,
  totalAssets,
  debts,
  goals,
  currentYear,
  currentMonth,
  currentMonthLabel
}: {
  user: UserProfile;
  semesterId: string;
  allocationTarget: AllocationTarget | null;
  baselineEntries: IncomeEntry[];
  incomeEntries: IncomeEntry[];
  expenseEntries: ExpenseEntry[];
  totalAssets: number;
  debts: Debt[];
  goals: Goal[];
  currentYear: number;
  currentMonth: number;
  currentMonthLabel: string;
}) {
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [monthLabel, setMonthLabel] = useState(currentMonthLabel);
  const [income, setIncome] = useState(incomeEntries);
  const [expenses, setExpenses] = useState(expenseEntries);
  const [loading, setLoading] = useState(false);

  // ── Derived numbers ──────────────────────────────────────────

  const netPayBaseline = calcNetPayFromBaseline(baselineEntries);
  const savingsPct = allocationTarget?.savingsPct ?? 0;
  const monthlySavings = (netPayBaseline * savingsPct) / 100;

  const grossPay = income.filter(e => e.category === "gross_pay").reduce((s, e) => s + e.amount, 0);
  const taxes = income.filter(e => e.category === "taxes").reduce((s, e) => s + e.amount, 0);
  const netPay = Math.max(0, grossPay - taxes);
  const otherIncome = income.filter(e => e.category !== "gross_pay" && e.category !== "taxes").reduce((s, e) => s + e.amount, 0);
  const totalIncome = netPay + otherIncome;

  const essentialExpenses = expenses.filter(e => e.category === "essential").reduce((s, e) => s + e.amount, 0);
  const debtExpenses = expenses.filter(e => e.category === "debt").reduce((s, e) => s + e.amount, 0);
  const discretionaryExpenses = expenses.filter(e => e.category === "discretionary").reduce((s, e) => s + e.amount, 0);
  const totalExpenses = essentialExpenses + debtExpenses + discretionaryExpenses;

  const netIncome = totalIncome - totalExpenses;
  const actualSavingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  const totalDebt = debts.reduce((s, d) => s + d.currentBalance, 0);
  const netWorth = totalAssets - totalDebt;

  const nonRetirementGoals = goals.filter(g => g.goalType !== "retirement");
  const goalProjections = projectGoals(nonRetirementGoals, monthlySavings);

  // ── Month navigation ─────────────────────────────────────────

  async function navigateMonth(y: number, m: number) {
    setLoading(true);
    try {
      const [incRes, expRes] = await Promise.all([
        fetch(`/api/student/income-entries?semesterId=${encodeURIComponent(semesterId)}&periodYear=${y}&periodMonth=${m}`),
        fetch(`/api/student/expense-entries?semesterId=${encodeURIComponent(semesterId)}&periodYear=${y}&periodMonth=${m}`)
      ]);
      const [incData, expData] = await Promise.all([incRes.json(), expRes.json()]);
      if (incData.ok && expData.ok) {
        setYear(y);
        setMonth(m);
        setMonthLabel(`${MONTH_NAMES[m - 1]} ${y}`);
        setIncome(incData.entries);
        setExpenses(expData.entries);
      }
    } finally {
      setLoading(false);
    }
  }

  function prevMonth() {
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    navigateMonth(y, m);
  }

  function nextMonth() {
    const m = month === 12 ? 1 : month + 1;
    const y = month === 12 ? year + 1 : year;
    navigateMonth(y, m);
  }

  return (
    <div className="snap-root">
      {/* Header */}
      <div className="snap-header no-print-hide">
        <div>
          <h1>Financial Snapshot</h1>
          <p>{monthLabel} · {user.fullName}</p>
        </div>
        <div className="snap-header-actions">
          <div className="snap-month-nav">
            <button className="wp-nav-btn" onClick={prevMonth} disabled={loading}>‹</button>
            <span className="wp-month-label">{monthLabel}</span>
            <button className="wp-nav-btn" onClick={nextMonth} disabled={loading}>›</button>
          </div>
          <button className="btn" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="snap-print-header print-only">
        <div className="snap-print-title">Financial Snapshot — {monthLabel}</div>
        <div className="snap-print-name">{user.fullName}</div>
      </div>

      {/* Net Worth */}
      <div className="snap-section">
        <div className="snap-section-title">Net Worth</div>
        <div className="snap-nw-row">
          <div className="snap-nw-stat">
            <span className="snap-nw-label">Assets</span>
            <span className="snap-nw-value snap-positive">{fmt(totalAssets)}</span>
          </div>
          <div className="snap-nw-divider">−</div>
          <div className="snap-nw-stat">
            <span className="snap-nw-label">Liabilities</span>
            <span className="snap-nw-value snap-negative">{fmt(totalDebt)}</span>
          </div>
          <div className="snap-nw-divider">=</div>
          <div className="snap-nw-stat">
            <span className="snap-nw-label">Net Worth</span>
            <span className={`snap-nw-value snap-nw-total ${netWorth >= 0 ? "snap-positive" : "snap-negative"}`}>
              {fmtSigned(netWorth)}
            </span>
          </div>
        </div>
      </div>

      {/* Income vs Expenses */}
      <div className="snap-section">
        <div className="snap-section-title">Income &amp; Expenses — {monthLabel}</div>
        <div className="snap-ie-grid">
          <div className="snap-ie-col">
            <div className="snap-ie-heading">Income</div>
            {grossPay > 0 && (
              <div className="snap-ie-row">
                <span>Gross Pay</span><span>{fmt(grossPay)}</span>
              </div>
            )}
            {taxes > 0 && (
              <div className="snap-ie-row snap-ie-deduct">
                <span>Taxes &amp; Withholding</span><span>({fmt(taxes)})</span>
              </div>
            )}
            {otherIncome > 0 && (
              <div className="snap-ie-row">
                <span>Other Income</span><span>{fmt(otherIncome)}</span>
              </div>
            )}
            <div className="snap-ie-total">
              <span>Net Income</span><span className={totalIncome >= 0 ? "snap-positive" : "snap-negative"}>{fmt(totalIncome)}</span>
            </div>
          </div>

          <div className="snap-ie-col">
            <div className="snap-ie-heading">Expenses</div>
            {essentialExpenses > 0 && (
              <div className="snap-ie-row">
                <span>Essential</span><span>{fmt(essentialExpenses)}</span>
              </div>
            )}
            {debtExpenses > 0 && (
              <div className="snap-ie-row">
                <span>Debt Payments</span><span>{fmt(debtExpenses)}</span>
              </div>
            )}
            {discretionaryExpenses > 0 && (
              <div className="snap-ie-row">
                <span>Discretionary</span><span>{fmt(discretionaryExpenses)}</span>
              </div>
            )}
            <div className="snap-ie-total">
              <span>Total Expenses</span><span>{fmt(totalExpenses)}</span>
            </div>
          </div>
        </div>

        <div className="snap-cashflow-row">
          <div className="snap-cashflow-stat">
            <span className="snap-cashflow-label">Cash Flow</span>
            <span className={`snap-cashflow-value ${netIncome >= 0 ? "snap-positive" : "snap-negative"}`}>
              {fmtSigned(netIncome)}
            </span>
          </div>
          <div className="snap-cashflow-stat">
            <span className="snap-cashflow-label">Actual Savings Rate</span>
            <span className="snap-cashflow-value" style={{ color: "var(--accent)" }}>
              {totalIncome > 0 ? pct(actualSavingsRate) : "—"}
            </span>
          </div>
          {savingsPct > 0 && (
            <div className="snap-cashflow-stat">
              <span className="snap-cashflow-label">Target Savings Rate</span>
              <span className="snap-cashflow-value">{pct(savingsPct)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Goal Progress */}
      {goalProjections.length > 0 && (
        <div className="snap-section">
          <div className="snap-section-title">Goal Progress</div>
          <div className="snap-goals">
            {goalProjections.map(g => {
              const isComplete = g.monthsRemaining === 0;
              return (
                <div key={g.goalId} className="snap-goal-row">
                  <div className="snap-goal-info">
                    <span className="snap-goal-label">{g.label}</span>
                    <span className="snap-goal-meta">
                      {fmt(g.savedToDate)} of {fmt(g.targetAmount)}
                      {" · "}
                      {isComplete ? "Complete" : durationLabel(g.monthsRemaining)}
                    </span>
                  </div>
                  <div className="snap-goal-bar-wrap">
                    <div className="snap-goal-bar-track">
                      <div
                        className={`snap-goal-bar-fill${isComplete ? " snap-goal-bar-complete" : ""}`}
                        style={{ width: `${Math.min(100, g.progressPct).toFixed(1)}%` }}
                      />
                    </div>
                    <span className="snap-goal-pct">{pct(g.progressPct)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Debt Summary */}
      {debts.length > 0 && (
        <div className="snap-section">
          <div className="snap-section-title">Debt Summary</div>
          <div className="snap-debts">
            {debts.map(d => (
              <div key={d.id} className="snap-debt-row">
                <div className="snap-debt-info">
                  <span className="snap-debt-label">{d.label}</span>
                  <span className="snap-debt-meta">
                    {d.interestRate > 0 ? `${d.interestRate.toFixed(1)}% APR · ` : ""}{fmt(d.monthlyPayment)}/mo
                  </span>
                </div>
                <span className="snap-debt-balance">{fmt(d.currentBalance)}</span>
              </div>
            ))}
            <div className="snap-debt-total">
              <span>Total Debt</span>
              <span>{fmt(totalDebt)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Allocation Target */}
      {allocationTarget && (
        <div className="snap-section">
          <div className="snap-section-title">Budget Allocation Target</div>
          <div className="snap-alloc-grid">
            {[
              { label: "Essential", value: allocationTarget.essentialPct, color: "var(--teal)" },
              { label: "Debt", value: allocationTarget.debtPct, color: "var(--danger)" },
              { label: "Discretionary", value: allocationTarget.discretionaryPct, color: "var(--accent)" },
              { label: "Savings", value: allocationTarget.savingsPct, color: "#0a9e74" }
            ].map(({ label, value, color }) => (
              <div key={label} className="snap-alloc-stat">
                <span className="snap-alloc-label">{label}</span>
                <span className="snap-alloc-value" style={{ color }}>{pct(value)}</span>
                {netPayBaseline > 0 && (
                  <span className="snap-alloc-amount">{fmt((netPayBaseline * value) / 100)}/mo</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
