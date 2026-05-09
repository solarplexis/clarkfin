"use client";

import { useRef, useState } from "react";

interface ReportData {
  studentName: string;
  courseTitle: string;
  courseCode: string;
  durationWeeks: number;
  generatedAt: string;
  netPayMonthly: number;
  savingsPct: number;
  savingsActual: number;
  totalIncome: number;
  totalExpenses: number;
  essentialExpenses: number;
  debtExpenses: number;
  discretionaryExpenses: number;
  totalAssets: number;
  totalDebt: number;
  netWorth: number;
  goals: Array<{ label: string; targetAmount: number; savedToDate: number; progressPct: number; isComplete: boolean }>;
  debts: Array<{ label: string; originalBalance: number; currentBalance: number; paidDownPct: number }>;
  recommendations: string;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function pct(n: number) {
  return `${Math.round(n)}%`;
}

function ReportView({ report }: { report: ReportData }) {
  return (
    <div className="fr-report">
      <div className="fr-header">
        <div className="fr-logo">ClarkFin</div>
        <div className="fr-header-meta">
          <div className="fr-course">{report.courseCode} · {report.courseTitle}</div>
          <div className="fr-student">{report.studentName}</div>
          <div className="fr-date">Generated {report.generatedAt}</div>
        </div>
      </div>

      <h1 className="fr-title">End-of-Course Performance Report</h1>

      <section className="fr-section">
        <h2 className="fr-section-title">Financial Overview</h2>
        <div className="fr-stat-grid">
          <div className="fr-stat">
            <div className="fr-stat-label">Net Worth</div>
            <div className={`fr-stat-value ${report.netWorth >= 0 ? "fr-positive" : "fr-negative"}`}>
              {fmt(report.netWorth)}
            </div>
            <div className="fr-stat-sub">{fmt(report.totalAssets)} assets · {fmt(report.totalDebt)} debt</div>
          </div>
          <div className="fr-stat">
            <div className="fr-stat-label">Total Income (Term)</div>
            <div className="fr-stat-value">{fmt(report.totalIncome)}</div>
            <div className="fr-stat-sub">{fmt(report.netPayMonthly)}/mo baseline net pay</div>
          </div>
          <div className="fr-stat">
            <div className="fr-stat-label">Total Expenses (Term)</div>
            <div className="fr-stat-value">{fmt(report.totalExpenses)}</div>
            <div className="fr-stat-sub">
              Essential {fmt(report.essentialExpenses)} · Debt {fmt(report.debtExpenses)} · Discretionary {fmt(report.discretionaryExpenses)}
            </div>
          </div>
          <div className="fr-stat">
            <div className="fr-stat-label">Savings Rate</div>
            <div className="fr-stat-value">{pct(report.savingsActual)}</div>
            <div className="fr-stat-sub">Target was {pct(report.savingsPct)}</div>
          </div>
        </div>
      </section>

      {report.goals.length > 0 && (
        <section className="fr-section">
          <h2 className="fr-section-title">Goal Progress</h2>
          <div className="fr-table">
            <div className="fr-table-head">
              <span>Goal</span>
              <span>Target</span>
              <span>Saved</span>
              <span>Progress</span>
            </div>
            {report.goals.map((g, i) => (
              <div key={i} className="fr-table-row">
                <span>{g.isComplete ? "✓ " : ""}{g.label}</span>
                <span>{fmt(g.targetAmount)}</span>
                <span>{fmt(g.savedToDate)}</span>
                <span>
                  <div className="fr-progress-track">
                    <div className="fr-progress-fill" style={{ width: `${g.progressPct}%` }} />
                  </div>
                  <span className="fr-progress-label">{pct(g.progressPct)}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {report.debts.length > 0 && (
        <section className="fr-section">
          <h2 className="fr-section-title">Debt Progress</h2>
          <div className="fr-table">
            <div className="fr-table-head">
              <span>Debt</span>
              <span>Original</span>
              <span>Remaining</span>
              <span>Paid Down</span>
            </div>
            {report.debts.map((d, i) => (
              <div key={i} className="fr-table-row">
                <span>{d.label}</span>
                <span>{fmt(d.originalBalance)}</span>
                <span>{fmt(d.currentBalance)}</span>
                <span>
                  <div className="fr-progress-track">
                    <div className="fr-progress-fill fr-progress-debt" style={{ width: `${d.paidDownPct}%` }} />
                  </div>
                  <span className="fr-progress-label">{pct(d.paidDownPct)}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="fr-section">
        <h2 className="fr-section-title">Personalized Recommendations</h2>
        <div className="fr-recommendations">
          {report.recommendations.split("\n\n").filter(Boolean).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </section>

      <div className="fr-footer">
        This report was generated by ClarkFin based on data you entered during {report.courseCode}.
        Projections are illustrative and do not constitute professional financial advice.
      </div>
    </div>
  );
}

export function FinalReportModal({ semesterId }: { semesterId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [report, setReport] = useState<ReportData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  async function generate() {
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/student/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semesterId })
      });
      const data = await res.json() as { ok?: boolean; report?: ReportData; error?: string };
      if (!res.ok || !data.report) throw new Error(data.error ?? "Failed to generate report.");
      setReport(data.report);
      setState("ready");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong.");
      setState("error");
    }
  }

  function printReport() {
    document.body.classList.add("printing-report");
    window.print();
    window.addEventListener("afterprint", () => {
      document.body.classList.remove("printing-report");
    }, { once: true });
  }

  function close() {
    setState("idle");
    setReport(null);
  }

  return (
    <>
      <div className="card fr-trigger-card">
        <div className="fr-trigger-header">
          <div>
            <h3>Final Report</h3>
            <p className="fr-trigger-sub">
              A downloadable end-of-course summary with personalized recommendations based on your performance.
            </p>
          </div>
        </div>
        {state === "error" && <p className="error-msg">{errorMsg}</p>}
        <button
          className="button"
          onClick={generate}
          disabled={state === "loading"}
        >
          {state === "loading" ? "Generating report…" : "Generate Final Report"}
        </button>
      </div>

      {(state === "loading" || state === "ready") && (
        <div className="fr-overlay" ref={overlayRef}>
          <div className="fr-overlay-bar no-print">
            <span className="fr-overlay-title">Final Report</span>
            <div style={{ display: "flex", gap: 10 }}>
              {state === "ready" && (
                <button className="button" onClick={printReport}>
                  Print / Save as PDF
                </button>
              )}
              <button className="button-secondary" onClick={close}>Close</button>
            </div>
          </div>

          <div className="fr-overlay-body">
            {state === "loading" ? (
              <div className="fr-loading">
                <div className="fr-loading-spinner" />
                <p>Generating your personalized report…</p>
                <p className="fr-loading-sub">This takes about 10–15 seconds.</p>
              </div>
            ) : report ? (
              <ReportView report={report} />
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
