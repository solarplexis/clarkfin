"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import type { Debt, DebtCategory, Goal, GoalType, IncomeEntryCategory, ExpenseCategory, UserProfile } from "@/types/domain";

// ─── Training content ─────────────────────────────────────────

const TRAINING: Record<number, Array<{ title: string; body: string; example: string }>> = {
  1: [
    {
      title: "Net Pay vs. Gross Pay",
      body: "Gross pay is what you earn before taxes. Net pay is what actually hits your bank account — the number ClarkFin uses for all budgeting and savings calculations.",
      example: "If you earn $2,500/month before taxes and take home $2,000, your net pay is $2,000. That's your real budget baseline."
    },
    {
      title: "Why Your Retirement Age Matters",
      body: "The gap between your age and retirement age is your wealth-building runway. A 21-year-old has 44 years — time is the single most powerful financial tool available to you.",
      example: "Starting to save $100/month at 21 vs. 31 can mean $150,000+ more by retirement, even before investment returns."
    }
  ],
  2: [
    {
      title: "The Minimum Payment Trap",
      body: "On a $1,200 credit card balance at 20% interest, paying only the minimum takes 6+ years and costs hundreds in extra interest. ClarkFin will show you this cost so you can make an informed choice.",
      example: "Paying just the minimum on a $1,200 balance costs ~$500 in interest. Paying it off in 12 months costs about $110 in interest. Same debt, very different outcomes."
    }
  ],
  3: [
    {
      title: "Why an Emergency Fund Comes First",
      body: "3–6 months of essential expenses as a savings buffer means any unexpected cost (car repair, medical bill, lost hours) doesn't go straight onto a credit card and erase months of progress.",
      example: "If your essential expenses are $1,500/month, an emergency fund of $4,500–$9,000 is your financial safety net before pursuing other goals."
    },
    {
      title: "Short vs. Long-Term Goals",
      body: "Short-term goals (1–3 years) are specific near-future targets. Long-term goals (3+ years) are bigger life milestones. The Goal Timeline Engine calculates exactly how long each takes based on your monthly savings.",
      example: "A laptop ($800) is short-term. A car down payment ($5,000) is long-term. You'll see a projected completion date for each the moment you enter your savings rate."
    }
  ],
  4: [
    {
      title: "What a Savings Rate Is",
      body: "Your savings rate is the percentage of your net pay set aside for goals each month. Even 5% is a meaningful start. The higher the rate, the faster every goal arrives.",
      example: "On $2,000/month net pay: 5% savings = $100/month, 10% = $200/month, 15% = $300/month. Small percentage changes make a huge difference over time."
    },
    {
      title: "How Allocations Work",
      body: "Every dollar of net pay goes somewhere: Essential (needs), Debt (payments), Discretionary (wants), Savings (goals). These four percentages must total 100% — this is your complete personal spending plan.",
      example: "Example: Essential 50% · Debt 20% · Discretionary 20% · Savings 10% = 100%. You'll set these targets on your dashboard after setup."
    }
  ]
};

// ─── Local draft types ────────────────────────────────────────

interface DebtDraft {
  tempId: string;
  savedId?: string;
  category: DebtCategory;
  label: string;
  originalBalance: string;
  currentBalance: string;
  monthlyPayment: string;
  repaymentGoalDate: string;
}

interface GoalDraft {
  tempId: string;
  savedId?: string;
  label: string;
  goalType: GoalType;
  targetAmount: string;
  targetDate: string;
}

interface LineItemDraft {
  tempId: string;
  category: string;
  label: string;
  amount: string;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function formatNumberWithCommas(value: string): string {
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("en-US");
}

const DEFAULT_INCOME: LineItemDraft[] = [
  { tempId: uid(), category: "gross_pay", label: "Monthly Gross Pay", amount: "" }
];

const DEFAULT_EXPENSES: LineItemDraft[] = [
  { tempId: uid(), category: "essential", label: "Rent / Housing", amount: "" },
  { tempId: uid(), category: "essential", label: "Groceries", amount: "" },
  { tempId: uid(), category: "essential", label: "Transportation", amount: "" },
  { tempId: uid(), category: "debt", label: "Student Loan", amount: "" },
  { tempId: uid(), category: "discretionary", label: "Dining Out", amount: "" },
  { tempId: uid(), category: "discretionary", label: "Entertainment", amount: "" }
];

// ─── Props ────────────────────────────────────────────────────

interface Props {
  user: UserProfile;
  semesterId: string;
  organizationId: string;
  initialDebts: Debt[];
  initialGoals: Goal[];
}

// ─── Component ────────────────────────────────────────────────

export function OnboardingWizard({ user, semesterId, organizationId, initialDebts, initialGoals }: Props) {
  const router = useRouter();
  const totalSteps = 4;

  // Navigation
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Training mode
  const [trainingActive, setTrainingActive] = useState(false);
  const [trainingCardIndex, setTrainingCardIndex] = useState(0);

  // Step 1 — Profile
  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [currentAge, setCurrentAge] = useState(user.currentAge?.toString() ?? "");
  const [targetRetirementAge, setTargetRetirementAge] = useState(user.targetRetirementAge?.toString() ?? "65");
  const [retirementNetWorthTarget, setRetirementNetWorthTarget] = useState(
    user.retirementNetWorthTarget ? formatNumberWithCommas(user.retirementNetWorthTarget.toString()) : ""
  );

  // Step 2 — Debts
  const [debts, setDebts] = useState<DebtDraft[]>(() =>
    initialDebts.length > 0
      ? initialDebts.map((d) => ({
          tempId: uid(),
          savedId: d.id,
          category: d.category,
          label: d.label,
          originalBalance: d.originalBalance.toString(),
          currentBalance: d.currentBalance.toString(),
          monthlyPayment: d.monthlyPayment.toString(),
          repaymentGoalDate: d.repaymentGoalDate ?? ""
        }))
      : []
  );

  // Step 3 — Goals
  const [goals, setGoals] = useState<GoalDraft[]>(() =>
    initialGoals.length > 0
      ? initialGoals.map((g) => ({
          tempId: uid(),
          savedId: g.id,
          label: g.label,
          goalType: g.goalType,
          targetAmount: g.targetAmount.toString(),
          targetDate: g.targetDate ?? ""
        }))
      : []
  );

  // Step 4 — Baseline income / expenses
  const [incomeItems, setIncomeItems] = useState<LineItemDraft[]>(DEFAULT_INCOME);
  const [expenseItems, setExpenseItems] = useState<LineItemDraft[]>(DEFAULT_EXPENSES);

  // Restore training mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("clarkfin_training_active");
    if (saved === "true") setTrainingActive(true);
  }, []);

  function toggleTraining() {
    const next = !trainingActive;
    setTrainingActive(next);
    setTrainingCardIndex(0);
    localStorage.setItem("clarkfin_training_active", next ? "true" : "false");
  }

  // Training cards for current step
  const currentTrainingCards = TRAINING[step] ?? [];
  const trainingCardVisible = trainingActive && trainingCardIndex < currentTrainingCards.length;
  const currentCard = currentTrainingCards[trainingCardIndex];

  function dismissTrainingCard() {
    if (trainingCardIndex < currentTrainingCards.length - 1) {
      setTrainingCardIndex(trainingCardIndex + 1);
    } else {
      setTrainingCardIndex(currentTrainingCards.length); // all dismissed for this step
    }
  }

  function onStepChange(nextStep: number) {
    setError("");
    setTrainingCardIndex(0); // reset training cards for new step
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ─── Step savers ────────────────────────────────────────────

  async function saveStep1() {
    const age = parseInt(currentAge);
    const retAge = parseInt(targetRetirementAge);
    const retTarget = parseFloat(retirementNetWorthTarget.replace(/,/g, ""));

    if (!fullName.trim()) throw new Error("Full name is required.");
    if (!currentAge || isNaN(age) || age < 16 || age > 100) throw new Error("Enter a valid age (16–100).");
    if (!targetRetirementAge || isNaN(retAge) || retAge <= age) throw new Error("Retirement age must be greater than your current age.");
    if (!retirementNetWorthTarget || isNaN(retTarget) || retTarget <= 0) throw new Error("Enter a retirement savings target.");

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: fullName.trim(), currentAge: age, targetRetirementAge: retAge, retirementNetWorthTarget: retTarget })
    });
    if (!res.ok) {
      const data = await res.json() as { error?: string };
      throw new Error(data.error ?? "Failed to save profile.");
    }
  }

  async function saveStep2() {
    // Submit only debts that haven't been saved yet (no savedId)
    const newDebts = debts.filter((d) => !d.savedId);
    await Promise.all(
      newDebts.map(async (d) => {
        if (!d.label.trim()) return;
        const res = await fetch("/api/student/debts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            semesterId,
            category: d.category,
            label: d.label.trim(),
            originalBalance: parseFloat(d.originalBalance) || 0,
            currentBalance: parseFloat(d.currentBalance) || 0,
            monthlyPayment: parseFloat(d.monthlyPayment) || 0,
            repaymentGoalDate: d.repaymentGoalDate || undefined
          })
        });
        if (!res.ok) {
          const data = await res.json() as { error?: string };
          throw new Error(data.error ?? "Failed to save a debt.");
        }
      })
    );
  }

  async function saveStep3() {
    // Submit only goals that haven't been saved yet
    const newGoals = goals.filter((g) => !g.savedId);
    await Promise.all(
      newGoals.map(async (g) => {
        if (!g.label.trim()) return;
        const res = await fetch("/api/student/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            semesterId,
            label: g.label.trim(),
            goalType: g.goalType,
            targetAmount: parseFloat(g.targetAmount) || 0,
            targetDate: g.targetDate || undefined,
            savedToDate: 0
          })
        });
        if (!res.ok) {
          const data = await res.json() as { error?: string };
          throw new Error(data.error ?? "Failed to save a goal.");
        }
      })
    );
  }

  async function saveStep4() {
    const filled = (items: LineItemDraft[]) => items.filter((i) => parseFloat(i.amount) > 0);

    await Promise.all([
      ...filled(incomeItems).map(async (item) => {
        const res = await fetch("/api/student/income-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            semesterId,
            periodYear: 0,
            periodMonth: 0,
            periodWeek: 0,
            category: item.category as IncomeEntryCategory,
            label: item.label,
            amount: parseFloat(item.amount)
          })
        });
        if (!res.ok) {
          const data = await res.json() as { error?: string };
          throw new Error(data.error ?? "Failed to save income entry.");
        }
      }),
      ...filled(expenseItems).map(async (item) => {
        const res = await fetch("/api/student/expense-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            semesterId,
            periodYear: 0,
            periodMonth: 0,
            periodWeek: 0,
            category: item.category as ExpenseCategory,
            label: item.label,
            amount: parseFloat(item.amount)
          })
        });
        if (!res.ok) {
          const data = await res.json() as { error?: string };
          throw new Error(data.error ?? "Failed to save expense entry.");
        }
      })
    ]);
  }

  // ─── Navigation handlers ─────────────────────────────────────

  async function handleNext() {
    setError("");
    setSaving(true);
    try {
      if (step === 1) await saveStep1();
      if (step === 2) await saveStep2();
      if (step === 3) await saveStep3();
      if (step === 4) {
        await saveStep4();
        localStorage.removeItem("clarkfin_training_active");
        router.push("/app/student");
        return;
      }
      onStepChange(step + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if (step > 1) onStepChange(step - 1);
  }

  function handleSkip() {
    router.push("/app/student");
  }

  const hasEmergencyFund = goals.some((g) => g.goalType === "emergency_fund");

  // ─── Debt helpers ────────────────────────────────────────────

  function addDebt() {
    setDebts([...debts, { tempId: uid(), category: "credit_card", label: "Credit Card", originalBalance: "", currentBalance: "", monthlyPayment: "", repaymentGoalDate: "" }]);
  }

  function removeDebt(tempId: string) {
    setDebts(debts.filter((d) => d.tempId !== tempId));
  }

  function updateDebt(tempId: string, field: keyof DebtDraft, value: string) {
    setDebts(debts.map((d) => d.tempId === tempId ? { ...d, [field]: value } : d));
  }

  // ─── Goal helpers ────────────────────────────────────────────

  function addGoal(type: GoalType = "short_term") {
    setGoals([...goals, { tempId: uid(), label: "", goalType: type, targetAmount: "", targetDate: "" }]);
  }

  function addEmergencyFund() {
    setGoals([{ tempId: uid(), label: "Emergency Fund", goalType: "emergency_fund", targetAmount: "", targetDate: "" }, ...goals]);
  }

  function removeGoal(tempId: string) {
    setGoals(goals.filter((g) => g.tempId !== tempId));
  }

  function updateGoal(tempId: string, field: keyof GoalDraft, value: string) {
    setGoals(goals.map((g) => g.tempId === tempId ? { ...g, [field]: value } : g));
  }

  // ─── Line item helpers ───────────────────────────────────────

  function updateIncome(tempId: string, field: keyof LineItemDraft, value: string) {
    setIncomeItems(incomeItems.map((i) => i.tempId === tempId ? { ...i, [field]: value } : i));
  }

  function addIncome() {
    setIncomeItems([...incomeItems, { tempId: uid(), category: "other", label: "Other Income", amount: "" }]);
  }

  function updateExpense(tempId: string, field: keyof LineItemDraft, value: string) {
    setExpenseItems(expenseItems.map((i) => i.tempId === tempId ? { ...i, [field]: value } : i));
  }

  function addExpense(category: string) {
    setExpenseItems([...expenseItems, { tempId: uid(), category, label: "", amount: "" }]);
  }

  function removeExpense(tempId: string) {
    setExpenseItems(expenseItems.filter((i) => i.tempId !== tempId));
  }

  // ─── Render ──────────────────────────────────────────────────

  const progressPct = ((step - 1) / totalSteps) * 100;

  const STEP_TITLES = ["Personal Profile", "Your Debts", "Your Goals", "Income & Expenses"];
  const STEP_SUBS = [
    "Tell us a little about yourself so we can set up your financial picture.",
    "Enter any debts you're carrying. You can add, edit, or skip for now.",
    "Define what you're saving toward. ClarkFin will project when you'll reach each one.",
    "Enter your approximate monthly income and expenses to seed your starting baseline."
  ];

  return (
    <div className="wizard-shell">
      {/* Top bar */}
      <header className="wizard-topbar">
        <div className="wizard-topbar-logo">ClarkFin</div>
        <button className="wizard-topbar-skip" onClick={handleSkip}>
          Skip setup for now →
        </button>
      </header>

      {/* Progress bar */}
      <div className="wizard-progress-track">
        <div className="wizard-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Body */}
      <main className="wizard-body">
        <div className="wizard-card">

          {/* Step header */}
          <div className="wizard-step-header">
            <div className="wizard-step-counter">Step {step} of {totalSteps} — {STEP_TITLES[step - 1]}</div>
            <h1 className="wizard-step-title">{STEP_TITLES[step - 1]}</h1>
            <p className="wizard-step-sub">{STEP_SUBS[step - 1]}</p>
          </div>

          {/* Training tour toggle (step 1 only) */}
          {step === 1 && (
            <div className="wizard-tour-banner">
              <span className="wizard-tour-banner-icon">🎓</span>
              <p>
                {trainingActive
                  ? "Guided tour is on. Each step includes a brief explanation before the form fields appear."
                  : "New to personal finance? Take the guided tour — it explains each concept before you fill it in. Takes about 8 minutes."}
              </p>
              <button className={trainingActive ? "btn-secondary btn-sm" : "btn btn-sm"} onClick={toggleTraining}>
                {trainingActive ? "Exit Tour" : "Start Tour"}
              </button>
            </div>
          )}

          {/* Training card for current step */}
          {trainingCardVisible && currentCard && (
            <div className="training-card">
              <div className="training-card-header">
                <span className="training-card-icon">💡</span>
                <span className="training-card-title">{currentCard.title}</span>
              </div>
              <p className="training-card-body">{currentCard.body}</p>
              <p className="training-card-example">{currentCard.example}</p>
              <div className="training-card-footer">
                <span className="training-card-progress">
                  Training card {trainingCardIndex + 1} of {currentTrainingCards.length}
                </span>
                <button className="training-got-it" onClick={dismissTrainingCard}>
                  Got it →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 1: Profile ── */}
          {step === 1 && (
            <div className="wizard-form-card">
              <div className="field">
                <label htmlFor="fullName">Full Name</label>
                <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
              </div>
              <div className="wizard-form-3col">
                <div className="field">
                  <label htmlFor="currentAge">Current Age</label>
                  <input id="currentAge" type="number" min="16" max="100" value={currentAge} onChange={(e) => setCurrentAge(e.target.value)} placeholder="e.g. 21" />
                </div>
                <div className="field">
                  <label htmlFor="retirementAge">Retirement Age</label>
                  <input id="retirementAge" type="number" min="40" max="99" value={targetRetirementAge} onChange={(e) => setTargetRetirementAge(e.target.value)} placeholder="e.g. 65" />
                </div>
                <div className="field">
                  <label htmlFor="retirementTarget">Retirement Net Worth Target ($)</label>
                  <input id="retirementTarget" type="text" inputMode="numeric" value={retirementNetWorthTarget} onChange={(e) => setRetirementNetWorthTarget(formatNumberWithCommas(e.target.value))} placeholder="e.g. 1,000,000" />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Debts ── */}
          {step === 2 && (
            <div className="stack">
              {debts.length === 0 && (
                <p className="muted" style={{ textAlign: "center", padding: "8px 0" }}>
                  No debts entered yet. Add any loans, credit cards, or other balances below.
                </p>
              )}
              <div className="wizard-item-list">
                {debts.map((debt, i) => (
                  <div key={debt.tempId} className="wizard-item-card">
                    <div className="wizard-item-card-header">
                      <span className="wizard-item-card-title">Debt {i + 1}</span>
                      <button className="btn-danger btn-sm" onClick={() => removeDebt(debt.tempId)}>Remove</button>
                    </div>
                    <div className="wizard-form-2col">
                      <div className="field">
                        <label>Type</label>
                        <select value={debt.category} onChange={(e) => updateDebt(debt.tempId, "category", e.target.value as DebtCategory)}>
                          <option value="student_loan">Student Loan</option>
                          <option value="credit_card">Credit Card</option>
                          <option value="car">Car Loan</option>
                          <option value="mortgage">Mortgage</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="field">
                        <label>Label / Name</label>
                        <input type="text" value={debt.label} onChange={(e) => updateDebt(debt.tempId, "label", e.target.value)} placeholder="e.g. Discover Card" />
                      </div>
                    </div>
                    <div className="wizard-form-3col">
                      <div className="field">
                        <label>Original Balance ($)</label>
                        <input type="number" min="0" value={debt.originalBalance} onChange={(e) => updateDebt(debt.tempId, "originalBalance", e.target.value)} placeholder="0.00" />
                      </div>
                      <div className="field">
                        <label>Current Balance ($)</label>
                        <input type="number" min="0" value={debt.currentBalance} onChange={(e) => updateDebt(debt.tempId, "currentBalance", e.target.value)} placeholder="0.00" />
                      </div>
                      <div className="field">
                        <label>Monthly Payment ($)</label>
                        <input type="number" min="0" value={debt.monthlyPayment} onChange={(e) => updateDebt(debt.tempId, "monthlyPayment", e.target.value)} placeholder="0.00" />
                      </div>
                    </div>
                    <div className="field">
                      <label>Repayment Goal Date (optional)</label>
                      <input type="date" value={debt.repaymentGoalDate} onChange={(e) => updateDebt(debt.tempId, "repaymentGoalDate", e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
              <button className="wizard-add-btn" onClick={addDebt}>+ Add a debt</button>
            </div>
          )}

          {/* ── Step 3: Goals ── */}
          {step === 3 && (
            <div className="stack">
              {/* Emergency fund suggestion */}
              {!hasEmergencyFund && (
                <div className="wizard-suggestion-card">
                  <span className="wizard-suggestion-icon">⚡</span>
                  <div className="wizard-suggestion-body">
                    <p>
                      <strong>Recommended first goal:</strong> Financial experts suggest building a 3–6 month emergency fund before other goals. This protects all your other progress from unexpected expenses.
                    </p>
                    <button className="btn btn-sm" onClick={addEmergencyFund}>+ Add Emergency Fund goal</button>
                  </div>
                </div>
              )}

              {goals.length === 0 && (
                <p className="muted" style={{ textAlign: "center", padding: "8px 0" }}>
                  No goals yet. Add what you're saving toward below.
                </p>
              )}

              <div className="wizard-item-list">
                {goals.map((goal, i) => (
                  <div key={goal.tempId} className="wizard-item-card">
                    <div className="wizard-item-card-header">
                      <span className="wizard-item-card-title">Goal {i + 1}</span>
                      <button className="btn-danger btn-sm" onClick={() => removeGoal(goal.tempId)}>Remove</button>
                    </div>
                    <div className="wizard-form-2col">
                      <div className="field">
                        <label>Type</label>
                        <select value={goal.goalType} onChange={(e) => updateGoal(goal.tempId, "goalType", e.target.value as GoalType)}>
                          <option value="emergency_fund">Emergency Fund</option>
                          <option value="short_term">Short-Term (1–3 years)</option>
                          <option value="long_term">Long-Term (3+ years)</option>
                          <option value="retirement">Retirement</option>
                        </select>
                      </div>
                      <div className="field">
                        <label>Goal Name</label>
                        <input type="text" value={goal.label} onChange={(e) => updateGoal(goal.tempId, "label", e.target.value)} placeholder="e.g. Emergency Fund, Laptop, Car" />
                      </div>
                    </div>
                    <div className="wizard-form-2col" style={{ alignItems: "start" }}>
                      <div className="field">
                        <label>Target Amount ($)</label>
                        <input type="number" min="0" value={goal.targetAmount} onChange={(e) => updateGoal(goal.tempId, "targetAmount", e.target.value)} placeholder="0.00" />
                      </div>
                      <div className="field" style={{ minHeight: "72px" }}>
                        <label>Target Date (optional)</label>
                        <input type="date" value={goal.targetDate} onChange={(e) => updateGoal(goal.tempId, "targetDate", e.target.value)} />
                        <span className="field-hint">ClarkFin will suggest if you are unsure</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button className="wizard-add-btn" style={{ flex: 1 }} onClick={() => addGoal("short_term")}>+ Short-term goal</button>
                <button className="wizard-add-btn" style={{ flex: 1 }} onClick={() => addGoal("long_term")}>+ Long-term goal</button>
              </div>
            </div>
          )}

          {/* ── Step 4: Baseline income & expenses ── */}
          {step === 4 && (
            <div className="stack">
              <div className="wizard-form-card">
                <div className="section-title">Monthly Income — Baseline</div>
                <div className="stack-sm">
                  {incomeItems.map((item) => (
                    <div key={item.tempId} className="wizard-form-2col" style={{ alignItems: "end" }}>
                      <div className="field">
                        <label>Description</label>
                        <input type="text" value={item.label} onChange={(e) => updateIncome(item.tempId, "label", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Monthly Amount ($)</label>
                        <input type="number" min="0" value={item.amount} onChange={(e) => updateIncome(item.tempId, "amount", e.target.value)} placeholder="0.00" />
                      </div>
                    </div>
                  ))}
                </div>
                <button className="wizard-add-btn" onClick={addIncome}>+ Add income source</button>
              </div>

              <div className="wizard-form-card">
                <div className="section-title">Monthly Expenses — Baseline</div>
                <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
                  Enter approximate monthly amounts. Skip any that don't apply.
                </p>
                <div className="stack-sm">
                  {expenseItems.map((item) => (
                    <div key={item.tempId} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "10px", alignItems: "end" }}>
                      <div className="field">
                        <label>Description</label>
                        <input type="text" value={item.label} onChange={(e) => updateExpense(item.tempId, "label", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Monthly Amount ($)</label>
                        <input type="number" min="0" value={item.amount} onChange={(e) => updateExpense(item.tempId, "amount", e.target.value)} placeholder="0.00" />
                      </div>
                      <button className="btn-ghost btn-sm" style={{ marginBottom: "1px" }} onClick={() => removeExpense(item.tempId)} aria-label="Remove">✕</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button className="wizard-add-btn" style={{ flex: 1 }} onClick={() => addExpense("essential")}>+ Essential</button>
                  <button className="wizard-add-btn" style={{ flex: 1 }} onClick={() => addExpense("debt")}>+ Debt payment</button>
                  <button className="wizard-add-btn" style={{ flex: 1 }} onClick={() => addExpense("discretionary")}>+ Discretionary</button>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && <p className="wizard-error">{error}</p>}

        </div>
      </main>

      {/* Footer */}
      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <div className="wizard-step-dots">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={`wizard-step-dot ${i + 1 === step ? "wizard-step-dot-active" : i + 1 < step ? "wizard-step-dot-done" : ""}`}
              />
            ))}
          </div>
        </div>
        <div className="wizard-footer-right">
          {step > 1 && (
            <button className="btn-secondary" onClick={handleBack} disabled={saving}>
              ← Back
            </button>
          )}
          <button className="btn" onClick={handleNext} disabled={saving}>
            {saving ? "Saving…" : step === totalSteps ? "Finish Setup →" : "Next →"}
          </button>
        </div>
      </footer>
    </div>
  );
}
