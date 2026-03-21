'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/components/AuthProvider';
import { useFirestore } from '@/hooks/useFirestore';
import NavBar from '@/components/NavBar';
import DebtChart from '@/components/DebtChart';
import { formatCurrency, formatPercentage } from '@/lib/utils/format';
import {
  calculatePayoffMonths,
  calculateTotalInterest,
  calculateMonthlyPayment,
} from '@/lib/utils/calculations';

export const dynamic = 'force-dynamic';

/** Maximum months used to estimate total interest when loan never pays off (30 years). */
const MAX_PAYOFF_MONTHS = 360;

export default function DebtPage() {
  const { user, loading } = useAuthContext();
  const router = useRouter();
  const { logActivity, saveDebtSimulation } = useFirestore();

  const [principal, setPrincipal] = useState('');
  const [annualRate, setAnnualRate] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [loanType, setLoanType] = useState<'credit_card' | 'student_loan'>('credit_card');
  const [result, setResult] = useState<{
    payoffMonths: number;
    totalInterest: number;
    suggestedPayment: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    logActivity('DEBT_SIM_VIEW', {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    const p = parseFloat(principal);
    const r = parseFloat(annualRate);
    const mp = parseFloat(monthlyPayment);

    const payoffMonths = calculatePayoffMonths(p, r, mp);
    const totalInterest = calculateTotalInterest(p, r, payoffMonths === Infinity ? MAX_PAYOFF_MONTHS : payoffMonths);
    const suggestedPayment = calculateMonthlyPayment(p, r, 60);

    setResult({ payoffMonths, totalInterest, suggestedPayment });
  }

  async function handleSave() {
    if (!result) return;
    const p = parseFloat(principal);
    const r = parseFloat(annualRate);
    const mp = parseFloat(monthlyPayment);

    setSaving(true);
    const sim = {
      principal: p,
      annualRate: r,
      monthlyPayment: mp,
      loanType,
      payoffMonths: result.payoffMonths === Infinity ? -1 : result.payoffMonths,
      totalInterest: result.totalInterest,
    };
    await saveDebtSimulation(sim);
    await logActivity('DEBT_SIM_CREATED', sim);
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Debt Simulator</h1>

        <form onSubmit={handleCalculate} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Loan Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Principal ($)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="10000"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Annual Interest Rate (%)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="18.99"
                value={annualRate}
                onChange={(e) => setAnnualRate(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Monthly Payment ($)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="250"
                value={monthlyPayment}
                onChange={(e) => setMonthlyPayment(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Loan Type</label>
              <select
                value={loanType}
                onChange={(e) => setLoanType(e.target.value as 'credit_card' | 'student_loan')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="credit_card">Credit Card</option>
                <option value="student_loan">Student Loan</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            Calculate
          </button>
        </form>

        {result && (
          <div className="space-y-5">
            {/* Result summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
                <p className="text-xs text-gray-500 uppercase font-medium mb-1">Payoff Time</p>
                <p className="text-xl font-bold text-blue-700">
                  {result.payoffMonths === Infinity
                    ? '∞'
                    : `${result.payoffMonths} mo`}
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
                <p className="text-xs text-gray-500 uppercase font-medium mb-1">Total Interest</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(result.totalInterest)}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
                <p className="text-xs text-gray-500 uppercase font-medium mb-1">Suggested (60 mo)</p>
                <p className="text-xl font-bold text-green-700">{formatCurrency(result.suggestedPayment)}/mo</p>
              </div>
            </div>

            {result.payoffMonths === Infinity && (
              <div className="bg-orange-50 border border-orange-200 text-orange-800 text-sm px-4 py-3 rounded-xl">
                ⚠️ Your monthly payment doesn&apos;t cover the interest. You&apos;ll never pay off this loan at this rate. Consider increasing your payment to at least {formatCurrency(result.suggestedPayment)}/mo.
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">
                  Payoff Schedule{' '}
                  <span className="text-gray-400 font-normal">(first 12 months)</span>
                </h2>
                <p className="text-xs text-gray-500">
                  {formatPercentage(parseFloat(annualRate))} APR
                </p>
              </div>
              <DebtChart
                principal={parseFloat(principal)}
                annualRate={parseFloat(annualRate)}
                monthlyPayment={parseFloat(monthlyPayment)}
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-gray-800 hover:bg-gray-900 text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Simulation'}
            </button>
          </div>
        )}
      </main>
    </>
  );
}
