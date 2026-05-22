"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

async function toDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });
}

function splitName(fullName: string) {
  const i = fullName.indexOf(" ");
  return i === -1
    ? { firstName: fullName, lastName: "" }
    : { firstName: fullName.slice(0, i), lastName: fullName.slice(i + 1) };
}

export function ProfileForm({
  fullName,
  email,
  avatarUrl
}: {
  fullName: string;
  email: string;
  avatarUrl?: string;
}) {
  const router = useRouter();
  const errorId = useId();
  const avatarInputId = useId();
  const [firstName, setFirstName] = useState(() => splitName(fullName).firstName);
  const [lastName, setLastName] = useState(() => splitName(fullName).lastName);
  const [avatarPreview, setAvatarPreview] = useState(avatarUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function saveProfile() {
    setError(null);
    setMessage(null);

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fullName,
        avatarUrl: avatarPreview
      })
    });

    const json = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(json.error ?? "Unable to update profile.");
      return;
    }

    setMessage("Profile updated.");
    router.refresh();
  }

  return (
    <div className="card stack">
      <div className="card-header">
        <div>
          <h2>Your Profile</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            Update your display name and profile picture.
          </p>
        </div>
      </div>

      <div className="profile-media">
        {avatarPreview ? (
          <img alt={`${firstName} ${lastName}`} className="profile-media-image" src={avatarPreview} />
        ) : (
          <div className="profile-media-placeholder">{`${firstName}${lastName}`.slice(0, 2).toUpperCase()}</div>
        )}
        <div className="stack-sm">
          <label
            aria-controls={avatarInputId}
            className="button-secondary profile-upload-button"
            htmlFor={avatarInputId}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                document.getElementById(avatarInputId)?.click();
              }
            }}
          >
            Upload profile picture
            <input
              accept="image/*"
              id={avatarInputId}
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
                      setAvatarPreview(dataUrl);
                    })
                    .catch((uploadError) => {
                      setError(
                        uploadError instanceof Error
                          ? uploadError.message
                          : "Unable to load profile image."
                      );
                    });
                });
              }}
            />
          </label>
          {avatarPreview ? (
            <button
              className="button-secondary"
              type="button"
              onClick={() => setAvatarPreview("")}
            >
              Remove picture
            </button>
          ) : null}
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="profile-first-name">First name</label>
          <input
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? "true" : undefined}
            autoComplete="given-name"
            id="profile-first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="profile-last-name">Last name</label>
          <input
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? "true" : undefined}
            autoComplete="family-name"
            id="profile-last-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="profile-email">Email</label>
        <input id="profile-email" readOnly value={email} />
      </div>

      {error ? <p className="error-msg" id={errorId} role="alert">{error}</p> : null}
      {message ? <p style={{ color: "var(--teal)", margin: 0 }}>{message}</p> : null}

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button
          className="button"
          disabled={isPending}
          type="button"
          onClick={() => {
            startTransition(() => {
              void saveProfile();
            });
          }}
        >
          {isPending ? "Saving..." : "Save Profile"}
        </button>
      </div>
    </div>
  );
}
