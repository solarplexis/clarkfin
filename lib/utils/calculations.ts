import { BudgetEntry } from '@/types';

export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  months: number
): number {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate === 0) return principal / months;

  const monthlyRate = annualRate / 100 / 12;
  return (
    (principal * (monthlyRate * Math.pow(1 + monthlyRate, months))) /
    (Math.pow(1 + monthlyRate, months) - 1)
  );
}

export function calculatePayoffMonths(
  principal: number,
  annualRate: number,
  monthlyPayment: number
): number {
  if (principal <= 0) return 0;
  if (annualRate === 0) {
    if (monthlyPayment <= 0) return Infinity;
    return Math.ceil(principal / monthlyPayment);
  }

  const monthlyRate = annualRate / 100 / 12;
  const minPayment = principal * monthlyRate;

  if (monthlyPayment <= minPayment) return Infinity;

  return Math.ceil(
    -Math.log(1 - (principal * monthlyRate) / monthlyPayment) /
      Math.log(1 + monthlyRate)
  );
}

export function calculateTotalInterest(
  principal: number,
  annualRate: number,
  months: number
): number {
  if (principal <= 0 || months <= 0) return 0;
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, months);
  return Math.max(0, monthlyPayment * months - principal);
}

export function calculateBudgetSummary(entries: BudgetEntry[]): {
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
} {
  const totalIncome = entries
    .filter((e) => e.type === 'income')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalExpenses = entries
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + e.amount, 0);

  return { totalIncome, totalExpenses, netIncome: totalIncome - totalExpenses };
}
