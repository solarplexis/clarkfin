export type UserRole = "ADMIN" | "ORG_ADMIN" | "STUDENT";

export type ActivityModule = "auth" | "budget" | "debt" | "system";

export type ActivityStatus = "draft" | "completed" | "system";

export interface Organization {
  orgId: string;
  name: string;
  apiKeyHash: string;
  apiKeyPreview?: string;
  settings?: {
    allowedEmailDomains?: string[];
    brandColor?: string;
    logoUrl?: string;
    supportEmail?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface Semester {
  semesterId: string;
  orgId: string;
  title: string;
  courseCode: string;
  isActive: boolean;
  durationWeeks: number;
  startsAt?: string;
  endsAt?: string;
  status?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type StudentStatus = "prospect" | "invited" | "active" | "inactive";

export interface StudentRecord {
  studentId: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  authUserId?: string;
  status: StudentStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type InviteStatus = "pending" | "redeemed" | "revoked";

export interface StudentInvite {
  inviteId: string;
  inviteCode: string;
  studentId: string;
  organizationId: string;
  semesterId: string;
  studentEmail: string;
  studentFirstName: string;
  studentLastName: string;
  status: InviteStatus;
  createdByUid: string;
  redeemedByUid?: string;
  createdAt?: string;
  updatedAt?: string;
  redeemedAt?: string;
}

export type EnrollmentStatus = "enrolled" | "completed" | "withdrawn";

export interface StudentEnrollment {
  enrollmentId: string;
  userId: string;
  organizationId: string;
  semesterId: string;
  inviteId?: string;
  studentEmail: string;
  status: EnrollmentStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: UserRole;
  organizationId?: string;
  activeSemesterId?: string;
  currentAge?: number;
  targetRetirementAge?: number;
  retirementNetWorthTarget?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  organizationId: string;
  semesterId: string;
  module: ActivityModule;
  action: string;
  status: ActivityStatus;
  summary: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export type BudgetFrequency = "monthly" | "weekly" | "biweekly" | "semimonthly" | "annual";

export interface BudgetItem {
  id: string;
  label: string;
  amount: number;
  frequency: BudgetFrequency;
}

export interface BudgetDraft {
  id: string;
  userId: string;
  organizationId: string;
  semesterId: string;
  income: BudgetItem[];
  savings: BudgetItem[];
  expenses: BudgetItem[];
  notes: string;
  monthlyBalance: number;
  isFinal: boolean;
  updatedAt: string;
}

export interface ActualItem {
  id: string;
  label: string;
  /** Monthly dollar amount actually received / spent / saved */
  amount: number;
  /** ISO date string for when this item occurred, e.g. "2026-03-15".
   *  Required for income and expense items to enable monthly milestone tracking.
   *  Optional for savings. */
  date?: string;
  /** Spending category for grouping and budget comparison (expenses only) */
  category?: string;
}

export interface BudgetActuals {
  id: string;
  userId: string;
  organizationId: string;
  semesterId: string;
  actualIncome: ActualItem[];
  actualSavings: ActualItem[];
  actualExpenses: ActualItem[];
  notes: string;
  updatedAt: string;
}

export interface DebtScenario {
  id: string;
  userId: string;
  organizationId: string;
  semesterId: string;
  debtName: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
  plannedPayment: number;
  payoffMonths: number;
  totalInterest: number;
  notes: string;
  isFinal: boolean;
  updatedAt: string;
}

export interface ExportRecord {
  logId: string;
  occurredAt: string;
  organizationId: string;
  organizationName: string;
  semesterId: string;
  semesterTitle: string;
  courseCode: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  module: ActivityModule;
  action: string;
  status: ActivityStatus;
  summary: string;
  payload: Record<string, unknown>;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatConversation {
  id: string;
  userId: string;
  organizationId: string;
  semesterId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationCreationResult {
  organization: Organization;
  orgAdmin: Pick<UserProfile, "uid" | "fullName" | "email" | "role" | "organizationId">;
  apiKey: string;
}

// ─── Goals ────────────────────────────────────────────────────

export type GoalType = "short_term" | "long_term" | "emergency_fund" | "retirement";

export interface Goal {
  id: string;
  userId: string;
  organizationId: string;
  semesterId: string;
  label: string;
  goalType: GoalType;
  targetAmount: number;
  targetDate?: string;
  savedToDate: number;
  priorityOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Debts ────────────────────────────────────────────────────

export type DebtCategory = "student_loan" | "mortgage" | "credit_card" | "car" | "other";

export interface Debt {
  id: string;
  userId: string;
  organizationId: string;
  semesterId: string;
  category: DebtCategory;
  label: string;
  originalBalance: number;
  currentBalance: number;
  monthlyPayment: number;
  /** Annual interest rate as a percentage, e.g. 5.5 for 5.5%. */
  interestRate: number;
  repaymentGoalDate?: string;
  isCreditCard: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Income Statement entries ─────────────────────────────────

export type IncomeEntryCategory = "gross_pay" | "taxes" | "bonus" | "interest" | "other";

export interface IncomeEntry {
  id: string;
  userId: string;
  organizationId: string;
  semesterId: string;
  /** Calendar year, e.g. 2026. Use 0 for the Month 0 baseline. */
  periodYear: number;
  /** Calendar month 1–12. Use 0 for the Month 0 baseline. */
  periodMonth: number;
  /** 0 = whole-month entry; 1–4 = week number. */
  periodWeek: number;
  category: IncomeEntryCategory;
  label: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Expense Statement entries ────────────────────────────────

export type ExpenseCategory = "essential" | "debt" | "discretionary";

export interface ExpenseEntry {
  id: string;
  userId: string;
  organizationId: string;
  semesterId: string;
  periodYear: number;
  periodMonth: number;
  periodWeek: number;
  category: ExpenseCategory;
  label: string;
  amount: number;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Assets ───────────────────────────────────────────────────

export type AssetCategory = "liquid" | "investment" | "property" | "retirement" | "other";

export interface Asset {
  id: string;
  userId: string;
  organizationId: string;
  semesterId: string;
  category: AssetCategory;
  label: string;
  currentValue: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Allocation Target ────────────────────────────────────────

export interface AllocationTarget {
  id: string;
  userId: string;
  organizationId: string;
  semesterId: string;
  /** All four percentages must sum to 100. */
  essentialPct: number;
  debtPct: number;
  discretionaryPct: number;
  savingsPct: number;
  updatedAt: string;
}
