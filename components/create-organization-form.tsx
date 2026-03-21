"use client";

import { useState, useTransition } from "react";

import { EndDrawer } from "@/components/end-drawer";

type CreateOrgResponse = {
  error?: string;
  organization?: { orgId: string; name: string };
  orgAdmin?: { fullName: string; email: string };
  apiKey?: string;
};

export function CreateOrganizationForm() {
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateOrgResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submit(formData: FormData) {
    setError(null);
    setResult(null);

    const response = await fetch("/api/admin/organizations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        orgId: String(formData.get("orgId") ?? ""),
        name: String(formData.get("name") ?? ""),
        supportEmail: String(formData.get("supportEmail") ?? ""),
        allowedEmailDomains: String(formData.get("allowedEmailDomains") ?? ""),
        brandColor: String(formData.get("brandColor") ?? ""),
        orgAdminFullName: String(formData.get("orgAdminFullName") ?? ""),
        orgAdminEmail: String(formData.get("orgAdminEmail") ?? ""),
        orgAdminPassword: String(formData.get("orgAdminPassword") ?? "")
      })
    });

    const json = (await response.json()) as CreateOrgResponse;

    if (!response.ok) {
      setError(json.error ?? "Unable to create organization.");
      return;
    }

    setResult(json);
  }

  return (
    <EndDrawer
        description="Configure tenant details and create the default organization admin in one flow."
        title="Create organization"
        triggerLabel="Open organization form"
      >
        <form
          className="stack"
          action={(formData) => {
            startTransition(() => {
              void submit(formData);
            });
          }}
        >
          <div className="form-grid">
            <div className="field">
              <label htmlFor="orgId">Organization ID</label>
              <input id="orgId" name="orgId" placeholder="csn-nevada" required />
            </div>
            <div className="field">
              <label htmlFor="name">Organization name</label>
              <input id="name" name="name" placeholder="College of Southern Nevada" required />
            </div>
            <div className="field">
              <label htmlFor="supportEmail">Support email</label>
              <input id="supportEmail" name="supportEmail" type="email" />
            </div>
            <div className="field">
              <label htmlFor="brandColor">Brand color</label>
              <input id="brandColor" name="brandColor" placeholder="#0f6a5b" />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="allowedEmailDomains">Allowed student email domains</label>
              <input
                id="allowedEmailDomains"
                name="allowedEmailDomains"
                placeholder="school.edu, students.school.edu"
              />
            </div>
          </div>

          <h3>Default organization admin</h3>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="orgAdminFullName">Full name</label>
              <input id="orgAdminFullName" name="orgAdminFullName" required />
            </div>
            <div className="field">
              <label htmlFor="orgAdminEmail">Email</label>
              <input id="orgAdminEmail" name="orgAdminEmail" type="email" required />
            </div>
            <div className="field">
              <label htmlFor="orgAdminPassword">Temporary password</label>
              <input
                id="orgAdminPassword"
                name="orgAdminPassword"
                type="password"
                minLength={8}
                required
              />
            </div>
          </div>

          {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
          {result?.organization && result.apiKey ? (
            <div className="panel stack" style={{ padding: 16 }}>
              <strong>{result.organization.name} created.</strong>
              <div className="muted">Org ID: {result.organization.orgId}</div>
              <div className="muted">
                Default org admin: {result.orgAdmin?.fullName} ({result.orgAdmin?.email})
              </div>
              <div className="note">
                <strong>API key</strong>
                <div style={{ wordBreak: "break-all" }}>{result.apiKey}</div>
              </div>
            </div>
          ) : null}

          <button className="button" type="submit" disabled={isPending}>
            {isPending ? "Creating organization..." : "Create organization and org admin"}
          </button>
        </form>
      </EndDrawer>
    </section>
  );
}
