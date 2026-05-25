"use client";

import { useEffect, useRef, useState } from "react";
import { projectGoals } from "@/src/lib/calculations/timeline";
import type { GoalProjection } from "@/src/lib/calculations/timeline";
import type { Debt, ExpenseEntry, Goal, IncomeEntry } from "@/types/domain";

// ─── Types ──────────────────────────────────────────────────────

interface ExpenseDraft {
  tempId: string;
  id?: string;
  label: string;
  amount: number;
  category: "essential" | "debt" | "discretionary";
  isDebt: boolean;
}

interface WeeklyCheckinWizardProps {
  semesterId: string;
  periodYear: number;
  periodMonth: number;
  periodWeek: number;
  goals: Goal[];
  debts: Debt[];
  existingIncomeEntries: IncomeEntry[];
  existingExpenseEntries: ExpenseEntry[];
  baselineNetPay: number;
  monthlySavings: number;
  onClose: () => void;
  onComplete: () => void;
}

// ─── Step definitions ─────────────────────────────────────────

const STEPS = [
  {
    label: "Your Goals",
    headline: "Before you log anything — here's what you're building toward.",
    description:
      "Goals aren't about restriction. They're the reason your weekly numbers matter. Every dollar you log this week moves these dates. Some will get closer. Some might drift out. Either way, seeing them before you log keeps the purpose clear.",
    backLabel: null,
    backSub: null,
    nextLabel: "What did you earn?",
    nextSub: "Log this week's income"
  },
  {
    label: "Your Income",
    headline: "What actually landed in your bank account this week?",
    description:
      "Enter your net pay — after taxes, health insurance, and any other withholdings. Not your gross salary. Not what's on your offer letter. The number that matters is what you actually received. If you had other income this week — tips, gig work, a refund — include all of it.",
    backLabel: "Your goals",
    backSub: "What you're working toward",
    nextLabel: "Where did it go?",
    nextSub: "Log this week's expenses"
  },
  {
    label: "Your Expenses",
    headline: "Where did your money go this week?",
    description:
      "Your debt payments are already filled in — those are fixed obligations that come out regardless. Add everything else you spent: housing, groceries, gas, dining out, subscriptions, anything. Don't filter yourself. Inaccurate expense data is worse than no data at all. You're not being judged — you're building an honest picture of your actual life.",
    backLabel: "Your income",
    backSub: "Update what you earned",
    nextLabel: "See the impact",
    nextSub: "How this week moves your goals"
  },
  {
    label: "Your Impact",
    headline: "Here's what this week did to your financial future.",
    description:
      "Every dollar you tracked ripples forward in time. If you spent less than you earned, your goal dates moved closer. Personal finance isn't about perfection — it's about seeing the pattern over time and adjusting. You just did something most people never do: you looked at your own numbers honestly.",
    backLabel: "Your expenses",
    backSub: "Add or adjust spending",
    nextLabel: null,
    nextSub: null
  }
] as const;

// ─── Helpers ──────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function monthLabel(ym: string | null): string {
  if (!ym) return "—";
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [, m] = ym.split("-").map(Number);
  const [y] = ym.split("-").map(Number);
  return `${months[m - 1]} ${y}`;
}

// ─── Step 0: Goal Recap ───────────────────────────────────────

function GoalRecapStep({
  goals,
  monthlySavings
}: {
  goals: Goal[];
  monthlySavings: number;
}) {
  const nonRetirement = goals.filter(g => g.goalType !== "retirement");
  const projections = projectGoals(nonRetirement, monthlySavings);

  if (projections.length === 0) {
    return (
      <div className="guided-empty">
        <p>You haven&apos;t set any goals yet.</p>
        <p style={{ marginTop: 8, fontSize: "0.875rem" }}>
          That&apos;s okay — you can still log this week. After you finish, visit the{" "}
          <a href="/app/student/goals" style={{ color: "var(--teal)" }}>Goals page</a> to set up
          what you&apos;re working toward. Goals are what make the numbers meaningful.
        </p>
      </div>
    );
  }

  return (
    <div className="guided-goal-list">
      {projections.map(g => {
        const isComplete = g.monthsRemaining === 0;
        return (
          <div key={g.goalId} className="guided-goal-row">
            <div className="guided-goal-top">
              <span className="guided-goal-name">{g.label}</span>
              <span className="guided-goal-timeline" style={{ color: isComplete ? "#0a9e74" : undefined }}>
                {isComplete
                  ? "Complete ✓"
                  : g.monthsRemaining === 1
                  ? "1 month away"
                  : g.monthsRemaining != null
                  ? `${g.monthsRemaining} months · ${monthLabel(g.projectedDate)}`
                  : "—"}
              </span>
            </div>
            <div className="guided-goal-track">
              <div
                className="guided-goal-fill"
                style={{
                  width: `${Math.min(100, g.progressPct).toFixed(1)}%`,
                  background: isComplete ? "#0a9e74" : "var(--teal)"
                }}
              />
            </div>
            <div className="guided-goal-meta">
              <span>{fmt(g.savedToDate)} saved</span>
              <span>{fmt(g.targetAmount)} target · {Math.round(g.progressPct)}%</span>
            </div>
          </div>
        );
      })}
      {monthlySavings === 0 && (
        <div className="guided-insight" style={{ marginTop: 12 }}>
          No savings rate set yet — go to your Dashboard and configure your allocation to see projected dates here.
        </div>
      )}
    </div>
  );
}

// ─── Step 1: Log Income ───────────────────────────────────────

function LogIncomeStep({
  semesterId,
  periodYear,
  periodMonth,
  periodWeek,
  baselineNetPay,
  existingEntries,
  onSaved
}: {
  semesterId: string;
  periodYear: number;
  periodMonth: number;
  periodWeek: number;
  baselineNetPay: number;
  existingEntries: IncomeEntry[];
  onSaved: (netPay: number) => void;
}) {
  const existing = existingEntries.find(
    e => e.category === "gross_pay" && e.periodWeek === periodWeek
  );
  const [amount, setAmount] = useState(
    existing ? String(existing.amount) : baselineNetPay > 0 ? String(baselineNetPay) : ""
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!existing);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) { setError("Enter a valid amount."); return; }
    setSaving(true);
    setError(null);
    try {
      const body = { semesterId, periodYear, periodMonth, periodWeek, category: "gross_pay", label: "Net Pay", amount: num };
      const resp = existing
        ? await fetch(`/api/student/income-entries/${existing.id}`, {
            method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
          })
        : await fetch("/api/student/income-entries", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
          });
      if (!resp.ok) { const d = await resp.json(); throw new Error(d.error ?? "Save failed"); }
      setSaved(true);
      onSaved(num);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="guided-form-block">
      <label className="guided-field-label">Net pay this week</label>
      <div className="guided-amount-row">
        <span className="guided-amount-prefix">$</span>
        <input
          className="guided-amount-input"
          type="number"
          min="0"
          step="1"
          value={amount}
          onChange={e => { setAmount(e.target.value); setSaved(false); }}
          onBlur={save}
          placeholder="0"
          autoFocus
        />
        {saved && <span className="guided-saved-badge">✓</span>}
      </div>
      {baselineNetPay > 0 && (
        <p className="guided-field-hint">
          Your baseline is {fmt(baselineNetPay)}/mo — enter what actually came in this specific week.
        </p>
      )}
      {error && <p className="guided-field-error">{error}</p>}
      {saving && <p className="guided-field-hint">Saving…</p>}
    </div>
  );
}

// ─── Step 2: Log Expenses ──────────────────────────────────────

function ExpenseRow({
  draft,
  semesterId,
  periodYear,
  periodMonth,
  periodWeek,
  onChange,
  onDelete
}: {
  draft: ExpenseDraft;
  semesterId: string;
  periodYear: number;
  periodMonth: number;
  periodWeek: number;
  onChange: (d: ExpenseDraft) => void;
  onDelete: (tempId: string) => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function persist(d: ExpenseDraft) {
    if (!d.label.trim() || d.amount <= 0) return;
    const body = { semesterId, periodYear, periodMonth, periodWeek, category: d.category, label: d.label.trim(), amount: d.amount, isRecurring: d.isDebt };
    const resp = d.id
      ? await fetch(`/api/student/expense-entries/${d.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/student/expense-entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await resp.json();
    if (data.ok ?? resp.ok) onChange({ ...d, id: data.entry?.id ?? d.id });
  }

  function schedule(d: ExpenseDraft) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(d), 300);
  }

  async function remove() {
    if (draft.id) await fetch(`/api/student/expense-entries/${draft.id}?semesterId=${encodeURIComponent(semesterId)}`, { method: "DELETE" });
    onDelete(draft.tempId);
  }

  return (
    <div className={`guided-expense-row${draft.isDebt ? " guided-expense-row-debt" : ""}`}>
      {draft.isDebt && <span className="guided-expense-debt-tag">debt payment</span>}
      <input
        className="guided-expense-label"
        value={draft.label}
        onChange={e => onChange({ ...draft, label: e.target.value })}
        onBlur={() => schedule(draft)}
        placeholder="Description"
        readOnly={draft.isDebt}
      />
      <div className="guided-expense-amount-wrap">
        <span className="guided-expense-prefix">$</span>
        <input
          className="guided-expense-amount"
          type="number"
          min="0"
          step="1"
          value={draft.amount || ""}
          onChange={e => onChange({ ...draft, amount: Number(e.target.value) || 0 })}
          onBlur={() => schedule(draft)}
          placeholder="0"
        />
      </div>
      {!draft.isDebt && (
        <button className="guided-expense-delete" onClick={remove} type="button" title="Remove">×</button>
      )}
    </div>
  );
}

function LogExpensesStep({
  semesterId,
  periodYear,
  periodMonth,
  periodWeek,
  debts,
  existingEntries,
  weeklyIncome,
  onUpdate
}: {
  semesterId: string;
  periodYear: number;
  periodMonth: number;
  periodWeek: number;
  debts: Debt[];
  existingEntries: ExpenseEntry[];
  weeklyIncome: number;
  onUpdate: (drafts: ExpenseDraft[]) => void;
}) {
  const [drafts, setDrafts] = useState<ExpenseDraft[]>(() => {
    const fromExisting = existingEntries
      .filter(e => e.periodWeek === periodWeek)
      .map(e => ({
        tempId: e.id, id: e.id,
        label: e.label, amount: e.amount,
        category: e.category as ExpenseDraft["category"],
        isDebt: e.category === "debt"
      }));
    if (fromExisting.length > 0) return fromExisting;
    return debts.map(d => ({
      tempId: uid(), label: d.label, amount: d.monthlyPayment,
      category: "debt" as const, isDebt: true
    }));
  });

  const totalExpenses = drafts.reduce((s, d) => s + d.amount, 0);
  const net = weeklyIncome - totalExpenses;

  function update(updated: ExpenseDraft) {
    const next = drafts.map(d => d.tempId === updated.tempId ? updated : d);
    setDrafts(next);
    onUpdate(next);
  }

  function remove(tempId: string) {
    const next = drafts.filter(d => d.tempId !== tempId);
    setDrafts(next);
    onUpdate(next);
  }

  function addRow() {
    const next = [...drafts, { tempId: uid(), label: "", amount: 0, category: "discretionary" as const, isDebt: false }];
    setDrafts(next);
    onUpdate(next);
  }

  return (
    <div>
      {weeklyIncome > 0 && (
        <div className="guided-expense-summary">
          <span>Income: <strong>{fmt(weeklyIncome)}</strong></span>
          <span>Expenses: <strong>{fmt(totalExpenses)}</strong></span>
          <span style={{ color: net >= 0 ? "#0a9e74" : "var(--danger)", fontWeight: 700 }}>
            Net: {fmt(net)}
          </span>
        </div>
      )}
      <div className="guided-expense-list">
        {drafts.map(d => (
          <ExpenseRow
            key={d.tempId}
            draft={d}
            semesterId={semesterId}
            periodYear={periodYear}
            periodMonth={periodMonth}
            periodWeek={periodWeek}
            onChange={update}
            onDelete={remove}
          />
        ))}
      </div>
      <button className="guided-add-row" onClick={addRow} type="button">+ Add expense</button>
    </div>
  );
}

// ─── Step 3: Goal Impact ──────────────────────────────────────

function GoalImpactStep({
  goals,
  monthlySavings,
  weeklyIncome,
  weeklyExpenses
}: {
  goals: Goal[];
  monthlySavings: number;
  weeklyIncome: number;
  weeklyExpenses: number;
}) {
  const net = weeklyIncome - weeklyExpenses;
  const actualMonthlySavings = net > 0 ? net * 4.33 : 0;
  const nonRetirement = goals.filter(g => g.goalType !== "retirement");
  const baseline = projectGoals(nonRetirement, monthlySavings);
  const actual = weeklyIncome > 0 ? projectGoals(nonRetirement, actualMonthlySavings) : baseline;

  if (nonRetirement.length === 0) {
    return (
      <div className="guided-empty">
        <p>No goals to project yet.</p>
        <p style={{ marginTop: 8, fontSize: "0.875rem" }}>
          Data logged. Now visit the{" "}
          <a href="/app/student/goals" style={{ color: "var(--teal)" }}>Goals page</a> to set
          what you&apos;re working toward — that&apos;s where the numbers become meaningful.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className={`guided-net-callout${net >= 0 ? " guided-net-positive" : " guided-net-negative"}`}>
        {net >= 0
          ? `This week you saved ${fmt(net)} — money that works toward your goals.`
          : `This week expenses exceeded income by ${fmt(Math.abs(net))}. Worth reviewing.`}
      </div>
      <div className="guided-impact-list">
        {actual.map(ap => {
          const bp = baseline.find(p => p.goalId === ap.goalId);
          const monthsDiff = bp?.monthsRemaining != null && ap.monthsRemaining != null
            ? bp.monthsRemaining - ap.monthsRemaining : null;
          const isComplete = ap.monthsRemaining === 0;
          return (
            <div key={ap.goalId} className="guided-impact-row">
              <div className="guided-impact-name">{ap.label}</div>
              <div className="guided-impact-date" style={{ color: isComplete ? "#0a9e74" : "var(--teal)" }}>
                {isComplete ? "Complete ✓" : monthLabel(ap.projectedDate)}
              </div>
              {monthsDiff !== null && monthsDiff !== 0 && weeklyIncome > 0 && (
                <div className={`guided-impact-delta ${monthsDiff > 0 ? "guided-delta-good" : "guided-delta-bad"}`}>
                  {monthsDiff > 0 ? `${monthsDiff} month${monthsDiff > 1 ? "s" : ""} sooner` : `${Math.abs(monthsDiff)} month${Math.abs(monthsDiff) > 1 ? "s" : ""} later`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export function WeeklyCheckinWizard({
  semesterId,
  periodYear,
  periodMonth,
  periodWeek,
  goals,
  debts,
  existingIncomeEntries,
  existingExpenseEntries,
  baselineNetPay,
  monthlySavings,
  onClose,
  onComplete
}: WeeklyCheckinWizardProps) {
  const [step, setStep] = useState(0);
  const [weeklyIncome, setWeeklyIncome] = useState(0);
  const [expenseDrafts, setExpenseDrafts] = useState<ExpenseDraft[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const totalWeeklyExpenses = expenseDrafts.reduce((s, d) => s + d.amount, 0);
  const current = STEPS[step];
  const totalSteps = STEPS.length;

  function goNext() {
    if (step < totalSteps - 1) setStep(s => s + 1);
    else onComplete();
  }

  function goBack() {
    if (step > 0) setStep(s => s - 1);
  }

  return (
    <div className="guided-overlay" role="dialog" aria-modal="true">

      {/* Top chrome */}
      <div className="guided-chrome">
        <span className="guided-chrome-logo">ClarkFin</span>
        <span className="guided-chrome-sep" />
        <span className="guided-chrome-label">Weekly Check-In</span>
        <div className="guided-chrome-dots">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`guided-chrome-dot${i === step ? " guided-chrome-dot-active" : i < step ? " guided-chrome-dot-done" : ""}`}
            />
          ))}
        </div>
        <button className="guided-chrome-exit" onClick={onClose} type="button" aria-label="Exit check-in">
          Exit ×
        </button>
      </div>

      {/* Scrollable content */}
      <div className="guided-scroll" ref={contentRef}>
        <div className="guided-content">

          {/* Progress bar */}
          <div className="guided-progress-bar">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`guided-progress-seg${i < step ? " guided-progress-done" : i === step ? " guided-progress-active" : ""}`}
              />
            ))}
          </div>

          {/* Step counter */}
          <div className="guided-step-counter">Step {step + 1} of {totalSteps} · {current.label}</div>

          {/* Headline */}
          <h1 className="guided-headline">{current.headline}</h1>

          {/* Description */}
          <p className="guided-description">{current.description}</p>

          {/* Step content */}
          <div className="guided-step-body">
            {step === 0 && (
              <GoalRecapStep goals={goals} monthlySavings={monthlySavings} />
            )}
            {step === 1 && (
              <LogIncomeStep
                semesterId={semesterId}
                periodYear={periodYear}
                periodMonth={periodMonth}
                periodWeek={periodWeek}
                baselineNetPay={baselineNetPay}
                existingEntries={existingIncomeEntries}
                onSaved={setWeeklyIncome}
              />
            )}
            {step === 2 && (
              <LogExpensesStep
                semesterId={semesterId}
                periodYear={periodYear}
                periodMonth={periodMonth}
                periodWeek={periodWeek}
                debts={debts}
                existingEntries={existingExpenseEntries}
                weeklyIncome={weeklyIncome}
                onUpdate={setExpenseDrafts}
              />
            )}
            {step === 3 && (
              <GoalImpactStep
                goals={goals}
                monthlySavings={monthlySavings}
                weeklyIncome={weeklyIncome}
                weeklyExpenses={totalWeeklyExpenses}
              />
            )}
          </div>

          {/* Bottom nav */}
          <div className="guided-nav">
            <div className="guided-nav-back">
              {current.backLabel && (
                <button className="guided-nav-btn guided-nav-btn-back" onClick={goBack} type="button">
                  <span className="guided-nav-arrow">←</span>
                  <span className="guided-nav-text">
                    <span className="guided-nav-primary">{current.backLabel}</span>
                    <span className="guided-nav-sub">{current.backSub}</span>
                  </span>
                </button>
              )}
            </div>

            <div className="guided-nav-forward">
              {current.nextLabel ? (
                <button className="guided-nav-btn guided-nav-btn-next" onClick={goNext} type="button">
                  <span className="guided-nav-text" style={{ textAlign: "right" }}>
                    <span className="guided-nav-primary">{current.nextLabel}</span>
                    <span className="guided-nav-sub">{current.nextSub}</span>
                  </span>
                  <span className="guided-nav-arrow">→</span>
                </button>
              ) : (
                <button className="btn btn-primary" onClick={onComplete} type="button">
                  Done — back to your finances
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
