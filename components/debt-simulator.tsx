"use client";

import { useState, useTransition } from "react";

import type { DebtScenario } from "@/types/domain";
import { EndDrawer } from "@/components/end-drawer";
import { calculateDebtScenario } from "@/src/lib/activity/debt";

export function DebtSimulator({
  initialScenario,
  semesterId,
  semesterLabel
}: {
  initialScenario: DebtScenario | null;
  semesterId?: string;
  semesterLabel?: string;
}) {
  const [debtName, setDebtName] = useState(initialScenario?.debtName ?? "Credit Card");
  const [balance, setBalance] = useState(initialScenario?.balance ?? 2400);
  const [interestRate, setInterestRate] = useState(initialScenario?.interestRate ?? 19.99);
  const [minimumPayment, setMinimumPayment] = useState(initialScenario?.minimumPayment ?? 75);
  const [plannedPayment, setPlannedPayment] = useState(initialScenario?.plannedPayment ?? 150);
  const [notes, setNotes] = useState(initialScenario?.notes ?? "");
  const [isFinal, setIsFinal] = useState(Boolean(initialScenario?.isFinal));
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const simulation = calculateDebtScenario({ balance, interestRate, plannedPayment });

  async function saveScenario() {
    setMessage(null);

    const response = await fetch("/api/activity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "debt.save",
        semesterId,
        debtName,
        balance,
        interestRate,
        minimumPayment,
        plannedPayment,
        notes,
        isFinal,
        payoffMonths: simulation.payoffMonths,
        totalInterest: simulation.totalInterest
      })
    });

    const json = (await response.json()) as { error?: string; message?: string };

    if (!response.ok) {
      throw new Error(json.error ?? "Unable to save debt scenario.");
    }

    setMessage(json.message ?? "Debt scenario saved.");
    setIsDrawerOpen(false);
  }

  return (
    <div className="grid-2">
      <div className="card stack">
        <div className="card-header">
          <div>
            <h2>Debt Simulator</h2>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.875rem" }}>
              Workspace: {semesterLabel ?? "No course selected"}
            </p>
          </div>
          <span className={`badge ${isFinal ? "badge-teal" : "badge-default"}`}>
            {isFinal ? "Ready for review" : "Working draft"}
          </span>
        </div>
        <p style={{ color: "var(--ink-2)" }}>
          Model a payoff timeline and save your strategy. Every save creates an activity log for
          your instructor.
        </p>
        <EndDrawer
          description="Adjust debt assumptions, run simulation changes, and save your strategy."
          onOpenChange={setIsDrawerOpen}
          open={isDrawerOpen}
          footer={
            <button
              className="button"
              disabled={isPending || !semesterId}
              type="button"
              onClick={() => {
                startTransition(() => {
                  void saveScenario();
                });
              }}
            >
              {isPending ? "Saving..." : "Save debt scenario"}
            </button>
          }
          title="Debt Editor"
          triggerLabel="Open Debt Form"
          triggerChildren={<span>Edit Scenario</span>}
          triggerClassName="btn"
        >
          <div className="stack">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="debt-name">Debt name</label>
                <input
                  id="debt-name"
                  value={debtName}
                  onChange={(event) => setDebtName(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="debt-balance">Balance</label>
                <input
                  id="debt-balance"
                  min="0"
                  step="0.01"
                  type="number"
                  value={balance}
                  onChange={(event) => setBalance(Number(event.target.value || "0"))}
                />
              </div>
              <div className="field">
                <label htmlFor="debt-rate">APR (%)</label>
                <input
                  id="debt-rate"
                  min="0"
                  step="0.01"
                  type="number"
                  value={interestRate}
                  onChange={(event) => setInterestRate(Number(event.target.value || "0"))}
                />
              </div>
              <div className="field">
                <label htmlFor="debt-minimum">Minimum payment</label>
                <input
                  id="debt-minimum"
                  min="0"
                  step="0.01"
                  type="number"
                  value={minimumPayment}
                  onChange={(event) => setMinimumPayment(Number(event.target.value || "0"))}
                />
              </div>
              <div className="field">
                <label htmlFor="debt-planned">Planned payment</label>
                <input
                  id="debt-planned"
                  min="0"
                  step="0.01"
                  type="number"
                  value={plannedPayment}
                  onChange={(event) => setPlannedPayment(Number(event.target.value || "0"))}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="debt-notes">Reflection notes</label>
              <textarea
                id="debt-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
            <label className="check-row">
              <input
                checked={isFinal}
                type="checkbox"
                onChange={(event) => setIsFinal(event.target.checked)}
              />
              Mark this debt strategy as ready for review
            </label>
            {message ? <p style={{ margin: 0, color: "var(--accent)" }}>{message}</p> : null}
          </div>
        </EndDrawer>
        {message ? <p style={{ margin: 0, color: "var(--accent)" }}>{message}</p> : null}
      </div>

      <div className="card stack">
        <div className="card-header">
          <h2>Simulation Result</h2>
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-card-label">Months to payoff</div>
            <div className="stat-card-value">{simulation.payoffMonths}</div>
            <div className="stat-card-sub">{(simulation.payoffMonths / 12).toFixed(1)} years</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Projected interest</div>
            <div className="stat-card-value" style={{ color: "var(--danger)" }}>
              {simulation.totalInterest.toLocaleString("en-US", { style: "currency", currency: "USD" })}
            </div>
          </div>
        </div>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
          If the planned payment is close to the monthly interest, the payoff horizon grows
          quickly. Try multiple payment strategies and reflect on the difference.
        </p>
      </div>
    </div>
  );
}
