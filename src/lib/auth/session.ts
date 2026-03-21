import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { UserProfile, UserRole } from "@/types/domain";
import { getSessionCookieName } from "@/src/lib/env";
import { getAdminAuth } from "@/src/lib/firebase/admin";
import { getUserProfileById } from "@/src/lib/data/repositories";

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
