import Link from "next/link";

import type { UserProfile } from "@/types/domain";
import { LogoutButton } from "@/components/logout-button";

export function DashboardShell({
  user,
  children
}: {
  user: UserProfile;
  children: React.ReactNode;
}) {
  return (
    <main className="page app-shell">
      <header className="hero app-header">
        <div className="stack">
          <span className="eyebrow">ClarkFin Workspace</span>
          <div>
            <h1 style={{ fontSize: "clamp(2rem, 3vw, 3rem)", maxWidth: "unset" }}>
              {user.fullName}
            </h1>
            <p className="lede" style={{ marginBottom: 0 }}>
              Signed in as {user.role} {user.organizationId ? `for ${user.organizationId}` : ""}.
            </p>
          </div>
        </div>
        <div className="stack" style={{ justifyItems: "end" }}>
          <nav>
            <Link className="button-secondary" href="/app">
              Home
            </Link>
            {user.role === "STUDENT" ? (
              <>
                <Link className="button-secondary" href="/app/student/budget">
                  Budget tool
                </Link>
                <Link className="button-secondary" href="/app/student/debt">
                  Debt simulator
                </Link>
              </>
            ) : null}
            {user.role === "ORG_ADMIN" ? (
              <Link className="button-secondary" href="/app/org">
                Org dashboard
              </Link>
            ) : null}
            {user.role === "ADMIN" ? (
              <Link className="button-secondary" href="/app/admin">
                System admin
              </Link>
            ) : null}
          </nav>
          <LogoutButton />
        </div>
      </header>
      {children}
    </main>
  );
}
