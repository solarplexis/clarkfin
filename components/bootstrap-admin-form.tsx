"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

export function BootstrapAdminForm() {
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
      <form
        className="panel stack"
        action={(formData) => {
          startTransition(() => {
            void submit(formData);
          });
        }}
      >
        <div className="field">
          <label htmlFor="fullName">Full name</label>
          <input id="fullName" name="fullName" type="text" required />
        </div>
        <div className="field">
          <label htmlFor="email">Admin email</label>
          <input id="email" name="email" type="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" minLength={8} required />
        </div>
        {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
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
    </div>
  );
}
