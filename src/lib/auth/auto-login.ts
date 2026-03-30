import { cookies } from "next/headers";

import { getAdminAuth } from "@/src/lib/firebase/admin";
import { getFirebaseApiKey, getAppUrl, getSessionCookieName } from "@/src/lib/env";
import {
  createStudentEnrollment,
  createUserProfile,
  getOrganizationById,
  getSemesterById,
  getStudentRecordByEmail,
  getUserProfileById,
  linkStudentRecordToAuthUser,
  setUserActiveSemester
} from "@/src/lib/data/repositories";

export interface AutoLoginToken {
  firstName: string;
  lastName: string;
  email: string;
  orgId: string;
  semesterId: string;
}

const MAX_SESSION_MS = 14 * 24 * 60 * 60 * 1000; // Firebase max: 14 days

export function encodeAutoLoginToken(data: AutoLoginToken): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

export function decodeAutoLoginToken(token: string): AutoLoginToken | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as Partial<AutoLoginToken>;
    if (!decoded.firstName || !decoded.lastName || !decoded.email || !decoded.orgId || !decoded.semesterId) {
      return null;
    }
    return decoded as AutoLoginToken;
  } catch {
    return null;
  }
}

export async function exchangeCustomTokenForIdToken(customToken: string): Promise<string> {
  const apiKey = getFirebaseApiKey();
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true })
    }
  );

  const json = (await res.json()) as { idToken?: string; error?: { message?: string } };

  if (!res.ok || !json.idToken) {
    throw new Error(json.error?.message ?? "Failed to exchange custom token for ID token.");
  }

  return json.idToken;
}

export async function provisionAutoLoginStudent(data: AutoLoginToken): Promise<string> {
  const email = data.email.trim().toLowerCase();
  const fullName = `${data.firstName} ${data.lastName}`.trim();

  const [org, semester] = await Promise.all([
    getOrganizationById(data.orgId),
    getSemesterById(data.semesterId)
  ]);

  if (!org) throw new Error("Organization not found.");
  if (!semester || semester.orgId !== data.orgId) throw new Error("Course not found for this organization.");

  const adminAuth = getAdminAuth();

  let uid: string;

  try {
    const existing = await adminAuth.getUserByEmail(email);
    uid = existing.uid;
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? err.code : "";
    if (code !== "auth/user-not-found") throw err;

    const newUser = await adminAuth.createUser({ email, displayName: fullName });
    uid = newUser.uid;
  }

  const existingProfile = await getUserProfileById(uid);

  if (!existingProfile) {
    await createUserProfile({
      uid,
      email,
      fullName,
      role: "STUDENT",
      organizationId: data.orgId,
      activeSemesterId: data.semesterId
    });
  }

  const studentRecord = await getStudentRecordByEmail(data.orgId, email);

  if (studentRecord) {
    if (!studentRecord.authUserId) {
      await linkStudentRecordToAuthUser({
        studentId: studentRecord.studentId,
        organizationId: data.orgId,
        authUserId: uid,
        firstName: data.firstName,
        lastName: data.lastName,
        email
      });
    }
  }

  await createStudentEnrollment({
    userId: uid,
    organizationId: data.orgId,
    semesterId: data.semesterId,
    studentEmail: email
  });

  await setUserActiveSemester(uid, data.semesterId);

  return uid;
}

export async function setAutoLoginSessionCookie(uid: string): Promise<void> {
  const adminAuth = getAdminAuth();
  const customToken = await adminAuth.createCustomToken(uid);
  const idToken = await exchangeCustomTokenForIdToken(customToken);
  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: MAX_SESSION_MS });

  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName(), sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: Math.floor(MAX_SESSION_MS / 1000),
    path: "/"
  });
}

export function buildAutoLoginUrl(data: AutoLoginToken): string {
  const token = encodeAutoLoginToken(data);
  return `${getAppUrl()}/api/auto-login?t=${token}`;
}
