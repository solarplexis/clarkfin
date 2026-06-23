"use client";

import { startTransition, useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { EndDrawer } from "@/components/end-drawer";

type SemesterOption = {
  semesterId: string;
  title: string;
  courseCode: string;
  isActive: boolean;
};

type StudentOption = {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  status: "prospect" | "invited" | "active" | "inactive";
};

type InviteRow = {
  inviteId: string;
  inviteCode: string;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  semesterId: string;
  status: "pending" | "redeemed" | "revoked";
};

const PencilIcon = () => (
  <svg fill="none" height="14" viewBox="0 0 16 16" width="14" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 2.474L5.81 11.577l-2.827.636.636-2.828L11.013 1.427Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
  </svg>
);

const TrashIcon = () => (
  <svg fill="none" height="14" viewBox="0 0 16 16" width="14" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4h12M5 4V2h6v2M3 4l1 10h8l1-10M6 7v4M10 7v4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
  </svg>
);

const CopyIcon = () => (
  <svg fill="none" height="14" viewBox="0 0 16 16" width="14" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 2.75h5.25A1.75 1.75 0 0 1 13 4.5v6.75A1.75 1.75 0 0 1 11.25 13H6A1.75 1.75 0 0 1 4.25 11.25V4.5A1.75 1.75 0 0 1 6 2.75Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
    <path d="M4.25 5.5H3.5A1.5 1.5 0 0 0 2 7v5.5A1.5 1.5 0 0 0 3.5 14h5.5A1.5 1.5 0 0 0 10.5 12.5v-.75" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
  </svg>
);

export function EditInviteDrawer({ invite }: { invite: InviteRow }) {
  const formId = useId();
  const errorId = `${formId}-error`;
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function submit(formData: FormData) {
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/org/invites/${invite.inviteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: String(formData.get("status") ?? "") })
      });

      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(json.error ?? "Unable to update invite.");
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
          {isPending ? "Saving..." : "Save invite"}
        </button>
      }
      open={isOpen}
      onOpenChange={setIsOpen}
      title="Edit Invite"
      triggerAriaLabel="Edit Invite"
      triggerChildren={<PencilIcon />}
      triggerClassName="icon-button"
      triggerLabel="Edit Invite"
      triggerTooltip="Edit Invite"
      triggerVariant="secondary"
    >
      <form
        action={(formData) => { void submit(formData); }}
        className="stack"
        id={formId}
      >
        <div className="note-box">
          {invite.studentFirstName} {invite.studentLastName} · {invite.studentEmail}
        </div>
        <div className="field">
          <label htmlFor={`${formId}-status`}>Status</label>
          <select
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? "true" : undefined}
            defaultValue={invite.status}
            id={`${formId}-status`}
            name="status"
          >
            <option value="pending">pending</option>
            <option value="redeemed">redeemed</option>
            <option value="revoked">revoked</option>
          </select>
        </div>
        {error ? <p className="error-msg" id={errorId} role="alert">{error}</p> : null}
      </form>
    </EndDrawer>
  );
}

export function DeleteInviteButton({ invite }: { invite: InviteRow }) {
  const router = useRouter();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function remove() {
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/org/invites/${invite.inviteId}`, { method: "DELETE" });
      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(json.error ?? "Unable to delete invite.");
        return;
      }

      startTransition(() => { router.refresh(); });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="stack-sm" style={{ alignItems: "flex-end" }}>
      <button
        aria-describedby={error ? errorId : undefined}
        aria-label="Delete Invite"
        className="icon-button icon-button-danger"
        data-tooltip="Delete Invite"
        title="Delete Invite"
        disabled={isPending || invite.status === "redeemed"}
        type="button"
        onClick={() => { void remove(); }}
      >
        <TrashIcon />
      </button>
      {error ? <p className="error-msg" id={errorId} role="alert" style={{ margin: 0 }}>{error}</p> : null}
    </div>
  );
}

export function CopyInviteLinkButton({ invite }: { invite: InviteRow }) {
  const [tooltip, setTooltip] = useState("Copy Invite URL");

  async function copyLink() {
    const inviteUrl = new URL(`/invite/${invite.inviteCode}`, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setTooltip("Copied invite URL");
      window.setTimeout(() => setTooltip("Copy invite URL"), 1800);
    } catch {
      setTooltip("Copy failed");
      window.setTimeout(() => setTooltip("Copy invite URL"), 1800);
    }
  }

  return (
    <button
      aria-label="Copy invite URL"
      className="icon-button"
      data-tooltip={tooltip}
      title={tooltip}
      type="button"
      onClick={() => { void copyLink(); }}
    >
      <CopyIcon />
    </button>
  );
}

function formatStudentLabel(student: StudentOption) {
  return `${student.firstName} ${student.lastName}`;
}

export function CreateStudentInviteForm({
  semesters,
  students,
  defaultSemesterId
}: {
  semesters: SemesterOption[];
  students: StudentOption[];
  defaultSemesterId?: string;
}) {
  const formId = useId();
  const router = useRouter();
  const errorId = `${formId}-error`;
  const pickerSummaryId = `${formId}-student-summary`;
  const listboxId = `${formId}-student-listbox`;
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isPending, setIsPending] = useState(false);
  const deferredStudentQuery = useDeferredValue(studentQuery);
  const normalizedStudentQuery = deferredStudentQuery.trim().toLowerCase();
  const semester = semesters.find((semesterOption) => semesterOption.semesterId === defaultSemesterId) ?? semesters[0];
  const studentIds = useMemo(() => new Set(students.map((student) => student.studentId)), [students]);

  useEffect(() => {
    setSelectedStudentIds((current) => current.filter((studentId) => studentIds.has(studentId)));
  }, [studentIds]);

  useEffect(() => {
    if (isOpen) {
      setStudentQuery("");
      setSelectedStudentIds([]);
      setError(null);
    }
  }, [isOpen]);

  const filteredStudents = normalizedStudentQuery
    ? students.filter((student) => {
        const haystack =
          `${student.firstName} ${student.lastName} ${student.email} ${student.status}`.toLowerCase();

        return haystack.includes(normalizedStudentQuery);
      })
    : students;

  const selectedCount = selectedStudentIds.length;
  const pickerDescribedBy = useMemo(() => {
    return [pickerSummaryId, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  }, [error, errorId, pickerSummaryId]);

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    );
    setError(null);
  }

  async function submit(formData: FormData) {
    setIsPending(true);
    setError(null);

    try {
      if (!semester?.semesterId) {
        setError("Select a course before creating invites.");
        return;
      }

      if (selectedStudentIds.length === 0) {
        setError("Select one or more students before creating invites.");
        return;
      }

      const response = await fetch("/api/org/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semesterId: semester.semesterId,
          studentIds: selectedStudentIds
        })
      });

      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(json.error ?? "Unable to create invites.");
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
      description="Create one or more student invites tied to the selected course."
      footer={
        <button
          className="button"
          disabled={isPending || semesters.length === 0 || students.length === 0 || selectedCount === 0}
          form={formId}
          type="submit"
        >
          {isPending ? "Creating invites..." : selectedCount > 1 ? `Create ${selectedCount} invites` : "Create invite"}
        </button>
      }
      title="Invite Student"
      open={isOpen}
      onOpenChange={setIsOpen}
      triggerAriaLabel={
        semesters.length === 0
          ? "Add a course first"
          : students.length === 0
            ? "Add students to the roster first"
            : "Invite Student"
      }
      triggerChildren={<span aria-hidden="true" className="section-plus-glyph">+</span>}
      triggerClassName="section-plus-button"
      triggerDisabled={semesters.length === 0 || students.length === 0}
      triggerLabel="Invite Student"
      triggerTooltip="Invite Student"
      triggerVariant="secondary"
    >
      <form
        action={(formData) => { void submit(formData); }}
        className="stack"
        id={formId}
      >
        <input name="semesterId" type="hidden" value={semester?.semesterId ?? ""} />

        <div className="field">
          <label>Course</label>
          <div className="student-picker-course-label">
            {semester ? `${semester.courseCode} · ${semester.title}` : "No course selected"}
          </div>
        </div>

        <div className="field">
          <label htmlFor={`${formId}-student-picker`}>Students</label>
          <div className="student-picker">
            <input
              aria-describedby={pickerDescribedBy}
              aria-invalid={error ? "true" : undefined}
              autoComplete="off"
              id={`${formId}-student-picker`}
              placeholder="Search by first name, last name, or email"
              type="search"
              value={studentQuery}
              onChange={(event) => {
                setStudentQuery(event.target.value);
                setError(null);
              }}
            />
            <div className="student-picker-summary" id={pickerSummaryId}>
              {selectedCount > 0 ? (
                <span>{selectedCount} student{selectedCount === 1 ? "" : "s"} selected.</span>
              ) : (
                <span>Showing {filteredStudents.length} of {students.length} students.</span>
              )}
            </div>
            <div className="student-picker-results" id={listboxId} role="list">
              {filteredStudents.length === 0 ? (
                <div className="student-picker-empty">No students match this search.</div>
              ) : (
                filteredStudents.map((student) => {
                  const isSelected = selectedStudentIds.includes(student.studentId);

                  return (
                    <label
                      className={`student-picker-option ${isSelected ? "student-picker-option-selected" : ""}`.trim()}
                      key={student.studentId}
                    >
                      <input
                        checked={isSelected}
                        className="student-picker-checkbox"
                        type="checkbox"
                        onChange={() => toggleStudent(student.studentId)}
                      />
                      <span className="student-picker-option-name">{formatStudentLabel(student)}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {error ? <p className="error-msg" id={errorId} role="alert">{error}</p> : null}
      </form>
    </EndDrawer>
  );
}
