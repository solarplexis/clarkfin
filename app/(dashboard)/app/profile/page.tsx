import { DashboardShell } from "@/components/dashboard-shell";
import { OrganizationProfileForm } from "@/components/organization-profile-form";
import { ProfileForm } from "@/components/profile-form";
import { requireUser } from "@/src/lib/auth/session";
import { getOrganizationById } from "@/src/lib/data/repositories";

export default async function ProfilePage() {
  const user = await requireUser();
  const organization = user.organizationId
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

      {user.role === "STUDENT" && organization ? (
        <div className="card stack">
          <div className="card-header">
            <div>
              <h2>Organization</h2>
              <p className="muted" style={{ marginTop: 6 }}>Your enrolled institution.</p>
            </div>
          </div>
          <div className="org-affiliation">
            {organization.settings?.logoUrl ? (
              <img
                alt={organization.name}
                className="org-affiliation-logo"
                src={organization.settings.logoUrl}
              />
            ) : (
              <div
                className="org-affiliation-logo-placeholder"
                style={organization.settings?.brandColor
                  ? { background: organization.settings.brandColor }
                  : undefined}
              >
                {organization.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="org-affiliation-name">{organization.name}</div>
              {organization.settings?.supportEmail ? (
                <div className="org-affiliation-meta">{organization.settings.supportEmail}</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

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
