import { getCurrentUser } from "@/src/lib/auth/session";
import { createOrganizationWithDefaultOrgAdmin as createOrgRepo } from "@/src/lib/data/repositories";
import { getAdminAuth } from "@/src/lib/firebase/admin";

export { getCurrentUser };

export async function createOrganizationWithDefaultOrgAdmin(input: {
  orgId: string;
  name: string;
  supportEmail?: string;
  allowedEmailDomains?: string[];
  brandColor?: string;
  orgAdminFullName: string;
  orgAdminEmail: string;
  orgAdminPassword: string;
}) {
  const adminAuth = getAdminAuth();

  try {
    await adminAuth.getUserByEmail(input.orgAdminEmail);
    throw new Error("A Firebase Auth user already exists for that org admin email.");
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : "";

    if (code !== "auth/user-not-found") {
      if (error instanceof Error && error.message.includes("already exists")) {
        throw error;
      }

      throw error;
    }

    if (!(error instanceof Error)) {
      // Continue when the user does not exist in Firebase Auth.
    }
  }

  const authUser = await adminAuth.createUser({
    email: input.orgAdminEmail,
    password: input.orgAdminPassword,
    displayName: input.orgAdminFullName
  });

  try {
    return await createOrgRepo({
      orgId: input.orgId,
      name: input.name,
      orgAdminUid: authUser.uid,
      orgAdminEmail: input.orgAdminEmail,
      orgAdminFullName: input.orgAdminFullName,
      supportEmail: input.supportEmail,
      allowedEmailDomains: input.allowedEmailDomains,
      brandColor: input.brandColor
    });
  } catch (error) {
    await adminAuth.deleteUser(authUser.uid);
    throw error;
  }
}
