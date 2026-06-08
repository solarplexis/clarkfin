"use client";

import { useCallback, useState } from "react";

import { PageConnect } from "@/components/page-connect";
import { WeeklyCheckinWizard } from "@/components/weekly-checkin-wizard";
import { projectGoals } from "@/src/lib/calculations/timeline";
import type { AllocationTarget, Debt, ExpenseEntry, Goal, IncomeEntry, Semester, UserProfile } from "@/types/domain";

// ─── Types ────────────────────────────────────────────────────

type EntryDraft = {
  id?: string;
  tempId: string;
  periodYear: number;
  periodMonth: number;
  periodWeek: number;
  label: string;
  amount: number;
  isRecurring: boolean;
  isPending: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

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

function parseSemesterStart(startsAt: string): Date | null {
  const trimmed = startsAt.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(startsAt);
  return isNaN(d.getTime()) ? null : d;
}

// Maps course week number (1-based) to calendar periodYear/Month/Week.
// Uses the week's start date; periodWeek = Math.min(4, ceil(dayOfMonth / 7)).
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
      const periodWeek = Math.min(4, Math.ceil(day / 7));
      return { periodYear: year, periodMonth: month, periodWeek };
    }
  }
  // Fallback when startsAt is missing: cycle 4 weeks per month.
  const month = Math.ceil(courseWeek / 4);
  const periodWeek = ((courseWeek - 1) % 4) + 1;
  return { periodYear: new Date().getFullYear(), periodMonth: month, periodWeek };
}

// Returns which course week we are currently in.
function currentCourseWeek(semester: Semester | null): number {
  const duration = semester?.durationWeeks ?? 4;
  if (semester?.startsAt) {
    const semStart = parseSemesterStart(semester.startsAt);
    if (semStart) {
      const diffMs = Date.now() - semStart.getTime();
      const w = Math.ceil(diffMs / MS_PER_WEEK);
      return Math.min(Math.max(1, w), duration);
    }
  }
  // Fallback: use day-of-month as week proxy.
  return Math.min(4, Math.ceil(new Date().getDate() / 7));
}

function buildDrafts(entries: ExpenseEntry[]): EntryDraft[] {
  return entries
    .filter(e => e.category === "discretionary" && e.periodWeek >= 1 && e.periodWeek <= 4)
    .map(e => ({
      id: e.id,
      tempId: e.id,
      periodYear: e.periodYear,
      periodMonth: e.periodMonth,
      periodWeek: e.periodWeek,
      label: e.label,
      amount: e.amount,
      isRecurring: e.isRecurring,
      isPending: false
    }));
}

// ─── Entry row ───────────────────────────────────────────────

function EntryRow({
  draft, semesterId, onUpdate, onDelete
}: {
  draft: EntryDraft;
  semesterId: string;
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
        periodYear: draft.periodYear,
        periodMonth: draft.periodMonth,
        periodWeek: draft.periodWeek,
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
  }, [draft, semesterId, onUpdate]);

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
  courseWeek, periodYear, periodMonth, periodWeek,
  available, entries, semesterId, onUpdate, onDelete, onAdd
}: {
  courseWeek: number;
  periodYear: number;
  periodMonth: number;
  periodWeek: number;
  available: number;
  entries: EntryDraft[];
  semesterId: string;
  onUpdate: (d: EntryDraft) => void;
  onDelete: (tempId: string) => void;
  onAdd: (periodYear: number, periodMonth: number, periodWeek: number) => void;
}) {
  const spent = entries.reduce((s, e) => s + e.amount, 0);
  const remaining = available - spent;
  const pct = available > 0 ? Math.min(100, (spent / available) * 100) : 0;
  const status: StatusClass = pct >= 100 ? "danger" : pct >= 80 ? "warning" : "ok";

  return (
    <div className={`wp-week-card wp-week-card-${status}`}>
      <div className="wp-week-header">
        <h2 className="wp-week-label">Week {courseWeek}</h2>
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
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </div>
      <button className="wp-add-btn" onClick={() => onAdd(periodYear, periodMonth, periodWeek)}>+ Add expense</button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export function WeeklyPlannerTool({
  semesterId,
  semester,
  allocationTarget,
  baselineEntries,
  initialEntries,
  debts,
  goals = [],
  currentMonthIncomeEntries = []
}: {
  user: UserProfile;
  semesterId: string;
  semester: Semester | null;
  allocationTarget: AllocationTarget | null;
  baselineEntries: IncomeEntry[];
  initialEntries: ExpenseEntry[];
  debts: Debt[];
  goals?: Goal[];
  currentMonthIncomeEntries?: IncomeEntry[];
}) {
  const [entries, setEntries] = useState<EntryDraft[]>(() => buildDrafts(initialEntries));
  const [checkinOpen, setCheckinOpen] = useState(false);

  const durationWeeks = semester?.durationWeeks ?? 4;
  const netPayMonthly = calcNetPay(baselineEntries);
  const discretionaryPct = allocationTarget?.discretionaryPct ?? 0;
  const baseWeeklyBudget = (netPayMonthly * discretionaryPct) / 100 / 4;
  const hasCreditCard = debts.some(d => d.isCreditCard);

  // Per-course-week calendar coords
  const weekCoords = Array.from({ length: durationWeeks }, (_, i) =>
    ({ courseWeek: i + 1, ...courseWeekToCalendar(semester?.startsAt, i + 1) })
  );

  // Saved spend for a given course week (by calendar coords)
  const savedSpent = (periodYear: number, periodMonth: number, periodWeek: number) =>
    entries
      .filter(e => !!e.id && e.periodYear === periodYear && e.periodMonth === periodMonth && e.periodWeek === periodWeek)
      .reduce((s, e) => s + e.amount, 0);

  // Rolling budgets across all course weeks
  const weeklyBudgets: number[] = new Array(durationWeeks + 1).fill(0);
  weeklyBudgets[1] = baseWeeklyBudget;
  for (let w = 2; w <= durationWeeks; w++) {
    const prev = weekCoords[w - 2];
    weeklyBudgets[w] = baseWeeklyBudget + Math.max(0, weeklyBudgets[w - 1] - savedSpent(prev.periodYear, prev.periodMonth, prev.periodWeek));
  }

  const savedEntries = entries.filter(e => !!e.id);
  const totalBudget = baseWeeklyBudget * durationWeeks;
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

  function handleAdd(periodYear: number, periodMonth: number, periodWeek: number) {
    setEntries(prev => [...prev, { tempId: uid(), periodYear, periodMonth, periodWeek, label: "", amount: 0, isRecurring: false, isPending: true }]);
  }

  // Current course week for the check-in banner
  const checkinCourseWeek = currentCourseWeek(semester);
  const checkinCoords = courseWeekToCalendar(semester?.startsAt, checkinCourseWeek);
  const thisWeekLogged = currentMonthIncomeEntries.some(
    e => e.periodYear === checkinCoords.periodYear &&
         e.periodMonth === checkinCoords.periodMonth &&
         e.periodWeek === checkinCoords.periodWeek
  );

  const savingsPct = allocationTarget?.savingsPct ?? 0;
  const monthlySavings = (netPayMonthly * savingsPct) / 100;

  // Goal story
  const nonRetirementGoals = goals.filter(g => g.goalType !== "retirement");
  const goalProjections = projectGoals(nonRetirementGoals, monthlySavings);
  const nextGoal = goalProjections.find(p => p.monthsRemaining !== 0 && p.monthsRemaining !== null);

  // What-if: if remaining discretionary went to savings
  const whatIfSavings = monthlySavings + Math.max(0, totalRemaining);
  const whatIfProjections = totalRemaining > 50
    ? projectGoals(nonRetirementGoals, whatIfSavings)
    : null;
  const whatIfNextGoal = whatIfProjections?.find(p => p.goalId === nextGoal?.goalId);
  const monthsSooner =
    nextGoal?.monthsRemaining != null && whatIfNextGoal?.monthsRemaining != null
      ? nextGoal.monthsRemaining - whatIfNextGoal.monthsRemaining
      : 0;

  return (
    <div className="wp-root">

      <PageConnect
        storageKey="budget"
        text="This page tracks how you spend your discretionary budget week by week. Log your full income and all expense categories on the Income page — that's what drives your savings rate and goal projections on the Dashboard."
        links={[
          { href: "/app/student/income", label: "Log income & expenses →" },
          { href: "/app/student/goals", label: "Adjust goal targets →" },
          { href: "/app/student", label: "See Dashboard →" }
        ]}
      />

      {checkinOpen && (
        <WeeklyCheckinWizard
          semesterId={semesterId}
          periodYear={checkinCoords.periodYear}
          periodMonth={checkinCoords.periodMonth}
          periodWeek={checkinCoords.periodWeek}
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
          <p>
            {semester?.title ?? "Course"} · {durationWeeks} weeks · discretionary spending
          </p>
        </div>
      </div>

      {!thisWeekLogged ? (
        <div className="wp-checkin-banner">
          <div className="wp-checkin-banner-body">
            <strong>Week {checkinCourseWeek} hasn&apos;t been logged yet.</strong>
            <span>The guided check-in walks you through income, expenses, and what it means for your goals — takes about 3 minutes.</span>
          </div>
          <button className="btn btn-primary wp-checkin-banner-btn" onClick={() => setCheckinOpen(true)}>
            Start Week {checkinCourseWeek} check-in →
          </button>
        </div>
      ) : (
        <div className="wp-checkin-done-row">
          <span className="wp-checkin-done-label">✓ Week {checkinCourseWeek} logged</span>
          <button className="wp-checkin-done-link" onClick={() => setCheckinOpen(true)}>
            Update check-in
          </button>
        </div>
      )}

      {/* Goal story */}
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
              Keep the remaining {fmt(totalRemaining)} unspent this course and that goal arrives {monthsSooner} month{monthsSooner > 1 ? "s" : ""} sooner.
            </div>
          )}
        </div>
      ) : netPayMonthly > 0 && goals.length === 0 ? (
        <div className="wp-goal-story wp-goal-story-empty">
          Your budget is set — but without goals, these numbers don&apos;t mean anything yet.{" "}
          <a href="/app/student/goals">Set up your goals</a> to see what your spending decisions are actually costing you.
        </div>
      ) : netPayMonthly === 0 ? (
        <div className="wp-goal-story wp-goal-story-empty">
          Log your baseline income on the <a href="/app/student/income">Income page</a> to activate your budget and see how your spending connects to your goals.
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
          <span className="wp-summary-label">Course Discretionary</span>
          <span className="wp-summary-value">{netPayMonthly > 0 ? fmt(totalBudget) : "—"}</span>
          {netPayMonthly > 0 && discretionaryPct > 0 && (
            <span className="wp-summary-sub">{discretionaryPct}% of take-home · {durationWeeks} weeks</span>
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
          No discretionary allocation set yet. Go to your <a href="/app/student">Dashboard</a> to split your income into categories — that&apos;s what sets this budget.
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
        {weekCoords.map(({ courseWeek, periodYear, periodMonth, periodWeek }) => (
          <WeekCard
            key={courseWeek}
            courseWeek={courseWeek}
            periodYear={periodYear}
            periodMonth={periodMonth}
            periodWeek={periodWeek}
            available={weeklyBudgets[courseWeek]}
            entries={entries.filter(e =>
              e.periodYear === periodYear &&
              e.periodMonth === periodMonth &&
              e.periodWeek === periodWeek
            )}
            semesterId={semesterId}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onAdd={handleAdd}
          />
        ))}
      </div>

    </div>
  );
}
