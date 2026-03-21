"use client";

import { useId, useState, useTransition } from "react";

import { EndDrawer } from "@/components/end-drawer";

type SemesterResponse = {
  error?: string;
  semester?: {
    semesterId: string;
    title: string;
    courseCode: string;
  };
};

export function CreateSemesterForm() {
  const formId = useId();
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
    <EndDrawer
      description="Define the course shell, dates, and activation status before inviting students."
      footer={
        <button className="button" disabled={isPending} form={formId} type="submit">
          {isPending ? "Creating course..." : "Create course"}
        </button>
      }
      title="Add course"
      triggerAriaLabel="Add course"
      triggerChildren={<span aria-hidden="true" className="section-plus-glyph">+</span>}
      triggerClassName="section-plus-button"
      triggerLabel="Add course"
      triggerTooltip="Add course"
      triggerVariant="secondary"
    >
      <form
        action={(formData) => {
          startTransition(() => {
            void submit(formData);
          });
        }}
        className="stack"
        id={formId}
      >
        <div className="form-grid">
          <div className="field">
            <label htmlFor={`${formId}-semesterId`}>Course run ID</label>
            <input
              id={`${formId}-semesterId`}
              name="semesterId"
              placeholder="fall-2026-fin101"
              required
            />
          </div>
          <div className="field">
            <label htmlFor={`${formId}-title`}>Title</label>
            <input
              id={`${formId}-title`}
              name="title"
              placeholder="Fall 2026 Personal Finance"
              required
            />
          </div>
          <div className="field">
            <label htmlFor={`${formId}-courseCode`}>Course code</label>
            <input
              id={`${formId}-courseCode`}
              name="courseCode"
              placeholder="FIN101"
              required
            />
          </div>
          <div className="field">
            <label htmlFor={`${formId}-startsAt`}>Start date</label>
            <input id={`${formId}-startsAt`} name="startsAt" type="date" />
          </div>
          <div className="field">
            <label htmlFor={`${formId}-endsAt`}>End date</label>
            <input id={`${formId}-endsAt`} name="endsAt" type="date" />
          </div>
        </div>
        <label className="row" style={{ alignItems: "center" }}>
          <input defaultChecked name="isActive" type="checkbox" />
          Course is active for student invites
        </label>
        {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
        {result?.semester ? (
          <div className="note-box" style={{ marginTop: 4 }}>
            <strong>{result.semester.title} created.</strong>
            <div style={{ color: "var(--muted)", marginTop: 4 }}>
              {result.semester.courseCode} · {result.semester.semesterId}
            </div>
          </div>
        ) : null}
      </form>
    </EndDrawer>
  );
}
