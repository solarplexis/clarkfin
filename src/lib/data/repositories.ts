import { FieldValue, Timestamp } from "firebase-admin/firestore";

import type {
  ActivityLog,
  ActualItem,
  BudgetActuals,
  BudgetDraft,
  ChatConversation,
  ChatMessage,
  DebtScenario,
  ExportRecord,
  Organization,
  OrganizationCreationResult,
  Semester,
  StudentEnrollment,
  StudentRecord,
  StudentInvite,
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

export async function updateUserProfile(input: {
  uid: string;
  fullName: string;
  avatarUrl?: string;
}) {
  const adminDb = getAdminDb();
  await adminDb.collection("users").doc(input.uid).set(
    {
      fullName: input.fullName,
      avatarUrl: input.avatarUrl || null,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

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
  const student = await getStudentRecordById(studentId);

  if (!student || student.organizationId !== organizationId) {
    throw new Error("That student could not be found.");
  }

  if (student.authUserId) {
    throw new Error("Linked students cannot be deleted. Mark them inactive instead.");
  }

  await adminDb.collection("students").doc(studentId).delete();
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
