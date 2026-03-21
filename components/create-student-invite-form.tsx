"use client";

import { startTransition, useDeferredValue, useId, useState } from "react";
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
          <select defaultValue={invite.status} id={`${formId}-status`} name="status">
            <option value="pending">pending</option>
            <option value="redeemed">redeemed</option>
            <option value="revoked">revoked</option>
          </select>
        </div>
        {error ? <p className="error-msg">{error}</p> : null}
      </form>
    </EndDrawer>
  );
}

export function DeleteInviteButton({ invite }: { invite: InviteRow }) {
  const router = useRouter();
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
        className="icon-button icon-button-danger"
        data-tooltip="Delete Invite"
        disabled={isPending || invite.status === "redeemed"}
        type="button"
        onClick={() => { void remove(); }}
      >
        <TrashIcon />
      </button>
      {error ? <p className="error-msg" style={{ margin: 0 }}>{error}</p> : null}
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
  students
}: {
  semesters: SemesterOption[];
  students: StudentOption[];
}) {
  const formId = useId();
  const router = useRouter();
  const listboxId = `${formId}-student-listbox`;
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const deferredStudentQuery = useDeferredValue(studentQuery);
  const normalizedStudentQuery = deferredStudentQuery.trim().toLowerCase();
  const selectedStudent = students.find((student) => student.studentId === selectedStudentId) ?? null;
  const filteredStudents = normalizedStudentQuery
    ? students.filter((student) => {
        const haystack =
          `${student.firstName} ${student.lastName} ${student.email} ${student.status}`.toLowerCase();

        return haystack.includes(normalizedStudentQuery);
      })
    : students;

  async function submit(formData: FormData) {
    setIsPending(true);
    setError(null);

    try {
      if (!selectedStudentId) {
        setError("Choose a student before creating an invite.");
        return;
      }

      const response = await fetch("/api/org/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semesterId: String(formData.get("semesterId") ?? ""),
          studentId: selectedStudentId
        })
      });

      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(json.error ?? "Unable to create invite.");
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
      description="Create a single-use student invite tied to a student roster entry and a specific course run."
      footer={
        <button
          className="button"
          disabled={isPending || semesters.length === 0 || students.length === 0 || !selectedStudentId}
          form={formId}
          type="submit"
        >
          {isPending ? "Creating invite..." : "Create Invite"}
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
        <input name="studentId" type="hidden" value={selectedStudentId} />
        <div className="field">
          <label htmlFor={`${formId}-student-picker`}>Student</label>
          <div className={`student-picker ${isPickerOpen ? "student-picker-open" : ""}`}>
            <input
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded={isPickerOpen}
              autoComplete="off"
              id={`${formId}-student-picker`}
              placeholder="Search by first name, last name, or email"
              role="combobox"
              type="search"
              value={studentQuery}
              onBlur={() => {
                window.setTimeout(() => setIsPickerOpen(false), 120);
              }}
              onChange={(event) => {
                setStudentQuery(event.target.value);
                setSelectedStudentId("");
                setIsPickerOpen(true);
              }}
              onFocus={() => setIsPickerOpen(true)}
            />
            <div className="student-picker-summary">
              {selectedStudent ? (
                <span>
                  Selected: <strong>{formatStudentLabel(selectedStudent)}</strong> · {selectedStudent.email}
                </span>
              ) : (
                <span>Showing {filteredStudents.length} of {students.length} students.</span>
              )}
            </div>
            {isPickerOpen ? (
              <div className="student-picker-results" id={listboxId} role="listbox">
                {filteredStudents.length === 0 ? (
                  <div className="student-picker-empty">No students match this search.</div>
                ) : (
                  filteredStudents.map((student) => (
                    <button
                      className={`student-picker-option ${
                        student.studentId === selectedStudentId ? "student-picker-option-selected" : ""
                      }`}
                      key={student.studentId}
                      type="button"
                      onClick={() => {
                        setSelectedStudentId(student.studentId);
                        setStudentQuery(formatStudentLabel(student));
                        setIsPickerOpen(false);
                      }}
                    >
                      <span className="student-picker-option-name">{formatStudentLabel(student)}</span>
                      <span className="student-picker-option-meta">{student.email} · {student.status}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${formId}-semesterId`}>Course</label>
          <select defaultValue="" id={`${formId}-semesterId`} name="semesterId" required>
            <option disabled value="">
              Select a course
            </option>
            {semesters.map((semester) => (
              <option key={semester.semesterId} value={semester.semesterId}>
                {semester.courseCode} · {semester.title}
                {semester.isActive ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </div>
        {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
      </form>
    </EndDrawer>
  );
}
