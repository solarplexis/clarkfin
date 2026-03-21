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
  role: UserRole;
  organizationId?: string;
  activeSemesterId?: string;
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

export interface BudgetItem {
  id: string;
  label: string;
  amount: number;
}

export interface BudgetDraft {
  id: string;
  userId: string;
  organizationId: string;
  semesterId: string;
  income: BudgetItem[];
  expenses: BudgetItem[];
  notes: string;
  monthlyBalance: number;
  isFinal: boolean;
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

export interface OrganizationCreationResult {
  organization: Organization;
  orgAdmin: Pick<UserProfile, "uid" | "fullName" | "email" | "role" | "organizationId">;
  apiKey: string;
}
