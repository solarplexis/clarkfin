import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { UserProfile, UserRole } from "@/types/domain";
import { getSessionCookieName } from "@/src/lib/env";
import { getAdminAuth } from "@/src/lib/firebase/admin";
import {
  getSemesterById,
  getStudentEnrollment,
  getUserProfileById,
  listStudentEnrollments,
  setUserActiveSemester
} from "@/src/lib/data/repositories";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(getSessionCookieName())?.value;

  if (!sessionCookie) {
    return null;
  }

  try {
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const profile = await getUserProfileById(decoded.uid);

    if (!profile) {
      return null;
    }

    return profile;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireRole(...roles: UserRole[]) {
  const user = await requireUser();

  if (!roles.includes(user.role)) {
    redirect("/app");
  }

  return user;
}

export function canAccessOrganization(user: UserProfile, orgId: string) {
  return user.role === "ADMIN" || user.organizationId === orgId;
}

export async function resolveStudentWorkspace(user: UserProfile) {
  if (user.role !== "STUDENT") {
    return null;
  }

  const enrollments = await listStudentEnrollments(user.uid);

  if (enrollments.length === 0) {
    return {
      enrollments: [],
      activeEnrollment: null,
      activeSemester: null
    };
  }

  const activeEnrollment =
    (user.activeSemesterId
      ? enrollments.find((enrollment) => enrollment.semesterId === user.activeSemesterId)
      : null) ?? enrollments[0];

  if (!user.activeSemesterId || user.activeSemesterId !== activeEnrollment.semesterId) {
    await setUserActiveSemester(user.uid, activeEnrollment.semesterId);
    user.activeSemesterId = activeEnrollment.semesterId;
  }

  const [activeSemester, enrollmentCheck] = await Promise.all([
    getSemesterById(activeEnrollment.semesterId),
    getStudentEnrollment(user.uid, activeEnrollment.semesterId)
  ]);

  if (!enrollmentCheck) {
    return {
      enrollments,
      activeEnrollment: null,
      activeSemester: null
    };
  }

  return {
    enrollments,
    activeEnrollment,
    activeSemester
  };
}
