'use client';

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { BudgetEntry, DebtSimulation } from '@/types';

export function useFirestore() {
  const { user, organizationId, semesterId } = useAuth();

  async function logActivity(type: string, data: Record<string, unknown>) {
    if (!user || !organizationId || !semesterId) return;
    await addDoc(collection(db!, 'activity_logs'), {
      studentId: user.uid,
      semesterId,
      orgId: organizationId,
      type,
      data,
      timestamp: serverTimestamp(),
    });
  }

  async function getBudgetEntries(): Promise<BudgetEntry[]> {
    if (!user) return [];
    const q = query(
      collection(db!, 'budget_entries'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as BudgetEntry));
  }

  async function saveBudgetEntry(
    entry: Omit<BudgetEntry, 'id' | 'userId' | 'createdAt'>
  ) {
    if (!user) return;
    await addDoc(collection(db!, 'budget_entries'), {
      ...entry,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });
  }

  async function deleteBudgetEntry(id: string) {
    await deleteDoc(doc(db!, 'budget_entries', id));
  }

  async function getDebtSimulations(): Promise<DebtSimulation[]> {
    if (!user) return [];
    const q = query(
      collection(db!, 'debt_simulations'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DebtSimulation));
  }

  async function saveDebtSimulation(
    sim: Omit<DebtSimulation, 'id' | 'userId' | 'createdAt'>
  ) {
    if (!user) return;
    await addDoc(collection(db!, 'debt_simulations'), {
      ...sim,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });
  }

  return {
    logActivity,
    getBudgetEntries,
    saveBudgetEntry,
    deleteBudgetEntry,
    getDebtSimulations,
    saveDebtSimulation,
  };
}
