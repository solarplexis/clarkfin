import { FieldValue, Timestamp } from "firebase-admin/firestore";

import type {
  ActivityLog,
  BudgetDraft,
  DebtScenario,
  ExportRecord,
  Organization,
  OrganizationCreationResult,
  Semester,
  UserProfile
} from "@/types/domain";
import { getAdminDb } from "@/src/lib/firebase/admin";
import {
  generateApiKey,
  generateInviteCode,
  previewSecret,
  sha256
} from "@/src/lib/security/hash";

function toIso(value: unknown) {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return new Date().toISOString();
}

function mapDoc<T>(id: string, data: Record<string, unknown>) {
  return {
    id,
    ...data
  } as T;
}

export async function getUserProfileById(uid: string) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb.collection("users").doc(uid).get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as Record<string, unknown>;

  return {
    uid: snapshot.id,
    email: String(data.email ?? ""),
    fullName: String(data.fullName ?? ""),
    role: data.role as UserProfile["role"],
    organizationId: data.organizationId ? String(data.organizationId) : undefined,
    semesterId: data.semesterId ? String(data.semesterId) : undefined,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt)
  } satisfies UserProfile;
}

export async function hasSystemAdmin() {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("users")
    .where("role", "==", "ADMIN")
    .limit(1)
    .get();

  return !snapshot.empty;
}

export async function listOrganizations() {
  const adminDb = getAdminDb();
  const snapshot = await adminDb.collection("organizations").orderBy("name").get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();

    return {
      orgId: doc.id,
      name: String(data.name ?? ""),
      apiKeyHash: String(data.apiKeyHash ?? ""),
      apiKeyPreview: data.apiKeyPreview ? String(data.apiKeyPreview) : undefined,
      settings: (data.settings ?? {}) as Organization["settings"],
      createdAt: toIso(data.createdAt),
      updatedAt: toIso(data.updatedAt)
    } satisfies Organization;
  });
}

export async function createOrganizationWithDefaultOrgAdmin(input: {
  orgId: string;
  name: string;
  orgAdminUid: string;
  orgAdminEmail: string;
  orgAdminFullName: string;
  supportEmail?: string;
  allowedEmailDomains?: string[];
  brandColor?: string;
}) {
  const adminDb = getAdminDb();
  const organizationRef = adminDb.collection("organizations").doc(input.orgId);
  const existingOrganization = await organizationRef.get();

  if (existingOrganization.exists) {
    throw new Error("An organization with that org ID already exists.");
  }

  const apiKey = generateApiKey();
  const organization: Organization = {
    orgId: input.orgId,
    name: input.name,
    apiKeyHash: sha256(apiKey),
    apiKeyPreview: previewSecret(apiKey),
    settings: {
      allowedEmailDomains: input.allowedEmailDomains?.filter(Boolean) ?? [],
      brandColor: input.brandColor || undefined,
      supportEmail: input.supportEmail || undefined
    }
  };

  await organizationRef.set({
    ...organization,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  await createUserProfile({
    uid: input.orgAdminUid,
    email: input.orgAdminEmail,
    fullName: input.orgAdminFullName,
    role: "ORG_ADMIN",
    organizationId: input.orgId
  });

  return {
    organization,
    orgAdmin: {
      uid: input.orgAdminUid,
      fullName: input.orgAdminFullName,
      email: input.orgAdminEmail,
      role: "ORG_ADMIN",
      organizationId: input.orgId
    },
    apiKey
  } satisfies OrganizationCreationResult;
}

export async function getOrganizationById(orgId: string) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb.collection("organizations").doc(orgId).get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as Record<string, unknown>;

  return {
    orgId: snapshot.id,
    name: String(data.name ?? ""),
    apiKeyHash: String(data.apiKeyHash ?? ""),
    apiKeyPreview: data.apiKeyPreview ? String(data.apiKeyPreview) : undefined,
    settings: (data.settings ?? {}) as Organization["settings"],
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt)
  } satisfies Organization;
}

export async function findOrganizationByApiKeyHash(apiKeyHash: string) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("organizations")
    .where("apiKeyHash", "==", apiKeyHash)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return getOrganizationById(snapshot.docs[0].id);
}

export async function getSemesterById(semesterId: string) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb.collection("semesters").doc(semesterId).get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as Record<string, unknown>;

  return {
    semesterId: snapshot.id,
    orgId: String(data.orgId ?? ""),
    title: String(data.title ?? ""),
    courseCode: String(data.courseCode ?? ""),
    inviteCode: String(data.inviteCode ?? ""),
    isActive: Boolean(data.isActive ?? true),
    startsAt: data.startsAt ? toIso(data.startsAt) : undefined,
    endsAt: data.endsAt ? toIso(data.endsAt) : undefined,
    status: data.status ? Boolean(data.status) : undefined,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt)
  } satisfies Semester;
}

export async function getSemesterByInviteCode(inviteCode: string) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("semesters")
    .where("inviteCode", "==", inviteCode)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return getSemesterById(snapshot.docs[0].id);
}

export async function listSemestersForOrganization(orgId: string) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("semesters")
    .where("orgId", "==", orgId)
    .orderBy("title")
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();

    return {
      semesterId: doc.id,
      orgId: String(data.orgId ?? ""),
      title: String(data.title ?? ""),
      courseCode: String(data.courseCode ?? ""),
      inviteCode: String(data.inviteCode ?? ""),
      isActive: Boolean(data.isActive ?? true),
      startsAt: data.startsAt ? toIso(data.startsAt) : undefined,
      endsAt: data.endsAt ? toIso(data.endsAt) : undefined,
      status: data.status ? Boolean(data.status) : undefined,
      createdAt: toIso(data.createdAt),
      updatedAt: toIso(data.updatedAt)
    } satisfies Semester;
  });
}

export async function createSemesterForOrganization(input: {
  orgId: string;
  semesterId: string;
  title: string;
  courseCode: string;
  startsAt?: string;
  endsAt?: string;
  isActive?: boolean;
}) {
  const adminDb = getAdminDb();
  const semesterRef = adminDb.collection("semesters").doc(input.semesterId);
  const existingSemester = await semesterRef.get();

  if (existingSemester.exists) {
    throw new Error("A semester with that ID already exists.");
  }

  const inviteCode = generateInviteCode();

  await semesterRef.set({
    orgId: input.orgId,
    title: input.title,
    courseCode: input.courseCode,
    inviteCode,
    isActive: input.isActive ?? true,
    startsAt: input.startsAt || null,
    endsAt: input.endsAt || null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  return {
    semesterId: input.semesterId,
    orgId: input.orgId,
    title: input.title,
    courseCode: input.courseCode,
    inviteCode,
    isActive: input.isActive ?? true,
    startsAt: input.startsAt,
    endsAt: input.endsAt
  } satisfies Semester;
}

export async function createUserProfile(profile: Omit<UserProfile, "createdAt" | "updatedAt">) {
  const adminDb = getAdminDb();
  await adminDb.collection("users").doc(profile.uid).set({
    ...profile,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
}

export async function createActivityLog(
  input: Omit<ActivityLog, "id" | "occurredAt">
) {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("activity_logs").doc();

  await ref.set({
    ...input,
    occurredAt: FieldValue.serverTimestamp()
  });

  return ref.id;
}

export async function listRecentActivityForStudent(userId: string, limit = 8) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("activity_logs")
    .where("userId", "==", userId)
    .orderBy("occurredAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();

    return {
      id: doc.id,
      userId: String(data.userId ?? ""),
      organizationId: String(data.organizationId ?? ""),
      semesterId: String(data.semesterId ?? ""),
      module: data.module as ActivityLog["module"],
      action: String(data.action ?? ""),
      status: data.status as ActivityLog["status"],
      summary: String(data.summary ?? ""),
      payload: (data.payload ?? {}) as Record<string, unknown>,
      occurredAt: toIso(data.occurredAt)
    } satisfies ActivityLog;
  });
}

export async function listOrganizationStudentsWithLatestActivity(orgId: string) {
  const adminDb = getAdminDb();
  const [usersSnapshot, activitySnapshot] = await Promise.all([
    adminDb
      .collection("users")
      .where("organizationId", "==", orgId)
      .where("role", "==", "STUDENT")
      .get(),
    adminDb
      .collection("activity_logs")
      .where("organizationId", "==", orgId)
      .orderBy("occurredAt", "desc")
      .limit(250)
      .get()
  ]);

  const latestByUser = new Map<string, string>();

  activitySnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const userId = String(data.userId ?? "");

    if (!latestByUser.has(userId)) {
      latestByUser.set(userId, toIso(data.occurredAt));
    }
  });

  return usersSnapshot.docs.map((doc) => {
    const data = doc.data();

    return {
      uid: doc.id,
      fullName: String(data.fullName ?? ""),
      email: String(data.email ?? ""),
      semesterId: data.semesterId ? String(data.semesterId) : "",
      latestActivityAt: latestByUser.get(doc.id) ?? null
    };
  });
}

export async function getBudgetDraft(userId: string, semesterId: string) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb.collection("budget_drafts").doc(`${semesterId}_${userId}`).get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as Record<string, unknown>;

  return mapDoc<BudgetDraft>(snapshot.id, {
    userId: String(data.userId ?? ""),
    organizationId: String(data.organizationId ?? ""),
    semesterId: String(data.semesterId ?? ""),
    income: (data.income ?? []) as BudgetDraft["income"],
    expenses: (data.expenses ?? []) as BudgetDraft["expenses"],
    notes: String(data.notes ?? ""),
    monthlyBalance: Number(data.monthlyBalance ?? 0),
    isFinal: Boolean(data.isFinal ?? false),
    updatedAt: toIso(data.updatedAt)
  });
}

export async function upsertBudgetDraft(
  draft: Omit<BudgetDraft, "id" | "updatedAt">
) {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("budget_drafts").doc(`${draft.semesterId}_${draft.userId}`);

  await ref.set({
    ...draft,
    updatedAt: FieldValue.serverTimestamp()
  });
}

export async function getDebtScenario(userId: string, semesterId: string) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("debt_scenarios")
    .doc(`${semesterId}_${userId}`)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as Record<string, unknown>;

  return mapDoc<DebtScenario>(snapshot.id, {
    userId: String(data.userId ?? ""),
    organizationId: String(data.organizationId ?? ""),
    semesterId: String(data.semesterId ?? ""),
    debtName: String(data.debtName ?? ""),
    balance: Number(data.balance ?? 0),
    interestRate: Number(data.interestRate ?? 0),
    minimumPayment: Number(data.minimumPayment ?? 0),
    plannedPayment: Number(data.plannedPayment ?? 0),
    payoffMonths: Number(data.payoffMonths ?? 0),
    totalInterest: Number(data.totalInterest ?? 0),
    notes: String(data.notes ?? ""),
    isFinal: Boolean(data.isFinal ?? false),
    updatedAt: toIso(data.updatedAt)
  });
}

export async function upsertDebtScenario(
  scenario: Omit<DebtScenario, "id" | "updatedAt">
) {
  const adminDb = getAdminDb();
  const ref = adminDb
    .collection("debt_scenarios")
    .doc(`${scenario.semesterId}_${scenario.userId}`);

  await ref.set({
    ...scenario,
    updatedAt: FieldValue.serverTimestamp()
  });
}

export async function buildExportFeedForOrganization(orgId: string) {
  const adminDb = getAdminDb();
  const [organization, semesters, students, logs] = await Promise.all([
    getOrganizationById(orgId),
    listSemestersForOrganization(orgId),
    adminDb
      .collection("users")
      .where("organizationId", "==", orgId)
      .where("role", "==", "STUDENT")
      .get(),
    adminDb
      .collection("activity_logs")
      .where("organizationId", "==", orgId)
      .orderBy("occurredAt", "desc")
      .get()
  ]);

  if (!organization) {
    return [];
  }

  const semestersById = new Map(semesters.map((semester) => [semester.semesterId, semester]));
  const studentsById = new Map(
    students.docs.map((doc) => [
      doc.id,
      {
        fullName: String(doc.data().fullName ?? ""),
        email: String(doc.data().email ?? "")
      }
    ])
  );

  return logs.docs.map((doc) => {
    const data = doc.data();
    const semester = semestersById.get(String(data.semesterId ?? ""));
    const student = studentsById.get(String(data.userId ?? ""));

    return {
      logId: doc.id,
      occurredAt: toIso(data.occurredAt),
      organizationId: orgId,
      organizationName: organization.name,
      semesterId: String(data.semesterId ?? ""),
      semesterTitle: semester?.title ?? "",
      courseCode: semester?.courseCode ?? "",
      studentId: String(data.userId ?? ""),
      studentName: student?.fullName ?? "",
      studentEmail: student?.email ?? "",
      module: data.module as ExportRecord["module"],
      action: String(data.action ?? ""),
      status: data.status as ExportRecord["status"],
      summary: String(data.summary ?? ""),
      payload: (data.payload ?? {}) as Record<string, unknown>
    } satisfies ExportRecord;
  });
}
