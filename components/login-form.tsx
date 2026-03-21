"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";

import { EndDrawer } from "@/components/end-drawer";
import { getClientAuth } from "@/src/lib/firebase/client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const credential = await signInWithEmailAndPassword(getClientAuth(), email, password);
      const idToken = await credential.user.getIdToken();

      const response = await fetch("/api/session/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ idToken })
      });

      if (!response.ok) {
        throw new Error("Could not create a server session.");
      }

      startTransition(() => {
        router.push("/app");
        router.refresh();
      });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to sign you in."
      );
    }
  }

  return (
    <div className="card stack">
      <h2>Sign in</h2>
      <p style={{ color: "var(--ink-2)" }}>Open the secure form drawer to continue.</p>
      <EndDrawer
        description="Use your invited or admin credentials to start an authenticated ClarkFin session."
        title="Sign in"
        triggerLabel="Open sign in form"
      >
        <form
          className="stack"
          action={(formData) => {
            void handleSubmit(formData);
          }}
        >
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required />
          </div>
          {error ? <p className="error-msg">{error}</p> : null}
          <button className="btn" type="submit" disabled={isPending}>
            {isPending ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </EndDrawer>
    </div>
  );
}
