"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { EndDrawer } from "@/components/end-drawer";

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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submit(formData: FormData) {
    setError(null);

    const response = await fetch("/api/org/students", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
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

    router.refresh();
  }

  return (
    <EndDrawer
      description="Add a roster entry before sending course invites."
      footer={
        <button className="button" disabled={isPending} form={formId} type="submit">
          {isPending ? "Creating student..." : "Add student"}
        </button>
      }
      title="Add student"
      triggerAriaLabel="Add student"
      triggerChildren={<span aria-hidden="true" className="section-plus-glyph">+</span>}
      triggerClassName="section-plus-button"
      triggerLabel="Add student"
      triggerTooltip="Add student"
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
        <StudentFormFields defaultStatus="prospect" formId={formId} />
        {error ? <p className="error-msg">{error}</p> : null}
      </form>
    </EndDrawer>
  );
}

function EditStudentDrawer({ student }: { student: StudentRow }) {
  const formId = useId();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submit(formData: FormData) {
    setError(null);

    const response = await fetch(`/api/org/students/${student.studentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
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

    router.refresh();
  }

  return (
    <EndDrawer
      description="Update the roster entry that future invites will use."
      footer={
        <button className="button" disabled={isPending} form={formId} type="submit">
          {isPending ? "Saving..." : "Save student"}
        </button>
      }
      title="Edit student"
      triggerLabel="Edit"
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

function DeleteStudentButton({ student }: { student: StudentRow }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function removeStudent() {
    setError(null);

    const response = await fetch(`/api/org/students/${student.studentId}`, {
      method: "DELETE"
    });

    const json = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(json.error ?? "Unable to delete student.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="stack-sm" style={{ alignItems: "flex-end" }}>
      <button
        className="button-secondary"
        disabled={isPending || Boolean(student.authUserId)}
        type="button"
        onClick={() => {
          startTransition(() => {
            void removeStudent();
          });
        }}
      >
        {isPending ? "Removing..." : "Delete"}
      </button>
      {error ? <p className="error-msg" style={{ margin: 0 }}>{error}</p> : null}
    </div>
  );
}

export function StudentRosterManager({ students }: { students: StudentRow[] }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>Student Roster</h2>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            Manage student records first, then create invites from this list.
          </p>
        </div>
        <CreateStudentDrawer />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Auth user</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: "var(--muted)", textAlign: "center" }}>
                  No students in the roster yet.
                </td>
              </tr>
            ) : (
              students.map((student) => (
                <tr key={student.studentId}>
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
                  <td>{student.authUserId ?? "Not linked yet"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <EditStudentDrawer student={student} />
                      <DeleteStudentButton student={student} />
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
