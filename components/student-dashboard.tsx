"use client";

import Link from "next/link";
import { useState } from "react";

import { StudentWorkspaceSwitcher } from "@/components/student-workspace-switcher";
import { projectGoals, projectRetirement, calcNetPayFromBaseline } from "@/src/lib/calculations/timeline";
import type {
  AllocationTarget,
  Debt,
  ExpenseEntry,
  Goal,
  IncomeEntry,
  Semester,
  StudentEnrollment,
  UserProfile
} from "@/types/domain";

// ─── Types ─────────────────────────────────────────────────────

interface Workspace {
  enrollments: StudentEnrollment[];
  activeEnrollment: StudentEnrollment | null;
  activeSemester: Semester | null;
}

interface EnrollmentOption {
  semesterId: string;
  label: string;
}

// ─── Helpers ───────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function pctLabel(n: number) {
  return `${Math.round(n)}%`;
}

const ALLOC_COLORS: Record<string, string> = {
  Essential: "var(--teal)",
  Debt: "var(--danger)",
  Discretionary: "var(--accent)",
  Savings: "#0a9e74"
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function monthLabel(ym: string | null): string {
  if (!ym) return "—";
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
}

function durationLabel(months: number | null): string {
  if (months === null) return "—";
  if (months === 0) return "Complete";
  if (months < 12) return `${months} mo`;
  const y = Math.floor(months / 12);
  const mo = months % 12;
  return mo > 0 ? `${y} yr ${mo} mo` : `${y} yr`;
}

// ─── Financial tips ─────────────────────────────────────────────

const TIPS: { title: string; text: string }[] = [
  { title: "Pay Yourself First", text: "Automate savings transfers on payday before spending anything else. Treat savings like a non-negotiable bill." },
  { title: "The 50/30/20 Rule", text: "A simple starting point: 50% of net pay for needs, 30% for wants, 20% for savings and debt payoff." },
  { title: "High-Interest Debt First", text: "Credit card interest rates often exceed 20% APR. Paying them down beats almost any investment return." },
  { title: "Build a 3-Month Emergency Fund", text: "Before investing, save 3–6 months of essential expenses in a separate, accessible savings account." },
  { title: "Automate, Then Forget", text: "Set up automatic transfers to savings and debt payments. Automation beats willpower every time." },
  { title: "Track Every Dollar for One Month", text: "Most people underestimate spending by 20–30%. One month of careful tracking reveals where money actually goes." },
  { title: "Understand Compound Interest", text: "Debt works against you exponentially. Starting to save early works for you the same way — time is the key variable." },
  { title: "Avoid Lifestyle Inflation", text: "When income rises, resist the urge to immediately raise spending. Direct raises to savings or debt first." },
  { title: "Negotiate Bills Annually", text: "Insurance, internet, and phone bills can often be reduced by simply asking or switching providers once a year." },
  { title: "Use Credit Cards Like Debit", text: "If you carry a balance, interest charges erase any rewards. Pay in full each month or avoid credit cards entirely." },
  { title: "Know Your Net Worth", text: "Net worth (assets minus liabilities) is the most important financial number to track over time, not income." },
  { title: "Invest in Tax-Advantaged Accounts First", text: "Max out a 401(k) or IRA before taxable accounts. The tax savings compound significantly over decades." },
  { title: "The Latte Factor Is Real — But Complicated", text: "Small daily expenses add up, but big recurring costs (housing, car, subscriptions) have more impact. Fix both." },
  { title: "Side Income Compounds Faster", text: "Extra income applied entirely to debt or savings creates momentum that salary alone rarely matches." },
  { title: "Buy Used, Drive Used", text: "New cars depreciate 20% in year one. A 2-year-old car gives nearly identical utility at a fraction of the cost." },
  { title: "Read One Finance Book", text: "\"The Total Money Makeover,\" \"I Will Teach You to Be Rich,\" or \"The Simple Path to Wealth\" are all worth the time." },
  { title: "Understand Your Paycheck", text: "Know the difference between gross pay, net pay, and your effective tax rate. These numbers drive every budget decision." },
  { title: "Set Goals With Deadlines", text: "\"Save $5,000\" is weak. \"Save $5,000 by December by saving $417/month\" is a plan." },
  { title: "Housing Is Often the Biggest Lever", text: "Keeping housing under 28% of gross income leaves room for saving, investing, and enjoying life." },
  { title: "Review Subscriptions Quarterly", text: "Streaming, gym, apps — recurring charges add up. Cancel anything you haven't used in 30 days." }
];

// ─── Allocation slider panel ────────────────────────────────────

function AllocationPanel({
  semesterId,
  initial
}: {
  semesterId: string;
  initial: AllocationTarget | null;
}) {
  const [essential, setEssential] = useState(initial?.essentialPct ?? 50);
  const [debt, setDebt] = useState(initial?.debtPct ?? 20);
  const [discretionary, setDiscretionary] = useState(initial?.discretionaryPct ?? 15);
  const [savings, setSavings] = useState(initial?.savingsPct ?? 15);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = essential + debt + discretionary + savings;
  const isValid = Math.abs(total - 100) < 0.01;

  const isDirty =
    essential !== (initial?.essentialPct ?? 50) ||
    debt !== (initial?.debtPct ?? 20) ||
    discretionary !== (initial?.discretionaryPct ?? 15) ||
    savings !== (initial?.savingsPct ?? 15);

  async function save() {
    if (!isValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const resp = await fetch("/api/student/allocation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semesterId, essentialPct: essential, debtPct: debt, discretionaryPct: discretionary, savingsPct: savings })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const rows: Array<{ label: string; value: number; set: (v: number) => void }> = [
    { label: "Essential", value: essential, set: setEssential },
    { label: "Debt", value: debt, set: setDebt },
    { label: "Discretionary", value: discretionary, set: setDiscretionary },
    { label: "Savings", value: savings, set: setSavings }
  ];

  return (
    <div className="card">
      <div className="card-header">
        <h3>Target Allocation</h3>
      </div>

      {rows.map(({ label, value, set }) => (
        <div className="dash-alloc-row" key={label}>
          <span className="dash-alloc-label">{label}</span>
          <input
            className="dash-alloc-slider"
            type="range"
            min={0}
            max={100}
            step={1}
            value={value}
            onChange={e => set(Number(e.target.value))}
            style={{ accentColor: ALLOC_COLORS[label] }}
          />
          <span className="dash-alloc-pct">{pctLabel(value)}</span>
        </div>
      ))}

      <div className="dash-alloc-total">
        <span style={{ color: isValid ? "#0a9e74" : "var(--danger)" }}>
          Total: {pctLabel(total)} {isValid ? "✓" : `(need ${pctLabel(100 - total)} more)`}
        </span>
        <button
          className="btn btn-sm"
          onClick={save}
          disabled={!isValid || !isDirty || saving}
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </div>

      {error && (
        <p style={{ marginTop: 6, fontSize: "0.8rem", color: "var(--danger)" }}>{error}</p>
      )}
    </div>
  );
}

// ─── Actual allocation panel ────────────────────────────────────

function ActualAllocationPanel({
  incomeEntries,
  expenseEntries,
  targetAllocation,
  monthYear
}: {
  incomeEntries: IncomeEntry[];
  expenseEntries: ExpenseEntry[];
  targetAllocation: AllocationTarget | null;
  monthYear: string;
}) {
  const grossPay = incomeEntries.filter(e => e.category === "gross_pay").reduce((s, e) => s + e.amount, 0);
  const taxes = incomeEntries.filter(e => e.category === "taxes").reduce((s, e) => s + e.amount, 0);
  const netPay = Math.max(0, grossPay - taxes);

  const essential = expenseEntries.filter(e => e.category === "essential").reduce((s, e) => s + e.amount, 0);
  const debtPayments = expenseEntries.filter(e => e.category === "debt").reduce((s, e) => s + e.amount, 0);
  const discretionary = expenseEntries.filter(e => e.category === "discretionary").reduce((s, e) => s + e.amount, 0);
  const totalExpenses = essential + debtPayments + discretionary;
  const savings = Math.max(0, netPay - totalExpenses);

  const rows: Array<{ label: string; actual: number; target: number; color: string }> = [
    { label: "Essential", actual: netPay > 0 ? (essential / netPay) * 100 : 0, target: targetAllocation?.essentialPct ?? 50, color: ALLOC_COLORS.Essential },
    { label: "Debt", actual: netPay > 0 ? (debtPayments / netPay) * 100 : 0, target: targetAllocation?.debtPct ?? 20, color: ALLOC_COLORS.Debt },
    { label: "Discretionary", actual: netPay > 0 ? (discretionary / netPay) * 100 : 0, target: targetAllocation?.discretionaryPct ?? 15, color: ALLOC_COLORS.Discretionary },
    { label: "Savings", actual: netPay > 0 ? (savings / netPay) * 100 : 0, target: targetAllocation?.savingsPct ?? 15, color: ALLOC_COLORS.Savings }
  ];

  const amounts: Record<string, number> = { Essential: essential, Debt: debtPayments, Discretionary: discretionary, Savings: savings };

  return (
    <div className="card">
      <div className="card-header">
        <h3>Actual Allocation</h3>
        <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{monthYear}</span>
      </div>

      {netPay === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
          No income data yet for this month.{" "}
          <Link href="/app/student/budget" style={{ color: "var(--accent)" }}>Add income →</Link>
        </p>
      ) : (
        <>
          <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 12 }}>
            Net Pay: {fmt(netPay)}/mo
          </p>
          {rows.map(({ label, actual, target, color }) => {
            const isOver = actual > target * 1.1;
            const isGood = actual <= target;
            return (
              <div className="dash-actual-row" key={label}>
                <span className="dash-actual-label">{label}</span>
                <div className="dash-actual-track">
                  <div
                    className={`dash-actual-fill${isOver ? " dash-actual-fill-over" : isGood ? " dash-actual-fill-good" : ""}`}
                    style={{ width: `${Math.min(100, actual).toFixed(1)}%`, background: color, opacity: isOver ? 1 : 0.85 }}
                  />
                </div>
                <span className="dash-actual-pct">{pctLabel(actual)}</span>
                <span className="dash-actual-amt">{fmt(amounts[label] ?? 0)}</span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────

export function StudentDashboard({
  user,
  goals,
  debts,
  totalAssets,
  allocationTarget,
  currentMonthIncomeEntries,
  currentMonthExpenseEntries,
  baselineEntries,
  workspace,
  enrollmentOptions,
  semesterId,
  currentMonthLabel
}: {
  user: UserProfile;
  goals: Goal[];
  debts: Debt[];
  totalAssets: number;
  allocationTarget: AllocationTarget | null;
  currentMonthIncomeEntries: IncomeEntry[];
  currentMonthExpenseEntries: ExpenseEntry[];
  baselineEntries: IncomeEntry[];
  workspace: Workspace | null;
  enrollmentOptions: EnrollmentOption[];
  semesterId?: string;
  currentMonthLabel: string;
}) {
  // ── KPI calculations ────────────────────────────────────────────

  const netPayMonthly = calcNetPayFromBaseline(baselineEntries);
  const savingsPct = allocationTarget?.savingsPct ?? 0;
  const monthlySavings = (netPayMonthly * savingsPct) / 100;

  // Current month actuals
  const grossPayActual = currentMonthIncomeEntries.filter(e => e.category === "gross_pay").reduce((s, e) => s + e.amount, 0);
  const taxesActual = currentMonthIncomeEntries.filter(e => e.category === "taxes").reduce((s, e) => s + e.amount, 0);
  const netPayActual = Math.max(0, grossPayActual - taxesActual);
  const totalExpensesActual = currentMonthExpenseEntries.reduce((s, e) => s + e.amount, 0);
  const netIncomeActual = netPayActual - totalExpensesActual;

  const totalDebt = debts.reduce((s, d) => s + d.currentBalance, 0);
  const netWorth = totalAssets - totalDebt;

  // Next goal (first incomplete, by priority)
  const nonRetirementGoals = goals.filter(g => g.goalType !== "retirement");
  const goalProjections = projectGoals(nonRetirementGoals, monthlySavings);
  const nextGoal = goalProjections.find(g => g.monthsRemaining !== 0);

  // Emergency fund check
  const hasEmergencyFund = goals.some(g => g.goalType === "emergency_fund");

  // Retirement
  const retirement =
    user.currentAge && user.targetRetirementAge && user.retirementNetWorthTarget
      ? projectRetirement(
          user.currentAge,
          user.targetRetirementAge,
          user.retirementNetWorthTarget,
          netWorth,
          monthlySavings,
          netPayMonthly
        )
      : null;

  const courseLabel = workspace?.activeSemester
    ? `${workspace.activeSemester.courseCode} · ${workspace.activeSemester.title}`
    : null;

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-text">
          <h1>My Finances</h1>
          <p>{courseLabel ?? "No active course"}</p>
        </div>
        {enrollmentOptions.length > 1 && (
          <StudentWorkspaceSwitcher
            activeSemesterId={workspace?.activeEnrollment?.semesterId}
            options={enrollmentOptions}
          />
        )}
      </div>

      {/* Emergency Fund Banner */}
      {!hasEmergencyFund && goals.length > 0 && (
        <div className="dash-ef-banner">
          <span className="dash-ef-icon">⚠</span>
          <div className="dash-ef-body">
            <div className="dash-ef-title">Add an Emergency Fund Goal</div>
            <div className="dash-ef-text">
              Financial advisors recommend 3–6 months of expenses in an accessible savings account before investing.
              Add an emergency fund goal to track your progress.{" "}
              <Link href="/app/student/goals" style={{ color: "var(--ink)", fontWeight: 600 }}>Set it up →</Link>
            </div>
          </div>
        </div>
      )}

      {/* KPI Strip */}
      <div className="fin-stat-strip">
        <div className="fin-stat">
          <div className="fin-stat-label">Net Worth</div>
          <div className={`fin-stat-value ${netWorth >= 0 ? "fin-positive" : "fin-negative"}`}>
            {fmt(netWorth)}
          </div>
          <div className="fin-stat-sub">
            {totalAssets > 0 && `${fmt(totalAssets)} assets · `}
            {totalDebt > 0 ? `${fmt(totalDebt)} debt` : "No debt on record"}
          </div>
        </div>

        <div className="fin-stat">
          <div className="fin-stat-label">Net Income</div>
          <div className={`fin-stat-value ${netIncomeActual >= 0 ? "fin-positive" : "fin-negative"}`}>
            {netPayActual > 0 ? fmt(netIncomeActual) : "—"}
          </div>
          <div className="fin-stat-sub">
            {netPayActual > 0
              ? `${currentMonthLabel} · net pay ${fmt(netPayActual)}`
              : "No income entries this month"}
          </div>
        </div>

        <div className="fin-stat">
          <div className="fin-stat-label">Savings Rate</div>
          <div className="fin-stat-value" style={{ color: "var(--accent)" }}>
            {savingsPct > 0 ? pctLabel(savingsPct) : "—"}
          </div>
          <div className="fin-stat-sub">
            {savingsPct > 0 && netPayMonthly > 0
              ? `${fmt(monthlySavings)}/mo baseline`
              : "Set allocation target"}
          </div>
        </div>

        <div className="fin-stat">
          <div className="fin-stat-label">Next Goal</div>
          {nextGoal ? (
            <>
              <div className="fin-stat-value" style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: 6 }}>
                {nextGoal.label}
              </div>
              <div className="fin-stat-sub">
                {nextGoal.monthsRemaining !== null
                  ? `${durationLabel(nextGoal.monthsRemaining)} · ${monthLabel(nextGoal.projectedDate)}`
                  : "Set a savings rate"}
              </div>
            </>
          ) : (
            <>
              <div className="fin-stat-value" style={{ fontSize: "1rem", color: "var(--muted)" }}>
                {goals.length === 0 ? "None set" : "All complete"}
              </div>
              <div className="fin-stat-sub">
                <Link href="/app/student/goals" style={{ color: "var(--accent)" }}>
                  {goals.length === 0 ? "Add goals →" : "View timeline →"}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Allocation panels */}
      <div className="fin-main-grid">
        <AllocationPanel semesterId={semesterId ?? ""} initial={allocationTarget} />
        <ActualAllocationPanel
          incomeEntries={currentMonthIncomeEntries}
          expenseEntries={currentMonthExpenseEntries}
          targetAllocation={allocationTarget}
          monthYear={currentMonthLabel}
        />
      </div>

      {/* Goal Progress Summary */}
      {nonRetirementGoals.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Goal Progress</h3>
            <Link href="/app/student/goals" className="btn-ghost btn-sm">View timeline →</Link>
          </div>

          <div className="stack-sm">
            {goalProjections.slice(0, 4).map(g => {
              const isComplete = g.monthsRemaining === 0;
              return (
                <div key={g.goalId} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 500, fontSize: "0.875rem" }}>{g.label}</span>
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                      {isComplete
                        ? "Complete"
                        : g.monthsRemaining !== null
                        ? `${durationLabel(g.monthsRemaining)} · ${monthLabel(g.projectedDate)}`
                        : "—"}
                    </span>
                  </div>
                  <div className="tl-progress-track">
                    <div
                      className={`tl-progress-fill${isComplete ? " tl-progress-fill-complete" : ""}`}
                      style={{ width: `${g.progressPct.toFixed(1)}%` }}
                    />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                    {fmt(g.savedToDate)} of {fmt(g.targetAmount)} · {pctLabel(g.progressPct)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {nonRetirementGoals.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "28px 20px" }}>
          <p style={{ color: "var(--muted)", marginBottom: 12 }}>
            No goals yet. Add your financial goals to track progress and see projected timelines.
          </p>
          <Link href="/app/student/goals" className="btn">Set up goals →</Link>
        </div>
      )}

      {/* Retirement Countdown */}
      {retirement && (
        <div className="card">
          <div className="card-header">
            <h3>Retirement Countdown</h3>
            {retirement.isOnTrack ? (
              <span className="tl-badge tl-badge-success">On Track</span>
            ) : (
              <span className="tl-badge tl-badge-danger">Behind</span>
            )}
          </div>

          <div className="dash-retirement-grid">
            <div className="dash-retirement-stat">
              <span className="dash-retirement-stat-label">Years Remaining</span>
              <span className="dash-retirement-stat-value">{retirement.yearsRemaining} yrs</span>
            </div>
            <div className="dash-retirement-stat">
              <span className="dash-retirement-stat-label">Target Net Worth</span>
              <span className="dash-retirement-stat-value">{fmt(retirement.targetNetWorth)}</span>
            </div>
            <div className="dash-retirement-stat">
              <span className="dash-retirement-stat-label">Projected at {retirement.retirementAge}</span>
              <span
                className="dash-retirement-stat-value"
                style={{ color: retirement.isOnTrack ? "#0a9e74" : "var(--danger)" }}
              >
                {fmt(retirement.projectedNetWorth)}
              </span>
            </div>
            {!retirement.isOnTrack && (
              <>
                <div className="dash-retirement-stat">
                  <span className="dash-retirement-stat-label">Required Savings</span>
                  <span className="dash-retirement-stat-value" style={{ color: "var(--danger)" }}>
                    {fmt(retirement.requiredMonthlySavings)}/mo
                  </span>
                </div>
                <div className="dash-retirement-stat">
                  <span className="dash-retirement-stat-label">Required Rate</span>
                  <span className="dash-retirement-stat-value" style={{ color: "var(--danger)" }}>
                    {Math.min(100, retirement.requiredSavingsRate).toFixed(1)}% of net pay
                  </span>
                </div>
              </>
            )}
          </div>

          <p style={{ marginTop: 12, fontSize: "0.75rem", color: "var(--muted)" }}>
            Linear projection at {fmt(monthlySavings)}/mo · does not include investment returns ·{" "}
            <Link href="/app/student/goals" style={{ color: "var(--accent)" }}>full projection →</Link>
          </p>
        </div>
      )}

      {/* Financial Tip of the Week */}
      {(() => {
        const weekIndex = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % TIPS.length;
        const tip = TIPS[weekIndex];
        return (
          <div className="dash-tip-card">
            <div className="dash-tip-eyebrow">Tip of the Week</div>
            <div className="dash-tip-title">{tip.title}</div>
            <div className="dash-tip-text">{tip.text}</div>
          </div>
        );
      })()}

      {/* Snapshot link */}
      <div style={{ textAlign: "center", paddingBottom: 8 }}>
        <Link href="/app/student/snapshot" style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          View monthly financial snapshot →
        </Link>
      </div>
    </>
  );
}
