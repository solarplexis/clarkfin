import Link from "next/link";

import { LoginForm } from "@/components/login-form";
import { hasSystemAdmin } from "@/src/lib/data/repositories";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const adminExists = await hasSystemAdmin();

  return (
    <main className="page grid two">
      <section className="hero stack">
        <span className="eyebrow">Secure access</span>
        <h1 style={{ maxWidth: "11ch" }}>Sign in to your ClarkFin workspace.</h1>
        <p className="lede">
          Students use their invited email and password. Organization admins and system
          admins sign in through the same Firebase-backed session flow.
        </p>
        <div className="row">
          <Link className="button-secondary" href="/">
            Back home
          </Link>
          {!adminExists ? (
            <Link className="button" href="/setup/admin">
              Create first admin
            </Link>
          ) : null}
        </div>
      </section>
      <LoginForm />
    </main>
  );
}
