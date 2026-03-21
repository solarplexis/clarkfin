'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/components/AuthProvider';
import { useFirestore } from '@/hooks/useFirestore';
import NavBar from '@/components/NavBar';
import BudgetCard from '@/components/BudgetCard';
import { BudgetEntry } from '@/types';
import { formatCurrency } from '@/lib/utils/format';
import { calculateBudgetSummary } from '@/lib/utils/calculations';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['Housing', 'Food', 'Transport', 'Entertainment', 'Healthcare', 'Education', 'Income', 'Other'];

export default function BudgetPage() {
  const { user, loading } = useAuthContext();
  const router = useRouter();
  const { logActivity, getBudgetEntries, saveBudgetEntry, deleteBudgetEntry } = useFirestore();

  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [fetching, setFetching] = useState(true);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setFetching(true);
      const data = await getBudgetEntries();
      setEntries(data);
      setFetching(false);
      await logActivity('BUDGET_VIEW', {});
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!description || !amount) return;
    setSaving(true);
    const entry = {
      description,
      amount: parseFloat(amount),
      type,
      category,
    };
    await saveBudgetEntry(entry);
    await logActivity('BUDGET_ENTRY_ADDED', entry);
    const updated = await getBudgetEntries();
    setEntries(updated);
    setDescription('');
    setAmount('');
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await deleteBudgetEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const summary = calculateBudgetSummary(entries);

  if (loading || fetching) {
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Budget Tracker</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-xs text-green-600 font-medium uppercase mb-1">Income</p>
            <p className="text-xl font-bold text-green-700">{formatCurrency(summary.totalIncome)}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-xs text-red-600 font-medium uppercase mb-1">Expenses</p>
            <p className="text-xl font-bold text-red-700">{formatCurrency(summary.totalExpenses)}</p>
          </div>
          <div className={`border rounded-xl p-4 text-center ${summary.netIncome >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
            <p className={`text-xs font-medium uppercase mb-1 ${summary.netIncome >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Net</p>
            <p className={`text-xl font-bold ${summary.netIncome >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{formatCurrency(summary.netIncome)}</p>
          </div>
        </div>

        {/* Add entry form */}
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Add Entry</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <input
                type="text"
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <input
              type="number"
              placeholder="Amount"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'income' | 'expense')}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add Entry'}
          </button>
        </form>

        {/* Entries list */}
        <div className="space-y-2">
          {entries.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No entries yet. Add your first budget item above.</p>
          ) : (
            entries.map((entry) => (
              <BudgetCard key={entry.id} entry={entry} onDelete={handleDelete} />
            ))
          )}
        </div>
      </main>
    </>
  );
}
