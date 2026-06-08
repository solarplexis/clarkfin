"use client";

import { useId, useState, startTransition } from "react";
import { useRouter } from "next/navigation";

import { SyllabusEditor } from "@/components/syllabus-editor";

type Semester = {
  semesterId: string;
  title: string;
  courseCode: string;
  isActive: boolean;
  durationWeeks: number;
  startsAt?: string;
  endsAt?: string;
};

type Props = {
  semester: Semester;
  initialSyllabusHtml: string;
};

function computeEndDate(startsAt: string, durationWeeks: number): string {
  if (!startsAt || !durationWeeks) return "";
  const d = new Date(startsAt);
  d.setUTCDate(d.getUTCDate() + durationWeeks * 7);
  return d.toISOString().slice(0, 10);
}

type Tab = "details" | "syllabus";

export function CourseEditForm({ semester, initialSyllabusHtml }: Props) {
  const formId = useId();
  const errorId = `${formId}-error`;
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("details");

  // Details tab state
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsPending, setDetailsPending] = useState(false);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [title, setTitle] = useState(semester.title);
  const [courseCode, setCourseCode] = useState(semester.courseCode);
  const [durationWeeks, setDurationWeeks] = useState(semester.durationWeeks);
  const [startsAt, setStartsAt] = useState(semester.startsAt?.slice(0, 10) ?? "");
  const [endsAt, setEndsAt] = useState(semester.endsAt?.slice(0, 10) ?? "");
  const [endDateUserEdited, setEndDateUserEdited] = useState(false);
  const [isActive, setIsActive] = useState(semester.isActive);

  // Syllabus tab state
  const [syllabusHtml, setSyllabusHtml] = useState(initialSyllabusHtml);
  const [syllabusError, setSyllabusError] = useState<string | null>(null);
  const [syllabusPending, setSyllabusPending] = useState(false);
  const [syllabusSaved, setSyllabusSaved] = useState(false);

  function handleStartsAtChange(val: string) {
    setStartsAt(val);
    if (!endDateUserEdited) setEndsAt(computeEndDate(val, durationWeeks));
  }

  function handleDurationChange(val: number) {
    setDurationWeeks(val);
    if (!endDateUserEdited) setEndsAt(computeEndDate(startsAt, val));
  }

  async function saveDetails() {
    setDetailsPending(true);
    setDetailsError(null);
    setDetailsSaved(false);

    try {
      const response = await fetch(`/api/org/semesters/${semester.semesterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, courseCode, durationWeeks, startsAt, endsAt, isActive })
      });

      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        setDetailsError(json.error ?? "Unable to update course.");
        return;
      }

      setDetailsSaved(true);
      startTransition(() => { router.refresh(); });
    } finally {
      setDetailsPending(false);
    }
  }

  async function saveSyllabus() {
    setSyllabusPending(true);
    setSyllabusError(null);
    setSyllabusSaved(false);

    try {
      const response = await fetch(`/api/org/semesters/${semester.semesterId}/syllabus`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: syllabusHtml })
      });

      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        setSyllabusError(json.error ?? "Unable to save syllabus.");
        return;
      }

      setSyllabusSaved(true);
    } finally {
      setSyllabusPending(false);
    }
  }

  return (
    <div>
      <div className="tab-nav" role="tablist">
        <button
          className={`tab-nav-item${tab === "details" ? " active" : ""}`}
          onClick={() => setTab("details")}
          role="tab"
          aria-selected={tab === "details"}
          type="button"
        >
          Details
        </button>
        <button
          className={`tab-nav-item${tab === "syllabus" ? " active" : ""}`}
          onClick={() => setTab("syllabus")}
          role="tab"
          aria-selected={tab === "syllabus"}
          type="button"
        >
          Syllabus
        </button>
      </div>

      {tab === "details" && (
        <div className="card">
          <div className="stack">
            <div className="field">
              <label>Course run ID</label>
              <input disabled value={semester.semesterId} />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor={`${formId}-title`}>Title</label>
                <input
                  id={`${formId}-title`}
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setDetailsSaved(false); }}
                  aria-describedby={detailsError ? errorId : undefined}
                  aria-invalid={detailsError ? "true" : undefined}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor={`${formId}-courseCode`}>Course code</label>
                <input
                  id={`${formId}-courseCode`}
                  value={courseCode}
                  onChange={(e) => { setCourseCode(e.target.value); setDetailsSaved(false); }}
                  aria-describedby={detailsError ? errorId : undefined}
                  aria-invalid={detailsError ? "true" : undefined}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor={`${formId}-durationWeeks`}>Duration (weeks)</label>
                <input
                  id={`${formId}-durationWeeks`}
                  type="number"
                  min={1}
                  value={durationWeeks}
                  onChange={(e) => { handleDurationChange(Number(e.target.value)); setDetailsSaved(false); }}
                  aria-describedby={detailsError ? errorId : undefined}
                  aria-invalid={detailsError ? "true" : undefined}
                />
              </div>
              <div className="field">
                <label htmlFor={`${formId}-startsAt`}>Start date</label>
                <input
                  id={`${formId}-startsAt`}
                  type="date"
                  value={startsAt}
                  onChange={(e) => { handleStartsAtChange(e.target.value); setDetailsSaved(false); }}
                  aria-describedby={detailsError ? errorId : undefined}
                  aria-invalid={detailsError ? "true" : undefined}
                />
              </div>
              <div className="field">
                <label htmlFor={`${formId}-endsAt`}>End date</label>
                <input
                  id={`${formId}-endsAt`}
                  type="date"
                  value={endsAt}
                  onChange={(e) => { setEndDateUserEdited(true); setEndsAt(e.target.value); setDetailsSaved(false); }}
                  aria-describedby={detailsError ? errorId : undefined}
                  aria-invalid={detailsError ? "true" : undefined}
                />
              </div>
            </div>
            <label className="row" style={{ alignItems: "center" }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => { setIsActive(e.target.checked); setDetailsSaved(false); }}
              />
              Course is active for student invites
            </label>
            {detailsError ? (
              <p className="error-msg" id={errorId} role="alert">{detailsError}</p>
            ) : null}
            <div className="row" style={{ gap: 12, alignItems: "center" }}>
              <button
                className="button"
                disabled={detailsPending}
                onClick={() => { void saveDetails(); }}
                type="button"
              >
                {detailsPending ? "Saving..." : "Save Details"}
              </button>
              {detailsSaved && (
                <span style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Saved</span>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "syllabus" && (
        <div className="stack">
          <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
            Use H2 and H3 headings to organise sections — they become the split points for AI search.
          </p>
          <SyllabusEditor content={syllabusHtml} onChange={(html) => { setSyllabusHtml(html); setSyllabusSaved(false); }} />
          {syllabusError ? (
            <p className="error-msg" role="alert">{syllabusError}</p>
          ) : null}
          <div className="row" style={{ gap: 12, alignItems: "center" }}>
            <button
              className="button"
              disabled={syllabusPending}
              onClick={() => { void saveSyllabus(); }}
              type="button"
            >
              {syllabusPending ? "Saving & indexing..." : "Save Syllabus"}
            </button>
            {syllabusSaved && (
              <span style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Saved and indexed</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
