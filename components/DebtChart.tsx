'use client';

import { formatCurrency } from '@/lib/utils/format';

interface DebtChartProps {
  principal: number;
  annualRate: number;
  monthlyPayment: number;
}

interface ScheduleRow {
  month: number;
  openingBalance: number;
  interestPaid: number;
  principalPaid: number;
  closingBalance: number;
}

function buildSchedule(
  principal: number,
  annualRate: number,
  monthlyPayment: number,
  maxMonths: number
): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  const monthlyRate = annualRate / 100 / 12;
  let balance = principal;

  for (let month = 1; month <= maxMonths && balance > 0; month++) {
    const interest = monthlyRate > 0 ? balance * monthlyRate : 0;
    const payment = Math.min(monthlyPayment, balance + interest);
    const principalPaid = payment - interest;
    const closing = Math.max(0, balance - principalPaid);

    rows.push({
      month,
      openingBalance: balance,
      interestPaid: interest,
      principalPaid,
      closingBalance: closing,
    });

    balance = closing;
  }

  return rows;
}

export default function DebtChart({ principal, annualRate, monthlyPayment }: DebtChartProps) {
  if (principal <= 0 || monthlyPayment <= 0) return null;

  const schedule = buildSchedule(principal, annualRate, monthlyPayment, 12);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Month</th>
            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Balance</th>
            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Interest</th>
            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Principal</th>
            <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Remaining</th>
          </tr>
        </thead>
        <tbody>
          {schedule.map((row) => (
            <tr key={row.month} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-2 text-gray-700">{row.month}</td>
              <td className="px-3 py-2 text-gray-700">{formatCurrency(row.openingBalance)}</td>
              <td className="px-3 py-2 text-red-600">{formatCurrency(row.interestPaid)}</td>
              <td className="px-3 py-2 text-green-600">{formatCurrency(row.principalPaid)}</td>
              <td className="px-3 py-2 text-gray-700">{formatCurrency(row.closingBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {schedule.length === 12 && schedule[11].closingBalance > 0 && (
        <p className="text-xs text-gray-400 mt-2">Showing first 12 months of payoff schedule.</p>
      )}
    </div>
  );
}
