"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

export function InviteRedemptionForm({
  inviteCode,
  invitedEmail,
  invitedFirstName,
  invitedLastName
}: {
  inviteCode: string;
  invitedEmail: string;
  invitedFirstName?: string;
  invitedLastName?: string;
}) {
  const formId = useId();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);

    const payload = {
      inviteCode,
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? "")
    };

    try {
      const registerResponse = await fetch("/api/invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const registerJson = (await registerResponse.json()) as { error?: string };

      if (!registerResponse.ok) {
        throw new Error(registerJson.error ?? "Registration failed.");
      }

      const loginResponse = await fetch("/api/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: payload.email, password: payload.password })
      });

      if (!loginResponse.ok) {
        throw new Error("Invite accepted, but the session could not be established.");
      }

      router.push("/app");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to redeem invite."
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form
      id={formId}
      className="stack"
      action={(formData) => { void handleSubmit(formData); }}
    >
      <div className="field">
        <label htmlFor={`${formId}-firstName`}>First name</label>
        <input
          defaultValue={invitedFirstName}
          id={`${formId}-firstName`}
          name="firstName"
          required
          type="text"
          autoComplete="given-name"
        />
      </div>
      <div className="field">
        <label htmlFor={`${formId}-lastName`}>Last name</label>
        <input
          defaultValue={invitedLastName}
          id={`${formId}-lastName`}
          name="lastName"
          required
          type="text"
          autoComplete="family-name"
        />
      </div>
      <div className="field">
        <label htmlFor={`${formId}-email`}>Email Address</label>
        <input
          defaultValue={invitedEmail}
          id={`${formId}-email`}
          name="email"
          readOnly
          required
          type="email"
          autoComplete="email"
        />
      </div>
      <div className="field">
        <label htmlFor={`${formId}-password`}>Password</label>
        <div className="password-input-wrapper">
          <input
            id={`${formId}-password`}
            minLength={8}
            name="password"
            required
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
          />
          <button
            type="button"
            className="password-toggle-btn"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
        <span className="field-hint">Use your existing password, or choose a new one if this is your first time.</span>
      </div>
      {error ? <p className="error-msg">{error}</p> : null}
      <button className="button" type="submit" disabled={isPending}>
        {isPending ? "Accepting..." : "Accept Invite"}
      </button>
    </form>
  );
}
