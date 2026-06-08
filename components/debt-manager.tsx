"use client";

import { useState, useTransition } from "react";

import { PageConnect } from "@/components/page-connect";

import type { Debt, DebtCategory } from "@/types/domain";
import { calculateDebtScenario } from "@/src/lib/activity/debt";

// ─── Helpers ───────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const CATEGORY_LABELS: Record<DebtCategory, string> = {
  student_loan: "Student Loan",
  mortgage: "Mortgage",
  credit_card: "Credit Card",
  car: "Car Loan",
  other: "Other"
};

function addMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[m - 1]} ${y}`;
}

function durationLabel(months: number): string {
  if (months === 0) return "Paid off";
  if (months >= 600) return "600+ mo";
  if (months < 12) return `${months} mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y} yr ${m} mo` : `${y} yr`;
}

// ─── Per-debt projection ───────────────────────────────────────

interface DebtProjection {
  payoffMonths: number;
  totalInterest: number;
  projectedDate: string | null;
  cantPayoff: boolean;
}

function projectDebt(debt: Debt): DebtProjection | null {
  if (debt.currentBalance <= 0) return null;
  if (debt.monthlyPayment <= 0) return null;

  const { payoffMonths, totalInterest } = calculateDebtScenario({
    balance: debt.currentBalance,
    interestRate: debt.interestRate,
    plannedPayment: debt.monthlyPayment
  });

  if (payoffMonths >= 600) {
    return { payoffMonths: 600, totalInterest, projectedDate: null, cantPayoff: true };
  }

  return { payoffMonths, totalInterest, projectedDate: addMonths(payoffMonths), cantPayoff: false };
}

// ─── Credit card minimum-payment warning ───────────────────────

interface MinPayWarning {
  minPayment: number;
  minPaymentInterest: number;
  minPaymentMonths: number;
  interestSaved: number;
}

function calcMinPayWarning(debt: Debt, projection: DebtProjection | null): MinPayWarning | null {
  if (!debt.isCreditCard || debt.interestRate <= 0 || debt.currentBalance <= 0) return null;

  const minPayment = Math.max(debt.currentBalance * 0.02, 25);
  const minSim = calculateDebtScenario({
    balance: debt.currentBalance,
    interestRate: debt.interestRate,
    plannedPayment: minPayment
  });
  const interestSaved = Math.max(0, minSim.totalInterest - (projection?.totalInterest ?? 0));

  return {
    minPayment,
    minPaymentInterest: minSim.totalInterest,
    minPaymentMonths: minSim.payoffMonths,
    interestSaved
  };
}

// ─── Activity logging ──────────────────────────────────────────

async function logDebtActivity(
  semesterId: string,
  action: "add" | "edit" | "delete",
  debt: Pick<Debt, "id" | "label" | "category" | "currentBalance" | "monthlyPayment">
) {
  await fetch("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "debt.update",
      semesterId,
      action,
      debtId: debt.id,
      label: debt.label,
      category: debt.category,
      currentBalance: debt.currentBalance,
      monthlyPayment: debt.monthlyPayment
    })
  });
}

// ─── Draft type ────────────────────────────────────────────────

interface DebtDraft {
  category: DebtCategory;
  label: string;
  originalBalance: string;
  currentBalance: string;
  monthlyPayment: string;
  interestRate: string;
  repaymentGoalDate: string;
}

function emptyDraft(): DebtDraft {
  return {
    category: "credit_card",
    label: "",
    originalBalance: "",
    currentBalance: "",
    monthlyPayment: "",
    interestRate: "",
    repaymentGoalDate: ""
  };
}

function debtToDraft(debt: Debt): DebtDraft {
  return {
    category: debt.category,
    label: debt.label,
    originalBalance: debt.originalBalance > 0 ? String(debt.originalBalance) : "",
    currentBalance: debt.currentBalance > 0 ? String(debt.currentBalance) : "",
    monthlyPayment: debt.monthlyPayment > 0 ? String(debt.monthlyPayment) : "",
    interestRate: debt.interestRate > 0 ? String(debt.interestRate) : "",
    repaymentGoalDate: debt.repaymentGoalDate ?? ""
  };
}

function draftToBody(draft: DebtDraft, semesterId: string) {
  return {
    semesterId,
    category: draft.category,
    label: draft.label.trim(),
    originalBalance: parseFloat(draft.originalBalance) || 0,
    currentBalance: parseFloat(draft.currentBalance) || 0,
    monthlyPayment: parseFloat(draft.monthlyPayment) || 0,
    interestRate: parseFloat(draft.interestRate) || 0,
    repaymentGoalDate: draft.repaymentGoalDate || undefined
  };
}

// ─── Edit form ─────────────────────────────────────────────────

function DebtEditForm({
  initial,
  saving,
  onSave,
  onCancel
}: {
  initial: DebtDraft;
  saving: boolean;
  onSave: (d: DebtDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<DebtDraft>(initial);
  const set = (field: keyof DebtDraft, value: string) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="dm-edit-form">
      <div className="wizard-form-2col">
        <div className="field">
          <label>Type</label>
          <select value={draft.category} onChange={(e) => set("category", e.target.value as DebtCategory)}>
            <option value="student_loan">Student Loan</option>
            <option value="credit_card">Credit Card</option>
            <option value="car">Car Loan</option>
            <option value="mortgage">Mortgage</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="field">
          <label>Label</label>
          <input
            type="text"
            value={draft.label}
            onChange={(e) => set("label", e.target.value)}
            placeholder="e.g. Discover Card"
          />
        </div>
      </div>

      <div className="wizard-form-3col">
        <div className="field">
          <label>Original Balance ($)</label>
          <input
            type="number"
            min="0"
            value={draft.originalBalance}
            onChange={(e) => set("originalBalance", e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="field">
          <label>Current Balance ($)</label>
          <input
            type="number"
            min="0"
            value={draft.currentBalance}
            onChange={(e) => set("currentBalance", e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="field">
          <label>Monthly Payment ($)</label>
          <input
            type="number"
            min="0"
            value={draft.monthlyPayment}
            onChange={(e) => set("monthlyPayment", e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div className="wizard-form-2col">
        <div className="field">
          <label>Interest Rate / APR (%)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.interestRate}
            onChange={(e) => set("interestRate", e.target.value)}
            placeholder="e.g. 19.99"
          />
        </div>
        <div className="field">
          <label>Repayment Goal Date (optional)</label>
          <input
            type="date"
            value={draft.repaymentGoalDate}
            onChange={(e) => set("repaymentGoalDate", e.target.value)}
          />
        </div>
      </div>

      <div className="dm-form-actions">
        <button
          className="btn"
          disabled={saving || !draft.label.trim()}
          onClick={() => onSave(draft)}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button className="btn-secondary" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Debt card (read + edit) ────────────────────────────────────

function DebtCard({
  debt,
  semesterId,
  onUpdated,
  onDeleted
}: {
  debt: Debt;
  semesterId: string;
  onUpdated: (updated: Debt) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const projection = projectDebt(debt);
  const minPayWarning = calcMinPayWarning(debt, projection);

  const goalStatus: "on_track" | "behind" | "no_goal" =
    projection?.projectedDate && debt.repaymentGoalDate
      ? projection.projectedDate <= debt.repaymentGoalDate
        ? "on_track"
        : "behind"
      : "no_goal";

  function handleSave(draft: DebtDraft) {
    setError("");
    startTransition(async () => {
      const resp = await fetch(`/api/student/debts/${debt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToBody(draft, semesterId))
      });
      const data = (await resp.json()) as { ok?: boolean; debt?: Debt; error?: string };
      if (!resp.ok || !data.debt) {
        setError(data.error ?? "Save failed.");
        return;
      }
      onUpdated(data.debt);
      void logDebtActivity(semesterId, "edit", data.debt);
      setEditing(false);
    });
  }

  function handleDelete() {
    if (!confirm(`Remove "${debt.label}"?`)) return;
    startTransition(async () => {
      await fetch(
        `/api/student/debts/${debt.id}?semesterId=${encodeURIComponent(semesterId)}`,
        { method: "DELETE" }
      );
      void logDebtActivity(semesterId, "delete", debt);
      onDeleted(debt.id);
    });
  }

  return (
    <div className="tl-debt-card">
      {editing ? (
        <>
          <div className="dm-edit-label">Edit: {debt.label}</div>
          <DebtEditForm
            initial={debtToDraft(debt)}
            saving={isPending}
            onSave={handleSave}
            onCancel={() => { setEditing(false); setError(""); }}
          />
          {error && <p className="dm-error">{error}</p>}
        </>
      ) : (
        <>
          <div className="tl-debt-header">
            <div>
              <div className="tl-debt-label">{debt.label}</div>
              <div className="tl-debt-meta">
                {CATEGORY_LABELS[debt.category]}
                {" · "}
                {fmt(debt.currentBalance)} balance
                {" · "}
                {fmt(debt.monthlyPayment)}/mo
                {debt.interestRate > 0 && ` · ${debt.interestRate.toFixed(1)}% APR`}
              </div>
            </div>
            <div className="dm-card-actions">
              {debt.currentBalance === 0 ? (
                <span className="tl-badge tl-badge-success">Paid off</span>
              ) : projection?.cantPayoff ? (
                <span className="tl-badge tl-badge-danger">Payment too low</span>
              ) : goalStatus === "on_track" ? (
                <span className="tl-badge tl-badge-success">On Track</span>
              ) : goalStatus === "behind" ? (
                <span className="tl-badge tl-badge-danger">Behind</span>
              ) : projection ? (
                <span className="tl-badge tl-badge-muted">{durationLabel(projection.payoffMonths)}</span>
              ) : null}
              <button className="btn-ghost btn-sm" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button
                className="btn-ghost btn-sm dm-delete-btn"
                disabled={isPending}
                onClick={handleDelete}
                aria-label="Remove debt"
              >
                ✕
              </button>
            </div>
          </div>

          {projection && !projection.cantPayoff && (
            <div className="tl-debt-meta">
              Payoff: {monthLabel(projection.projectedDate!)}
              {projection.totalInterest > 0 && ` · ${fmt(projection.totalInterest)} in interest`}
              {debt.interestRate === 0 && " · (no APR — add rate for accurate projection)"}
              {debt.repaymentGoalDate && ` · Goal: ${monthLabel(debt.repaymentGoalDate)}`}
            </div>
          )}

          {minPayWarning && (
            <div className="tl-cc-warning">
              <strong>Minimum Payment Trap</strong> — At ~{fmt(minPayWarning.minPayment)}/mo you&apos;ll
              pay <strong>{fmt(minPayWarning.minPaymentInterest)}</strong> in interest over{" "}
              {durationLabel(minPayWarning.minPaymentMonths)}.
              {minPayWarning.interestSaved > 0 ? (
                <> Your current payment saves <strong>{fmt(minPayWarning.interestSaved)}</strong> in interest.</>
              ) : (
                <> Increasing your payment significantly reduces this cost.</>
              )}
            </div>
          )}

          {debt.isCreditCard && debt.interestRate === 0 && debt.currentBalance > 0 && (
            <div className="tl-cc-warning">
              <strong>Credit Card</strong> — Add your APR in Edit to see the true cost of minimum payments.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Add debt card ─────────────────────────────────────────────

function AddDebtCard({
  semesterId,
  onAdded,
  onCancel
}: {
  semesterId: string;
  onAdded: (debt: Debt) => void;
  onCancel: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleSave(draft: DebtDraft) {
    setError("");
    startTransition(async () => {
      const resp = await fetch("/api/student/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToBody(draft, semesterId))
      });
      const data = (await resp.json()) as { ok?: boolean; debt?: Debt; error?: string };
      if (!resp.ok || !data.debt) {
        setError(data.error ?? "Save failed.");
        return;
      }
      onAdded(data.debt);
      void logDebtActivity(semesterId, "add", data.debt);
    });
  }

  return (
    <div className="tl-debt-card">
      <div className="dm-edit-label">New Debt</div>
      <DebtEditForm
        initial={emptyDraft()}
        saving={isPending}
        onSave={handleSave}
        onCancel={onCancel}
      />
      {error && <p className="dm-error">{error}</p>}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────

export function DebtManager({
  initialDebts,
  semesterId,
  semesterLabel
}: {
  initialDebts: Debt[];
  semesterId?: string;
  semesterLabel?: string;
}) {
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [adding, setAdding] = useState(false);

  const totalBalance = debts.reduce((s, d) => s + d.currentBalance, 0);
  const totalMonthly = debts.reduce((s, d) => s + d.monthlyPayment, 0);

  if (!semesterId) {
    return (
      <div className="card">
        <p style={{ color: "var(--muted)" }}>
          No active course workspace. Enroll in a course to manage your debts.
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageConnect
        storageKey="debt"
        text="Every debt here reduces your net worth on the Balance Sheet and your monthly payments appear as an expense category on the Income page. High-interest debt is worth treating as a goal — paying it off faster has a bigger impact on your finances than almost any other move."
        links={[
          { href: "/app/student/balance-sheet", label: "See net worth →" },
          { href: "/app/student/goals", label: "Set payoff goal →" },
          { href: "/app/student/income", label: "Log payments →" }
        ]}
      />

      <div className="card-header" style={{ paddingBottom: 0 }}>
        <div>
          <h2>Debt Overview</h2>
          {semesterLabel && (
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.875rem" }}>
              {semesterLabel}
            </p>
          )}
        </div>
        <button className="btn btn-sm" disabled={adding} onClick={() => setAdding(true)}>
          + Add debt
        </button>
      </div>

      {debts.length > 0 && (
        <div className="dm-summary">
          <div className="dm-summary-item">
            <span className="dm-summary-label">Debts</span>
            <span className="dm-summary-value">{debts.length}</span>
          </div>
          <div className="dm-summary-item">
            <span className="dm-summary-label">Total Balance</span>
            <span className="dm-summary-value dm-summary-danger">{fmt(totalBalance)}</span>
          </div>
          <div className="dm-summary-item">
            <span className="dm-summary-label">Monthly Payments</span>
            <span className="dm-summary-value">{fmt(totalMonthly)}/mo</span>
          </div>
        </div>
      )}

      {debts.length === 0 && !adding && (
        <div className="card dm-empty">
          No debts recorded. Use <strong>+ Add debt</strong> above to track your payoff timeline.
        </div>
      )}

      {debts.map((debt) => (
        <DebtCard
          key={debt.id}
          debt={debt}
          semesterId={semesterId}
          onUpdated={(updated) =>
            setDebts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
          }
          onDeleted={(id) => setDebts((prev) => prev.filter((d) => d.id !== id))}
        />
      ))}

      {adding && (
        <AddDebtCard
          semesterId={semesterId}
          onAdded={(debt) => {
            setDebts((prev) => [...prev, debt]);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}

    </div>
  );
}
