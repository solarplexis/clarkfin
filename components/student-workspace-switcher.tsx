"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type WorkspaceOption = {
  semesterId: string;
  label: string;
};

export function StudentWorkspaceSwitcher({
  activeSemesterId,
  options
}: {
  activeSemesterId?: string;
  options: WorkspaceOption[];
}) {
  const router = useRouter();
  const errorId = useId();
  const [value, setValue] = useState(activeSemesterId ?? options[0]?.semesterId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function saveWorkspace() {
    setError(null);

    const response = await fetch("/api/student/workspace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ semesterId: value })
    });

    const json = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(json.error ?? "Unable to change course workspace.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="stack-sm">
      <div className="field">
        <label htmlFor="student-workspace-select">Active course workspace</label>
        <select
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? "true" : undefined}
          id="student-workspace-select"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.semesterId} value={option.semesterId}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button
          className="button-secondary"
          disabled={isPending || !value || value === activeSemesterId}
          type="button"
          onClick={() => {
            void saveWorkspace();
          }}
        >
          {isPending ? "Switching..." : "Switch workspace"}
        </button>
      </div>
      {error ? <p className="error-msg" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}
