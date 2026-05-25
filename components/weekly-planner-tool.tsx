"use client";

import { useCallback, useState } from "react";

import { PageConnect } from "@/components/page-connect";
import { WeeklyCheckinWizard } from "@/components/weekly-checkin-wizard";
import { projectGoals } from "@/src/lib/calculations/timeline";
import type { GoalProjection } from "@/src/lib/calculations/timeline";
import type { AllocationTarget, Debt, ExpenseEntry, Goal, IncomeEntry, UserProfile } from "@/types/domain";

// ─── Types ────────────────────────────────────────────────────

type EntryDraft = {
  id?: string;
  tempId: string;
  week: 1 | 2 | 3 | 4;
  label: string;
  amount: number;
  isRecurring: boolean;
  isPending: boolean;
};

// ─── Constants ────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// ─── Helpers ─────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function calcNetPay(baselineEntries: IncomeEntry[]): number {
  const gross = baselineEntries
    .filter(e => e.category === "gross_pay")
    .reduce((s, e) => s + e.amount, 0);
  const taxes = baselineEntries
    .filter(e => e.category === "taxes")
    .reduce((s, e) => s + e.amount, 0);
  return Math.max(0, gross - taxes);
}

function buildDrafts(entries: ExpenseEntry[]): EntryDraft[] {
  return entries
    .filter(e => e.category === "discretionary" && e.periodWeek >= 1 && e.periodWeek <= 4)
    .map(e => ({
      id: e.id,
      tempId: e.id,
      week: e.periodWeek as 1 | 2 | 3 | 4,
      label: e.label,
      amount: e.amount,
      isRecurring: e.isRecurring,
      isPending: false
    }));
}

// ─── Entry row ───────────────────────────────────────────────

function EntryRow({
  draft, semesterId, year, month, onUpdate, onDelete
}: {
  draft: EntryDraft;
  semesterId: string;
  year: number;
  month: number;
  onUpdate: (d: EntryDraft) => void;
  onDelete: (tempId: string) => void;
}) {
  const [label, setLabel] = useState(draft.label);
  const [amount, setAmount] = useState(draft.amount);
  const [saving, setSaving] = useState(false);

  const save = useCallback(async (nextLabel: string, nextAmount: number, nextRecurring: boolean) => {
    if (!nextLabel.trim()) return;
    setSaving(true);
    try {
      const payload = {
        semesterId,
        category: "discretionary",
        label: nextLabel.trim(),
        amount: nextAmount,
        periodYear: year,
        periodMonth: month,
        periodWeek: draft.week,
        isRecurring: nextRecurring
      };
      const resp = draft.id
        ? await fetch(`/api/student/expense-entries/${draft.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          })
        : await fetch("/api/student/expense-entries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
      const data = await resp.json();
      if (data.ok) {
        onUpdate({
          ...draft,
          id: data.entry.id,
          tempId: data.entry.id,
          label: nextLabel.trim(),
          amount: nextAmount,
          isRecurring: nextRecurring,
          isPending: false
        });
      }
    } finally {
      setSaving(false);
    }
  }, [draft, semesterId, year, month, onUpdate]);

  async function toggleRecurring() {
    const next = !draft.isRecurring;
    if (draft.id) {
      await save(label, amount, next);
    } else {
      onUpdate({ ...draft, isRecurring: next });
    }
  }

  async function handleDelete() {
    if (draft.id) {
      await fetch(`/api/student/expense-entries/${draft.id}?semesterId=${encodeURIComponent(semesterId)}`, {
        method: "DELETE"
      });
    }
    onDelete(draft.tempId);
  }

  return (
    <div className="wp-entry-row">
      <input
        className="wp-entry-label"
        value={label}
        onChange={e => setLabel(e.target.value)}
        onBlur={() => save(label, amount, draft.isRecurring)}
        placeholder="Expense name"
        autoFocus={draft.isPending}
      />
      <input
        className="wp-entry-amount"
        type="number"
        min="0"
        step="1"
        value={amount || ""}
        onChange={e => setAmount(Number(e.target.value) || 0)}
        onBlur={() => save(label, amount, draft.isRecurring)}
        placeholder="0"
      />
      <button
        className={`wp-recurring-btn${draft.isRecurring ? " wp-recurring-btn-on" : ""}`}
        onClick={toggleRecurring}
        title={draft.isRecurring ? "Recurring — click to unmark" : "Mark as recurring subscription"}
      >
        ⟳
      </button>
      {saving && <span className="wp-saving-dot" />}
      <button className="wp-delete-btn" onClick={handleDelete} title="Remove">✕</button>
    </div>
  );
}

// ─── Week card ───────────────────────────────────────────────

type StatusClass = "ok" | "warning" | "danger";

function WeekCard({
  week, available, entries, semesterId, year, month, onUpdate, onDelete, onAdd
}: {
  week: 1 | 2 | 3 | 4;
  available: number;
  entries: EntryDraft[];
  semesterId: string;
  year: number;
  month: number;
  onUpdate: (d: EntryDraft) => void;
  onDelete: (tempId: string) => void;
  onAdd: (week: 1 | 2 | 3 | 4) => void;
}) {
  const spent = entries.reduce((s, e) => s + e.amount, 0);
  const remaining = available - spent;
  const pct = available > 0 ? Math.min(100, (spent / available) * 100) : 0;
  const status: StatusClass = pct >= 100 ? "danger" : pct >= 80 ? "warning" : "ok";

  return (
    <div className={`wp-week-card wp-week-card-${status}`}>
      <div className="wp-week-header">
        <span className="wp-week-label">Week {week}</span>
        <span className={`wp-week-remaining wp-week-remaining-${status}`}>
          {remaining >= 0 ? `${fmt(remaining)} left` : `${fmt(remaining)} over`}
        </span>
      </div>
      <div className="wp-progress-track">
        <div className={`wp-progress-fill wp-progress-fill-${status}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="wp-week-meta">
        <span>Budget: {fmt(available)}</span>
        <span>Spent: {fmt(spent)}</span>
      </div>
      <div className="wp-entries">
        {entries.map(d => (
          <EntryRow
            key={d.tempId}
            draft={d}
            semesterId={semesterId}
            year={year}
            month={month}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </div>
      <button className="wp-add-btn" onClick={() => onAdd(week)}>+ Add expense</button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export function WeeklyPlannerTool({
  semesterId,
  allocationTarget,
  baselineEntries,
  initialEntries,
  debts,
  currentYear,
  currentMonth,
  currentMonthLabel,
  goals = [],
  currentMonthIncomeEntries = []
}: {
  user: UserProfile;
  semesterId: string;
  allocationTarget: AllocationTarget | null;
  baselineEntries: IncomeEntry[];
  initialEntries: ExpenseEntry[];
  debts: Debt[];
  currentYear: number;
  currentMonth: number;
  currentMonthLabel: string;
  goals?: Goal[];
  currentMonthIncomeEntries?: IncomeEntry[];
}) {
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [monthLabel, setMonthLabel] = useState(currentMonthLabel);
  const [entries, setEntries] = useState<EntryDraft[]>(() => buildDrafts(initialEntries));
  const [loading, setLoading] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);

  const netPayMonthly = calcNetPay(baselineEntries);
  const discretionaryPct = allocationTarget?.discretionaryPct ?? 0;
  const baseWeeklyBudget = (netPayMonthly * discretionaryPct) / 100 / 4;
  const hasCreditCard = debts.some(d => d.isCreditCard);

  // YNAB roll-over: only saved entries count for prior-week surplus
  const savedSpent = (w: 1 | 2 | 3 | 4) =>
    entries.filter(e => !!e.id && e.week === w).reduce((s, e) => s + e.amount, 0);

  const w1Budget = baseWeeklyBudget;
  const w2Budget = baseWeeklyBudget + Math.max(0, w1Budget - savedSpent(1));
  const w3Budget = baseWeeklyBudget + Math.max(0, w2Budget - savedSpent(2));
  const w4Budget = baseWeeklyBudget + Math.max(0, w3Budget - savedSpent(3));
  const weeklyBudgets: Record<1 | 2 | 3 | 4, number> = { 1: w1Budget, 2: w2Budget, 3: w3Budget, 4: w4Budget };

  const savedEntries = entries.filter(e => !!e.id);
  const totalBudget = baseWeeklyBudget * 4;
  const totalSpent = savedEntries.reduce((s, e) => s + e.amount, 0);
  const totalRemaining = totalBudget - totalSpent;

  // Subscription summary
  const recurringEntries = savedEntries.filter(e => e.isRecurring);
  const recurringTotal = recurringEntries.reduce((s, e) => s + e.amount, 0);

  function handleUpdate(updated: EntryDraft) {
    setEntries(prev => prev.map(d => d.tempId === updated.tempId ? updated : d));
  }

  function handleDelete(tempId: string) {
    setEntries(prev => prev.filter(d => d.tempId !== tempId));
  }

  function handleAdd(week: 1 | 2 | 3 | 4) {
    setEntries(prev => [...prev, { tempId: uid(), week, label: "", amount: 0, isRecurring: false, isPending: true }]);
  }

  async function navigateMonth(y: number, m: number) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/student/expense-entries?semesterId=${encodeURIComponent(semesterId)}&periodYear=${y}&periodMonth=${m}`
      );
      const data = await res.json();
      if (data.ok) {
        setYear(y);
        setMonth(m);
        setMonthLabel(`${MONTH_NAMES[m - 1]} ${y}`);
        setEntries(buildDrafts(data.entries));
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

  const now = new Date();
  const checkinWeek = Math.min(4, Math.ceil(now.getDate() / 7)) as 1 | 2 | 3 | 4;
  const savingsPct = allocationTarget?.savingsPct ?? 0;
  const monthlySavings = (netPayMonthly * savingsPct) / 100;

  // Goal story: connect spending decisions to goal timelines
  const nonRetirementGoals = goals.filter(g => g.goalType !== "retirement");
  const goalProjections = projectGoals(nonRetirementGoals, monthlySavings);
  const nextGoal = goalProjections.find(p => p.monthsRemaining !== 0 && p.monthsRemaining !== null);

  // What-if: if the remaining discretionary budget went to savings instead
  const whatIfSavings = monthlySavings + Math.max(0, totalRemaining);
  const whatIfProjections = totalRemaining > 50
    ? projectGoals(nonRetirementGoals, whatIfSavings)
    : null;
  const whatIfNextGoal = whatIfProjections?.find(p => p.goalId === nextGoal?.goalId);
  const monthsSooner =
    nextGoal?.monthsRemaining != null && whatIfNextGoal?.monthsRemaining != null
      ? nextGoal.monthsRemaining - whatIfNextGoal.monthsRemaining
      : 0;

  const thisWeekLogged = currentMonthIncomeEntries.some(e => e.periodWeek === checkinWeek);

  return (
    <div className="wp-root">

      <PageConnect
        storageKey="budget"
        text="This page tracks how you spend your discretionary budget week by week. Log your full income and all expense categories on the Income page — that's what drives your savings rate and goal projections on the Dashboard."
        links={[
          { href: "/app/student/budget", label: "Log income & expenses →" },
          { href: "/app/student/goals", label: "Adjust goal targets →" },
          { href: "/app/student", label: "See Dashboard →" }
        ]}
      />

      {checkinOpen && (
        <WeeklyCheckinWizard
          semesterId={semesterId}
          periodYear={year}
          periodMonth={month}
          periodWeek={checkinWeek}
          goals={goals}
          debts={debts}
          existingIncomeEntries={currentMonthIncomeEntries}
          existingExpenseEntries={initialEntries}
          baselineNetPay={netPayMonthly}
          monthlySavings={monthlySavings}
          onClose={() => setCheckinOpen(false)}
          onComplete={() => { setCheckinOpen(false); window.location.reload(); }}
        />
      )}

      <div className="wp-header">
        <div>
          <h1>Budget</h1>
          <p>{monthLabel} · discretionary spending</p>
        </div>
        <div className="wp-month-nav">
          <button className="wp-nav-btn" onClick={prevMonth} disabled={loading}>‹</button>
          <span className="wp-month-label">{monthLabel}</span>
          <button className="wp-nav-btn" onClick={nextMonth} disabled={loading}>›</button>
        </div>
      </div>

      {!thisWeekLogged ? (
        <div className="wp-checkin-banner">
          <div className="wp-checkin-banner-body">
            <strong>Week {checkinWeek} hasn&apos;t been logged yet.</strong>
            <span>The guided check-in walks you through income, expenses, and what it means for your goals — takes about 3 minutes.</span>
          </div>
          <button className="btn btn-primary wp-checkin-banner-btn" onClick={() => setCheckinOpen(true)}>
            Start Week {checkinWeek} check-in →
          </button>
        </div>
      ) : (
        <div className="wp-checkin-done-row">
          <span className="wp-checkin-done-label">✓ Week {checkinWeek} logged</span>
          <button className="wp-checkin-done-link" onClick={() => setCheckinOpen(true)}>
            Update check-in
          </button>
        </div>
      )}

      {/* Goal story — the thread connecting budget to financial future */}
      {netPayMonthly > 0 && monthlySavings > 0 && nextGoal ? (
        <div className="wp-goal-story">
          <div className="wp-goal-story-row">
            <span className="wp-goal-story-saving">Saving {fmt(monthlySavings)}/mo</span>
            <span className="wp-goal-story-arrow">→</span>
            <span className="wp-goal-story-goal">{nextGoal.label}</span>
            <span className="wp-goal-story-date">
              {nextGoal.monthsRemaining === 1
                ? "in 1 month"
                : nextGoal.monthsRemaining != null
                ? `in ${nextGoal.monthsRemaining} months`
                : "—"}
            </span>
          </div>
          {monthsSooner >= 1 && (
            <div className="wp-goal-story-whyif">
              Keep the remaining {fmt(totalRemaining)} unspent this month and that goal arrives {monthsSooner} month{monthsSooner > 1 ? "s" : ""} sooner.
            </div>
          )}
        </div>
      ) : netPayMonthly > 0 && goals.length === 0 ? (
        <div className="wp-goal-story wp-goal-story-empty">
          Your budget is set — but without goals, these numbers don't mean anything yet.{" "}
          <a href="/app/student/goals">Set up your goals</a> to see what your spending decisions are actually costing you.
        </div>
      ) : netPayMonthly === 0 ? (
        <div className="wp-goal-story wp-goal-story-empty">
          Log your baseline income on the <a href="/app/student/budget">Income page</a> to activate your budget and see how your spending connects to your goals.
        </div>
      ) : null}

      {hasCreditCard && (
        <div className="wp-cc-banner">
          Credit card balance on file — expenses charged to your card add to that debt, not just this budget.{" "}
          <a href="/app/student/debt">Track debt payments →</a>
        </div>
      )}

      <div className="wp-summary-strip">
        <div className="wp-summary-stat">
          <span className="wp-summary-label">Monthly Discretionary</span>
          <span className="wp-summary-value">{netPayMonthly > 0 ? fmt(totalBudget) : "—"}</span>
          {netPayMonthly > 0 && discretionaryPct > 0 && (
            <span className="wp-summary-sub">{discretionaryPct}% of take-home</span>
          )}
        </div>
        <div className="wp-summary-stat">
          <span className="wp-summary-label">Spent</span>
          <span className="wp-summary-value">{fmt(totalSpent)}</span>
        </div>
        <div className="wp-summary-stat">
          <span className="wp-summary-label">Remaining</span>
          <span className={`wp-summary-value${totalRemaining < 0 ? " wp-value-danger" : totalRemaining > 0 ? " wp-value-good" : ""}`}>
            {totalRemaining < 0 ? `−${fmt(Math.abs(totalRemaining))}` : fmt(totalRemaining)}
          </span>
        </div>
        <div className="wp-summary-stat">
          <span className="wp-summary-label">Per Week</span>
          <span className="wp-summary-value">{netPayMonthly > 0 ? fmt(baseWeeklyBudget) : "—"}</span>
        </div>
      </div>

      {discretionaryPct === 0 && netPayMonthly > 0 && (
        <div className="wp-empty-hint">
          No discretionary allocation set yet. Go to your <a href="/app/student">Dashboard</a> to split your income into categories — that's what sets this budget.
        </div>
      )}

      {/* Subscription Tracker */}
      {recurringEntries.length > 0 && (
        <div className="wp-subscriptions">
          <div className="wp-sub-header">
            <span className="wp-sub-title">⟳ Recurring Subscriptions</span>
            <span className="wp-sub-total">{fmt(recurringTotal)}/mo</span>
          </div>
          <div className="wp-sub-list">
            {recurringEntries.map(e => (
              <div key={e.tempId} className="wp-sub-row">
                <span className="wp-sub-label">{e.label || "Untitled"}</span>
                <span className="wp-sub-amount">{fmt(e.amount)}</span>
              </div>
            ))}
          </div>
          <p className="wp-sub-hint">
            Mark an expense as recurring (⟳) to track it here. {recurringTotal > 0 && `${fmt(recurringTotal)} of your monthly discretionary budget goes to subscriptions.`}
          </p>
        </div>
      )}

      <div className="wp-weeks-grid">
        {([1, 2, 3, 4] as const).map(w => (
          <WeekCard
            key={`${year}-${month}-${w}`}
            week={w}
            available={weeklyBudgets[w]}
            entries={entries.filter(e => e.week === w)}
            semesterId={semesterId}
            year={year}
            month={month}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onAdd={handleAdd}
          />
        ))}
      </div>

    </div>
  );
}
