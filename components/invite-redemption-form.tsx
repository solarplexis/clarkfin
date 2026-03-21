"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";

import { getClientAuth } from "@/src/lib/firebase/client";

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

      const credential = await signInWithEmailAndPassword(
        getClientAuth(),
        payload.email,
        payload.password
      );
      const idToken = await credential.user.getIdToken();

      const loginResponse = await fetch("/api/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
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
        <input
          id={`${formId}-password`}
          minLength={8}
          name="password"
          required
          type="password"
          autoComplete="current-password"
        />
        <span className="field-hint">Use your existing password, or choose a new one if this is your first time.</span>
      </div>
      {error ? <p className="error-msg">{error}</p> : null}
      <button className="button" type="submit" disabled={isPending}>
        {isPending ? "Accepting..." : "Accept Invite"}
      </button>
    </form>
  );
}
