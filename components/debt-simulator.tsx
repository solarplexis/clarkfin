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
  }

  return (
    <section className="grid two">
      <div className="panel stack">
        <h2>Debt Simulator</h2>
        <p className="muted">Use the end drawer editor to model payoff timelines and save drafts.</p>
        <p className="muted">Workspace: {semesterLabel ?? "No course selected"}</p>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="pill">{isFinal ? "Marked final" : "Working draft"}</span>
          <EndDrawer
            description="Adjust debt assumptions, run simulation changes, and save your strategy."
            title="Debt editor"
            triggerLabel="Open debt form"
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
              <label className="row" style={{ alignItems: "center" }}>
                <input
                  checked={isFinal}
                  type="checkbox"
                  onChange={(event) => setIsFinal(event.target.checked)}
                />
                Mark this debt strategy as ready for review
              </label>
              {message ? <p style={{ margin: 0, color: "var(--accent)" }}>{message}</p> : null}
              <button
                className="button"
                type="button"
                disabled={isPending || !semesterId}
                onClick={() => {
                  startTransition(() => {
                    void saveScenario();
                  });
                }}
              >
                {isPending ? "Saving..." : "Save debt scenario"}
              </button>
            </div>
          </EndDrawer>
        </div>
        <p className="muted">Current status: {isFinal ? "Ready for review" : "Working draft"}</p>
        {message ? <p style={{ margin: 0, color: "var(--accent)" }}>{message}</p> : null}
      </div>
      <aside className="panel stack">
        <h2>Simulation result</h2>
        <div className="stats">
          <div className="stat">
            <div className="muted">Months to payoff</div>
            <div className="stat-value">{simulation.payoffMonths}</div>
          </div>
          <div className="stat">
            <div className="muted">Projected interest</div>
            <div className="stat-value">${simulation.totalInterest.toFixed(2)}</div>
          </div>
        </div>
        <p className="note muted">
          If the planned payment is close to the monthly interest, the payoff horizon grows
          quickly. Encourage students to test multiple payment strategies and reflect on the
          difference.
        </p>
      </aside>
    </section>
  );
}
