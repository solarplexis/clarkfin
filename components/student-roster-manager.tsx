"use client";

import { startTransition, useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { EndDrawer } from "@/components/end-drawer";

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

type StudentStatus = "prospect" | "invited" | "active" | "inactive";

type StudentRow = {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  status: StudentStatus;
  authUserId?: string;
};

function StudentFormFields({
  formId,
  defaultFirstName,
  defaultLastName,
  defaultEmail,
  defaultStatus
}: {
  formId: string;
  defaultFirstName?: string;
  defaultLastName?: string;
  defaultEmail?: string;
  defaultStatus?: StudentStatus;
}) {
  return (
    <>
      <div className="field">
        <label htmlFor={`${formId}-firstName`}>First name</label>
        <input defaultValue={defaultFirstName} id={`${formId}-firstName`} name="firstName" required />
      </div>
      <div className="field">
        <label htmlFor={`${formId}-lastName`}>Last name</label>
        <input defaultValue={defaultLastName} id={`${formId}-lastName`} name="lastName" required />
      </div>
      <div className="field">
        <label htmlFor={`${formId}-email`}>Student email</label>
        <input
          defaultValue={defaultEmail}
          id={`${formId}-email`}
          name="email"
          required
          type="email"
        />
      </div>
      <div className="field">
        <label htmlFor={`${formId}-status`}>Status</label>
        <select defaultValue={defaultStatus ?? "prospect"} id={`${formId}-status`} name="status">
          <option value="prospect">prospect</option>
          <option value="invited">invited</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
      </div>
    </>
  );
}

function CreateStudentDrawer() {
  const formId = useId();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function submit(formData: FormData) {
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch("/api/org/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: String(formData.get("firstName") ?? ""),
          lastName: String(formData.get("lastName") ?? ""),
          email: String(formData.get("email") ?? ""),
          status: String(formData.get("status") ?? "prospect")
        })
      });

      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(json.error ?? "Unable to create student.");
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
      description="Add a roster entry before sending course invites."
      footer={
        <button className="button" disabled={isPending} form={formId} type="submit">
          {isPending ? "Creating student..." : "Add Student"}
        </button>
      }
      open={isOpen}
      onOpenChange={setIsOpen}
      title="Add Student"
      triggerAriaLabel="Add Student"
      triggerChildren={<span aria-hidden="true" className="section-plus-glyph">+</span>}
      triggerClassName="section-plus-button"
      triggerLabel="Add Student"
      triggerTooltip="Add Student"
      triggerVariant="secondary"
    >
      <form
        action={(formData) => { void submit(formData); }}
        className="stack"
        id={formId}
      >
        <StudentFormFields defaultStatus="prospect" formId={formId} />
        {error ? <p className="error-msg">{error}</p> : null}
      </form>
    </EndDrawer>
  );
}

function EditStudentDrawer({ student }: { student: StudentRow }) {
  const formId = useId();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function submit(formData: FormData) {
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/org/students/${student.studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: String(formData.get("firstName") ?? ""),
          lastName: String(formData.get("lastName") ?? ""),
          email: String(formData.get("email") ?? ""),
          status: String(formData.get("status") ?? student.status)
        })
      });

      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(json.error ?? "Unable to update student.");
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
      description="Update the roster entry that future invites will use."
      footer={
        <button className="button" disabled={isPending} form={formId} type="submit">
          {isPending ? "Saving..." : "Save student"}
        </button>
      }
      open={isOpen}
      onOpenChange={setIsOpen}
      title="Edit student"
      triggerAriaLabel="Edit student"
      triggerChildren={<PencilIcon />}
      triggerClassName="icon-button"
      triggerLabel="Edit student"
      triggerTooltip="Edit student"
      triggerVariant="secondary"
    >
      <form
        action={(formData) => { void submit(formData); }}
        className="stack"
        id={formId}
      >
        <StudentFormFields
          defaultEmail={student.email}
          defaultFirstName={student.firstName}
          defaultLastName={student.lastName}
          defaultStatus={student.status}
          formId={formId}
        />
        {student.authUserId ? (
          <div className="note-box">
            Linked auth user: <strong>{student.authUserId}</strong>
          </div>
        ) : null}
        {error ? <p className="error-msg">{error}</p> : null}
      </form>
    </EndDrawer>
  );
}

function DeleteStudentButton({
  student,
  disabled,
  onDeleted
}: {
  student: StudentRow;
  disabled?: boolean;
  onDeleted?: (studentId: string) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function removeStudent() {
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/org/students/${student.studentId}`, { method: "DELETE" });
      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(json.error ?? "Unable to delete student.");
        return;
      }

      onDeleted?.(student.studentId);
      startTransition(() => { router.refresh(); });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="stack-sm" style={{ alignItems: "flex-end" }}>
      <button
        className="icon-button icon-button-danger"
        data-tooltip={student.authUserId ? "Delete student and linked account" : "Delete student"}
        disabled={isPending || Boolean(disabled)}
        type="button"
        onClick={() => { void removeStudent(); }}
      >
        <TrashIcon />
      </button>
      {error ? <p className="error-msg" style={{ margin: 0 }}>{error}</p> : null}
    </div>
  );
}

export function StudentRosterManager({ students }: { students: StudentRow[] }) {
  const router = useRouter();
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);
  const [isBulkPending, setIsBulkPending] = useState(false);
  const studentIds = useMemo(() => new Set(students.map((student) => student.studentId)), [students]);
  const hasSelection = selectedStudentIds.length > 0;
  const allStudentsSelected =
    students.length > 0 && selectedStudentIds.length === students.length;

  useEffect(() => {
    setSelectedStudentIds((current) => current.filter((studentId) => studentIds.has(studentId)));
  }, [studentIds]);

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    );
  }

  function toggleAllDeletable() {
    if (allStudentsSelected) {
      setSelectedStudentIds([]);
      return;
    }

    setSelectedStudentIds(students.map((student) => student.studentId));
  }

  async function deleteSelectedStudents() {
    if (!hasSelection) {
      return;
    }

    const confirmMessage = `Fully delete ${selectedStudentIds.length} selected student${selectedStudentIds.length === 1 ? "" : "s"}? This removes linked enrollments, activity, workspace data, and account access.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsBulkPending(true);
    setBulkError(null);
    setBulkSuccess(null);

    try {
      const response = await fetch("/api/org/students", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: selectedStudentIds })
      });
      const json = (await response.json()) as {
        error?: string;
        deletedCount?: number;
        skippedCount?: number;
      };

      if (!response.ok) {
        setBulkError(json.error ?? "Unable to delete selected students.");
        return;
      }

      const deletedCount = Number(json.deletedCount ?? 0);
      const skippedCount = Number(json.skippedCount ?? 0);

      setSelectedStudentIds([]);
      if (deletedCount > 0) {
        setBulkSuccess(
          skippedCount > 0
            ? `Deleted ${deletedCount} students. ${skippedCount} could not be deleted.`
            : `Deleted ${deletedCount} students.`
        );
      } else {
        setBulkError("None of the selected students could be deleted.");
      }

      startTransition(() => { router.refresh(); });
    } finally {
      setIsBulkPending(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>Student Roster</h2>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            Manage student records first, then create invites from this list.
          </p>
        </div>
        <div style={{ alignItems: "center", display: "flex", gap: 10, flexWrap: "wrap" }}>
          {hasSelection ? (
            <button
              className="button-danger"
              disabled={isBulkPending}
              type="button"
              onClick={() => { void deleteSelectedStudents(); }}
            >
              {isBulkPending
                ? "Deleting..."
                : `Delete selected (${selectedStudentIds.length})`}
            </button>
          ) : null}
          <CreateStudentDrawer />
        </div>
      </div>

      {bulkError ? <p className="error-msg" style={{ margin: "0 0 12px" }}>{bulkError}</p> : null}
      {bulkSuccess ? <p className="success-msg" style={{ margin: "0 0 12px" }}>{bulkSuccess}</p> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  aria-label="Select all students"
                  checked={allStudentsSelected}
                  disabled={isBulkPending || students.length === 0}
                  type="checkbox"
                  onChange={toggleAllDeletable}
                />
              </th>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Student ID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: "var(--muted)", textAlign: "center" }}>
                  No students in the roster yet.
                </td>
              </tr>
            ) : (
              students.map((student) => (
                <tr key={student.studentId}>
                  <td>
                    <input
                      aria-label={`Select ${student.firstName} ${student.lastName}`}
                      checked={selectedStudentIds.includes(student.studentId)}
                      disabled={isBulkPending}
                      type="checkbox"
                      onChange={() => { toggleStudent(student.studentId); }}
                    />
                  </td>
                  <td>{student.firstName} {student.lastName}</td>
                  <td>{student.email}</td>
                  <td>
                    <span className={`badge ${
                      student.status === "active"
                        ? "badge-teal"
                        : student.status === "invited"
                          ? "badge-accent"
                          : "badge-default"
                    }`}>
                      {student.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <code style={{ fontSize: "0.85rem", color: "var(--ink-2)" }}>{student.studentId}</code>
                      <button
                        type="button"
                        aria-label="Copy student ID"
                        className="icon-button"
                        onClick={() => {
                          void navigator.clipboard.writeText(student.studentId);
                        }}
                      >
                        <CopyIcon />
                      </button>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <EditStudentDrawer student={student} />
                      <DeleteStudentButton
                        disabled={isBulkPending}
                        student={student}
                        onDeleted={(studentId) => {
                          setSelectedStudentIds((current) => current.filter((id) => id !== studentId));
                          setBulkSuccess(null);
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
