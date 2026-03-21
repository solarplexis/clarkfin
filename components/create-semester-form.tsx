"use client";

import { useState, useTransition } from "react";

type SemesterResponse = {
  error?: string;
  semester?: {
    semesterId: string;
    title: string;
    courseCode: string;
    inviteCode: string;
  };
};

export function CreateSemesterForm() {
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SemesterResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submit(formData: FormData) {
    setError(null);
    setResult(null);

    const response = await fetch("/api/org/semesters", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        semesterId: String(formData.get("semesterId") ?? ""),
        title: String(formData.get("title") ?? ""),
        courseCode: String(formData.get("courseCode") ?? ""),
        startsAt: String(formData.get("startsAt") ?? ""),
        endsAt: String(formData.get("endsAt") ?? ""),
        isActive: formData.get("isActive") === "on"
      })
    });

    const json = (await response.json()) as SemesterResponse;

    if (!response.ok) {
      setError(json.error ?? "Unable to create semester.");
      return;
    }

    setResult(json);
  }

  return (
    <section className="panel stack">
      <h2>Create semester</h2>
      <p className="muted">
        Add a semester, generate its invite code, and make it ready for student enrollment.
      </p>
      <form
        className="stack"
        action={(formData) => {
          startTransition(() => {
            void submit(formData);
          });
        }}
      >
        <div className="form-grid">
          <div className="field">
            <label htmlFor="semesterId">Semester ID</label>
            <input id="semesterId" name="semesterId" placeholder="fall-2026-fin101" required />
          </div>
          <div className="field">
            <label htmlFor="title">Title</label>
            <input id="title" name="title" placeholder="Fall 2026 Personal Finance" required />
          </div>
          <div className="field">
            <label htmlFor="courseCode">Course code</label>
            <input id="courseCode" name="courseCode" placeholder="FIN101" required />
          </div>
          <div className="field">
            <label htmlFor="startsAt">Start date</label>
            <input id="startsAt" name="startsAt" type="date" />
          </div>
          <div className="field">
            <label htmlFor="endsAt">End date</label>
            <input id="endsAt" name="endsAt" type="date" />
          </div>
        </div>
        <label className="row" style={{ alignItems: "center" }}>
          <input defaultChecked name="isActive" type="checkbox" />
          Semester is active for invites
        </label>
        {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
        {result?.semester ? (
          <div className="panel stack" style={{ padding: 16 }}>
            <strong>{result.semester.title} created.</strong>
            <div className="muted">
              {result.semester.courseCode} · {result.semester.semesterId}
            </div>
            <div className="note">
              <strong>Invite code</strong>
              <div>{result.semester.inviteCode}</div>
            </div>
          </div>
        ) : null}
        <button className="button" disabled={isPending} type="submit">
          {isPending ? "Creating semester..." : "Create semester"}
        </button>
      </form>
    </section>
  );
}
