"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";

import { AccountMenu } from "@/components/account-menu";
import type { UserProfile } from "@/types/domain";

// ─── Types ────────────────────────────────────────────────────

type NavItem = {
  href: Route;
  label: string;
  exact?: boolean;
};

// ─── Guided tour steps ────────────────────────────────────────

const GUIDED_STEPS = [
  {
    path: "/app/student/goals",
    label: "Your Goals",
    headline: "Before you log anything — what are you working toward?",
    description:
      "Goals are what turn numbers into decisions. Every dollar you log, every savings rate you set, every debt you pay down — it all gets its meaning from this screen. Set your goals first. Everything else in this app follows from them."
  },
  {
    path: "/app/student/budget",
    label: "Your Income",
    headline: "What does your financial life actually look like?",
    description:
      "Log your real take-home pay — after taxes and withholdings, not the gross number on your offer letter. Add your expense categories too. This single number drives every projection in the app. Your savings rate, goal timelines, and allocation targets all start here."
  },
  {
    path: "/app/student/debt",
    label: "Your Debt",
    headline: "Know what you owe before you plan what to save.",
    description:
      "Debt is a monthly obligation that comes out before anything else. Log every debt you carry: student loans, credit cards, car payments. Monthly payments pull through automatically as an expense category. Balances flow directly into your net worth on the next screen."
  },
  {
    path: "/app/student/balance-sheet",
    label: "Your Net Worth",
    headline: "Here's where you actually stand.",
    description:
      "Net worth is assets minus liabilities — what you own minus what you owe. For most students this starts negative, and that's fine. The number matters less than whether it's moving in the right direction. Add your assets here; your debts pulled in automatically from the previous step."
  },
  {
    path: "/app/student",
    label: "Your Plan",
    headline: "Divide your income before it decides for itself.",
    description:
      "Every dollar you earn needs a job. Here you set the percentage of your take-home that goes to essentials, debt payments, discretionary spending, and savings. Get this allocation right and every number in the app — goal timelines, weekly budget, savings rate — snaps into focus."
  },
  {
    path: "/app/student/planner",
    label: "Your Budget",
    headline: "The plan meets real life — week by week.",
    description:
      "The allocation you just set becomes your weekly spending limit. Track what you actually spend. Watch how your choices this week shift your goal timelines. This is the screen you'll come back to most often — it's the home base of the app."
  },
  {
    path: "/app/student/snapshot",
    label: "Your Report",
    headline: "The full picture, in one place.",
    description:
      "This report assembles everything you've logged — income, expenses, debts, assets, and goal progress — into a monthly snapshot you can save or print. Keep your data current and this writes itself. Come back at the end of each month to see your trajectory."
  }
] as const;

const GUIDED_KEY = "clarkfin_guided_mode";

// ─── Helpers ─────────────────────────────────────────────────

function isActivePath(pathname: string, href: string, exact = true) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

// ─── Main component ───────────────────────────────────────────

export function DashboardShell({
  user,
  children
}: {
  user: UserProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [routeAnnouncement, setRouteAnnouncement] = useState("");
  const [guidedMode, setGuidedMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setGuidedMode(localStorage.getItem(GUIDED_KEY) === "true");
    setMounted(true);
  }, []);

  useEffect(() => {
    setRouteAnnouncement(document.title.trim());
  }, [pathname]);

  function enterGuided() {
    localStorage.setItem(GUIDED_KEY, "true");
    setGuidedMode(true);
    router.push(GUIDED_STEPS[0].path);
  }

  function exitGuided() {
    localStorage.setItem(GUIDED_KEY, "false");
    setGuidedMode(false);
  }

  const isStudent = user.role === "STUDENT";

  const currentStepIdx = isStudent
    ? GUIDED_STEPS.findIndex(s => s.path === pathname)
    : -1;
  const currentStep = currentStepIdx >= 0 ? GUIDED_STEPS[currentStepIdx] : null;
  const prevStep = currentStepIdx > 0 ? GUIDED_STEPS[currentStepIdx - 1] : null;
  const nextStep = currentStepIdx < GUIDED_STEPS.length - 1 ? GUIDED_STEPS[currentStepIdx + 1] : null;

  const navItems: NavItem[] = user.role === "STUDENT"
    ? [
        { href: "/app/student/planner", label: "Budget", exact: false },
        { href: "/app/student", label: "Dashboard" },
        { href: "/app/student/budget", label: "Income", exact: false },
        { href: "/app/student/balance-sheet", label: "Balance Sheet" },
        { href: "/app/student/goals", label: "Goals" },
        { href: "/app/student/debt", label: "Debt" },
        { href: "/app/student/snapshot", label: "Report" }
      ]
    : user.role === "ORG_ADMIN"
      ? [
          { href: "/app/org", label: "Dashboard" },
          { href: "/app/org/course-grid", label: "Course Progress" }
        ]
      : user.role === "ADMIN"
        ? [{ href: "/app/admin", label: "System Admin" }]
        : [];

  // ── Guided mode layout ────────────────────────────────────────

  if (mounted && guidedMode && isStudent && currentStep) {
    return (
      <>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <div aria-atomic="true" aria-live="polite" className="sr-only" role="status">
          {routeAnnouncement}
        </div>
        <div className="guided-overlay">

          {/* Top chrome */}
          <div className="guided-chrome">
            <span className="guided-chrome-logo">ClarkFin</span>
            <span className="guided-chrome-sep" />
            <span className="guided-chrome-label">Guided Tour</span>
            <div className="guided-chrome-dots" aria-hidden="true">
              {GUIDED_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`guided-chrome-dot${
                    i === currentStepIdx ? " guided-chrome-dot-active" :
                    i < currentStepIdx ? " guided-chrome-dot-done" : ""
                  }`}
                />
              ))}
            </div>
            <button className="guided-chrome-exit" onClick={exitGuided} type="button" aria-label="Exit guided tour">
              Exit guided tour ×
            </button>
          </div>

          {/* Scrollable area */}
          <div className="guided-scroll">

            {/* Hero: progress bar + headline + description */}
            <div className="guided-shell-hero">
              <div className="guided-progress-bar" aria-hidden="true">
                {GUIDED_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`guided-progress-seg${
                      i < currentStepIdx ? " guided-progress-done" :
                      i === currentStepIdx ? " guided-progress-active" : ""
                    }`}
                  />
                ))}
              </div>
              <div className="guided-step-counter">
                Step {currentStepIdx + 1} of {GUIDED_STEPS.length} · {currentStep.label}
              </div>
              <h1 className="guided-headline">{currentStep.headline}</h1>
              <p className="guided-description">{currentStep.description}</p>
            </div>

            {/* Full-width page content */}
            <div className="guided-shell-page" id="main-content" tabIndex={-1}>
              {children}
            </div>

            {/* Bottom nav */}
            <div className="guided-shell-hero" style={{ paddingTop: 0 }}>
              <div className="guided-nav">
                <div className="guided-nav-back">
                  {prevStep && (
                    <button
                      className="guided-nav-btn guided-nav-btn-back"
                      onClick={() => router.push(prevStep.path)}
                      type="button"
                    >
                      <span className="guided-nav-arrow">←</span>
                      <span className="guided-nav-text">
                        <span className="guided-nav-primary">{prevStep.label}</span>
                        <span className="guided-nav-sub">Previous step</span>
                      </span>
                    </button>
                  )}
                </div>
                <div className="guided-nav-forward">
                  {nextStep ? (
                    <button
                      className="guided-nav-btn guided-nav-btn-next"
                      onClick={() => router.push(nextStep.path)}
                      type="button"
                    >
                      <span className="guided-nav-text" style={{ textAlign: "right" }}>
                        <span className="guided-nav-primary">{nextStep.label}</span>
                        <span className="guided-nav-sub">Next step</span>
                      </span>
                      <span className="guided-nav-arrow">→</span>
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={exitGuided} type="button">
                      Done — switch to standard view
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </>
    );
  }

  // ── Standard layout ───────────────────────────────────────────

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div aria-atomic="true" aria-live="polite" className="sr-only" role="status">
        {routeAnnouncement}
      </div>
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
          {isStudent && mounted && (
            <div className="guided-tour-btn-wrap" data-tooltip="Come back anytime — the tour is always here">
              <button className="guided-tour-btn" onClick={enterGuided} type="button">
                Guided Tour
              </button>
            </div>
          )}
          <AccountMenu avatarUrl={user.avatarUrl} fullName={user.fullName} />
        </div>
      </header>
      <main className="page-shell" id="main-content" tabIndex={-1}>
        <div className="page-content">
          {children}
        </div>
      </main>
    </>
  );
}
