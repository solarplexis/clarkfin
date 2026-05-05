import type { AllocationTarget, Debt, Goal, IncomeEntry } from "@/types/domain";

// ─── Output types ───────────────────────────────────────────────

export type GoalProjection = {
  goalId: string;
  label: string;
  goalType: string;
  targetAmount: number;
  savedToDate: number;
  progressPct: number;
  monthlyContribution: number;
  monthsRemaining: number | null;
  projectedDate: string | null;
  /** null when goal has no targetDate */
  isOnTrack: boolean | null;
};

export type DebtProjection = {
  debtId: string;
  label: string;
  category: string;
  isCreditCard: boolean;
  currentBalance: number;
  monthlyPayment: number;
  interestRate: number;
  monthsToPayoff: number;
  projectedPayoffDate: string;
  totalInterestPaid: number;
  /** Only present for credit cards with interestRate > 0 */
  minPaymentWarning?: {
    minPayment: number;
    minPaymentMonths: number;
    minPaymentInterest: number;
    interestSaved: number;
  };
};

export type RetirementProjection = {
  currentAge: number;
  retirementAge: number;
  yearsRemaining: number;
  targetNetWorth: number;
  currentNetWorth: number;
  monthlyContribution: number;
  projectedNetWorth: number;
  isOnTrack: boolean;
  requiredMonthlySavings: number;
  requiredSavingsRate: number;
};

export type TimelineResult = {
  netPayMonthly: number;
  monthlySavings: number;
  goals: GoalProjection[];
  debts: DebtProjection[];
  retirement: RetirementProjection | null;
};

// ─── Core math ──────────────────────────────────────────────────

/** Months to pay off a balance with optional compound interest. */
function payoffMonths(balance: number, payment: number, annualRatePct: number): number {
  if (balance <= 0) return 0;
  if (payment <= 0) return Infinity;

  const r = annualRatePct / 100 / 12;
  if (r < 0.0001) return Math.ceil(balance / payment);

  // Standard amortization: n = -ln(1 - r·B/P) / ln(1 + r)
  const inside = 1 - (r * balance) / payment;
  if (inside <= 0) return Infinity; // payment doesn't cover interest
  return Math.ceil(-Math.log(inside) / Math.log(1 + r));
}

function totalInterest(balance: number, payment: number, months: number): number {
  if (!isFinite(months)) return Infinity;
  return Math.max(0, payment * months - balance);
}

function addMonths(months: number): string {
  if (!isFinite(months)) return "—";
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 7); // YYYY-MM
}

// ─── Net pay from baseline entries ─────────────────────────────

export function calcNetPayFromBaseline(entries: IncomeEntry[]): number {
  let gross = 0;
  let taxes = 0;
  for (const e of entries) {
    if (e.category === "gross_pay") gross += e.amount;
    if (e.category === "taxes") taxes += e.amount;
  }
  return Math.max(0, gross - taxes);
}

// ─── Goal projections ───────────────────────────────────────────

export function projectGoals(goals: Goal[], monthlySavings: number): GoalProjection[] {
  const sorted = [...goals].sort((a, b) => a.priorityOrder - b.priorityOrder);
  const projections: GoalProjection[] = [];
  let cumulativeMonths = 0;

  for (const goal of sorted) {
    const remaining = Math.max(0, goal.targetAmount - goal.savedToDate);
    const progressPct =
      goal.targetAmount > 0
        ? Math.min(100, (goal.savedToDate / goal.targetAmount) * 100)
        : 0;

    if (remaining === 0) {
      projections.push({
        goalId: goal.id,
        label: goal.label,
        goalType: goal.goalType,
        targetAmount: goal.targetAmount,
        savedToDate: goal.savedToDate,
        progressPct: 100,
        monthlyContribution: 0,
        monthsRemaining: 0,
        projectedDate: null,
        isOnTrack: true
      });
      continue;
    }

    if (monthlySavings <= 0) {
      projections.push({
        goalId: goal.id,
        label: goal.label,
        goalType: goal.goalType,
        targetAmount: goal.targetAmount,
        savedToDate: goal.savedToDate,
        progressPct,
        monthlyContribution: 0,
        monthsRemaining: null,
        projectedDate: null,
        isOnTrack: null
      });
      continue;
    }

    const monthsForThis = Math.ceil(remaining / monthlySavings);
    cumulativeMonths += monthsForThis;
    const projectedDate = addMonths(cumulativeMonths);

    let isOnTrack: boolean | null = null;
    if (goal.targetDate) {
      const targetMs = new Date(goal.targetDate).getTime();
      const projectedMs = new Date(projectedDate + "-01").getTime();
      isOnTrack = projectedMs <= targetMs;
    }

    projections.push({
      goalId: goal.id,
      label: goal.label,
      goalType: goal.goalType,
      targetAmount: goal.targetAmount,
      savedToDate: goal.savedToDate,
      progressPct,
      monthlyContribution: monthlySavings,
      monthsRemaining: monthsForThis,
      projectedDate,
      isOnTrack
    });
  }

  return projections;
}

// ─── Debt projections ───────────────────────────────────────────

export function projectDebts(debts: Debt[]): DebtProjection[] {
  return debts.map((debt) => {
    const months = payoffMonths(debt.currentBalance, debt.monthlyPayment, debt.interestRate);
    const interest = isFinite(months) ? totalInterest(debt.currentBalance, debt.monthlyPayment, months) : 0;

    const proj: DebtProjection = {
      debtId: debt.id,
      label: debt.label,
      category: debt.category,
      isCreditCard: debt.isCreditCard,
      currentBalance: debt.currentBalance,
      monthlyPayment: debt.monthlyPayment,
      interestRate: debt.interestRate,
      monthsToPayoff: isFinite(months) ? months : 0,
      projectedPayoffDate: addMonths(months),
      totalInterestPaid: interest
    };

    if (debt.isCreditCard && debt.interestRate > 0) {
      const minPayment = Math.max(25, debt.currentBalance * 0.02);
      const minMonths = payoffMonths(debt.currentBalance, minPayment, debt.interestRate);
      const minInterest = isFinite(minMonths)
        ? totalInterest(debt.currentBalance, minPayment, minMonths)
        : 0;

      if (debt.monthlyPayment <= minPayment * 1.1) {
        proj.minPaymentWarning = {
          minPayment,
          minPaymentMonths: isFinite(minMonths) ? minMonths : 0,
          minPaymentInterest: minInterest,
          interestSaved: Math.max(0, minInterest - interest)
        };
      }
    }

    return proj;
  });
}

// ─── Retirement projection ──────────────────────────────────────

export function projectRetirement(
  currentAge: number,
  retirementAge: number,
  targetNetWorth: number,
  currentNetWorth: number,
  monthlySavings: number,
  netPayMonthly: number
): RetirementProjection {
  const yearsRemaining = Math.max(0, retirementAge - currentAge);
  const monthsRemaining = yearsRemaining * 12;
  const projectedNetWorth = currentNetWorth + monthlySavings * monthsRemaining;
  const isOnTrack = projectedNetWorth >= targetNetWorth;

  const gap = Math.max(0, targetNetWorth - currentNetWorth);
  const requiredMonthlySavings = monthsRemaining > 0 ? gap / monthsRemaining : 0;
  const requiredSavingsRate =
    netPayMonthly > 0 ? (requiredMonthlySavings / netPayMonthly) * 100 : 0;

  return {
    currentAge,
    retirementAge,
    yearsRemaining,
    targetNetWorth,
    currentNetWorth,
    monthlyContribution: monthlySavings,
    projectedNetWorth,
    isOnTrack,
    requiredMonthlySavings,
    requiredSavingsRate
  };
}

// ─── Full recalculation ─────────────────────────────────────────

export function runTimeline({
  baselineEntries,
  goals,
  debts,
  allocationTarget,
  currentAge,
  targetRetirementAge,
  retirementNetWorthTarget,
  currentNetWorth,
  savingsPctOverride
}: {
  baselineEntries: IncomeEntry[];
  goals: Goal[];
  debts: Debt[];
  allocationTarget: AllocationTarget | null;
  currentAge: number;
  targetRetirementAge?: number;
  retirementNetWorthTarget?: number;
  currentNetWorth: number;
  savingsPctOverride?: number;
}): TimelineResult {
  const netPayMonthly = calcNetPayFromBaseline(baselineEntries);
  const savingsPct =
    savingsPctOverride !== undefined
      ? savingsPctOverride
      : (allocationTarget?.savingsPct ?? 0);
  const monthlySavings = (netPayMonthly * savingsPct) / 100;

  const nonRetirementGoals = goals.filter(g => g.goalType !== "retirement");
  const goalProjections = projectGoals(nonRetirementGoals, monthlySavings);
  const debtProjections = projectDebts(debts);

  let retirement: RetirementProjection | null = null;
  if (targetRetirementAge && retirementNetWorthTarget && currentAge) {
    retirement = projectRetirement(
      currentAge,
      targetRetirementAge,
      retirementNetWorthTarget,
      currentNetWorth,
      monthlySavings,
      netPayMonthly
    );
  }

  return { netPayMonthly, monthlySavings, goals: goalProjections, debts: debtProjections, retirement };
}
