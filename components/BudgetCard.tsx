'use client';

import { BudgetEntry } from '@/types';
import { formatCurrency } from '@/lib/utils/format';

interface BudgetCardProps {
  entry: BudgetEntry;
  onDelete: (id: string) => void;
}

export default function BudgetCard({ entry, onDelete }: BudgetCardProps) {
  return (
    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
      <div className="flex items-center gap-4">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
          {entry.category}
        </span>
        <span className="text-sm text-gray-800">{entry.description}</span>
      </div>
      <div className="flex items-center gap-4">
        <span
          className={`text-sm font-semibold ${
            entry.type === 'income' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {entry.type === 'income' ? '+' : '-'}
          {formatCurrency(entry.amount)}
        </span>
        <button
          onClick={() => onDelete(entry.id)}
          className="text-gray-400 hover:text-red-500 transition-colors text-xs"
          aria-label="Delete entry"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
