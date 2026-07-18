"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";

import { getClientAuth } from "@/src/lib/firebase/client";

type CodeStatus = "checking" | "valid" | "invalid";

export function ResetPasswordForm({ oobCode }: { oobCode: string }) {
  const formId = useId();
  const errorId = `${formId}-error`;
  const router = useRouter();
  const [codeStatus, setCodeStatus] = useState<CodeStatus>(oobCode ? "checking" : "invalid");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      return;
    }

    let cancelled = false;

    verifyPasswordResetCode(getClientAuth(), oobCode)
      .then(() => {
        if (!cancelled) {
          setCodeStatus("valid");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCodeStatus("invalid");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);

    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsPending(false);
      return;
    }

    try {
      await confirmPasswordReset(getClientAuth(), oobCode, password);
      setIsDone(true);
      window.setTimeout(() => { router.push("/login"); }, 2000);
    } catch (submissionError) {
      const code =
        typeof submissionError === "object" && submissionError && "code" in submissionError
          ? String((submissionError as { code: unknown }).code)
          : "";

      if (code === "auth/expired-action-code" || code === "auth/invalid-action-code") {
        setCodeStatus("invalid");
      } else if (code === "auth/weak-password") {
        setError("Please choose a stronger password (at least 8 characters).");
      } else {
        setError("Unable to reset your password right now. Please try again.");
      }
    } finally {
      setIsPending(false);
    }
  }

  if (codeStatus === "checking") {
    return <p className="note-box">Checking your reset link...</p>;
  }

  if (codeStatus === "invalid") {
    return (
      <p className="error-msg" role="alert">
        This password reset link is invalid or has expired. Request a new one from the sign-in
        page.
      </p>
    );
  }

  if (isDone) {
    return <p className="success-msg">Password updated. Redirecting you to sign in...</p>;
  }

  return (
    <form
      className="stack"
      id={formId}
      action={(formData) => { void handleSubmit(formData); }}
    >
      <div className="field">
        <label htmlFor={`${formId}-password`}>New password</label>
        <div className="password-input-wrapper">
          <input
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? "true" : undefined}
            autoComplete="new-password"
            id={`${formId}-password`}
            minLength={8}
            name="password"
            required
            type={showPassword ? "text" : "password"}
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="password-toggle-btn"
            type="button"
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? (
              <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" x2="23" y1="1" y2="23"/>
              </svg>
            ) : (
              <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${formId}-confirmPassword`}>Confirm new password</label>
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? "true" : undefined}
          autoComplete="new-password"
          id={`${formId}-confirmPassword`}
          minLength={8}
          name="confirmPassword"
          required
          type={showPassword ? "text" : "password"}
        />
      </div>
      {error ? <p className="error-msg" id={errorId} role="alert">{error}</p> : null}
      <button className="button" disabled={isPending} type="submit">
        {isPending ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
