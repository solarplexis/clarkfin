"use client";

import { useEffect, useState } from "react";
import {
  CopyInviteLinkButton,
  CreateStudentInviteForm,
  DeleteInviteButton,
  EditInviteDrawer
} from "@/components/create-student-invite-form";

const STORAGE_KEY = "org-selected-semester-id";

const SortChevronIcon = ({ direction }: { direction: "asc" | "desc" }) => (
  <svg
    aria-hidden="true"
    fill="none"
    height="10"
    style={{ transform: direction === "desc" ? "rotate(180deg)" : undefined }}
    viewBox="0 0 10 6"
    width="10"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
  </svg>
);

type InviteSortKey = "student" | "email" | "status";
type SortDirection = "asc" | "desc";

const INVITES_PAGE_SIZE = 15;

function compareInviteRows(a: InviteRow, b: InviteRow, sortKey: InviteSortKey): number {
  switch (sortKey) {
    case "student":
      return `${a.studentFirstName} ${a.studentLastName}`
        .toLowerCase()
        .localeCompare(`${b.studentFirstName} ${b.studentLastName}`.toLowerCase());
    case "email":
      return a.studentEmail.toLowerCase().localeCompare(b.studentEmail.toLowerCase());
    case "status":
      return a.status.localeCompare(b.status);
  }
}

type SemesterOption = {
  semesterId: string;
  title: string;
  courseCode: string;
  isActive: boolean;
};

type InviteRow = {
  inviteId: string;
  inviteCode: string;
  studentId: string;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  semesterId: string;
  status: "pending" | "redeemed" | "revoked";
};

type FeedbackRow = {
  id: string;
  userId: string;
  semesterId: string;
  grade: number;
  gradeLetter: string;
  gradeBreakdown: { engagement: number; savings: number; goals: number };
  submittedAt: string | null;
};

type EnrolledStudent = {
  uid: string;
  fullName: string;
  email: string;
};

type RosterStudent = {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  status: "prospect" | "invited" | "active" | "inactive";
  authUserId?: string;
};

export function SelectedCourseSection({
  semesters,
  invites,
  feedbacks,
  roster,
  enrolledStudents
}: {
  semesters: SemesterOption[];
  invites: InviteRow[];
  feedbacks: FeedbackRow[];
  roster: RosterStudent[];
  enrolledStudents: EnrolledStudent[];
}) {
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>(
    semesters[0]?.semesterId ?? ""
  );
  const [inviteSortKey, setInviteSortKey] = useState<InviteSortKey>("student");
  const [inviteSortDir, setInviteSortDir] = useState<SortDirection>("asc");
  const [invitePage, setInvitePage] = useState(0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && semesters.some((s) => s.semesterId === stored)) {
        setSelectedSemesterId(stored);
      }
    } catch {
      // localStorage unavailable
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function selectSemester(semesterId: string) {
    setSelectedSemesterId(semesterId);
    setInvitePage(0);
    try {
      localStorage.setItem(STORAGE_KEY, semesterId);
    } catch {
      // localStorage unavailable
    }
  }

  const selectedSemester = semesters.find((s) => s.semesterId === selectedSemesterId) ?? semesters[0];
  const filteredInvites = invites.filter((inv) => inv.semesterId === selectedSemesterId);
  const filteredFeedbacks = feedbacks.filter((fb) => fb.semesterId === selectedSemesterId);
  const invitedStudentIds = new Set(filteredInvites.map((inv) => inv.studentId));
  const enrolledStudentsById = new Map(enrolledStudents.map((s) => [s.uid, s]));

  const sortedInvites = [...filteredInvites].sort((a, b) => compareInviteRows(a, b, inviteSortKey));
  if (inviteSortDir === "desc") sortedInvites.reverse();
  const invitePageCount = Math.max(1, Math.ceil(sortedInvites.length / INVITES_PAGE_SIZE));
  const currentInvitePage = Math.min(invitePage, invitePageCount - 1);
  const pagedInvites = sortedInvites.slice(
    currentInvitePage * INVITES_PAGE_SIZE,
    currentInvitePage * INVITES_PAGE_SIZE + INVITES_PAGE_SIZE
  );

  function toggleInviteSort(key: InviteSortKey) {
    if (inviteSortKey === key) {
      setInviteSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setInviteSortKey(key);
      setInviteSortDir("asc");
    }
    setInvitePage(0);
  }

  if (semesters.length === 0) {
    return null;
  }

  return (
    <div className="course-group">
      <div className="course-group-header">
        <span className="course-group-label">Selected Course</span>
        {semesters.length > 1 ? (
          <select
            aria-label="Select course"
            className="course-group-select"
            value={selectedSemesterId}
            onChange={(e) => selectSemester(e.target.value)}
          >
            {semesters.map((semester) => (
              <option key={semester.semesterId} value={semester.semesterId}>
                {semester.courseCode} · {semester.title}
                {semester.isActive ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        ) : selectedSemester ? (
          <span className="course-group-name">
            {selectedSemester.courseCode} · {selectedSemester.title}
          </span>
        ) : null}
      </div>

      <div className="course-group-body">
        <div className="card">
          <div className="card-header">
            <h2>Invites</h2>
            <CreateStudentInviteForm
              defaultSemesterId={selectedSemesterId}
              semesters={semesters}
              students={roster.filter((student) => student.status === "prospect" && !invitedStudentIds.has(student.studentId))}
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <button
                      aria-sort={inviteSortKey === "student" ? (inviteSortDir === "asc" ? "ascending" : "descending") : "none"}
                      className="th-sort-button"
                      type="button"
                      onClick={() => { toggleInviteSort("student"); }}
                    >
                      Student
                      <SortChevronIcon direction={inviteSortKey === "student" ? inviteSortDir : "asc"} />
                    </button>
                  </th>
                  <th>
                    <button
                      aria-sort={inviteSortKey === "email" ? (inviteSortDir === "asc" ? "ascending" : "descending") : "none"}
                      className="th-sort-button"
                      type="button"
                      onClick={() => { toggleInviteSort("email"); }}
                    >
                      Email
                      <SortChevronIcon direction={inviteSortKey === "email" ? inviteSortDir : "asc"} />
                    </button>
                  </th>
                  <th>Invite code</th>
                  <th>
                    <button
                      aria-sort={inviteSortKey === "status" ? (inviteSortDir === "asc" ? "ascending" : "descending") : "none"}
                      className="th-sort-button"
                      type="button"
                      onClick={() => { toggleInviteSort("status"); }}
                    >
                      Status
                      <SortChevronIcon direction={inviteSortKey === "status" ? inviteSortDir : "asc"} />
                    </button>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagedInvites.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)" }}>
                      No invites for this course yet.
                    </td>
                  </tr>
                ) : (
                  pagedInvites.map((invite) => {
                    return (
                      <tr key={invite.inviteId}>
                        <td>{invite.studentFirstName} {invite.studentLastName}</td>
                        <td>{invite.studentEmail}</td>
                        <td><span className="semester-card-code">{invite.inviteCode}</span></td>
                        <td>
                          <span
                            className={`badge ${
                              invite.status === "pending"
                                ? "badge-teal"
                                : invite.status === "redeemed"
                                  ? "badge-accent"
                                  : "badge-default"
                            }`}
                          >
                            {invite.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <CopyInviteLinkButton invite={invite} />
                            <EditInviteDrawer invite={invite} />
                            <DeleteInviteButton invite={invite} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {sortedInvites.length > INVITES_PAGE_SIZE ? (
              <div className="table-pagination">
                <span className="muted">
                  Page {currentInvitePage + 1} of {invitePageCount} · {sortedInvites.length} invites
                </span>
                <button
                  className="button-secondary btn-sm"
                  disabled={currentInvitePage === 0}
                  type="button"
                  onClick={() => { setInvitePage((current) => Math.max(0, current - 1)); }}
                >
                  Previous
                </button>
                <button
                  className="button-secondary btn-sm"
                  disabled={currentInvitePage >= invitePageCount - 1}
                  type="button"
                  onClick={() => { setInvitePage((current) => Math.min(invitePageCount - 1, current + 1)); }}
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Grade Roster</h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
              Students who have submitted end-of-course feedback. Use these grades for Canvas entry.
            </p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Email</th>
                  <th>Grade</th>
                  <th>Breakdown</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {filteredFeedbacks.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)" }}>
                      No feedback submitted for this course yet.
                    </td>
                  </tr>
                ) : (
                  filteredFeedbacks.map((fb) => {
                    const student = enrolledStudentsById.get(fb.userId);
                    return (
                      <tr key={fb.id}>
                        <td>{student?.fullName ?? fb.userId}</td>
                        <td>{student?.email ?? "—"}</td>
                        <td>
                          <span className="grade-badge">
                            {fb.gradeLetter} &nbsp;<span style={{ color: "var(--muted)", fontWeight: 400 }}>{fb.grade}/100</span>
                          </span>
                        </td>
                        <td style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                          Eng {fb.gradeBreakdown.engagement}/40 · Sav {fb.gradeBreakdown.savings}/35 · Goals {fb.gradeBreakdown.goals}/25
                        </td>
                        <td style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                          {fb.submittedAt ? new Date(fb.submittedAt).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
