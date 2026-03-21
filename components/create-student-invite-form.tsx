"use client";

import { useDeferredValue, useId, useState, useTransition } from "react";

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

type StudentInviteResponse = {
  error?: string;
  invite?: {
    inviteId: string;
    inviteCode: string;
    semesterId: string;
    studentId: string;
    studentEmail: string;
    studentFirstName: string;
    studentLastName: string;
    status: "pending" | "redeemed" | "revoked";
  };
};

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
  const listboxId = `${formId}-student-listbox`;
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StudentInviteResponse | null>(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
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
    setError(null);
    setResult(null);

    if (!selectedStudentId) {
      setError("Choose a student before creating an invite.");
      return;
    }

    const response = await fetch("/api/org/invites", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        semesterId: String(formData.get("semesterId") ?? ""),
        studentId: selectedStudentId
      })
    });

    const json = (await response.json()) as StudentInviteResponse;

    if (!response.ok) {
      setError(json.error ?? "Unable to create invite.");
      return;
    }

    setResult(json);
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
          {isPending ? "Creating invite..." : "Create invite"}
        </button>
      }
      title="Invite student"
      triggerAriaLabel={
        semesters.length === 0
          ? "Add a course first"
          : students.length === 0
            ? "Add students to the roster first"
            : "Invite student"
      }
      triggerChildren={<span aria-hidden="true" className="section-plus-glyph">+</span>}
      triggerClassName="section-plus-button"
      triggerDisabled={semesters.length === 0 || students.length === 0}
      triggerLabel="Invite student"
      triggerTooltip="Invite student"
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
        {result?.invite ? (
          <div className="note-box" style={{ marginTop: 4 }}>
            <strong>
              {result.invite.studentFirstName} {result.invite.studentLastName} is ready to enroll.
            </strong>
            <div style={{ color: "var(--muted)", marginTop: 4 }}>{result.invite.studentEmail}</div>
            <div style={{ marginTop: 8 }}>
              <strong>Invite code:</strong> {result.invite.inviteCode}
            </div>
          </div>
        ) : null}
      </form>
    </EndDrawer>
  );
}
