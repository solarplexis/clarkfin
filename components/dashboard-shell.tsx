"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

import { AccountMenu } from "@/components/account-menu";
import type { UserProfile } from "@/types/domain";

type NavItem = {
  href: Route;
  label: string;
  exact?: boolean;
};

function isActivePath(pathname: string, href: string, exact = true) {
  if (exact) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardShell({
  user,
  children
}: {
  user: UserProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems: NavItem[] = user.role === "STUDENT"
    ? [
        { href: "/app/student", label: "Home" },
        { href: "/app/student/budget", label: "Budget", exact: false },
        { href: "/app/student/balance-sheet", label: "Balance" },
        { href: "/app/student/planner", label: "Planner" },
        { href: "/app/student/goals", label: "Goals" },
        { href: "/app/student/debt", label: "Debt" },
        { href: "/app/student/snapshot", label: "Snapshot" }
      ]
    : user.role === "ORG_ADMIN"
      ? [
          { href: "/app/org", label: "Dashboard" },
          { href: "/app/org/course-grid", label: "Course Progress" }
        ]
      : user.role === "ADMIN"
        ? [{ href: "/app/admin", label: "System Admin" }]
        : [];

  return (
    <>
      <header className="appbar">
        <div className="appbar-logo">
          ClarkFin
        </div>
        <nav className="appbar-nav">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href, item.exact ?? true);

            return (
              <Link
                key={item.href}
                aria-current={active ? "page" : undefined}
                className={active ? "active" : undefined}
                href={item.href}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
          {user.role !== "STUDENT" && (() => {
            const active = isActivePath(pathname, "/docs/api", false);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={active ? "active" : undefined}
                href="/docs/api"
              >
                <span>API Docs</span>
              </Link>
            );
          })()}
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
