import { Timestamp } from 'firebase/firestore';

export interface Organization {
  id: string;
  name: string;
  createdAt: Timestamp;
}

export interface Semester {
  id: string;
  orgId: string;
  name: string;
  startDate: Timestamp;
  endDate: Timestamp;
  createdAt: Timestamp;
}

export interface User {
  uid: string;
  email: string;
  role: 'ADMIN' | 'STUDENT';
  organizationId: string;
  semesterId: string;
  createdAt: Timestamp;
}

export interface ActivityLog {
  id: string;
  studentId: string;
  semesterId: string;
  orgId: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: Timestamp;
}

export interface BudgetEntry {
  id: string;
  userId: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  createdAt: Timestamp;
}

export interface DebtSimulation {
  id: string;
  userId: string;
  principal: number;
  annualRate: number;
  monthlyPayment: number;
  loanType: 'credit_card' | 'student_loan';
  payoffMonths: number;
  totalInterest: number;
  createdAt: Timestamp;
}
