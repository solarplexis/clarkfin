"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";

import { getClientAuth } from "@/src/lib/firebase/client";

export function InviteRedemptionForm({ inviteCode }: { inviteCode: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);

    const payload = {
      inviteCode,
      fullName: String(formData.get("fullName") ?? ""),
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
    <form
      className="panel stack"
      action={(formData) => {
        void handleSubmit(formData);
      }}
    >
      <div className="field">
        <label htmlFor="fullName">Full name</label>
        <input id="fullName" name="fullName" type="text" required />
      </div>
      <div className="field">
        <label htmlFor="email">College email</label>
        <input id="email" name="email" type="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" minLength={8} required />
      </div>
      {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
      <button className="button" type="submit" disabled={isPending}>
        {isPending ? "Creating account..." : "Create student account"}
      </button>
    </form>
  );
}
