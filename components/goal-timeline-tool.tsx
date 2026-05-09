"use client";

import { useEffect, useState } from "react";

import type { AllocationTarget, Debt, Goal, IncomeEntry, Semester, UserProfile } from "@/types/domain";
import {
  runTimeline,
  type DebtProjection,
  type GoalProjection,
  type RetirementProjection
} from "@/src/lib/calculations/timeline";
import { getCourseWeek } from "@/src/lib/calculations/course";
import { FinalReportModal } from "@/components/final-report-modal";
import { FeedbackForm } from "@/components/feedback-form";

// ─── Helpers ───────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtRate(n: number) {
  return n.toFixed(1) + "%";
}

const GOAL_TYPE_LABELS: Record<string, string> = {
  short_term: "Short-term",
  long_term: "Long-term",
  emergency_fund: "Emergency Fund",
  retirement: "Retirement"
};

const MILESTONES = [25, 50, 75, 100] as const;

function monthLabel(ym: string | null): string {
  if (!ym) return "—";
  const [y, m] = ym.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  return `${months[m - 1]} ${y}`;
}

function durationLabel(months: number | null): string {
  if (months === null) return "—";
  if (months === 0) return "Complete";
  if (months < 12) return `${months} mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y} yr ${m} mo` : `${y} yr`;
}

// ─── Goal Card (with milestone celebration) ────────────────────

function GoalCard({ goal, cumulative }: { goal: GoalProjection; cumulative: number }) {
  const isComplete = goal.monthsRemaining === 0;
  const noSavings = goal.monthlyContribution === 0 && !isComplete;
  const [milestone, setMilestone] = useState<number | null>(null);

  useEffect(() => {
    const reached = MILESTONES.filter(m => goal.progressPct >= m);
    if (reached.length === 0) return;
    const key = `cf-milestone-${goal.goalId}`;
    const seen = parseInt(localStorage.getItem(key) ?? "0", 10);
    const max = Math.max(...reached);
    if (max > seen) {
      setMilestone(max);
      localStorage.setItem(key, String(max));
    }
  }, [goal.goalId, goal.progressPct]);

  return (
    <div className="tl-goal-card">
      {milestone && (
        <div className="tl-milestone-banner">
          <span>
            {milestone === 100
              ? "Goal complete! You did it."
              : `${milestone}% milestone reached!`}
          </span>
          <button className="tl-milestone-dismiss" onClick={() => setMilestone(null)}>✕</button>
        </div>
      )}

      <div className="tl-goal-header">
        <div>
          <div className="tl-goal-label">{goal.label}</div>
          <div className="tl-goal-type">{GOAL_TYPE_LABELS[goal.goalType] ?? goal.goalType}</div>
        </div>
        {isComplete ? (
          <span className="tl-badge tl-badge-success">Complete</span>
        ) : goal.isOnTrack === true ? (
          <span className="tl-badge tl-badge-success">On Track</span>
        ) : goal.isOnTrack === false ? (
          <span className="tl-badge tl-badge-danger">Behind</span>
        ) : noSavings ? (
          <span className="tl-badge tl-badge-muted">No savings set</span>
        ) : null}
      </div>

      <div className="tl-goal-amounts">
        {fmt(goal.savedToDate)} saved of {fmt(goal.targetAmount)}
      </div>

      <div className="tl-progress-track">
        <div
          className={`tl-progress-fill${isComplete ? " tl-progress-fill-complete" : ""}`}
          style={{ width: `${goal.progressPct.toFixed(1)}%` }}
        />
      </div>

      <div className="tl-goal-meta">
        <span className="tl-projected-date">
          {isComplete
            ? "Goal reached"
            : noSavings
            ? "Set a savings rate to project"
            : cumulative > 0
            ? `Reached in ${durationLabel(cumulative)} · ${monthLabel(goal.projectedDate)}`
            : `${durationLabel(goal.monthsRemaining)} · ${monthLabel(goal.projectedDate)}`}
        </span>
        {!isComplete && !noSavings && goal.monthlyContribution > 0 && (
          <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
            {fmt(goal.monthlyContribution)}/mo allocated
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Debt Card ─────────────────────────────────────────────────

function DebtCard({ debt }: { debt: DebtProjection }) {
  const cantPayoff = debt.monthsToPayoff === 0 && debt.currentBalance > 0;

  return (
    <div className="tl-debt-card">
      <div className="tl-debt-header">
        <div>
          <div className="tl-debt-label">{debt.label}</div>
          <div className="tl-debt-meta">
            {fmt(debt.currentBalance)} balance · {fmt(debt.monthlyPayment)}/mo
            {debt.interestRate > 0 && ` · ${fmtRate(debt.interestRate)} APR`}
          </div>
        </div>
        {debt.currentBalance === 0 ? (
          <span className="tl-badge tl-badge-success">Paid off</span>
        ) : cantPayoff ? (
          <span className="tl-badge tl-badge-danger">Payment too low</span>
        ) : (
          <span className="tl-badge tl-badge-muted">
            {durationLabel(debt.monthsToPayoff)}
          </span>
        )}
      </div>

      {!cantPayoff && debt.currentBalance > 0 && (
        <div className="tl-debt-meta">
          Payoff: {monthLabel(debt.projectedPayoffDate)}
          {debt.totalInterestPaid > 0 && ` · ${fmt(debt.totalInterestPaid)} interest`}
        </div>
      )}

      {debt.minPaymentWarning && (
        <div className="tl-cc-warning">
          <strong>Minimum Payment Trap</strong> — At ~{fmt(debt.minPaymentWarning.minPayment)}/mo
          you&apos;ll pay <strong>{fmt(debt.minPaymentWarning.minPaymentInterest)}</strong> in
          interest over {durationLabel(debt.minPaymentWarning.minPaymentMonths)}.
          {debt.minPaymentWarning.interestSaved > 0 && (
            <> Your current payment saves {fmt(debt.minPaymentWarning.interestSaved)} in interest.</>
          )}
          {debt.minPaymentWarning.interestSaved === 0 && (
            <> Increasing your payment significantly reduces this cost.</>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Retirement Card ───────────────────────────────────────────

function RetirementCard({ r, netPay }: { r: RetirementProjection; netPay: number }) {
  const noData = r.monthlyContribution === 0 && r.currentNetWorth === 0;

  return (
    <div className="tl-retirement-card">
      <div className="tl-retirement-stat">
        <span className="tl-retirement-stat-label">Years Remaining</span>
        <span className="tl-retirement-stat-value">{r.yearsRemaining} yrs</span>
      </div>
      <div className="tl-retirement-stat">
        <span className="tl-retirement-stat-label">Target Net Worth</span>
        <span className="tl-retirement-stat-value">{fmt(r.targetNetWorth)}</span>
      </div>
      <div className="tl-retirement-stat">
        <span className="tl-retirement-stat-label">Monthly Contribution</span>
        <span className="tl-retirement-stat-value">{fmt(r.monthlyContribution)}</span>
      </div>
      <div className="tl-retirement-stat">
        <span className="tl-retirement-stat-label">Projected at Age {r.retirementAge}</span>
        <span
          className="tl-retirement-stat-value"
          style={{ color: noData ? "var(--muted)" : r.isOnTrack ? "#0a9e74" : "var(--danger)" }}
        >
          {noData ? "—" : fmt(r.projectedNetWorth)}
        </span>
      </div>
      {!noData && (
        <div className="tl-retirement-stat">
          <span className="tl-retirement-stat-label">Status</span>
          <span className="tl-retirement-stat-value">
            {r.isOnTrack ? (
              <span className="tl-badge tl-badge-success">On Track</span>
            ) : (
              <span className="tl-badge tl-badge-danger">Behind</span>
            )}
          </span>
        </div>
      )}
      {!r.isOnTrack && !noData && (
        <>
          <div className="tl-retirement-stat">
            <span className="tl-retirement-stat-label">Required Monthly Savings</span>
            <span className="tl-retirement-stat-value" style={{ color: "var(--danger)" }}>
              {fmt(r.requiredMonthlySavings)}
            </span>
          </div>
          <div className="tl-retirement-stat">
            <span className="tl-retirement-stat-label">Required Savings Rate</span>
            <span className="tl-retirement-stat-value" style={{ color: "var(--danger)" }}>
              {fmtRate(Math.min(100, r.requiredSavingsRate))} of net pay
            </span>
          </div>
        </>
      )}
      <div
        className="tl-retirement-stat"
        style={{ gridColumn: "1 / -1", fontSize: "0.8rem", color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: 8, marginTop: 4 }}
      >
        {noData
          ? "Enter baseline income and set a savings rate to see your projection."
          : `Compounding annually at ${fmtRate(r.annualReturnPct)} · ${netPay > 0 ? `Net pay: ${fmt(netPay)}/mo` : ""}`}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────

type Strategy = "avalanche" | "snowball";

export function GoalTimelineTool({
  user,
  goals,
  debts,
  allocationTarget,
  baselineEntries,
  currentNetWorth,
  activeSemester,
  semesterId
}: {
  user: UserProfile;
  goals: Goal[];
  debts: Debt[];
  allocationTarget: AllocationTarget | null;
  baselineEntries: IncomeEntry[];
  currentNetWorth: number;
  activeSemester?: Semester | null;
  semesterId?: string;
}) {
  const defaultSavingsPct = allocationTarget?.savingsPct ?? 0;
  const [savingsPct, setSavingsPct] = useState(defaultSavingsPct);
  const [strategy, setStrategy] = useState<Strategy>("avalanche");
  const [returnRatePct, setReturnRatePct] = useState(6);

  const result = runTimeline({
    baselineEntries,
    goals,
    debts,
    allocationTarget,
    currentAge: user.currentAge ?? 0,
    targetRetirementAge: user.targetRetirementAge,
    retirementNetWorthTarget: user.retirementNetWorthTarget,
    currentNetWorth,
    savingsPctOverride: savingsPct,
    annualReturnPct: returnRatePct
  });

  const { netPayMonthly, monthlySavings } = result;

  // Sort debts by chosen strategy (display only — per-debt payments are fixed)
  const sortedDebts = [...result.debts].sort((a, b) =>
    strategy === "avalanche"
      ? b.interestRate - a.interestRate
      : a.currentBalance - b.currentBalance
  );

  // Cumulative months for sequential goal display
  let cum = 0;
  const cumulatives: number[] = result.goals.map(g => {
    if (g.monthsRemaining === 0 || g.monthsRemaining === null) return cum;
    cum += g.monthsRemaining;
    return cum;
  });

  return (
    <div className="stack">
      {/* What-If Slider */}
      <div className="card">
        <h2 style={{ marginBottom: 14 }}>Goal Timeline</h2>
        <div className="tl-slider-row">
          <span className="tl-slider-label">
            Savings Rate: <strong>{fmtRate(savingsPct)}</strong>
          </span>
          <input
            className="tl-slider"
            type="range"
            min={0}
            max={80}
            step={1}
            value={savingsPct}
            onChange={e => setSavingsPct(Number(e.target.value))}
          />
          <span className="tl-savings-amount">
            {netPayMonthly > 0
              ? `${fmt(monthlySavings)}/mo from ${fmt(netPayMonthly)}/mo net pay`
              : "Add baseline income to see projections"}
          </span>
        </div>
        {defaultSavingsPct !== savingsPct && (
          <p style={{ marginTop: 8, fontSize: "0.8rem", color: "var(--accent)" }}>
            What-if mode — saved target is {fmtRate(defaultSavingsPct)}.{" "}
            <button
              className="btn-ghost btn-sm"
              style={{ padding: 0, fontSize: "0.8rem", color: "var(--accent)", border: "none", background: "none", cursor: "pointer", textDecoration: "underline" }}
              onClick={() => setSavingsPct(defaultSavingsPct)}
            >
              Reset
            </button>
          </p>
        )}
      </div>

      {/* Goals */}
      <div className="card">
        <div className="card-header">
          <h3>Goals</h3>
        </div>
        {result.goals.length === 0 ? (
          <p className="tl-empty">No goals yet — add goals during onboarding or the Goals setup page.</p>
        ) : (
          <div className="stack-sm">
            {result.goals.map((g, i) => (
              <GoalCard key={g.goalId} goal={g} cumulative={cumulatives[i]} />
            ))}
          </div>
        )}
      </div>

      {/* Debts */}
      {debts.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Debt Payoff</h3>
            <div className="tl-strategy-toggle">
              <button
                className={`tl-strategy-btn${strategy === "avalanche" ? " tl-strategy-btn-active" : ""}`}
                onClick={() => setStrategy("avalanche")}
              >
                Avalanche
              </button>
              <button
                className={`tl-strategy-btn${strategy === "snowball" ? " tl-strategy-btn-active" : ""}`}
                onClick={() => setStrategy("snowball")}
              >
                Snowball
              </button>
            </div>
          </div>
          <p className="tl-strategy-desc">
            {strategy === "avalanche"
              ? "Highest interest rate first — minimizes total interest paid over time."
              : "Lowest balance first — builds momentum with quick wins."}
          </p>
          <div className="stack-sm" style={{ marginTop: 12 }}>
            {sortedDebts.map(d => (
              <DebtCard key={d.debtId} debt={d} />
            ))}
          </div>
        </div>
      )}

      {/* Retirement */}
      {result.retirement && (
        <div className="card">
          <div className="card-header">
            <h3>Retirement Projection</h3>
          </div>
          <div className="tl-slider-row" style={{ marginBottom: 16 }}>
            <span className="tl-slider-label">
              Rate of Return: <strong>{fmtRate(returnRatePct)}</strong>
            </span>
            <input
              className="tl-slider"
              type="range"
              min={0}
              max={15}
              step={0.5}
              value={returnRatePct}
              onChange={e => setReturnRatePct(Number(e.target.value))}
            />
          </div>
          <RetirementCard r={result.retirement} netPay={netPayMonthly} />
        </div>
      )}

      {!result.retirement && user.targetRetirementAge == null && (
        <div className="card" style={{ background: "var(--bg-subtle)", border: "none" }}>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
            Complete your profile (current age, retirement age, and net worth target) to see a retirement projection.
          </p>
        </div>
      )}

      {/* Final Report — unlocks in the last week of the course */}
      {semesterId && activeSemester?.startsAt &&
        getCourseWeek(activeSemester.startsAt) >= activeSemester.durationWeeks && (
        <FinalReportModal semesterId={semesterId} />
      )}

      {/* Feedback Form — unlocks in the last week of the course */}
      {semesterId && activeSemester?.startsAt &&
        getCourseWeek(activeSemester.startsAt) >= activeSemester.durationWeeks && (
        <FeedbackForm semesterId={semesterId} />
      )}
    </div>
  );
}
