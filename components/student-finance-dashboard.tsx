import Link from "next/link";

import { StudentWorkspaceSwitcher } from "@/components/student-workspace-switcher";
import type { ActivityLog, BudgetActuals, BudgetDraft, BudgetItem, DebtScenario, UserProfile } from "@/types/domain";
import type { Semester, StudentEnrollment } from "@/types/domain";

interface Workspace {
  enrollments: StudentEnrollment[];
  activeEnrollment: StudentEnrollment | null;
  activeSemester: Semester | null;
}

interface EnrollmentOption {
  semesterId: string;
  label: string;
}

interface Props {
  user: UserProfile;
  budget: BudgetDraft | null;
  actuals: BudgetActuals | null;
  debt: DebtScenario | null;
  recentActivity: ActivityLog[];
  workspace: Workspace | null;
  enrollmentOptions: EnrollmentOption[];
}

const FREQ_TO_MONTHLY: Record<string, number> = {
  monthly: 1,
  semimonthly: 2,
  biweekly: 26 / 12,
  weekly: 52 / 12,
  annual: 1 / 12,
};

function toMonthly(item: BudgetItem): number {
  return item.amount * (FREQ_TO_MONTHLY[item.frequency] ?? 1);
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtExact(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** SVG donut ring showing percent consumed */
function RingChart({ pct, danger }: { pct: number; danger?: boolean }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(pct, 0), 1);
  const offset = circ * (1 - clamped);
  const color = danger ? "var(--danger)" : pct >= 0.85 ? "var(--amber)" : "var(--teal)";

  return (
    <svg width={54} height={54} viewBox="0 0 54 54" aria-hidden="true">
      <circle cx={27} cy={27} r={r} fill="none" stroke="var(--line)" strokeWidth={6} />
      <circle
        cx={27}
        cy={27}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 27 27)"
      />
    </svg>
  );
}

/** Horizontal bar sized proportionally to max */
function CategoryBar({ amount, max, label }: { amount: number; max: number; label: string }) {
  const pct = max > 0 ? (amount / max) * 100 : 0;
  const isTop = pct >= 90;

  return (
    <div className="fin-cat-row">
      <span className="fin-cat-label">{label}</span>
      <div className="fin-cat-track">
        <div
          className="fin-cat-fill"
          style={{
            width: `${pct}%`,
            background: isTop ? "var(--accent)" : "var(--teal)"
          }}
        />
      </div>
      <span className="fin-cat-amount">{fmt(amount)}</span>
    </div>
  );
}

export function StudentFinanceDashboard({
  user,
  budget,
  actuals,
  debt,
  recentActivity,
  workspace,
  enrollmentOptions
}: Props) {
  const totalIncome = budget?.income.reduce((s, i) => s + toMonthly(i), 0) ?? 0;
  const totalSavings = (budget?.savings ?? []).reduce((s, i) => s + toMonthly(i), 0);
  const totalExpenses = budget?.expenses.reduce((s, i) => s + toMonthly(i), 0) ?? 0;
  const balance = totalIncome - totalSavings - totalExpenses;
  const balancePositive = balance >= 0;

  const totalActualIncome = (actuals?.actualIncome ?? []).reduce((s, i) => s + i.amount, 0);
  const totalActualSavings = (actuals?.actualSavings ?? []).reduce((s, i) => s + i.amount, 0);
  const totalActualExpenses = (actuals?.actualExpenses ?? []).reduce((s, i) => s + i.amount, 0);
  const actualFCF = totalActualIncome - totalActualSavings - totalActualExpenses;
  const hasActuals = actuals !== null && (
    actuals.actualIncome.length > 0 || actuals.actualExpenses.length > 0 || actuals.actualSavings.length > 0
  );

  const expensesSorted = [...(budget?.expenses ?? [])].sort((a, b) => toMonthly(b) - toMonthly(a));
  const maxExpense = expensesSorted.length > 0 ? toMonthly(expensesSorted[0]) : 0;
  const expensePct = totalIncome > 0 ? Math.min(totalExpenses / totalIncome, 1) : 0;
  const incomePct = totalExpenses > 0 ? Math.min(totalIncome / totalExpenses, 1) : 1;

  const courseLabel = workspace?.activeSemester
    ? `${workspace.activeSemester.courseCode} · ${workspace.activeSemester.title}`
    : null;

  const hasBudget = budget !== null;
  const hasDebt = debt !== null && debt.balance > 0;

  return (
    <>
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="page-header">
        <div className="page-header-text">
          <h1>My Finances</h1>
          <p>{courseLabel ?? "No active course — select one below"}</p>
        </div>

      </div>

      {/* ── Top stat strip ──────────────────────────────────────── */}
      <div className="fin-stat-strip">
        <div className="fin-stat">
          <div className="fin-stat-label">Monthly Income</div>
          <div className="fin-stat-value fin-positive">{fmt(totalIncome)}</div>
          <div className="fin-stat-sub">
            {hasActuals ? `Actual: ${fmtExact(totalActualIncome)}` : budget ? `${budget.income.length} source${budget.income.length !== 1 ? "s" : ""}` : "—"}
          </div>
        </div>
        {totalSavings > 0 && (
          <div className="fin-stat">
            <div className="fin-stat-label">Monthly Savings</div>
            <div className="fin-stat-value" style={{ color: "var(--accent)" }}>{fmt(totalSavings)}</div>
            <div className="fin-stat-sub">
              {hasActuals ? `Actual: ${fmtExact(totalActualSavings)}` : `${(budget?.savings ?? []).length} goal${(budget?.savings ?? []).length !== 1 ? "s" : ""}`}
            </div>
          </div>
        )}
        <div className="fin-stat">
          <div className="fin-stat-label">Monthly Expenses</div>
          <div className="fin-stat-value">{fmt(totalExpenses)}</div>
          <div className="fin-stat-sub">
            {hasActuals ? `Actual: ${fmtExact(totalActualExpenses)}` : budget ? `${budget.expenses.length} categor${budget.expenses.length !== 1 ? "ies" : "y"}` : "—"}
          </div>
        </div>
        <div className="fin-stat">
          <div className="fin-stat-label">Free Cash Flow</div>
          <div className={`fin-stat-value ${balancePositive ? "fin-positive" : "fin-negative"}`}>
            {balancePositive ? "+" : ""}{fmt(balance)}
          </div>
          <div className="fin-stat-sub">
            {hasActuals
              ? `Actual: ${actualFCF >= 0 ? "+" : ""}${fmtExact(actualFCF)}`
              : hasBudget
                ? balancePositive
                  ? "Surplus — you're on track"
                  : "Deficit — review expenses"
                : "—"}
          </div>
        </div>
        {hasDebt && (
          <div className="fin-stat">
            <div className="fin-stat-label">Total Debt</div>
            <div className="fin-stat-value fin-negative">{fmtExact(debt.balance)}</div>
            <div className="fin-stat-sub">
              {debt.payoffMonths > 0 ? `${debt.payoffMonths} mo to payoff` : "—"}
            </div>
          </div>
        )}
        {!hasDebt && (
          <div className="fin-stat fin-stat-cta">
            <div className="fin-stat-label">Debt Simulator</div>
            <div className="fin-stat-value" style={{ fontSize: "1rem", color: "var(--muted)" }}>Not started</div>
            <div className="fin-stat-sub">
              <Link href="/app/student/debt" style={{ color: "var(--accent)" }}>Run a scenario →</Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Budget vs Actual ────────────────────────────────────── */}
      {hasBudget && hasActuals && (
        <>
          <div className="fin-section-label">Budget vs Actual</div>
          <div className="card">
            <table className="budget-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="budget-table-num">Budgeted / mo</th>
                  <th className="budget-table-num">Actual / mo</th>
                  <th className="budget-table-num">Variance</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Income</td>
                  <td className="budget-table-num">{fmtExact(totalIncome)}</td>
                  <td className="budget-table-num">{fmtExact(totalActualIncome)}</td>
                  <td className="budget-table-num">
                    <span style={{ color: totalActualIncome >= totalIncome ? "var(--teal)" : "var(--danger)", fontWeight: 600 }}>
                      {totalActualIncome >= totalIncome ? "+" : ""}{fmtExact(totalActualIncome - totalIncome)}
                    </span>
                  </td>
                </tr>
                {(totalSavings > 0 || totalActualSavings > 0) && (
                  <tr>
                    <td>Savings</td>
                    <td className="budget-table-num">{fmtExact(totalSavings)}</td>
                    <td className="budget-table-num">{fmtExact(totalActualSavings)}</td>
                    <td className="budget-table-num">
                      <span style={{ color: totalActualSavings >= totalSavings ? "var(--teal)" : "var(--amber)", fontWeight: 600 }}>
                        {totalActualSavings >= totalSavings ? "+" : ""}{fmtExact(totalActualSavings - totalSavings)}
                      </span>
                    </td>
                  </tr>
                )}
                <tr>
                  <td>Expenses</td>
                  <td className="budget-table-num">{fmtExact(totalExpenses)}</td>
                  <td className="budget-table-num">{fmtExact(totalActualExpenses)}</td>
                  <td className="budget-table-num">
                    <span style={{ color: totalActualExpenses <= totalExpenses ? "var(--teal)" : "var(--danger)", fontWeight: 600 }}>
                      {totalActualExpenses > totalExpenses ? "+" : ""}{fmtExact(totalActualExpenses - totalExpenses)}
                    </span>
                  </td>
                </tr>
                <tr style={{ fontWeight: 700, borderTop: "2px solid var(--line)" }}>
                  <td>Free Cash Flow</td>
                  <td className="budget-table-num">{fmtExact(balance)}</td>
                  <td className="budget-table-num">{fmtExact(actualFCF)}</td>
                  <td className="budget-table-num">
                    <span style={{ color: actualFCF >= balance ? "var(--teal)" : "var(--danger)", fontWeight: 700 }}>
                      {actualFCF >= balance ? "+" : ""}{fmtExact(actualFCF - balance)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            {actuals?.notes && (
              <div style={{ marginTop: 12, color: "var(--ink-2)", fontSize: "0.875rem" }}>
                <strong>Notes:</strong> {actuals.notes}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Main two-column section ──────────────────────────────── */}
      {hasBudget ? (
        <div className="fin-main-grid">
          {/* Left: Expense Categories */}
          <div className="card">
            <div className="card-header">
              <h2>Expense Categories</h2>
              <span className="badge badge-default">{fmt(totalExpenses)} / mo</span>
            </div>
            {expensesSorted.length === 0 ? (
              <div className="empty-state">No expense categories yet.</div>
            ) : (
              <div className="fin-cat-list">
                {expensesSorted.map((item) => (
                  <CategoryBar key={item.id} amount={toMonthly(item)} max={maxExpense} label={item.label} />
                ))}
              </div>
            )}
          </div>

          {/* Right: Cash Flow Summary */}
          <div className="card">
            <div className="card-header">
              <h2>Cash Flow</h2>
            </div>
            <div className="fin-cashflow">
              <div className="fin-cashflow-row">
                <span className="fin-cashflow-label">Income</span>
                <div className="fin-cashflow-track">
                  <div
                    className="fin-cashflow-bar fin-cashflow-income"
                    style={{ width: `${expensePct <= 1 ? 100 : incomePct * 100}%` }}
                  />
                </div>
                <span className="fin-cashflow-amount fin-positive">{fmt(totalIncome)}</span>
              </div>
              <div className="fin-cashflow-row">
                <span className="fin-cashflow-label">Expenses</span>
                <div className="fin-cashflow-track">
                  <div
                    className="fin-cashflow-bar fin-cashflow-expense"
                    style={{ width: `${expensePct * 100}%` }}
                  />
                </div>
                <span className="fin-cashflow-amount fin-negative">{fmt(totalExpenses)}</span>
              </div>
            </div>

            <div className={`fin-balance-chip ${balancePositive ? "fin-balance-chip-pos" : "fin-balance-chip-neg"}`}>
              <span className="fin-balance-chip-label">Free Cash Flow</span>
              <span className="fin-balance-chip-value">
                {balancePositive ? "+" : ""}{fmtExact(balance)}
              </span>
            </div>

            {/* Income sources */}
            {(budget?.income ?? []).length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div className="fin-section-label">Income Sources</div>
                <div className="fin-source-list">
                  {budget!.income.map((item) => (
                    <div key={item.id} className="fin-source-row">
                      <span style={{ color: "var(--ink-2)" }}>{item.label}</span>
                      <span className="fin-positive" style={{ fontWeight: 600 }}>{fmtExact(toMonthly(item))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Savings goals */}
            {(budget?.savings ?? []).length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div className="fin-section-label">Savings Goals</div>
                <div className="fin-source-list">
                  {(budget?.savings ?? []).map((item) => (
                    <div key={item.id} className="fin-source-row">
                      <span style={{ color: "var(--ink-2)" }}>{item.label}</span>
                      <span style={{ fontWeight: 600, color: "var(--accent)" }}>{fmtExact(toMonthly(item))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* No budget yet — full-width CTA */
        <div className="card fin-empty-budget">
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>📊</div>
            <h2 style={{ marginBottom: 8 }}>Build your budget to unlock your dashboard</h2>
            <p style={{ color: "var(--muted)", marginBottom: 20 }}>
              Add your income sources and monthly expenses to see your full financial picture.
            </p>
            <Link className="btn" href="/app/student/budget">Start Budget Builder</Link>
          </div>
        </div>
      )}

      {/* ── Budget category cards ────────────────────────────────── */}
      {hasBudget && expensesSorted.length > 0 && (
        <>
          <div className="fin-section-label" style={{ marginTop: 8 }}>Expense Breakdown</div>
          <div className="fin-budget-grid">
            {expensesSorted.map((item) => {
              const monthly = toMonthly(item);
              const pct = totalExpenses > 0 ? monthly / totalExpenses : 0;
              const isDanger = pct > 0.4;
              return (
                <div key={item.id} className="fin-budget-card">
                  <div className="fin-budget-card-ring">
                    <RingChart pct={pct} danger={isDanger} />
                    <span className="fin-budget-card-pct">{Math.round(pct * 100)}%</span>
                  </div>
                  <div className="fin-budget-card-info">
                    <div className="fin-budget-card-name">{item.label}</div>
                    <div className="fin-budget-card-amount">{fmtExact(monthly)}</div>
                    <div className="fin-budget-card-of-total">of {fmt(totalExpenses)} total</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Debt Snapshot ────────────────────────────────────────── */}
      {hasDebt && (
        <>
          <div className="fin-section-label">Debt Payoff Plan</div>
          <div className="card fin-debt-card">
            <div className="fin-debt-head">
              <div>
                <div className="fin-debt-name">{debt.debtName || "Debt Account"}</div>
                <div className="fin-debt-balance">{fmtExact(debt.balance)}</div>
              </div>
              <Link href="/app/student/debt" className="btn btn-secondary" style={{ fontSize: "0.82rem" }}>
                Edit
              </Link>
            </div>
            <div className="fin-debt-stats">
              <div className="fin-debt-stat">
                <div className="fin-debt-stat-label">Interest Rate</div>
                <div className="fin-debt-stat-value">{debt.interestRate}%</div>
              </div>
              <div className="fin-debt-stat">
                <div className="fin-debt-stat-label">Min. Payment</div>
                <div className="fin-debt-stat-value">{fmtExact(debt.minimumPayment)}</div>
              </div>
              <div className="fin-debt-stat">
                <div className="fin-debt-stat-label">Planned Payment</div>
                <div className="fin-debt-stat-value fin-positive">{fmtExact(debt.plannedPayment)}</div>
              </div>
              <div className="fin-debt-stat">
                <div className="fin-debt-stat-label">Total Interest</div>
                <div className="fin-debt-stat-value fin-negative">{fmtExact(debt.totalInterest)}</div>
              </div>
              <div className="fin-debt-stat">
                <div className="fin-debt-stat-label">Payoff Timeline</div>
                <div className="fin-debt-stat-value">
                  {debt.payoffMonths > 0
                    ? `${debt.payoffMonths} mo (${(debt.payoffMonths / 12).toFixed(1)} yr)`
                    : "—"}
                </div>
              </div>
            </div>
            {debt.payoffMonths > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="fin-debt-progress-label">
                  Progress toward payoff
                  <span style={{ color: "var(--muted)", fontWeight: 400, marginLeft: 8 }}>{debt.payoffMonths} months remaining</span>
                </div>
                <div className="fin-debt-track">
                  {/* Show a relative indicator — position within a 120-month (10-year) range */}
                  <div
                    className="fin-debt-fill"
                    style={{ width: `${Math.max(4, 100 - Math.min((debt.payoffMonths / 120) * 100, 100))}%` }}
                  />
                </div>
              </div>
            )}
            {debt.notes && (
              <div className="fin-debt-notes">{debt.notes}</div>
            )}
          </div>
        </>
      )}

      {/* ── Enrollment ───────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2>Enrollment</h2>
        </div>
        <div className="stack-sm">
          <div className="row" style={{ gap: 8 }}>
            <span className="badge badge-default">Organization</span>
            <span style={{ color: "var(--ink-2)" }}>{user.organizationId}</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="badge badge-accent">Active Course</span>
            <span style={{ color: "var(--ink-2)" }}>
              {courseLabel ?? "No active course selected"}
            </span>
          </div>
          {enrollmentOptions.length > 0 ? (
            <StudentWorkspaceSwitcher
              activeSemesterId={user.activeSemesterId}
              options={enrollmentOptions}
            />
          ) : (
            <div className="empty-state" style={{ padding: 16 }}>
              No course enrollments yet.
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Activity ──────────────────────────────────────── */}
      <div className="fin-section-label">Recent Activity</div>
      {recentActivity.length === 0 ? (
        <div className="empty-state">No activity yet. Start with the Budget Builder or Debt Simulator.</div>
      ) : (
        <div className="card">
          <ul className="plain-list">
            {recentActivity.map((item) => (
              <li key={item.id} className="fin-activity-item">
                <div className="fin-activity-dot" data-module={item.module} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{item.summary}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>
                    {item.module} · {item.action} · {new Date(item.occurredAt).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
