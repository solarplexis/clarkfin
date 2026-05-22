"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";

import { EndDrawer } from "@/components/end-drawer";

export function BootstrapAdminForm() {
  const errorId = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submit(formData: FormData) {
    setMessage(null);
    setError(null);

    const response = await fetch("/api/setup/bootstrap-admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fullName: String(formData.get("fullName") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? "")
      })
    });

    const json = (await response.json()) as { error?: string; message?: string };

    if (!response.ok) {
      setError(json.error ?? "Unable to create admin user.");
      return;
    }

    setMessage(json.message ?? "Admin created.");
  }

  return (
    <div className="grid two">
      <section className="hero stack">
        <span className="eyebrow">Platform bootstrap</span>
        <h1 style={{ maxWidth: "11ch" }}>Create the first ClarkFin admin.</h1>
        <p className="lede">
          This route is only available while the platform has no `ADMIN` user. Once created,
          use that account to sign in and manage organizations.
        </p>
        <Link className="button-secondary" href="/login">
          Back to login
        </Link>
      </section>
      <section className="panel stack">
        <h2>Bootstrap admin setup</h2>
        <p className="muted">Create the first platform admin using the setup drawer.</p>
        <EndDrawer
          description="This account will become the platform-level administrator for ClarkFin."
          title="Create first admin"
          triggerLabel="Open admin setup form"
        >
          <form
            className="stack"
            action={(formData) => {
              startTransition(() => {
                void submit(formData);
              });
            }}
          >
            <div className="field">
              <label htmlFor="fullName">Full name</label>
              <input
                aria-describedby={error ? errorId : undefined}
                aria-invalid={error ? "true" : undefined}
                id="fullName"
                name="fullName"
                required
                type="text"
              />
            </div>
            <div className="field">
              <label htmlFor="email">Admin email</label>
              <input
                aria-describedby={error ? errorId : undefined}
                aria-invalid={error ? "true" : undefined}
                id="email"
                name="email"
                required
                type="email"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                aria-describedby={error ? errorId : undefined}
                aria-invalid={error ? "true" : undefined}
                id="password"
                minLength={8}
                name="password"
                required
                type="password"
              />
            </div>
            {error ? <p className="error-msg" id={errorId} role="alert">{error}</p> : null}
            {message ? (
              <div className="stack">
                <p style={{ color: "var(--accent)", margin: 0 }}>{message}</p>
                <Link className="button-secondary" href="/login">
                  Continue to login
                </Link>
              </div>
            ) : null}
            <button className="button" type="submit" disabled={isPending}>
              {isPending ? "Creating admin..." : "Create platform admin"}
            </button>
          </form>
        </EndDrawer>
      </section>
    </div>
  );
}
