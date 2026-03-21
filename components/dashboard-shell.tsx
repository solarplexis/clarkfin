import Link from "next/link";

import type { UserProfile } from "@/types/domain";
import { LogoutButton } from "@/components/logout-button";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function DashboardShell({
  user,
  children
}: {
  user: UserProfile;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="appbar">
        <div className="appbar-logo">
          ClarkFin
        </div>
        <nav className="appbar-nav">
          {user.role === "STUDENT" && (
            <>
              <Link href="/app/student"><span>Home</span></Link>
              <Link href="/app/student/budget"><span>Budget</span></Link>
              <Link href="/app/student/debt"><span>Debt</span></Link>
            </>
          )}
          {user.role === "ORG_ADMIN" && (
            <Link href="/app/org"><span>Dashboard</span></Link>
          )}
          {user.role === "ADMIN" && (
            <Link href="/app/admin"><span>System Admin</span></Link>
          )}
        </nav>
        <div className="appbar-end">
          <div className="appbar-user">
            <div className="appbar-avatar">{initials(user.fullName)}</div>
            <span className="appbar-user-name">{user.fullName}</span>
          </div>
          <LogoutButton />
        </div>
      </header>
      <div className="page-shell">
        <div className="page-content">
          {children}
        </div>
      </div>
    </>
  );
}
