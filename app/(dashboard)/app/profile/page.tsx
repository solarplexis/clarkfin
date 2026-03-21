import { DashboardShell } from "@/components/dashboard-shell";
import { OrganizationProfileForm } from "@/components/organization-profile-form";
import { ProfileForm } from "@/components/profile-form";
import { requireUser } from "@/src/lib/auth/session";
import { getOrganizationById } from "@/src/lib/data/repositories";

export default async function ProfilePage() {
  const user = await requireUser();
  const organization =
    user.role === "ORG_ADMIN" && user.organizationId
      ? await getOrganizationById(user.organizationId)
      : null;

  return (
    <DashboardShell user={user}>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Profile</h1>
          <p>Manage your account details and, when applicable, your organization branding.</p>
        </div>
      </div>

      <ProfileForm
        avatarUrl={user.avatarUrl}
        email={user.email}
        fullName={user.fullName}
      />

      {user.role === "ORG_ADMIN" && organization ? (
        <OrganizationProfileForm
          brandColor={organization.settings?.brandColor}
          logoUrl={organization.settings?.logoUrl}
          name={organization.name}
          supportEmail={organization.settings?.supportEmail}
        />
      ) : null}
    </DashboardShell>
  );
}
