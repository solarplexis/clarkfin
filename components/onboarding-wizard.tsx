"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { projectGoals } from "@/src/lib/calculations/timeline";

import type { Debt, DebtCategory, Goal, GoalType, IncomeEntryCategory, UserProfile } from "@/types/domain";

// ─── Training content ──────────────────────────────────────────
// Keys match step numbers 1–4 (step 0 = welcome, no training)

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
      title: "Why an Emergency Fund Comes First",
      body: "3–6 months of essential expenses as a savings buffer means any unexpected cost (car repair, medical bill, lost hours) doesn't go straight onto a credit card and erase months of progress.",
      example: "If your essential expenses are $1,500/month, an emergency fund of $4,500–$9,000 is your financial safety net before pursuing other goals."
    },
    {
      title: "Short vs. Long-Term Goals",
      body: "Short-term goals (1–3 years) are specific near-future targets. Long-term goals (3+ years) are bigger life milestones. ClarkFin calculates exactly how long each takes based on your monthly savings.",
      example: "A laptop ($800) is short-term. A car down payment ($5,000) is long-term. You'll see a projected completion date for each the moment you set your savings rate."
    }
  ],
  3: [
    {
      title: "The Minimum Payment Trap",
      body: "On a $1,200 credit card balance at 20% interest, paying only the minimum takes 6+ years and costs hundreds in extra interest. ClarkFin shows you this cost in real time so you can make an informed choice.",
      example: "Paying just the minimum on a $1,200 balance costs ~$500 in interest. Paying it off in 12 months costs about $110 in interest. Same debt, very different outcomes."
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
      example: "Example: Essential 55% · Debt 15% · Discretionary 20% · Savings 10% = 100%. Adjust until it reflects your reality, then watch your goal timelines update instantly."
    }
  ]
};

// ─── Helpers ────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function formatNumberWithCommas(value: string): string {
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("en-US");
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatProjectedDate(ym: string | null): string {
  if (!ym) return "—";
  const [y, m] = ym.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[m - 1]} ${y}`;
}

function calcCCWarning(balance: number, rate: number, payment: number) {
  if (balance <= 0 || rate <= 0 || payment <= 0) return null;
  const r = rate / 100 / 12;
  const minPmt = Math.max(25, balance * 0.02);
  function months(p: number): number | null {
    if (p <= 0) return null;
    const inside = 1 - (r * balance) / p;
    if (inside <= 0) return null;
    return Math.ceil(-Math.log(inside) / Math.log(1 + r));
  }
  const minMonths = months(minPmt);
  if (!minMonths) return null;
  const minInterest = Math.round(Math.max(0, minPmt * minMonths - balance));
  const pmtMonths = months(payment);
  if (payment > minPmt * 1.2) return null;
  return { minMonths, minInterest, pmtMonths };
}

// ─── Draft types ─────────────────────────────────────────────────

interface DebtDraft {
  tempId: string;
  savedId?: string;
  category: DebtCategory;
  label: string;
  originalBalance: string;
  currentBalance: string;
  interestRate: string;
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

// ─── Props ───────────────────────────────────────────────────────

interface Props {
  user: UserProfile;
  semesterId: string;
  organizationId: string;
  initialDebts: Debt[];
  initialGoals: Goal[];
}

// ─── Component ──────────────────────────────────────────────────

export function OnboardingWizard({ user, semesterId, organizationId: _organizationId, initialDebts, initialGoals }: Props) {
  const router = useRouter();

  // step 0 = welcome, 1–4 = data entry
  const DATA_STEPS = 4;
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Training mode
  const [trainingActive, setTrainingActive] = useState(false);
  const [trainingCardIndex, setTrainingCardIndex] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("clarkfin_training_active");
    if (saved === "true") setTrainingActive(true);
  }, []);

  // Step 1 — Profile
  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [currentAge, setCurrentAge] = useState(user.currentAge?.toString() ?? "");
  const [targetRetirementAge, setTargetRetirementAge] = useState(user.targetRetirementAge?.toString() ?? "65");
  const [retirementNetWorthTarget, setRetirementNetWorthTarget] = useState(
    user.retirementNetWorthTarget ? formatNumberWithCommas(user.retirementNetWorthTarget.toString()) : ""
  );

  // Step 2 — Goals (goals before debts)
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

  // Step 3 — Debts
  const [debts, setDebts] = useState<DebtDraft[]>(() =>
    initialDebts.length > 0
      ? initialDebts.map((d) => ({
          tempId: uid(),
          savedId: d.id,
          category: d.category,
          label: d.label,
          originalBalance: d.originalBalance.toString(),
          currentBalance: d.currentBalance.toString(),
          interestRate: d.interestRate?.toString() ?? "",
          monthlyPayment: d.monthlyPayment.toString(),
          repaymentGoalDate: d.repaymentGoalDate ?? ""
        }))
      : []
  );

  // Step 4 — Income & Plan
  const [netPay, setNetPay] = useState("");
  const [essential, setEssential] = useState(55);
  const [debtPct, setDebtPct] = useState(15);
  const [discretionary, setDiscretionary] = useState(20);
  const [savingsPct, setSavingsPct] = useState(10);

  // ─── Derived ─────────────────────────────────────────────────

  const ageNum = parseInt(currentAge);
  const retAgeNum = parseInt(targetRetirementAge);
  const yearsRemaining = !isNaN(ageNum) && !isNaN(retAgeNum) && retAgeNum > ageNum ? retAgeNum - ageNum : null;

  const allocTotal = essential + debtPct + discretionary + savingsPct;
  const allocValid = Math.abs(allocTotal - 100) < 0.5;

  const netPayNum = parseFloat(netPay) || 0;
  const monthlySavings = (netPayNum * savingsPct) / 100;

  const liveProjections = (() => {
    const validGoals = goals.filter(g => g.label.trim() && parseFloat(g.targetAmount) > 0);
    if (validGoals.length === 0 || netPayNum <= 0) return [];
    const fakeGoals: Goal[] = validGoals.map((g, i) => ({
      id: g.tempId,
      userId: "",
      organizationId: "",
      semesterId: "",
      label: g.label,
      goalType: g.goalType,
      targetAmount: parseFloat(g.targetAmount) || 0,
      savedToDate: 0,
      priorityOrder: i,
      createdAt: "",
      updatedAt: ""
    }));
    return projectGoals(fakeGoals, monthlySavings);
  })();

  // ─── Training ─────────────────────────────────────────────────

  function toggleTraining() {
    const next = !trainingActive;
    setTrainingActive(next);
    setTrainingCardIndex(0);
    localStorage.setItem("clarkfin_training_active", next ? "true" : "false");
    if (next && step === 0) setStep(1);
  }

  const currentTrainingCards = TRAINING[step] ?? [];
  const trainingCardVisible = trainingActive && trainingCardIndex < currentTrainingCards.length;
  const currentCard = currentTrainingCards[trainingCardIndex];

  function dismissTrainingCard() {
    if (trainingCardIndex < currentTrainingCards.length - 1) {
      setTrainingCardIndex(trainingCardIndex + 1);
    } else {
      setTrainingCardIndex(currentTrainingCards.length);
    }
  }

  function onStepChange(nextStep: number) {
    setError("");
    setTrainingCardIndex(0);
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ─── Step savers ──────────────────────────────────────────────

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
    const newGoals = goals.filter((g) => !g.savedId && g.label.trim());
    await Promise.all(
      newGoals.map(async (g) => {
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

  async function saveStep3() {
    const newDebts = debts.filter((d) => !d.savedId && d.label.trim());
    await Promise.all(
      newDebts.map(async (d) => {
        const res = await fetch("/api/student/debts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            semesterId,
            category: d.category,
            label: d.label.trim(),
            originalBalance: parseFloat(d.originalBalance) || 0,
            currentBalance: parseFloat(d.currentBalance) || 0,
            interestRate: parseFloat(d.interestRate) || 0,
            monthlyPayment: parseFloat(d.monthlyPayment) || 0,
            repaymentGoalDate: d.repaymentGoalDate || undefined,
            isCreditCard: d.category === "credit_card"
          })
        });
        if (!res.ok) {
          const data = await res.json() as { error?: string };
          throw new Error(data.error ?? "Failed to save a debt.");
        }
      })
    );
  }

  async function saveStep4() {
    if (!netPay || netPayNum <= 0) throw new Error("Enter your monthly net pay.");
    if (!allocValid) throw new Error(`Allocation must total 100% (currently ${allocTotal}%).`);

    const [allocRes, incomeRes] = await Promise.all([
      fetch("/api/student/allocation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semesterId, essentialPct: essential, debtPct, discretionaryPct: discretionary, savingsPct })
      }),
      fetch("/api/student/income-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semesterId,
          periodYear: 0,
          periodMonth: 0,
          periodWeek: 0,
          category: "gross_pay" as IncomeEntryCategory,
          label: "Monthly Net Pay",
          amount: netPayNum
        })
      })
    ]);

    if (!allocRes.ok) {
      const data = await allocRes.json() as { error?: string };
      throw new Error(data.error ?? "Failed to save allocation.");
    }
    if (!incomeRes.ok) {
      const data = await incomeRes.json() as { error?: string };
      throw new Error(data.error ?? "Failed to save income baseline.");
    }
  }

  // ─── Navigation ───────────────────────────────────────────────

  async function handleNext() {
    setError("");
    if (step === 0) {
      onStepChange(1);
      return;
    }
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
    if (step > 0) onStepChange(step - 1);
  }

  function handleSkip() {
    router.push("/app/student");
  }

  // ─── Goal helpers ─────────────────────────────────────────────

  const hasEmergencyFund = goals.some((g) => g.goalType === "emergency_fund");

  function addEmergencyFund() {
    setGoals([{ tempId: uid(), label: "Emergency Fund", goalType: "emergency_fund", targetAmount: "", targetDate: "" }, ...goals]);
  }

  function addGoal(type: GoalType = "short_term") {
    setGoals([...goals, { tempId: uid(), label: "", goalType: type, targetAmount: "", targetDate: "" }]);
  }

  function removeGoal(tempId: string) {
    setGoals(goals.filter((g) => g.tempId !== tempId));
  }

  function updateGoal(tempId: string, field: keyof GoalDraft, value: string) {
    setGoals(goals.map((g) => g.tempId === tempId ? { ...g, [field]: value } : g));
  }

  // ─── Debt helpers ─────────────────────────────────────────────

  function addDebt() {
    setDebts([...debts, {
      tempId: uid(), category: "credit_card", label: "Credit Card",
      originalBalance: "", currentBalance: "", interestRate: "20", monthlyPayment: "", repaymentGoalDate: ""
    }]);
  }

  function removeDebt(tempId: string) {
    setDebts(debts.filter((d) => d.tempId !== tempId));
  }

  function updateDebt(tempId: string, field: keyof DebtDraft, value: string) {
    setDebts(debts.map((d) => d.tempId === tempId ? { ...d, [field]: value } : d));
  }

  // ─── Render ───────────────────────────────────────────────────

  const progressPct = step > 0 ? (step / DATA_STEPS) * 100 : 0;

  const STEP_TITLES = ["", "Personal Profile", "Your Goals", "Your Debts", "Income & Plan"];
  const STEP_SUBS = [
    "",
    "Tell us about yourself so we can set up your financial picture.",
    "Define what you're saving toward. ClarkFin will project when you'll reach each one.",
    "Enter any debts you're carrying. Skip any that don't apply.",
    "Set your monthly net pay and savings rate. Your goal timelines appear as you type."
  ];

  return (
    <div className="wizard-shell">
      <header className="wizard-topbar">
        <div className="wizard-topbar-logo">ClarkFin</div>
        {step > 0 && (
          <button className="wizard-topbar-skip" onClick={handleSkip}>
            Finish later →
          </button>
        )}
      </header>

      {step > 0 && (
        <div className="wizard-progress-track">
          <div className="wizard-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      <main className="wizard-body">

        {/* ── Step 0: Welcome ── */}
        {step === 0 && (
          <div className="wizard-welcome">
            <div className="wizard-welcome-eyebrow">ClarkFin</div>
            <h1 className="wizard-welcome-title">Your financial future<br />starts here</h1>
            <p className="wizard-welcome-sub">
              Set up your plan in about 5 minutes. ClarkFin shows you exactly when you&apos;ll reach every goal you have.
            </p>
            <div className="wizard-tour-banner" style={{ maxWidth: 460, margin: "0 auto 20px" }}>
              <span className="wizard-tour-banner-icon">🎓</span>
              <p>New to personal finance? Turn on the guided tour — it explains every concept before you fill it in.</p>
              <button className={trainingActive ? "btn-secondary btn-sm" : "btn btn-sm"} onClick={toggleTraining}>
                {trainingActive ? "Tour on ✓" : "Start guided tour"}
              </button>
            </div>
            <button
              className="btn"
              style={{ width: "100%", maxWidth: 460, padding: "14px", fontSize: "1rem", display: "block", margin: "0 auto" }}
              onClick={handleNext}
            >
              Set Up My Plan →
            </button>
            <button
              className="wizard-topbar-skip"
              style={{ display: "block", margin: "14px auto 0", background: "none", border: "none", cursor: "pointer" }}
              onClick={handleSkip}
            >
              I&apos;ll do this later
            </button>
          </div>
        )}

        {/* ── Steps 1–4 ── */}
        {step > 0 && (
          <div className="wizard-card">
            <div className="wizard-step-header">
              <div className="wizard-step-counter">Step {step} of {DATA_STEPS} — {STEP_TITLES[step]}</div>
              <h1 className="wizard-step-title">{STEP_TITLES[step]}</h1>
              <p className="wizard-step-sub">{STEP_SUBS[step]}</p>
            </div>

            {step === 1 && (
              <div className="wizard-tour-banner">
                <span className="wizard-tour-banner-icon">🎓</span>
                <p>
                  {trainingActive
                    ? "Guided tour is on. Each step includes a brief explanation before the form fields appear."
                    : "New to personal finance? The guided tour explains each concept before you fill it in."}
                </p>
                <button className={trainingActive ? "btn-secondary btn-sm" : "btn btn-sm"} onClick={toggleTraining}>
                  {trainingActive ? "Exit Tour" : "Start Tour"}
                </button>
              </div>
            )}

            {trainingCardVisible && currentCard && (
              <div className="training-card">
                <div className="training-card-header">
                  <span className="training-card-icon">💡</span>
                  <span className="training-card-title">{currentCard.title}</span>
                </div>
                <p className="training-card-body">{currentCard.body}</p>
                <p className="training-card-example">{currentCard.example}</p>
                <div className="training-card-footer">
                  <span className="training-card-progress">{trainingCardIndex + 1} of {currentTrainingCards.length}</span>
                  <button className="training-got-it" onClick={dismissTrainingCard}>Got it →</button>
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
                    <label htmlFor="retirementAge">Retire at Age</label>
                    <input id="retirementAge" type="number" min="40" max="99" value={targetRetirementAge} onChange={(e) => setTargetRetirementAge(e.target.value)} placeholder="e.g. 65" />
                  </div>
                  <div className="field">
                    <label htmlFor="retirementTarget">Retirement Target ($)</label>
                    <input id="retirementTarget" type="text" inputMode="numeric" value={retirementNetWorthTarget} onChange={(e) => setRetirementNetWorthTarget(formatNumberWithCommas(e.target.value))} placeholder="e.g. 500,000" />
                  </div>
                </div>
                {yearsRemaining !== null && (
                  <div className="wizard-insight">
                    ✦ You have <strong>{yearsRemaining} years</strong> to build wealth. That&apos;s your biggest financial advantage — time beats income at this stage.
                  </div>
                )}
              </div>
            )}

            {/* ── Step 2: Goals ── */}
            {step === 2 && (
              <div className="stack">
                {!hasEmergencyFund && (
                  <div className="wizard-suggestion-card">
                    <span className="wizard-suggestion-icon">⚡</span>
                    <div className="wizard-suggestion-body">
                      <p>
                        <strong>Recommended first goal:</strong> An emergency fund (3–6 months of expenses) protects all your other goals from unexpected costs.
                      </p>
                      <button className="btn btn-sm" onClick={addEmergencyFund}>+ Add Emergency Fund</button>
                    </div>
                  </div>
                )}
                {goals.length === 0 && (
                  <p className="muted" style={{ textAlign: "center", padding: "8px 0" }}>
                    No goals yet. Add what you&apos;re saving toward below.
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
                      <div className="wizard-form-2col">
                        <div className="field">
                          <label>Target Amount ($)</label>
                          <input type="number" min="0" value={goal.targetAmount} onChange={(e) => updateGoal(goal.tempId, "targetAmount", e.target.value)} placeholder="0.00" />
                        </div>
                        <div className="field">
                          <label>Target Date <span className="field-hint">(optional)</span></label>
                          <input type="date" value={goal.targetDate} onChange={(e) => updateGoal(goal.tempId, "targetDate", e.target.value)} />
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

            {/* ── Step 3: Debts ── */}
            {step === 3 && (
              <div className="stack">
                {debts.length === 0 && (
                  <p className="muted" style={{ textAlign: "center", padding: "8px 0" }}>
                    No debts entered yet. Add any loans, credit cards, or other balances — or skip to the next step.
                  </p>
                )}
                <div className="wizard-item-list">
                  {debts.map((debt, i) => {
                    const isCreditCard = debt.category === "credit_card";
                    const warning = isCreditCard
                      ? calcCCWarning(
                          parseFloat(debt.currentBalance) || 0,
                          parseFloat(debt.interestRate) || 20,
                          parseFloat(debt.monthlyPayment) || 0
                        )
                      : null;

                    return (
                      <div key={debt.tempId} className="wizard-item-card">
                        <div className="wizard-item-card-header">
                          <span className="wizard-item-card-title">Debt {i + 1}</span>
                          <button className="btn-danger btn-sm" onClick={() => removeDebt(debt.tempId)}>Remove</button>
                        </div>
                        <div className="wizard-form-2col">
                          <div className="field">
                            <label>Type</label>
                            <select
                              value={debt.category}
                              onChange={(e) => {
                                const cat = e.target.value as DebtCategory;
                                updateDebt(debt.tempId, "category", cat);
                                if (cat === "credit_card" && !debt.interestRate) {
                                  updateDebt(debt.tempId, "interestRate", "20");
                                }
                              }}
                            >
                              <option value="student_loan">Student Loan</option>
                              <option value="credit_card">Credit Card</option>
                              <option value="car">Car Loan</option>
                              <option value="mortgage">Mortgage</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div className="field">
                            <label>Label</label>
                            <input type="text" value={debt.label} onChange={(e) => updateDebt(debt.tempId, "label", e.target.value)} placeholder="e.g. Discover Card" />
                          </div>
                        </div>
                        <div className="wizard-form-3col">
                          <div className="field">
                            <label>Current Balance ($)</label>
                            <input type="number" min="0" value={debt.currentBalance} onChange={(e) => updateDebt(debt.tempId, "currentBalance", e.target.value)} placeholder="0.00" />
                          </div>
                          <div className="field">
                            <label>Interest Rate (%)</label>
                            <input type="number" min="0" max="100" step="0.1" value={debt.interestRate} onChange={(e) => updateDebt(debt.tempId, "interestRate", e.target.value)} placeholder={isCreditCard ? "20" : "0"} />
                          </div>
                          <div className="field">
                            <label>Monthly Payment ($)</label>
                            <input type="number" min="0" value={debt.monthlyPayment} onChange={(e) => updateDebt(debt.tempId, "monthlyPayment", e.target.value)} placeholder="0.00" />
                          </div>
                        </div>
                        {warning && (
                          <div className="wizard-warn-strip">
                            ⚠ Minimum payments take <strong>{warning.minMonths} months</strong> and cost <strong>{fmt(warning.minInterest)}</strong> in interest.
                            {warning.pmtMonths !== null && ` Paying ${fmt(parseFloat(debt.monthlyPayment) || 0)}/mo clears this in ${warning.pmtMonths} months.`}
                          </div>
                        )}
                        <div className="field" style={{ marginTop: 8 }}>
                          <label>Pay-off Goal Date <span className="field-hint">(optional)</span></label>
                          <input type="date" value={debt.repaymentGoalDate} onChange={(e) => updateDebt(debt.tempId, "repaymentGoalDate", e.target.value)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button className="wizard-add-btn" onClick={addDebt}>+ Add a debt</button>
              </div>
            )}

            {/* ── Step 4: Income & Plan ── */}
            {step === 4 && (
              <div className="stack">
                <div className="wizard-form-card">
                  <div className="field">
                    <label htmlFor="netPay">
                      Monthly Net Pay
                      <span className="field-hint" style={{ marginLeft: 6 }}>after taxes, what hits your account</span>
                    </label>
                    <input
                      id="netPay"
                      type="number"
                      min="0"
                      value={netPay}
                      onChange={(e) => setNetPay(e.target.value)}
                      placeholder="e.g. 1800"
                      style={{ fontSize: "1.1rem" }}
                    />
                  </div>
                </div>

                <div className="wizard-form-card">
                  <div className="section-title" style={{ marginBottom: 10 }}>
                    How do you want to split it?
                    <span className="field-hint" style={{ marginLeft: 8 }}>
                      {!allocValid
                        ? <span style={{ color: "var(--danger)" }}>must total 100% · currently {allocTotal}%</span>
                        : <span style={{ color: "#0a9e74" }}>✓ totals 100%</span>
                      }
                    </span>
                  </div>
                  <div className="wizard-alloc-grid">
                    {([
                      { label: "Essential", value: essential, set: setEssential, hint: "rent, groceries, utilities" },
                      { label: "Debt", value: debtPct, set: setDebtPct, hint: "loan & card payments" },
                      { label: "Discretionary", value: discretionary, set: setDiscretionary, hint: "dining, entertainment" },
                      { label: "Savings", value: savingsPct, set: setSavingsPct, hint: "your goals" }
                    ] as Array<{ label: string; value: number; set: (v: number) => void; hint: string }>).map(({ label, value, set, hint }) => (
                      <div key={label} className={`wizard-alloc-box${label === "Savings" ? " wizard-alloc-box-active" : ""}`}>
                        <div className="wizard-alloc-label">{label}</div>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={value}
                          onChange={(e) => set(Number(e.target.value))}
                          className="wizard-alloc-input"
                        />
                        <div className="wizard-alloc-pct">%</div>
                        {netPayNum > 0 && (
                          <div className="wizard-alloc-amount">{fmt((netPayNum * value) / 100)}/mo</div>
                        )}
                        <div className="wizard-alloc-hint">{hint}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* The aha moment — live goal projections */}
                {liveProjections.length > 0 && (
                  <div className="wizard-form-card">
                    <div className="section-title" style={{ marginBottom: 10 }}>
                      At {savingsPct}% savings ({fmt(monthlySavings)}/mo), your goals:
                    </div>
                    <div className="stack-sm">
                      {liveProjections.map((proj) => (
                        <div key={proj.goalId} className="wizard-projection-row">
                          <span className="wizard-projection-label">{proj.label}</span>
                          <span
                            className="wizard-projection-date"
                            style={{ color: proj.projectedDate ? "#0a9e74" : "var(--muted)" }}
                          >
                            {proj.projectedDate ? formatProjectedDate(proj.projectedDate) : "set a target amount"}
                          </span>
                        </div>
                      ))}
                    </div>
                    {savingsPct < 15 && netPayNum > 0 && liveProjections.length > 0 && (
                      <p className="wizard-projection-nudge">
                        Save {savingsPct + 5}% instead ({fmt((netPayNum * (savingsPct + 5)) / 100)}/mo) and every goal arrives sooner.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && <p className="wizard-error">{error}</p>}
          </div>
        )}
      </main>

      {step > 0 && (
        <footer className="wizard-footer">
          <div className="wizard-footer-left">
            <div className="wizard-step-dots">
              {Array.from({ length: DATA_STEPS }, (_, i) => (
                <div
                  key={i}
                  className={`wizard-step-dot ${i + 1 === step ? "wizard-step-dot-active" : i + 1 < step ? "wizard-step-dot-done" : ""}`}
                />
              ))}
            </div>
          </div>
          <div className="wizard-footer-right">
            <button className="btn-secondary" onClick={handleBack} disabled={saving}>
              ← Back
            </button>
            <button
              className="btn"
              onClick={handleNext}
              disabled={saving || (step === DATA_STEPS && !allocValid)}
            >
              {saving ? "Saving…" : step === DATA_STEPS ? "See My Dashboard 🚀" : "Next →"}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
