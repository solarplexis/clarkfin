import Link from "next/link";

import { AccountMenu } from "@/components/account-menu";
import type { UserProfile } from "@/types/domain";

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
          <Link href="/docs/api"><span>API Docs</span></Link>
        </nav>
        <div className="appbar-end">
          <AccountMenu avatarUrl={user.avatarUrl} fullName={user.fullName} />
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
