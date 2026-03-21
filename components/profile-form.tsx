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
  const [name, setName] = useState(fullName);
  const [avatarPreview, setAvatarPreview] = useState(avatarUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function saveProfile() {
    setError(null);
    setMessage(null);

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fullName: name,
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
          <h2>Your profile</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            Update your display name and profile picture.
          </p>
        </div>
      </div>

      <div className="profile-media">
        {avatarPreview ? (
          <img alt={name} className="profile-media-image" src={avatarPreview} />
        ) : (
          <div className="profile-media-placeholder">{name.slice(0, 2).toUpperCase()}</div>
        )}
        <div className="stack-sm">
          <label className="button-secondary profile-upload-button">
            Upload profile picture
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

      <div className="field">
        <label htmlFor="profile-full-name">Display name</label>
        <input
          id="profile-full-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="profile-email">Email</label>
        <input id="profile-email" readOnly value={email} />
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
              void saveProfile();
            });
          }}
        >
          {isPending ? "Saving..." : "Save profile"}
        </button>
      </div>
    </div>
  );
}
