import { FieldValue, Timestamp } from "firebase-admin/firestore";

import type {
  ActivityLog,
  ActualItem,
  AllocationTarget,
  Asset,
  AssetCategory,
  BudgetActuals,
  BudgetDraft,
  ChatConversation,
  ChatMessage,
  Debt,
  DebtCategory,
  DebtScenario,
  ExpenseCategory,
  ExpenseEntry,
  ExportRecord,
  Goal,
  GoalType,
  IncomeEntry,
  IncomeEntryCategory,
  Organization,
  OrganizationCreationResult,
  Semester,
  StudentEnrollment,
  StudentRecord,
  StudentInvite,
  UserProfile
} from "@/types/domain";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebase/admin";
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

function buildFullName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

function mapSemester(id: string, data: Record<string, unknown>) {
  return {
    semesterId: id,
    orgId: String(data.orgId ?? ""),
    title: String(data.title ?? ""),
    courseCode: String(data.courseCode ?? ""),
    isActive: Boolean(data.isActive ?? true),
    durationWeeks: typeof data.durationWeeks === "number" ? data.durationWeeks : 8,
    startsAt: data.startsAt ? toIso(data.startsAt) : undefined,
    endsAt: data.endsAt ? toIso(data.endsAt) : undefined,
    status: data.status ? Boolean(data.status) : undefined,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt)
  } satisfies Semester;
}

function mapStudentInvite(id: string, data: Record<string, unknown>) {
  return {
    inviteId: id,
    inviteCode: String(data.inviteCode ?? ""),
    studentId: String(data.studentId ?? ""),
    organizationId: String(data.organizationId ?? ""),
    semesterId: String(data.semesterId ?? ""),
    studentEmail: String(data.studentEmail ?? "").toLowerCase(),
    studentFirstName: String(data.studentFirstName ?? ""),
    studentLastName: String(data.studentLastName ?? ""),
    status: (data.status ?? "pending") as StudentInvite["status"],
    createdByUid: String(data.createdByUid ?? ""),
    redeemedByUid: data.redeemedByUid ? String(data.redeemedByUid) : undefined,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    redeemedAt: data.redeemedAt ? toIso(data.redeemedAt) : undefined
  } satisfies StudentInvite;
}

function mapStudentRecord(id: string, data: Record<string, unknown>) {
  return {
    studentId: id,
    organizationId: String(data.organizationId ?? ""),
    firstName: String(data.firstName ?? ""),
    lastName: String(data.lastName ?? ""),
    email: String(data.email ?? "").toLowerCase(),
    authUserId: data.authUserId ? String(data.authUserId) : undefined,
    status: (data.status ?? "prospect") as StudentRecord["status"],
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt)
  } satisfies StudentRecord;
}

function mapStudentEnrollment(id: string, data: Record<string, unknown>) {
  return {
    enrollmentId: id,
    userId: String(data.userId ?? ""),
    organizationId: String(data.organizationId ?? ""),
    semesterId: String(data.semesterId ?? ""),
    inviteId: data.inviteId ? String(data.inviteId) : undefined,
    studentEmail: String(data.studentEmail ?? "").toLowerCase(),
    status: (data.status ?? "enrolled") as StudentEnrollment["status"],
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt)
  } satisfies StudentEnrollment;
}

function mapActivityLog(id: string, data: Record<string, unknown>): ActivityLog {
  return {
    id,
    userId: String(data.userId ?? ""),
    organizationId: String(data.organizationId ?? ""),
    semesterId: String(data.semesterId ?? ""),
    module: data.module as ActivityLog["module"],
    action: String(data.action ?? ""),
    status: data.status as ActivityLog["status"],
    summary: String(data.summary ?? ""),
    payload: (data.payload ?? {}) as Record<string, unknown>,
    occurredAt: toIso(data.occurredAt)
  };
}

const USER_SCOPED_COLLECTIONS = [
  "student_enrollments",
  "activity_logs",
  "budget_drafts",
  "budget_actuals",
  "budget_actuals_monthly",
  "debt_scenarios",
  "chat_conversations",
  "goals",
  "debts",
  "income_entries",
  "expense_entries",
  "assets",
  "allocation_targets",
  "student_feedback"
] as const;

async function deleteCollectionByField(input: {
  collectionName: string;
  fieldName: string;
  fieldValue: string;
}) {
  const adminDb = getAdminDb();

  if (!input.fieldValue) {
    return 0;
  }

  let totalDeleted = 0;
  const pageSize = 400;

  while (true) {
    const snapshot = await adminDb
      .collection(input.collectionName)
      .where(input.fieldName, "==", input.fieldValue)
      .limit(pageSize)
      .get();

    if (snapshot.empty) {
      break;
    }

    const batch = adminDb.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    totalDeleted += snapshot.size;

    if (snapshot.size < pageSize) {
      break;
    }
  }

  return totalDeleted;
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
    avatarUrl: data.avatarUrl ? String(data.avatarUrl) : undefined,
    role: data.role as UserProfile["role"],
    organizationId: data.organizationId ? String(data.organizationId) : undefined,
    activeSemesterId: data.activeSemesterId ? String(data.activeSemesterId) : undefined,
    currentAge: data.currentAge != null ? Number(data.currentAge) : undefined,
    targetRetirementAge: data.targetRetirementAge != null ? Number(data.targetRetirementAge) : undefined,
    retirementNetWorthTarget: data.retirementNetWorthTarget != null ? Number(data.retirementNetWorthTarget) : undefined,
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

export async function rotateOrganizationApiKey(orgId: string) {
  const adminDb = getAdminDb();
  const apiKey = generateApiKey();
  await adminDb.collection("organizations").doc(orgId).set(
    {
      apiKeyHash: sha256(apiKey),
      apiKeyPreview: previewSecret(apiKey),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  return { apiKey, apiKeyPreview: previewSecret(apiKey) };
}

export async function updateUserProfile(input: {
  uid: string;
  fullName: string;
  avatarUrl?: string;
  currentAge?: number;
  targetRetirementAge?: number;
  retirementNetWorthTarget?: number;
}) {
  const adminDb = getAdminDb();
  const data: Record<string, unknown> = {
    fullName: input.fullName,
    avatarUrl: input.avatarUrl || null,
    updatedAt: FieldValue.serverTimestamp()
  };
  if (input.currentAge !== undefined) data.currentAge = input.currentAge;
  if (input.targetRetirementAge !== undefined) data.targetRetirementAge = input.targetRetirementAge;
  if (input.retirementNetWorthTarget !== undefined) data.retirementNetWorthTarget = input.retirementNetWorthTarget;
  await adminDb.collection("users").doc(input.uid).set(data, { merge: true });

  return getUserProfileById(input.uid);
}

export async function updateOrganizationProfile(input: {
  orgId: string;
  name: string;
  supportEmail?: string;
  brandColor?: string;
  logoUrl?: string;
}) {
  const adminDb = getAdminDb();
  await adminDb.collection("organizations").doc(input.orgId).set(
    {
      name: input.name,
      settings: {
        supportEmail: input.supportEmail || null,
        brandColor: input.brandColor || null,
        logoUrl: input.logoUrl || null
      },
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return getOrganizationById(input.orgId);
}

export async function getSemesterById(semesterId: string) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb.collection("semesters").doc(semesterId).get();

  if (!snapshot.exists) {
    return null;
  }

  return mapSemester(snapshot.id, snapshot.data() as Record<string, unknown>);
}

export async function getStudentRecordById(studentId: string) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb.collection("students").doc(studentId).get();

  if (!snapshot.exists) {
    return null;
  }

  return mapStudentRecord(snapshot.id, snapshot.data() as Record<string, unknown>);
}

export async function getStudentRecordByEmail(organizationId: string, email: string) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("students")
    .where("organizationId", "==", organizationId)
    .where("email", "==", email.trim().toLowerCase())
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  return mapStudentRecord(snapshot.docs[0].id, snapshot.docs[0].data() as Record<string, unknown>);
}

export async function listStudentsForOrganization(organizationId: string) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("students")
    .where("organizationId", "==", organizationId)
    .orderBy("lastName")
    .get();

  return snapshot.docs.map((doc) => mapStudentRecord(doc.id, doc.data()));
}

export async function createStudentRecord(input: {
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  status?: StudentRecord["status"];
}) {
  const adminDb = getAdminDb();
  const email = input.email.trim().toLowerCase();
  const existingSnapshot = await adminDb
    .collection("students")
    .where("organizationId", "==", input.organizationId)
    .where("email", "==", email)
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    throw new Error("A student with that email already exists in this organization.");
  }

  const studentRef = adminDb.collection("students").doc();
  await studentRef.set({
    organizationId: input.organizationId,
    firstName: input.firstName,
    lastName: input.lastName,
    email,
    authUserId: null,
    status: input.status ?? "prospect",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  const snapshot = await studentRef.get();

  return mapStudentRecord(studentRef.id, snapshot.data() as Record<string, unknown>);
}

export async function updateStudentRecord(input: {
  studentId: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  status: StudentRecord["status"];
}) {
  const adminDb = getAdminDb();
  const studentRef = adminDb.collection("students").doc(input.studentId);
  const student = await studentRef.get();

  if (!student.exists) {
    throw new Error("That student could not be found.");
  }

  const current = mapStudentRecord(student.id, student.data() as Record<string, unknown>);

  if (current.organizationId !== input.organizationId) {
    throw new Error("That student does not belong to this organization.");
  }

  const email = input.email.trim().toLowerCase();
  if (current.authUserId && email !== current.email) {
    throw new Error("Linked student emails must be changed through the authenticated account flow.");
  }

  if (email !== current.email) {
    const existingSnapshot = await adminDb
      .collection("students")
      .where("organizationId", "==", input.organizationId)
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!existingSnapshot.empty && existingSnapshot.docs[0].id !== input.studentId) {
      throw new Error("A student with that email already exists in this organization.");
    }
  }

  await studentRef.set(
    {
      firstName: input.firstName,
      lastName: input.lastName,
      email,
      status: input.status,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  const snapshot = await studentRef.get();

  return mapStudentRecord(studentRef.id, snapshot.data() as Record<string, unknown>);
}

export async function deleteStudentRecord(studentId: string, organizationId: string) {
  const adminDb = getAdminDb();
  const studentRef = adminDb.collection("students").doc(studentId);
  const snapshot = await studentRef.get();

  if (!snapshot.exists) {
    throw new Error("That student could not be found.");
  }

  const student = mapStudentRecord(snapshot.id, snapshot.data() as Record<string, unknown>);

  if (!student || student.organizationId !== organizationId) {
    throw new Error("That student could not be found.");
  }

  await deleteCollectionByField({
    collectionName: "student_invites",
    fieldName: "studentId",
    fieldValue: student.studentId
  });

  if (student.authUserId) {
    const uid = student.authUserId;

    for (const collectionName of USER_SCOPED_COLLECTIONS) {
      await deleteCollectionByField({
        collectionName,
        fieldName: "userId",
        fieldValue: uid
      });
    }

    await deleteCollectionByField({
      collectionName: "student_invites",
      fieldName: "redeemedByUid",
      fieldValue: uid
    });

    try {
      await getAdminAuth().deleteUser(uid);
    } catch (error) {
      const authErrorCode =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: string }).code ?? "")
          : "";

      if (authErrorCode !== "auth/user-not-found") {
        throw error;
      }
    }

    await adminDb.collection("users").doc(uid).delete();
  }

  await studentRef.delete();
}

export async function deleteStudentRecordsBulk(input: {
  organizationId: string;
  studentIds: string[];
}) {
  const adminDb = getAdminDb();
  const uniqueStudentIds = Array.from(
    new Set(input.studentIds.map((studentId) => studentId.trim()).filter(Boolean))
  );

  if (uniqueStudentIds.length === 0) {
    return {
      deletedIds: [] as string[],
      skipped: [] as Array<{ studentId: string; reason: string }>
    };
  }

  const refs = uniqueStudentIds.map((studentId) => adminDb.collection("students").doc(studentId));
  const snapshots = await adminDb.getAll(...refs);
  const deletedIds: string[] = [];
  const skipped: Array<{ studentId: string; reason: string }> = [];

  for (const snapshot of snapshots) {
    if (!snapshot.exists) {
      skipped.push({ studentId: snapshot.id, reason: "Student not found." });
      continue;
    }

    const student = mapStudentRecord(snapshot.id, snapshot.data() as Record<string, unknown>);

    if (student.organizationId !== input.organizationId) {
      skipped.push({ studentId: student.studentId, reason: "Student does not belong to this organization." });
      continue;
    }

    try {
      await deleteStudentRecord(student.studentId, input.organizationId);
      deletedIds.push(student.studentId);
    } catch (error) {
      skipped.push({
        studentId: student.studentId,
        reason: error instanceof Error ? error.message : "Unable to delete student."
      });
    }
  }

  return { deletedIds, skipped };
}

export async function linkStudentRecordToAuthUser(input: {
  studentId: string;
  organizationId: string;
  authUserId: string;
  firstName: string;
  lastName: string;
  email: string;
}) {
  const adminDb = getAdminDb();
  const studentRef = adminDb.collection("students").doc(input.studentId);
  const snapshot = await studentRef.get();

  if (!snapshot.exists) {
    throw new Error("The student record for this invite no longer exists.");
  }

  const student = mapStudentRecord(snapshot.id, snapshot.data() as Record<string, unknown>);

  if (student.organizationId !== input.organizationId) {
    throw new Error("This invite is attached to a different organization.");
  }

  if (student.authUserId && student.authUserId !== input.authUserId) {
    throw new Error("This student record is already linked to a different user.");
  }

  await studentRef.set(
    {
      authUserId: input.authUserId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email.toLowerCase(),
      status: "active",
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

export async function updateSemesterForOrganization(input: {
  semesterId: string;
  orgId: string;
  title: string;
  courseCode: string;
  durationWeeks: number;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
}) {
  const adminDb = getAdminDb();
  const semesterRef = adminDb.collection("semesters").doc(input.semesterId);
  const snapshot = await semesterRef.get();

  if (!snapshot.exists) {
    throw new Error("That course could not be found.");
  }

  const current = mapSemester(snapshot.id, snapshot.data() as Record<string, unknown>);

  if (current.orgId !== input.orgId) {
    throw new Error("That course does not belong to this organization.");
  }

  await semesterRef.set(
    {
      title: input.title,
      courseCode: input.courseCode.toUpperCase(),
      isActive: input.isActive,
      durationWeeks: input.durationWeeks,
      startsAt: input.startsAt || null,
      endsAt: input.endsAt || null,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  const updated = await semesterRef.get();

  return mapSemester(semesterRef.id, updated.data() as Record<string, unknown>);
}

export async function deleteSemesterForOrganization(semesterId: string, orgId: string) {
  const adminDb = getAdminDb();
  const semesterRef = adminDb.collection("semesters").doc(semesterId);
  const snapshot = await semesterRef.get();

  if (!snapshot.exists) {
    throw new Error("That course could not be found.");
  }

  const semester = mapSemester(snapshot.id, snapshot.data() as Record<string, unknown>);

  if (semester.orgId !== orgId) {
    throw new Error("That course does not belong to this organization.");
  }

  const [inviteSnapshot, enrollmentSnapshot] = await Promise.all([
    adminDb
      .collection("student_invites")
      .where("semesterId", "==", semesterId)
      .limit(1)
      .get(),
    adminDb
      .collection("student_enrollments")
      .where("semesterId", "==", semesterId)
      .limit(1)
      .get()
  ]);

  if (!inviteSnapshot.empty || !enrollmentSnapshot.empty) {
    throw new Error("Courses with invites or enrollments cannot be deleted.");
  }

  await semesterRef.delete();
}

export async function updateStudentInviteStatus(input: {
  inviteId: string;
  organizationId: string;
  status: StudentInvite["status"];
}) {
  const adminDb = getAdminDb();
  const inviteRef = adminDb.collection("student_invites").doc(input.inviteId);
  const snapshot = await inviteRef.get();

  if (!snapshot.exists) {
    throw new Error("That invite could not be found.");
  }

  const current = mapStudentInvite(snapshot.id, snapshot.data() as Record<string, unknown>);

  if (current.organizationId !== input.organizationId) {
    throw new Error("That invite does not belong to this organization.");
  }

  await inviteRef.set(
    {
      status: input.status,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  const updated = await inviteRef.get();

  return mapStudentInvite(inviteRef.id, updated.data() as Record<string, unknown>);
}

export async function deleteStudentInvite(inviteId: string, organizationId: string) {
  const adminDb = getAdminDb();
  const inviteRef = adminDb.collection("student_invites").doc(inviteId);
  const snapshot = await inviteRef.get();

  if (!snapshot.exists) {
    throw new Error("That invite could not be found.");
  }

  const invite = mapStudentInvite(snapshot.id, snapshot.data() as Record<string, unknown>);

  if (invite.organizationId !== organizationId) {
    throw new Error("That invite does not belong to this organization.");
  }

  if (invite.status === "redeemed") {
    throw new Error("Redeemed invites cannot be deleted.");
  }

  await inviteRef.delete();
}

export async function listSemestersForOrganization(orgId: string) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("semesters")
    .where("orgId", "==", orgId)
    .orderBy("title")
    .get();

  return snapshot.docs.map((doc) => mapSemester(doc.id, doc.data()));
}

export async function createSemesterForOrganization(input: {
  orgId: string;
  semesterId: string;
  title: string;
  courseCode: string;
  durationWeeks: number;
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

  await semesterRef.set({
    orgId: input.orgId,
    title: input.title,
    courseCode: input.courseCode,
    isActive: input.isActive ?? true,
    durationWeeks: input.durationWeeks,
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
    isActive: input.isActive ?? true,
    durationWeeks: input.durationWeeks,
    startsAt: input.startsAt,
    endsAt: input.endsAt
  } satisfies Semester;
}

export async function listStudentInvitesForOrganization(organizationId: string) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("student_invites")
    .where("organizationId", "==", organizationId)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => mapStudentInvite(doc.id, doc.data()));
}

export async function getStudentInviteById(inviteId: string) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb.collection("student_invites").doc(inviteId).get();

  if (!snapshot.exists) {
    return null;
  }

  return mapStudentInvite(snapshot.id, snapshot.data() as Record<string, unknown>);
}

export async function getStudentInviteByCode(inviteCode: string) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("student_invites")
    .where("inviteCode", "==", inviteCode)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return mapStudentInvite(
    snapshot.docs[0].id,
    snapshot.docs[0].data() as Record<string, unknown>
  );
}

export async function createStudentInvite(input: {
  studentId: string;
  organizationId: string;
  semesterId: string;
  createdByUid: string;
}) {
  const adminDb = getAdminDb();
  const student = await getStudentRecordById(input.studentId);

  if (!student || student.organizationId !== input.organizationId) {
    throw new Error("That student could not be found.");
  }

  const inviteId = `invite_${sha256(`${input.semesterId}:${student.email}`).slice(0, 24)}`;
  const inviteRef = adminDb.collection("student_invites").doc(inviteId);
  const inviteCode = generateInviteCode();

  await inviteRef.set({
    inviteCode,
    studentId: student.studentId,
    organizationId: input.organizationId,
    semesterId: input.semesterId,
    studentEmail: student.email,
    studentFirstName: student.firstName,
    studentLastName: student.lastName,
    status: "pending",
    createdByUid: input.createdByUid,
    redeemedByUid: null,
    redeemedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  const snapshot = await inviteRef.get();

  await adminDb.collection("students").doc(student.studentId).set(
    {
      status: student.authUserId ? student.status : "invited",
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return mapStudentInvite(inviteRef.id, snapshot.data() as Record<string, unknown>);
}

export async function redeemStudentInvite(inviteId: string, redeemedByUid: string) {
  const adminDb = getAdminDb();
  await adminDb.collection("student_invites").doc(inviteId).set(
    {
      status: "redeemed",
      redeemedByUid,
      redeemedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

export async function createStudentEnrollment(input: {
  userId: string;
  organizationId: string;
  semesterId: string;
  inviteId?: string;
  studentEmail: string;
}) {
  const adminDb = getAdminDb();
  const enrollmentId = `${input.userId}_${input.semesterId}`;
  const enrollmentRef = adminDb.collection("student_enrollments").doc(enrollmentId);
  const existing = await enrollmentRef.get();

  if (existing.exists) {
    return mapStudentEnrollment(enrollmentRef.id, existing.data() as Record<string, unknown>);
  }

  await enrollmentRef.set({
    userId: input.userId,
    organizationId: input.organizationId,
    semesterId: input.semesterId,
    inviteId: input.inviteId ?? null,
    studentEmail: input.studentEmail.toLowerCase(),
    status: "enrolled",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  const snapshot = await enrollmentRef.get();

  return mapStudentEnrollment(enrollmentRef.id, snapshot.data() as Record<string, unknown>);
}

export async function getStudentEnrollment(userId: string, semesterId: string) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("student_enrollments")
    .doc(`${userId}_${semesterId}`)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  return mapStudentEnrollment(snapshot.id, snapshot.data() as Record<string, unknown>);
}

export async function listStudentEnrollments(userId: string) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("student_enrollments")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => mapStudentEnrollment(doc.id, doc.data()));
}

export async function setUserActiveSemester(uid: string, semesterId: string) {
  const adminDb = getAdminDb();
  await adminDb.collection("users").doc(uid).set(
    {
      activeSemesterId: semesterId,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
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

  return snapshot.docs.map((doc) => mapActivityLog(doc.id, doc.data()));
}

export async function listActivityLogsForOrganization(
  organizationId: string,
  { semesterId, limit = 50 }: { semesterId?: string; limit?: number } = {}
) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("activity_logs")
    .where("organizationId", "==", organizationId)
    .orderBy("occurredAt", "desc")
    .limit(semesterId ? 500 : limit)
    .get();

  let logs = snapshot.docs.map((doc) => mapActivityLog(doc.id, doc.data()));

  if (semesterId) {
    logs = logs.filter((log) => log.semesterId === semesterId).slice(0, limit);
  }

  return logs;
}

export async function listOrganizationStudentsWithLatestActivity(orgId: string) {
  const adminDb = getAdminDb();
  const [usersSnapshot, activitySnapshot, enrollmentsSnapshot] = await Promise.all([
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
      .get(),
    adminDb
      .collection("student_enrollments")
      .where("organizationId", "==", orgId)
      .get()
  ]);

  const latestByUser = new Map<string, string>();
  const enrollmentCountByUser = new Map<string, number>();

  activitySnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const userId = String(data.userId ?? "");

    if (!latestByUser.has(userId)) {
      latestByUser.set(userId, toIso(data.occurredAt));
    }
  });

  enrollmentsSnapshot.docs.forEach((doc) => {
    const userId = String(doc.data().userId ?? "");
    enrollmentCountByUser.set(userId, (enrollmentCountByUser.get(userId) ?? 0) + 1);
  });

  return usersSnapshot.docs.map((doc) => {
    const data = doc.data();
    const activeSemesterId = data.activeSemesterId ? String(data.activeSemesterId) : "";

    return {
      uid: doc.id,
      fullName: String(data.fullName ?? ""),
      email: String(data.email ?? ""),
      activeSemesterId,
      enrollmentCount: enrollmentCountByUser.get(doc.id) ?? 0,
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
    savings: (data.savings ?? []) as BudgetDraft["savings"],
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

export async function getBudgetActuals(userId: string, semesterId: string) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb.collection("budget_actuals").doc(`${semesterId}_${userId}`).get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as Record<string, unknown>;

  return mapDoc<BudgetActuals>(snapshot.id, {
    userId: String(data.userId ?? ""),
    organizationId: String(data.organizationId ?? ""),
    semesterId: String(data.semesterId ?? ""),
    actualIncome: (data.actualIncome ?? []) as ActualItem[],
    actualSavings: (data.actualSavings ?? []) as ActualItem[],
    actualExpenses: (data.actualExpenses ?? []) as ActualItem[],
    notes: String(data.notes ?? ""),
    updatedAt: toIso(data.updatedAt)
  });
}

export async function upsertBudgetActuals(
  actuals: Omit<BudgetActuals, "id" | "updatedAt">
) {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("budget_actuals").doc(`${actuals.semesterId}_${actuals.userId}`);

  await ref.set({
    ...actuals,
    updatedAt: FieldValue.serverTimestamp()
  });
}

export async function getBudgetActualsByMonth(userId: string, semesterId: string, monthKey: string) {
  const adminDb = getAdminDb();
  const monthlySnapshot = await adminDb
    .collection("budget_actuals_monthly")
    .doc(`${semesterId}_${userId}_${monthKey}`)
    .get();

  if (monthlySnapshot.exists) {
    const data = monthlySnapshot.data() as Record<string, unknown>;
    return mapDoc<BudgetActuals>(monthlySnapshot.id, {
      userId: String(data.userId ?? ""),
      organizationId: String(data.organizationId ?? ""),
      semesterId: String(data.semesterId ?? ""),
      actualIncome: (data.actualIncome ?? []) as ActualItem[],
      actualSavings: (data.actualSavings ?? []) as ActualItem[],
      actualExpenses: (data.actualExpenses ?? []) as ActualItem[],
      notes: String(data.notes ?? ""),
      updatedAt: toIso(data.updatedAt)
    });
  }

  // Fall back to the legacy single-doc actuals only for the current month
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (monthKey !== currentMonthKey) {
    return null;
  }

  const legacySnapshot = await adminDb
    .collection("budget_actuals")
    .doc(`${semesterId}_${userId}`)
    .get();

  if (!legacySnapshot.exists) {
    return null;
  }

  const data = legacySnapshot.data() as Record<string, unknown>;
  return mapDoc<BudgetActuals>(legacySnapshot.id, {
    userId: String(data.userId ?? ""),
    organizationId: String(data.organizationId ?? ""),
    semesterId: String(data.semesterId ?? ""),
    actualIncome: (data.actualIncome ?? []) as ActualItem[],
    actualSavings: (data.actualSavings ?? []) as ActualItem[],
    actualExpenses: (data.actualExpenses ?? []) as ActualItem[],
    notes: String(data.notes ?? ""),
    updatedAt: toIso(data.updatedAt)
  });
}

export async function upsertBudgetActualsByMonth(
  actuals: Omit<BudgetActuals, "id" | "updatedAt">,
  monthKey: string
) {
  const adminDb = getAdminDb();
  const ref = adminDb
    .collection("budget_actuals_monthly")
    .doc(`${actuals.semesterId}_${actuals.userId}_${monthKey}`);

  await ref.set({
    ...actuals,
    monthKey,
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

// ─── Chat conversations ───────────────────────────────────────

export async function listChatConversations(
  userId: string,
  semesterId: string,
  limit = 10
): Promise<ChatConversation[]> {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("chat_conversations")
    .where("userId", "==", userId)
    .where("semesterId", "==", semesterId)
    .orderBy("updatedAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return mapDoc<ChatConversation>(doc.id, {
      userId: String(data.userId ?? ""),
      organizationId: String(data.organizationId ?? ""),
      semesterId: String(data.semesterId ?? ""),
      title: String(data.title ?? ""),
      messages: (data.messages ?? []) as ChatMessage[],
      createdAt: toIso(data.createdAt),
      updatedAt: toIso(data.updatedAt)
    });
  });
}

export async function createChatConversation(
  conversation: Omit<ChatConversation, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("chat_conversations").doc();
  await ref.set({
    ...conversation,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return ref.id;
}

export async function updateChatConversation(
  id: string,
  messages: ChatMessage[]
): Promise<void> {
  const adminDb = getAdminDb();
  await adminDb.collection("chat_conversations").doc(id).update({
    messages,
    updatedAt: FieldValue.serverTimestamp()
  });
}

export async function deleteChatConversation(id: string): Promise<void> {
  const adminDb = getAdminDb();
  await adminDb.collection("chat_conversations").doc(id).delete();
}

function buildActualMonths(startsAt?: string, endsAt?: string): string[] {
  if (!startsAt || !endsAt) return [];
  const end = new Date(endsAt);
  const months: string[] = [];
  const current = new Date(new Date(startsAt).getFullYear(), new Date(startsAt).getMonth(), 1);
  while (current <= end) {
    months.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`);
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}

export async function getRaceProgress(semesterId: string, organizationId: string) {
  const adminDb = getAdminDb();

  const semester = await getSemesterById(semesterId);
  if (!semester || semester.orgId !== organizationId) return null;

  const enrollmentsSnap = await adminDb
    .collection("student_enrollments")
    .where("semesterId", "==", semesterId)
    .where("organizationId", "==", organizationId)
    .get();

  const enrollments = enrollmentsSnap.docs.map((doc) => ({
    userId: String(doc.data().userId ?? "")
  }));

  const actualMonths = buildActualMonths(semester.startsAt, semester.endsAt);
  const maxScore = 6 + actualMonths.length;

  const students = await Promise.all(
    enrollments.map(async ({ userId }) => {
      const [userSnap, budgetSnap, debtSnap, actualsSnap, chatSnap] = await Promise.all([
        adminDb.collection("users").doc(userId).get(),
        adminDb.collection("budget_drafts").doc(`${semesterId}_${userId}`).get(),
        adminDb.collection("debt_scenarios").doc(`${semesterId}_${userId}`).get(),
        adminDb.collection("budget_actuals").doc(`${semesterId}_${userId}`).get(),
        adminDb
          .collection("chat_conversations")
          .where("userId", "==", userId)
          .where("semesterId", "==", semesterId)
          .limit(1)
          .get()
      ]);

      const budgetData = budgetSnap.data() as Record<string, unknown> | undefined;
      const debtData = debtSnap.data() as Record<string, unknown> | undefined;
      const actualsData = actualsSnap.data() as Record<string, unknown> | undefined;

      const hasIncome = Array.isArray(budgetData?.income) && (budgetData.income as unknown[]).length > 0;
      const hasExpenses = Array.isArray(budgetData?.expenses) && (budgetData.expenses as unknown[]).length > 0;

      const actualIncomeItems = (actualsData?.actualIncome ?? []) as Array<{ date?: string }>;
      const actualExpenseItems = (actualsData?.actualExpenses ?? []) as Array<{ date?: string }>;

      const actualsProgress: Record<string, boolean> = {};
      for (const month of actualMonths) {
        actualsProgress[month] =
          actualIncomeItems.some((i) => i.date?.startsWith(month)) &&
          actualExpenseItems.some((i) => i.date?.startsWith(month));
      }

      const staticFlags = {
        enrolled: true,
        budget_started: budgetSnap.exists && (hasIncome || hasExpenses),
        budget_submitted: budgetSnap.exists && Boolean(budgetData?.isFinal),
        debt_started: debtSnap.exists,
        debt_submitted: debtSnap.exists && Boolean(debtData?.isFinal),
        assistant_used: !chatSnap.empty
      };

      const score =
        Object.values(staticFlags).filter(Boolean).length +
        Object.values(actualsProgress).filter(Boolean).length;

      const fullName = String(userSnap.data()?.fullName ?? "");
      const spaceIdx = fullName.indexOf(" ");
      const firstName = spaceIdx > -1 ? fullName.slice(0, spaceIdx) : fullName;
      const lastName = spaceIdx > -1 ? fullName.slice(spaceIdx + 1) : "";

      return {
        studentId: userId,
        firstName,
        lastName,
        score,
        milestones: { ...staticFlags, actuals: actualsProgress }
      };
    })
  );

  return {
    semester,
    actualMonths,
    maxScore,
    students: students.sort((a, b) =>
      a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
    )
  };
}

// ─── Goals ────────────────────────────────────────────────────

const VALID_GOAL_TYPES: GoalType[] = ["short_term", "long_term", "emergency_fund", "retirement"];

function mapGoal(id: string, data: Record<string, unknown>): Goal {
  return {
    id,
    userId: String(data.userId ?? ""),
    organizationId: String(data.organizationId ?? ""),
    semesterId: String(data.semesterId ?? ""),
    label: String(data.label ?? ""),
    goalType: (data.goalType as GoalType) ?? "short_term",
    targetAmount: Number(data.targetAmount ?? 0),
    targetDate: data.targetDate ? String(data.targetDate) : undefined,
    savedToDate: Number(data.savedToDate ?? 0),
    priorityOrder: Number(data.priorityOrder ?? 0),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt)
  };
}

export async function listGoals(userId: string, semesterId: string): Promise<Goal[]> {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("goals")
    .where("userId", "==", userId)
    .where("semesterId", "==", semesterId)
    .orderBy("priorityOrder")
    .get();
  return snapshot.docs.map((doc) => mapGoal(doc.id, doc.data()));
}

export async function createGoal(input: {
  userId: string;
  organizationId: string;
  semesterId: string;
  label: string;
  goalType: GoalType;
  targetAmount: number;
  targetDate?: string;
  savedToDate?: number;
}): Promise<Goal> {
  const adminDb = getAdminDb();
  const existing = await listGoals(input.userId, input.semesterId);
  const ref = adminDb.collection("goals").doc();
  await ref.set({
    userId: input.userId,
    organizationId: input.organizationId,
    semesterId: input.semesterId,
    label: input.label,
    goalType: input.goalType,
    targetAmount: input.targetAmount,
    targetDate: input.targetDate || null,
    savedToDate: input.savedToDate ?? 0,
    priorityOrder: existing.length,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  const snapshot = await ref.get();
  return mapGoal(ref.id, snapshot.data() as Record<string, unknown>);
}

export async function updateGoal(input: {
  goalId: string;
  userId: string;
  semesterId: string;
  label: string;
  goalType: GoalType;
  targetAmount: number;
  targetDate?: string;
  savedToDate: number;
  priorityOrder: number;
}): Promise<Goal> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("goals").doc(input.goalId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("Goal not found.");
  const current = mapGoal(snapshot.id, snapshot.data() as Record<string, unknown>);
  if (current.userId !== input.userId || current.semesterId !== input.semesterId) {
    throw new Error("That goal does not belong to this enrollment.");
  }
  await ref.set(
    {
      label: input.label,
      goalType: input.goalType,
      targetAmount: input.targetAmount,
      targetDate: input.targetDate || null,
      savedToDate: input.savedToDate,
      priorityOrder: input.priorityOrder,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  const updated = await ref.get();
  return mapGoal(ref.id, updated.data() as Record<string, unknown>);
}

export async function deleteGoal(goalId: string, userId: string, semesterId: string): Promise<void> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("goals").doc(goalId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("Goal not found.");
  const current = mapGoal(snapshot.id, snapshot.data() as Record<string, unknown>);
  if (current.userId !== userId || current.semesterId !== semesterId) {
    throw new Error("That goal does not belong to this enrollment.");
  }
  await ref.delete();
}

export { VALID_GOAL_TYPES };

// ─── Debts ────────────────────────────────────────────────────

const VALID_DEBT_CATEGORIES: DebtCategory[] = [
  "student_loan", "mortgage", "credit_card", "car", "other"
];

function mapDebt(id: string, data: Record<string, unknown>): Debt {
  const category = data.category as DebtCategory;
  return {
    id,
    userId: String(data.userId ?? ""),
    organizationId: String(data.organizationId ?? ""),
    semesterId: String(data.semesterId ?? ""),
    category,
    label: String(data.label ?? ""),
    originalBalance: Number(data.originalBalance ?? 0),
    currentBalance: Number(data.currentBalance ?? 0),
    monthlyPayment: Number(data.monthlyPayment ?? 0),
    interestRate: Number(data.interestRate ?? 0),
    repaymentGoalDate: data.repaymentGoalDate ? String(data.repaymentGoalDate) : undefined,
    isCreditCard: category === "credit_card" || Boolean(data.isCreditCard),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt)
  };
}

export async function listDebts(userId: string, semesterId: string): Promise<Debt[]> {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("debts")
    .where("userId", "==", userId)
    .where("semesterId", "==", semesterId)
    .orderBy("createdAt")
    .get();
  return snapshot.docs.map((doc) => mapDebt(doc.id, doc.data()));
}

export async function createDebt(input: {
  userId: string;
  organizationId: string;
  semesterId: string;
  category: DebtCategory;
  label: string;
  originalBalance: number;
  currentBalance: number;
  monthlyPayment: number;
  interestRate?: number;
  repaymentGoalDate?: string;
}): Promise<Debt> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("debts").doc();
  await ref.set({
    userId: input.userId,
    organizationId: input.organizationId,
    semesterId: input.semesterId,
    category: input.category,
    label: input.label,
    originalBalance: input.originalBalance,
    currentBalance: input.currentBalance,
    monthlyPayment: input.monthlyPayment,
    interestRate: input.interestRate ?? 0,
    repaymentGoalDate: input.repaymentGoalDate || null,
    isCreditCard: input.category === "credit_card",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  const snapshot = await ref.get();
  return mapDebt(ref.id, snapshot.data() as Record<string, unknown>);
}

export async function updateDebt(input: {
  debtId: string;
  userId: string;
  semesterId: string;
  category: DebtCategory;
  label: string;
  originalBalance: number;
  currentBalance: number;
  monthlyPayment: number;
  interestRate?: number;
  repaymentGoalDate?: string;
}): Promise<Debt> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("debts").doc(input.debtId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("Debt not found.");
  const current = mapDebt(snapshot.id, snapshot.data() as Record<string, unknown>);
  if (current.userId !== input.userId || current.semesterId !== input.semesterId) {
    throw new Error("That debt does not belong to this enrollment.");
  }
  await ref.set(
    {
      category: input.category,
      label: input.label,
      originalBalance: input.originalBalance,
      currentBalance: input.currentBalance,
      monthlyPayment: input.monthlyPayment,
      interestRate: input.interestRate ?? 0,
      repaymentGoalDate: input.repaymentGoalDate || null,
      isCreditCard: input.category === "credit_card",
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  const updated = await ref.get();
  return mapDebt(ref.id, updated.data() as Record<string, unknown>);
}

export async function deleteDebt(debtId: string, userId: string, semesterId: string): Promise<void> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("debts").doc(debtId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("Debt not found.");
  const current = mapDebt(snapshot.id, snapshot.data() as Record<string, unknown>);
  if (current.userId !== userId || current.semesterId !== semesterId) {
    throw new Error("That debt does not belong to this enrollment.");
  }
  await ref.delete();
}

export { VALID_DEBT_CATEGORIES };

// ─── Income Entries ───────────────────────────────────────────

const VALID_INCOME_CATEGORIES: IncomeEntryCategory[] = [
  "gross_pay", "taxes", "bonus", "interest", "other"
];

function mapIncomeEntry(id: string, data: Record<string, unknown>): IncomeEntry {
  return {
    id,
    userId: String(data.userId ?? ""),
    organizationId: String(data.organizationId ?? ""),
    semesterId: String(data.semesterId ?? ""),
    periodYear: Number(data.periodYear ?? 0),
    periodMonth: Number(data.periodMonth ?? 0),
    periodWeek: Number(data.periodWeek ?? 0),
    category: (data.category as IncomeEntryCategory) ?? "other",
    label: String(data.label ?? ""),
    amount: Number(data.amount ?? 0),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt)
  };
}

export async function listIncomeEntries(
  userId: string,
  semesterId: string,
  filter?: { periodYear?: number; periodMonth?: number }
): Promise<IncomeEntry[]> {
  const adminDb = getAdminDb();
  let query = adminDb
    .collection("income_entries")
    .where("userId", "==", userId)
    .where("semesterId", "==", semesterId);
  if (filter?.periodYear != null) {
    query = query.where("periodYear", "==", filter.periodYear);
  }
  if (filter?.periodMonth != null) {
    query = query.where("periodMonth", "==", filter.periodMonth);
  }
  const snapshot = await query.orderBy("periodWeek").get();
  return snapshot.docs.map((doc) => mapIncomeEntry(doc.id, doc.data()));
}

export async function createIncomeEntry(input: {
  userId: string;
  organizationId: string;
  semesterId: string;
  periodYear: number;
  periodMonth: number;
  periodWeek: number;
  category: IncomeEntryCategory;
  label: string;
  amount: number;
}): Promise<IncomeEntry> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("income_entries").doc();
  await ref.set({
    ...input,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  const snapshot = await ref.get();
  return mapIncomeEntry(ref.id, snapshot.data() as Record<string, unknown>);
}

export async function updateIncomeEntry(input: {
  entryId: string;
  userId: string;
  semesterId: string;
  category: IncomeEntryCategory;
  label: string;
  amount: number;
  periodYear: number;
  periodMonth: number;
  periodWeek: number;
}): Promise<IncomeEntry> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("income_entries").doc(input.entryId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("Income entry not found.");
  const current = mapIncomeEntry(snapshot.id, snapshot.data() as Record<string, unknown>);
  if (current.userId !== input.userId || current.semesterId !== input.semesterId) {
    throw new Error("That entry does not belong to this enrollment.");
  }
  await ref.set(
    {
      category: input.category,
      label: input.label,
      amount: input.amount,
      periodYear: input.periodYear,
      periodMonth: input.periodMonth,
      periodWeek: input.periodWeek,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  const updated = await ref.get();
  return mapIncomeEntry(ref.id, updated.data() as Record<string, unknown>);
}

export async function deleteIncomeEntry(entryId: string, userId: string, semesterId: string): Promise<void> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("income_entries").doc(entryId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("Income entry not found.");
  const current = mapIncomeEntry(snapshot.id, snapshot.data() as Record<string, unknown>);
  if (current.userId !== userId || current.semesterId !== semesterId) {
    throw new Error("That entry does not belong to this enrollment.");
  }
  await ref.delete();
}

export { VALID_INCOME_CATEGORIES };

// ─── Expense Entries ──────────────────────────────────────────

const VALID_EXPENSE_CATEGORIES: ExpenseCategory[] = ["essential", "debt", "discretionary"];

function mapExpenseEntry(id: string, data: Record<string, unknown>): ExpenseEntry {
  return {
    id,
    userId: String(data.userId ?? ""),
    organizationId: String(data.organizationId ?? ""),
    semesterId: String(data.semesterId ?? ""),
    periodYear: Number(data.periodYear ?? 0),
    periodMonth: Number(data.periodMonth ?? 0),
    periodWeek: Number(data.periodWeek ?? 0),
    category: (data.category as ExpenseCategory) ?? "discretionary",
    label: String(data.label ?? ""),
    amount: Number(data.amount ?? 0),
    isRecurring: Boolean(data.isRecurring ?? false),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt)
  };
}

export async function listExpenseEntries(
  userId: string,
  semesterId: string,
  filter?: { periodYear?: number; periodMonth?: number }
): Promise<ExpenseEntry[]> {
  const adminDb = getAdminDb();
  let query = adminDb
    .collection("expense_entries")
    .where("userId", "==", userId)
    .where("semesterId", "==", semesterId);
  if (filter?.periodYear != null) {
    query = query.where("periodYear", "==", filter.periodYear);
  }
  if (filter?.periodMonth != null) {
    query = query.where("periodMonth", "==", filter.periodMonth);
  }
  const snapshot = await query.orderBy("periodWeek").get();
  return snapshot.docs.map((doc) => mapExpenseEntry(doc.id, doc.data()));
}

export async function createExpenseEntry(input: {
  userId: string;
  organizationId: string;
  semesterId: string;
  periodYear: number;
  periodMonth: number;
  periodWeek: number;
  category: ExpenseCategory;
  label: string;
  amount: number;
  isRecurring?: boolean;
}): Promise<ExpenseEntry> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("expense_entries").doc();
  await ref.set({
    ...input,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  const snapshot = await ref.get();
  return mapExpenseEntry(ref.id, snapshot.data() as Record<string, unknown>);
}

export async function updateExpenseEntry(input: {
  entryId: string;
  userId: string;
  semesterId: string;
  category: ExpenseCategory;
  label: string;
  amount: number;
  periodYear: number;
  periodMonth: number;
  periodWeek: number;
  isRecurring?: boolean;
}): Promise<ExpenseEntry> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("expense_entries").doc(input.entryId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("Expense entry not found.");
  const current = mapExpenseEntry(snapshot.id, snapshot.data() as Record<string, unknown>);
  if (current.userId !== input.userId || current.semesterId !== input.semesterId) {
    throw new Error("That entry does not belong to this enrollment.");
  }
  await ref.set(
    {
      category: input.category,
      label: input.label,
      amount: input.amount,
      periodYear: input.periodYear,
      periodMonth: input.periodMonth,
      periodWeek: input.periodWeek,
      isRecurring: input.isRecurring ?? false,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  const updated = await ref.get();
  return mapExpenseEntry(ref.id, updated.data() as Record<string, unknown>);
}

export async function deleteExpenseEntry(entryId: string, userId: string, semesterId: string): Promise<void> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("expense_entries").doc(entryId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("Expense entry not found.");
  const current = mapExpenseEntry(snapshot.id, snapshot.data() as Record<string, unknown>);
  if (current.userId !== userId || current.semesterId !== semesterId) {
    throw new Error("That entry does not belong to this enrollment.");
  }
  await ref.delete();
}

export { VALID_EXPENSE_CATEGORIES };

// ─── Assets ───────────────────────────────────────────────────

const VALID_ASSET_CATEGORIES: AssetCategory[] = [
  "liquid", "investment", "property", "retirement", "other"
];

function mapAsset(id: string, data: Record<string, unknown>): Asset {
  return {
    id,
    userId: String(data.userId ?? ""),
    organizationId: String(data.organizationId ?? ""),
    semesterId: String(data.semesterId ?? ""),
    category: (data.category as AssetCategory) ?? "other",
    label: String(data.label ?? ""),
    currentValue: Number(data.currentValue ?? 0),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt)
  };
}

export async function listAssets(userId: string, semesterId: string): Promise<Asset[]> {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("assets")
    .where("userId", "==", userId)
    .where("semesterId", "==", semesterId)
    .orderBy("createdAt")
    .get();
  return snapshot.docs.map((doc) => mapAsset(doc.id, doc.data()));
}

export async function createAsset(input: {
  userId: string;
  organizationId: string;
  semesterId: string;
  category: AssetCategory;
  label: string;
  currentValue: number;
}): Promise<Asset> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("assets").doc();
  await ref.set({
    ...input,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  const snapshot = await ref.get();
  return mapAsset(ref.id, snapshot.data() as Record<string, unknown>);
}

export async function updateAsset(input: {
  assetId: string;
  userId: string;
  semesterId: string;
  category: AssetCategory;
  label: string;
  currentValue: number;
}): Promise<Asset> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("assets").doc(input.assetId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("Asset not found.");
  const current = mapAsset(snapshot.id, snapshot.data() as Record<string, unknown>);
  if (current.userId !== input.userId || current.semesterId !== input.semesterId) {
    throw new Error("That asset does not belong to this enrollment.");
  }
  await ref.set(
    {
      category: input.category,
      label: input.label,
      currentValue: input.currentValue,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  const updated = await ref.get();
  return mapAsset(ref.id, updated.data() as Record<string, unknown>);
}

export async function deleteAsset(assetId: string, userId: string, semesterId: string): Promise<void> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("assets").doc(assetId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("Asset not found.");
  const current = mapAsset(snapshot.id, snapshot.data() as Record<string, unknown>);
  if (current.userId !== userId || current.semesterId !== semesterId) {
    throw new Error("That asset does not belong to this enrollment.");
  }
  await ref.delete();
}

export { VALID_ASSET_CATEGORIES };

// ─── Allocation Target ────────────────────────────────────────

function mapAllocationTarget(id: string, data: Record<string, unknown>): AllocationTarget {
  return {
    id,
    userId: String(data.userId ?? ""),
    organizationId: String(data.organizationId ?? ""),
    semesterId: String(data.semesterId ?? ""),
    essentialPct: Number(data.essentialPct ?? 0),
    debtPct: Number(data.debtPct ?? 0),
    discretionaryPct: Number(data.discretionaryPct ?? 0),
    savingsPct: Number(data.savingsPct ?? 0),
    updatedAt: toIso(data.updatedAt)
  };
}

export async function getAllocationTarget(
  userId: string,
  semesterId: string
): Promise<AllocationTarget | null> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("allocation_targets").doc(`${semesterId}_${userId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  return mapAllocationTarget(snapshot.id, snapshot.data() as Record<string, unknown>);
}

export async function upsertAllocationTarget(
  input: Omit<AllocationTarget, "id" | "updatedAt">
): Promise<AllocationTarget> {
  const adminDb = getAdminDb();
  const ref = adminDb
    .collection("allocation_targets")
    .doc(`${input.semesterId}_${input.userId}`);
  await ref.set(
    { ...input, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  const snapshot = await ref.get();
  return mapAllocationTarget(ref.id, snapshot.data() as Record<string, unknown>);
}

export interface StudentFeedback {
  id: string;
  userId: string;
  organizationId: string;
  semesterId: string;
  comments: string;
  grade: number;
  gradeLetter: string;
  gradeBreakdown: { engagement: number; savings: number; goals: number };
  emailSent: boolean;
  submittedAt: string;
}

function mapFeedback(id: string, data: Record<string, unknown>): StudentFeedback {
  return {
    id,
    userId: String(data.userId ?? ""),
    organizationId: String(data.organizationId ?? ""),
    semesterId: String(data.semesterId ?? ""),
    comments: String(data.comments ?? ""),
    grade: Number(data.grade ?? 0),
    gradeLetter: String(data.gradeLetter ?? ""),
    gradeBreakdown: (data.gradeBreakdown ?? { engagement: 0, savings: 0, goals: 0 }) as StudentFeedback["gradeBreakdown"],
    emailSent: Boolean(data.emailSent ?? false),
    submittedAt: toIso(data.submittedAt) ?? ""
  };
}

export async function getStudentFeedback(userId: string, semesterId: string): Promise<StudentFeedback | null> {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("student_feedback")
    .where("userId", "==", userId)
    .where("semesterId", "==", semesterId)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return mapFeedback(snapshot.docs[0].id, snapshot.docs[0].data());
}

export async function createStudentFeedback(input: Omit<StudentFeedback, "id" | "submittedAt">): Promise<StudentFeedback> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection("student_feedback").doc();
  await ref.set({ ...input, submittedAt: FieldValue.serverTimestamp() });
  const snapshot = await ref.get();
  return mapFeedback(ref.id, snapshot.data() as Record<string, unknown>);
}

export async function listStudentFeedbacksForOrganization(orgId: string): Promise<StudentFeedback[]> {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection("student_feedback")
    .where("organizationId", "==", orgId)
    .orderBy("submittedAt", "desc")
    .get();
  return snapshot.docs.map(doc => mapFeedback(doc.id, doc.data()));
}
