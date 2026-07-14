"use client";

import { useState } from "react";

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

type ActivityStudentRow = {
  uid: string;
  fullName: string;
  email: string;
  activeSemesterId: string;
  latestActivityAt: string | null;
  latestActivitySummary: string | null;
};

type SemesterOption = {
  semesterId: string;
  title: string;
  courseCode: string;
};

type ActivitySortKey = "student" | "email" | "lastAction" | "latestActivity";
type SortDirection = "asc" | "desc";

const ACTIVITY_PAGE_SIZE = 15;

function compareActivityRows(a: ActivityStudentRow, b: ActivityStudentRow, sortKey: ActivitySortKey): number {
  switch (sortKey) {
    case "student":
      return a.fullName.toLowerCase().localeCompare(b.fullName.toLowerCase());
    case "email":
      return a.email.toLowerCase().localeCompare(b.email.toLowerCase());
    case "lastAction":
      return (a.latestActivitySummary ?? "").toLowerCase().localeCompare((b.latestActivitySummary ?? "").toLowerCase());
    case "latestActivity":
      return (a.latestActivityAt ?? "").localeCompare(b.latestActivityAt ?? "");
  }
}

export function StudentActivityTable({
  students,
  semesters
}: {
  students: ActivityStudentRow[];
  semesters: SemesterOption[];
}) {
  const [sortKey, setSortKey] = useState<ActivitySortKey>("latestActivity");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [page, setPage] = useState(0);

  const semestersById = new Map(semesters.map((semester) => [semester.semesterId, semester]));

  const sortedStudents = [...students].sort((a, b) => compareActivityRows(a, b, sortKey));
  if (sortDir === "desc") sortedStudents.reverse();
  const pageCount = Math.max(1, Math.ceil(sortedStudents.length / ACTIVITY_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pagedStudents = sortedStudents.slice(
    currentPage * ACTIVITY_PAGE_SIZE,
    currentPage * ACTIVITY_PAGE_SIZE + ACTIVITY_PAGE_SIZE
  );

  function toggleSort(key: ActivitySortKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }

  function sortableHeader(key: ActivitySortKey, label: string) {
    return (
      <th>
        <button
          aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
          className="th-sort-button"
          type="button"
          onClick={() => { toggleSort(key); }}
        >
          {label}
          <SortChevronIcon direction={sortKey === key ? sortDir : "asc"} />
        </button>
      </th>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Student Activity</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {sortableHeader("student", "Student")}
              {sortableHeader("email", "Email")}
              <th>Active course</th>
              {sortableHeader("lastAction", "Last action")}
              {sortableHeader("latestActivity", "Latest activity")}
            </tr>
          </thead>
          <tbody>
            {pagedStudents.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)" }}>
                  No enrolled students yet.
                </td>
              </tr>
            ) : (
              pagedStudents.map((student) => (
                <tr key={student.uid}>
                  <td>{student.fullName}</td>
                  <td>{student.email}</td>
                  <td>
                    {student.activeSemesterId
                      ? (() => {
                          const semester = semestersById.get(student.activeSemesterId);

                          return semester
                            ? `${semester.courseCode} · ${semester.title}`
                            : student.activeSemesterId;
                        })()
                      : "No active course"}
                  </td>
                  <td>
                    {student.latestActivitySummary
                      ? student.latestActivitySummary
                      : <span style={{ color: "var(--muted)" }}>No activity yet</span>}
                  </td>
                  <td>
                    {student.latestActivityAt
                      ? new Date(student.latestActivityAt).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
                      : <span style={{ color: "var(--muted)" }}>No activity yet</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {sortedStudents.length > ACTIVITY_PAGE_SIZE ? (
          <div className="table-pagination">
            <span className="muted">
              Page {currentPage + 1} of {pageCount} · {sortedStudents.length} students
            </span>
            <button
              className="button-secondary btn-sm"
              disabled={currentPage === 0}
              type="button"
              onClick={() => { setPage((current) => Math.max(0, current - 1)); }}
            >
              Previous
            </button>
            <button
              className="button-secondary btn-sm"
              disabled={currentPage >= pageCount - 1}
              type="button"
              onClick={() => { setPage((current) => Math.min(pageCount - 1, current + 1)); }}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
