"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";

import { EndDrawer } from "@/components/end-drawer";
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
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
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
        headers: {
          "Content-Type": "application/json"
        },
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
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ idToken })
      });

      if (!loginResponse.ok) {
        throw new Error("Account created, but the server session could not be established.");
      }

      startTransition(() => {
        router.push("/app");
        router.refresh();
      });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to redeem invite."
      );
    }
  }

  return (
    <div className="card stack">
      <h2>Create student account</h2>
      <p style={{ color: "var(--ink-2)" }}>
        Open the enrollment drawer to create your account or attach this course to your existing
        account.
      </p>
      <EndDrawer
        description="Confirm the invited identity, choose a password, and establish a secure session."
        footer={
          <button className="button" disabled={isPending} form={formId} type="submit">
            {isPending ? "Creating account..." : "Create student account"}
          </button>
        }
        title="Invite enrollment"
        triggerLabel="Open enrollment form"
      >
        <form
          action={(formData) => {
            void handleSubmit(formData);
          }}
          className="stack"
          id={formId}
        >
          <div className="field">
            <label htmlFor={`${formId}-firstName`}>First name</label>
            <input
              defaultValue={invitedFirstName}
              id={`${formId}-firstName`}
              name="firstName"
              required
              type="text"
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
            />
          </div>
          <div className="field">
            <label htmlFor={`${formId}-email`}>College email</label>
            <input
              defaultValue={invitedEmail}
              id={`${formId}-email`}
              name="email"
              readOnly
              required
              type="email"
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
            />
          </div>
          {error ? <p className="error-msg">{error}</p> : null}
        </form>
      </EndDrawer>
    </div>
  );
}
