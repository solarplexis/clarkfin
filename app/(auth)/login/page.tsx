import Link from "next/link";

import { LoginForm } from "@/components/login-form";
import { hasSystemAdmin } from "@/src/lib/data/repositories";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const adminExists = await hasSystemAdmin();

  return (
    <main className="auth-centered">
      <div className="auth-box">
        <div className="auth-box-header">
          <span className="auth-box-logo">ClarkFin</span>
          <h1>Sign in</h1>
          <p>Enter your email and password to continue.</p>
        </div>
        <LoginForm />
        {!adminExists ? (
          <p className="auth-box-footer">
            No admin account yet?{" "}
            <Link href="/setup/admin">Create the first admin</Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}
