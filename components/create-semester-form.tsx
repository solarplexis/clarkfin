"use client";

import { startTransition, useId, useState } from "react";
import { useRouter } from "next/navigation";

import { EndDrawer } from "@/components/end-drawer";

function computeEndDate(startsAt: string, durationWeeks: number): string {
  if (!startsAt || !durationWeeks) return "";
  const d = new Date(startsAt);
  d.setUTCDate(d.getUTCDate() + durationWeeks * 7);
  return d.toISOString().slice(0, 10);
}

type SemesterRow = {
  semesterId: string;
  title: string;
  courseCode: string;
  isActive: boolean;
  durationWeeks: number;
  startsAt?: string;
  endsAt?: string;
};

type SemesterResponse = {
  error?: string;
  semester?: SemesterRow;
};

const PencilIcon = () => (
  <svg fill="none" height="14" viewBox="0 0 16 16" width="14" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 2.474L5.81 11.577l-2.827.636.636-2.828L11.013 1.427Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
  </svg>
);

export function EditSemesterDrawer({ semester }: { semester: SemesterRow }) {
  const formId = useId();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [startsAt, setStartsAt] = useState(semester.startsAt?.slice(0, 10) ?? "");
  const [durationWeeks, setDurationWeeks] = useState(semester.durationWeeks);
  const [endsAt, setEndsAt] = useState(semester.endsAt?.slice(0, 10) ?? "");
  const [endDateUserEdited, setEndDateUserEdited] = useState(false);

  function handleStartsAtChange(val: string) {
    setStartsAt(val);
    if (!endDateUserEdited) setEndsAt(computeEndDate(val, durationWeeks));
  }

  function handleDurationChange(val: number) {
    setDurationWeeks(val);
    if (!endDateUserEdited) setEndsAt(computeEndDate(startsAt, val));
  }

  function handleEndsAtChange(val: string) {
    setEndDateUserEdited(true);
    setEndsAt(val);
  }

  async function submit(formData: FormData) {
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/org/semesters/${semester.semesterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(formData.get("title") ?? ""),
          courseCode: String(formData.get("courseCode") ?? ""),
          durationWeeks: Number(formData.get("durationWeeks") ?? 8),
          startsAt: String(formData.get("startsAt") ?? ""),
          endsAt: String(formData.get("endsAt") ?? ""),
          isActive: formData.get("isActive") === "on"
        })
      });

      const json = (await response.json()) as SemesterResponse;

      if (!response.ok) {
        setError(json.error ?? "Unable to update course.");
        return;
      }

      setIsOpen(false);
      startTransition(() => { router.refresh(); });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <EndDrawer
      footer={
        <button className="button" disabled={isPending} form={formId} type="submit">
          {isPending ? "Saving..." : "Save Course"}
        </button>
      }
      open={isOpen}
      onOpenChange={setIsOpen}
      title="Edit Course"
      triggerAriaLabel="Edit Course"
      triggerChildren={<PencilIcon />}
      triggerClassName="icon-button"
      triggerLabel="Edit Course"
      triggerTooltip="Edit Course"
      triggerVariant="secondary"
    >
      <form action={(formData) => { void submit(formData); }} className="stack" id={formId}>
        <div className="field">
          <label>Course run ID</label>
          <input disabled value={semester.semesterId} />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor={`${formId}-title`}>Title</label>
            <input defaultValue={semester.title} id={`${formId}-title`} name="title" required />
          </div>
          <div className="field">
            <label htmlFor={`${formId}-courseCode`}>Course code</label>
            <input defaultValue={semester.courseCode} id={`${formId}-courseCode`} name="courseCode" required />
          </div>
          <div className="field">
            <label htmlFor={`${formId}-durationWeeks`}>Duration (weeks)</label>
            <input id={`${formId}-durationWeeks`} min={1} name="durationWeeks" type="number" value={durationWeeks} onChange={(e) => handleDurationChange(Number(e.target.value))} />
          </div>
          <div className="field">
            <label htmlFor={`${formId}-startsAt`}>Start date</label>
            <input id={`${formId}-startsAt`} name="startsAt" type="date" value={startsAt} onChange={(e) => handleStartsAtChange(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${formId}-endsAt`}>End date</label>
            <input id={`${formId}-endsAt`} name="endsAt" type="date" value={endsAt} onChange={(e) => handleEndsAtChange(e.target.value)} />
          </div>
        </div>
        <label className="row" style={{ alignItems: "center" }}>
          <input defaultChecked={semester.isActive} name="isActive" type="checkbox" />
          Course is active for student invites
        </label>
        {error ? <p className="error-msg">{error}</p> : null}
      </form>
    </EndDrawer>
  );
}

export function CreateSemesterForm() {
  const formId = useId();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [durationWeeks, setDurationWeeks] = useState(8);
  const [endsAt, setEndsAt] = useState("");
  const [endDateUserEdited, setEndDateUserEdited] = useState(false);

  function handleStartsAtChange(val: string) {
    setStartsAt(val);
    if (!endDateUserEdited) setEndsAt(computeEndDate(val, durationWeeks));
  }

  function handleDurationChange(val: number) {
    setDurationWeeks(val);
    if (!endDateUserEdited) setEndsAt(computeEndDate(startsAt, val));
  }

  function handleEndsAtChange(val: string) {
    setEndDateUserEdited(true);
    setEndsAt(val);
  }

  async function submit(formData: FormData) {
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch("/api/org/semesters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semesterId: String(formData.get("semesterId") ?? ""),
          title: String(formData.get("title") ?? ""),
          courseCode: String(formData.get("courseCode") ?? ""),
          durationWeeks: Number(formData.get("durationWeeks") ?? 8),
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

      setIsOpen(false);
      startTransition(() => { router.refresh(); });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <EndDrawer
      description="Define the course shell, dates, and activation status before inviting students."
      footer={
        <button className="button" disabled={isPending} form={formId} type="submit">
          {isPending ? "Creating course..." : "Create Course"}
        </button>
      }
      open={isOpen}
      onOpenChange={setIsOpen}
      title="Add Course"
      triggerAriaLabel="Add Course"
      triggerChildren={<span aria-hidden="true" className="section-plus-glyph">+</span>}
      triggerClassName="section-plus-button"
      triggerLabel="Add Course"
      triggerTooltip="Add Course"
      triggerVariant="secondary"
    >
      <form action={(formData) => { void submit(formData); }} className="stack" id={formId}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor={`${formId}-semesterId`}>Course run ID</label>
            <input id={`${formId}-semesterId`} name="semesterId" placeholder="fall-2026-fin101" required />
          </div>
          <div className="field">
            <label htmlFor={`${formId}-title`}>Title</label>
            <input id={`${formId}-title`} name="title" placeholder="Fall 2026 Personal Finance" required />
          </div>
          <div className="field">
            <label htmlFor={`${formId}-courseCode`}>Course code</label>
            <input id={`${formId}-courseCode`} name="courseCode" placeholder="FIN101" required />
          </div>
          <div className="field">
            <label htmlFor={`${formId}-durationWeeks`}>Duration (weeks)</label>
            <input id={`${formId}-durationWeeks`} min={1} name="durationWeeks" type="number" value={durationWeeks} onChange={(e) => handleDurationChange(Number(e.target.value))} />
          </div>
          <div className="field">
            <label htmlFor={`${formId}-startsAt`}>Start date</label>
            <input id={`${formId}-startsAt`} name="startsAt" type="date" value={startsAt} onChange={(e) => handleStartsAtChange(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${formId}-endsAt`}>End date</label>
            <input id={`${formId}-endsAt`} name="endsAt" type="date" value={endsAt} onChange={(e) => handleEndsAtChange(e.target.value)} />
          </div>
        </div>
        <label className="row" style={{ alignItems: "center" }}>
          <input defaultChecked name="isActive" type="checkbox" />
          Course is active for student invites
        </label>
        {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
      </form>
    </EndDrawer>
  );
}
