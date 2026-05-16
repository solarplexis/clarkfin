"use client";

import { startTransition, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";

// Survives client-side navigation within the same session
const savingsRateCache: Record<string, number> = {};

import type { AllocationTarget, Debt, Goal, GoalType, IncomeEntry, Semester, UserProfile } from "@/types/domain";
import {
  runTimeline,
  type DebtProjection,
  type GoalProjection,
  type RetirementProjection
} from "@/src/lib/calculations/timeline";
import { getCourseWeek } from "@/src/lib/calculations/course";
import { EndDrawer } from "@/components/end-drawer";
import { FinalReportModal } from "@/components/final-report-modal";
import { FeedbackForm } from "@/components/feedback-form";

// ─── Icons ────────────────────────────────────────────────────

const TrashIcon = () => (
  <svg fill="none" height="14" viewBox="0 0 16 16" width="14" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4h12M5 4V2h6v2M3 4l1 10h8l1-10M6 7v4M10 7v4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
  </svg>
);

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
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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

// ─── Shared form fields ────────────────────────────────────────

function GoalFormFields({
  formId,
  label, setLabel,
  goalType, setGoalType,
  targetAmount, setTargetAmount,
  savedToDate, setSavedToDate,
  targetDate, setTargetDate,
  error
}: {
  formId: string;
  label: string; setLabel: (v: string) => void;
  goalType: GoalType; setGoalType: (v: GoalType) => void;
  targetAmount: string; setTargetAmount: (v: string) => void;
  savedToDate: string; setSavedToDate: (v: string) => void;
  targetDate: string; setTargetDate: (v: string) => void;
  error: string;
}) {
  return (
    <div className="stack">
      <div className="field">
        <label htmlFor={`${formId}-type`}>Type</label>
        <select id={`${formId}-type`} value={goalType} onChange={e => setGoalType(e.target.value as GoalType)}>
          <option value="emergency_fund">Emergency Fund</option>
          <option value="short_term">Short-Term (1–3 years)</option>
          <option value="long_term">Long-Term (3+ years)</option>
          <option value="retirement">Retirement</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${formId}-label`}>Goal Name</label>
        <input
          id={`${formId}-label`}
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="e.g. Emergency Fund, Laptop"
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div className="field">
          <label htmlFor={`${formId}-amount`}>Target Amount ($)</label>
          <input
            id={`${formId}-amount`}
            type="number"
            min="0"
            value={targetAmount}
            onChange={e => setTargetAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="field">
          <label htmlFor={`${formId}-saved`}>Saved to Date ($)</label>
          <input
            id={`${formId}-saved`}
            type="number"
            min="0"
            value={savedToDate}
            onChange={e => setSavedToDate(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${formId}-date`}>Target Date (optional)</label>
        <input
          id={`${formId}-date`}
          type="date"
          value={targetDate}
          onChange={e => setTargetDate(e.target.value)}
        />
      </div>
      {error && <p style={{ color: "var(--danger)", fontSize: "0.82rem", margin: 0 }}>{error}</p>}
    </div>
  );
}

// ─── Add Goal Drawer ───────────────────────────────────────────

function AddGoalDrawer({ semesterId, onSaved }: { semesterId: string; onSaved: (goal: Goal) => void }) {
  const formId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("short_term");
  const [targetAmount, setTargetAmount] = useState("");
  const [savedToDate, setSavedToDate] = useState("0");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLabel(""); setGoalType("short_term"); setTargetAmount("");
      setSavedToDate("0"); setTargetDate(""); setError("");
    }
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!label.trim()) { setError("Goal name is required."); return; }
    const amount = parseFloat(targetAmount) || 0;
    if (amount <= 0) { setError("Enter a target amount greater than 0."); return; }
    setError("");
    setIsPending(true);
    try {
      const res = await fetch("/api/student/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semesterId, label: label.trim(), goalType,
          targetAmount: amount,
          targetDate: targetDate || undefined,
          savedToDate: parseFloat(savedToDate) || 0
        })
      });
      const data = await res.json() as { goal?: Goal; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create goal.");
      setIsOpen(false);
      onSaved(data.goal!);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <EndDrawer
      title="Add Goal"
      description="Define a new savings goal. ClarkFin will project when you'll reach it based on your savings rate."
      open={isOpen}
      onOpenChange={setIsOpen}
      triggerLabel="+ Add Goal"
      triggerVariant="primary"
      triggerClassName="btn-sm"
      footer={
        <button className="button" disabled={isPending} form={formId} type="submit">
          {isPending ? "Saving…" : "Add Goal"}
        </button>
      }
    >
      <form id={formId} onSubmit={handleSubmit}>
        <GoalFormFields
          formId={formId}
          label={label} setLabel={setLabel}
          goalType={goalType} setGoalType={setGoalType}
          targetAmount={targetAmount} setTargetAmount={setTargetAmount}
          savedToDate={savedToDate} setSavedToDate={setSavedToDate}
          targetDate={targetDate} setTargetDate={setTargetDate}
          error={error}
        />
      </form>
    </EndDrawer>
  );
}

// ─── Edit Goal Drawer ──────────────────────────────────────────

function EditGoalDrawer({
  goal,
  semesterId,
  onSaved
}: {
  goal: Goal;
  semesterId: string;
  onSaved: (goal: Goal) => void;
}) {
  const formId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [label, setLabel] = useState(goal.label);
  const [goalType, setGoalType] = useState<GoalType>(goal.goalType);
  const [targetAmount, setTargetAmount] = useState(String(goal.targetAmount));
  const [savedToDate, setSavedToDate] = useState(String(goal.savedToDate));
  const [targetDate, setTargetDate] = useState(goal.targetDate ?? "");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLabel(goal.label); setGoalType(goal.goalType);
      setTargetAmount(String(goal.targetAmount));
      setSavedToDate(String(goal.savedToDate));
      setTargetDate(goal.targetDate ?? "");
      setError("");
    }
  }, [isOpen, goal]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!label.trim()) { setError("Goal name is required."); return; }
    const amount = parseFloat(targetAmount) || 0;
    if (amount <= 0) { setError("Enter a target amount greater than 0."); return; }
    setError("");
    setIsPending(true);
    try {
      const res = await fetch(`/api/student/goals/${goal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semesterId, label: label.trim(), goalType,
          targetAmount: amount,
          targetDate: targetDate || undefined,
          savedToDate: parseFloat(savedToDate) || 0,
          priorityOrder: goal.priorityOrder
        })
      });
      const data = await res.json() as { goal?: Goal; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to update goal.");
      setIsOpen(false);
      onSaved(data.goal!);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <EndDrawer
      title="Edit Goal"
      description="Update your savings goal. Changes are reflected immediately in your timeline."
      open={isOpen}
      onOpenChange={setIsOpen}
      triggerLabel="Edit"
      triggerAriaLabel={`Edit goal: ${goal.label}`}
      triggerVariant="secondary"
      triggerClassName="btn-sm"
      footer={
        <button className="button" disabled={isPending} form={formId} type="submit">
          {isPending ? "Saving…" : "Save Changes"}
        </button>
      }
    >
      <form id={formId} onSubmit={handleSubmit}>
        <GoalFormFields
          formId={formId}
          label={label} setLabel={setLabel}
          goalType={goalType} setGoalType={setGoalType}
          targetAmount={targetAmount} setTargetAmount={setTargetAmount}
          savedToDate={savedToDate} setSavedToDate={setSavedToDate}
          targetDate={targetDate} setTargetDate={setTargetDate}
          error={error}
        />
      </form>
    </EndDrawer>
  );
}

// ─── Delete Goal Button ────────────────────────────────────────

function DeleteGoalButton({
  goal,
  semesterId,
  onDeleted
}: {
  goal: Goal;
  semesterId: string;
  onDeleted: (goalId: string) => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/goals/${goal.id}?semesterId=${semesterId}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to delete goal.");
      }
      onDeleted(goal.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsPending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <button
        className="icon-button icon-button-danger"
        data-tooltip={`Delete ${goal.label}`}
        disabled={isPending}
        type="button"
        onClick={() => { void handleDelete(); }}
      >
        <TrashIcon />
      </button>
      {error && <p className="error-msg" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}

// ─── Goal Card ─────────────────────────────────────────────────

function GoalCard({
  goal,
  cumulative,
  actions
}: {
  goal: GoalProjection;
  cumulative: number;
  actions?: React.ReactNode;
}) {
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
            {milestone === 100 ? "Goal complete! You did it." : `${milestone}% milestone reached!`}
          </span>
          <button className="tl-milestone-dismiss" onClick={() => setMilestone(null)}>✕</button>
        </div>
      )}

      <div className="tl-goal-header">
        <div>
          <div className="tl-goal-label">{goal.label}</div>
          <div className="tl-goal-type">{GOAL_TYPE_LABELS[goal.goalType] ?? goal.goalType}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isComplete ? (
            <span className="tl-badge tl-badge-success">Complete</span>
          ) : goal.isOnTrack === true ? (
            <span className="tl-badge tl-badge-success">On Track</span>
          ) : goal.isOnTrack === false ? (
            <span className="tl-badge tl-badge-danger">Behind</span>
          ) : null}
          {actions}
        </div>
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
  goals: initialGoals,
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
  const router = useRouter();
  const defaultSavingsPct = allocationTarget?.savingsPct ?? 0;
  const storageKey = semesterId ?? "";
  const storageItemKey = storageKey ? `clarkfin_savings_pct_${storageKey}` : "";

  function readPersistedRate(): number {
    if (!storageKey) return 0;

    if (savingsRateCache[storageKey] !== undefined) {
      return savingsRateCache[storageKey];
    }

    try {
      const stored = localStorage.getItem(storageItemKey);
      const parsed = Number(stored);

      if (stored !== null && Number.isFinite(parsed) && parsed >= 0) {
        savingsRateCache[storageKey] = parsed;
        return parsed;
      }
    } catch {
      // localStorage unavailable (SSR)
    }

    return defaultSavingsPct;
  }

  const [savingsPct, setSavingsPct] = useState(readPersistedRate);
  const [strategy, setStrategy] = useState<Strategy>("avalanche");
  const [returnRatePct, setReturnRatePct] = useState(6);
  const [goals, setGoals] = useState<Goal[]>(initialGoals);

  useEffect(() => {
    setSavingsPct(readPersistedRate());
  }, [storageKey, defaultSavingsPct]);

  function handleSavingsPctChange(value: number) {
    setSavingsPct(value);
    if (!storageKey) {
      return;
    }

    if (value === defaultSavingsPct) {
      delete savingsRateCache[storageKey];
      try {
        localStorage.removeItem(storageItemKey);
      } catch {
        // noop
      }
      return;
    }

    savingsRateCache[storageKey] = value;
    try {
      localStorage.setItem(storageItemKey, String(value));
    } catch {
      // noop
    }
  }

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

  const sortedDebts = [...result.debts].sort((a, b) =>
    strategy === "avalanche"
      ? b.interestRate - a.interestRate
      : a.currentBalance - b.currentBalance
  );

  let cum = 0;
  const cumulatives: number[] = result.goals.map(g => {
    if (g.monthsRemaining === 0 || g.monthsRemaining === null) return cum;
    cum += g.monthsRemaining;
    return cum;
  });

  function handleGoalSaved(saved: Goal) {
    setGoals(prev => {
      const exists = prev.find(g => g.id === saved.id);
      return exists ? prev.map(g => g.id === saved.id ? saved : g) : [...prev, saved];
    });
    startTransition(() => { router.refresh(); });
  }

  function handleGoalDeleted(goalId: string) {
    setGoals(prev => prev.filter(g => g.id !== goalId));
    startTransition(() => { router.refresh(); });
  }

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
            onChange={e => handleSavingsPctChange(Number(e.target.value))}
          />
          <span className="tl-savings-amount">
            {netPayMonthly > 0
              ? `${fmt(monthlySavings)}/mo from ${fmt(netPayMonthly)}/mo net pay`
              : "Add baseline income to see projections"}
          </span>
        </div>
        {defaultSavingsPct > 0 && defaultSavingsPct !== savingsPct && (
          <p style={{ marginTop: 8, fontSize: "0.8rem", color: "var(--accent)" }}>
            What-if mode — saved target is {fmtRate(defaultSavingsPct)}.{" "}
            <button
              className="btn-ghost btn-sm"
              style={{ padding: 0, fontSize: "0.8rem", color: "var(--accent)", border: "none", background: "none", cursor: "pointer", textDecoration: "underline" }}
              onClick={() => handleSavingsPctChange(defaultSavingsPct)}
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
          {semesterId && (
            <AddGoalDrawer semesterId={semesterId} onSaved={handleGoalSaved} />
          )}
        </div>
        {result.goals.length === 0 ? (
          <p className="tl-empty">No goals yet — use the button above to add your first goal.</p>
        ) : (
          <div className="stack-sm">
            {result.goals.map((g, i) => {
              const originalGoal = goals.find(lg => lg.id === g.goalId);
              return (
                <GoalCard
                  key={g.goalId}
                  goal={g}
                  cumulative={cumulatives[i]}
                  actions={originalGoal && semesterId ? (
                    <>
                      <EditGoalDrawer
                        goal={originalGoal}
                        semesterId={semesterId}
                        onSaved={handleGoalSaved}
                      />
                      <DeleteGoalButton
                        goal={originalGoal}
                        semesterId={semesterId}
                        onDeleted={handleGoalDeleted}
                      />
                    </>
                  ) : undefined}
                />
              );
            })}
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

      {/* Feedback Form — always visible; submission unlocks in the final week */}
      {semesterId && (
        <FeedbackForm
          semesterId={semesterId}
          isOpen={!!(activeSemester?.startsAt &&
            getCourseWeek(activeSemester.startsAt) >= activeSemester.durationWeeks)}
        />
      )}
    </div>
  );
}
