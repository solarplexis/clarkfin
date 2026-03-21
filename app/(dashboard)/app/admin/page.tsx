import { CreateOrganizationForm } from "@/components/create-organization-form";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/src/lib/auth/session";
import { listOrganizations, listSemestersForOrganization } from "@/src/lib/data/repositories";

export default async function SystemAdminPage() {
  const user = await requireRole("ADMIN");
  const organizations = await listOrganizations();
  const organizationDetails = await Promise.all(
    organizations.map(async (organization) => ({
      organization,
      semesters: await listSemestersForOrganization(organization.orgId)
    }))
  );

  return (
    <DashboardShell user={user}>
      <section className="panel stack">
        <h2>System administration</h2>
        <p className="muted">
          This view is for platform operators. Review organizations, semester setup, and the
          presence of per-organization export credentials.
        </p>
      </section>
      <CreateOrganizationForm />
      <section className="grid two section">
        {organizationDetails.map(({ organization, semesters }) => (
          <article className="panel stack" key={organization.orgId}>
            <h3>{organization.name}</h3>
            <div className="pill">Org ID: {organization.orgId}</div>
            <div className="pill">
              API key: {organization.apiKeyPreview ? organization.apiKeyPreview : "Not set"}
            </div>
            <div className="muted">Semesters: {semesters.length}</div>
            <ul className="list">
              {semesters.map((semester) => (
                <li key={semester.semesterId}>
                  <strong>{semester.title}</strong>
                  <div className="muted">
                    {semester.courseCode} · invite {semester.inviteCode}
                  </div>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </DashboardShell>
  );
}
