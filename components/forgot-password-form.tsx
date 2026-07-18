"use client";

import { useId, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";

import { getClientAuth } from "@/src/lib/firebase/client";

export function ForgotPasswordForm() {
  const formId = useId();
  const errorId = `${formId}-error`;
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);

    const email = String(formData.get("email") ?? "").trim();

    try {
      await sendPasswordResetEmail(getClientAuth(), email, {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true
      });
      setIsSent(true);
    } catch (submissionError) {
      const code =
        typeof submissionError === "object" && submissionError && "code" in submissionError
          ? String((submissionError as { code: unknown }).code)
          : "";

      if (code === "auth/user-not-found" || code === "auth/invalid-email") {
        setIsSent(true);
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a bit before trying again.");
      } else {
        setError("Unable to send a reset link right now. Please try again.");
      }
    } finally {
      setIsPending(false);
    }
  }

  if (isSent) {
    return (
      <p className="success-msg">
        If an account exists for that email, we&apos;ve sent a link to reset your password.
      </p>
    );
  }

  return (
    <form
      className="stack"
      id={formId}
      action={(formData) => { void handleSubmit(formData); }}
    >
      <div className="field">
        <label htmlFor={`${formId}-email`}>Email</label>
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? "true" : undefined}
          autoComplete="email"
          id={`${formId}-email`}
          name="email"
          required
          type="email"
        />
      </div>
      {error ? <p className="error-msg" id={errorId} role="alert">{error}</p> : null}
      <button className="button" disabled={isPending} type="submit">
        {isPending ? "Sending..." : "Send reset link"}
      </button>
    </form>
  );
}
