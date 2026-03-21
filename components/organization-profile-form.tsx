"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

async function toDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });
}

export function OrganizationProfileForm({
  name,
  supportEmail,
  brandColor,
  logoUrl
}: {
  name: string;
  supportEmail?: string;
  brandColor?: string;
  logoUrl?: string;
}) {
  const router = useRouter();
  const [orgName, setOrgName] = useState(name);
  const [support, setSupport] = useState(supportEmail ?? "");
  const [color, setColor] = useState(brandColor ?? "");
  const [logoPreview, setLogoPreview] = useState(logoUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function saveOrganization() {
    setError(null);
    setMessage(null);

    const response = await fetch("/api/org/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: orgName,
        supportEmail: support,
        brandColor: color,
        logoUrl: logoPreview
      })
    });

    const json = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(json.error ?? "Unable to update organization.");
      return;
    }

    setMessage("Organization profile updated.");
    router.refresh();
  }

  return (
    <div className="card stack">
      <div className="card-header">
        <div>
          <h2>Organization profile</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            Edit the organization name and visual branding shown to admins and students.
          </p>
        </div>
      </div>

      <div className="profile-media">
        {logoPreview ? (
          <img alt={orgName} className="profile-media-image profile-media-logo" src={logoPreview} />
        ) : (
          <div className="profile-media-placeholder profile-media-logo">{orgName.slice(0, 2).toUpperCase()}</div>
        )}
        <div className="stack-sm">
          <label className="button-secondary profile-upload-button">
            Upload organization logo
            <input
              accept="image/*"
              hidden
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (!file) {
                  return;
                }

                startTransition(() => {
                  void toDataUrl(file)
                    .then((dataUrl) => {
                      setLogoPreview(dataUrl);
                    })
                    .catch((uploadError) => {
                      setError(
                        uploadError instanceof Error
                          ? uploadError.message
                          : "Unable to load organization logo."
                      );
                    });
                });
              }}
            />
          </label>
          {logoPreview ? (
            <button
              className="button-secondary"
              type="button"
              onClick={() => setLogoPreview("")}
            >
              Remove logo
            </button>
          ) : null}
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="organization-name">Organization name</label>
          <input
            id="organization-name"
            value={orgName}
            onChange={(event) => setOrgName(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="organization-support-email">Support email</label>
          <input
            id="organization-support-email"
            type="email"
            value={support}
            onChange={(event) => setSupport(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="organization-brand-color">Brand color</label>
          <input
            id="organization-brand-color"
            placeholder="#5b5ef6"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
        </div>
      </div>

      {error ? <p className="error-msg">{error}</p> : null}
      {message ? <p style={{ color: "var(--teal)", margin: 0 }}>{message}</p> : null}

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button
          className="button"
          disabled={isPending}
          type="button"
          onClick={() => {
            startTransition(() => {
              void saveOrganization();
            });
          }}
        >
          {isPending ? "Saving..." : "Save organization"}
        </button>
      </div>
    </div>
  );
}
