import type { Metadata } from "next";
import { CreateOrganizationForm } from "@/components/create-organization-form";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/src/lib/auth/session";
import { listOrganizations, listSemestersForOrganization } from "@/src/lib/data/repositories";

export const metadata: Metadata = {
  title: "System Administration"
};

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
      <div className="page-header">
        <div className="page-header-text">
          <h1>System Administration</h1>
          <p>Manage organizations, credentials, and course setup.</p>
        </div>
        <CreateOrganizationForm />
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-label">Organizations</div>
          <div className="stat-card-value">{organizations.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total courses</div>
          <div className="stat-card-value">
            {organizationDetails.reduce((sum, d) => sum + d.semesters.length, 0)}
          </div>
        </div>
      </div>

      {organizationDetails.length === 0 ? (
        <div className="empty-state">No organizations yet. Create one to get started.</div>
      ) : (
        <div className="grid-2">
          {organizationDetails.map(({ organization, semesters }) => (
            <div className="card" key={organization.orgId}>
              <div className="card-header">
                <div>
                  <h2>{organization.name}</h2>
                  <div style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span className="badge badge-default">ID: {organization.orgId}</span>
                    {organization.apiKeyPreview ? (
                      <span className="badge badge-teal">API key set</span>
                    ) : (
                      <span className="badge badge-danger">No API key</span>
                    )}
                  </div>
                </div>
                <span className="badge badge-accent">{semesters.length} course{semesters.length !== 1 ? "s" : ""}</span>
              </div>
              {semesters.length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>No courses yet.</p>
              ) : (
                <ul className="plain-list">
                  {semesters.map((semester) => (
                    <li key={semester.semesterId}>
                      <div className="semester-card">
                        <div>
                          <div className="semester-card-title">{semester.title}</div>
                          <div className="semester-card-meta">{semester.courseCode}</div>
                        </div>
                        <span className="semester-card-code">{semester.semesterId}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
