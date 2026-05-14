"use client";

import { useEffect, useMemo, useState } from "react";

import type { Semester } from "@/types/domain";

type WeekAvailability = "available" | "future";
type CellStatus = "pass" | "fail" | "unavailable";

type WeekRow = {
  weekNumber: number;
  label: string;
  availability: WeekAvailability;
  startsAt: string;
  endsAt: string;
  students: Array<{
    userId: string;
    fullName: string;
    email: string;
    status: CellStatus;
  }>;
};

type GridResponse = {
  ok: true;
  semester: {
    semesterId: string;
    title: string;
    courseCode: string;
    durationWeeks: number;
    startsAt: string;
  };
  threshold: {
    model: "score-threshold";
    passScore: number;
  };
  weeks: WeekRow[];
};

export function OrgCourseGrid({
  semesters,
  initialSemesterId
}: {
  semesters: Semester[];
  initialSemesterId: string;
}) {
  const [semesterId, setSemesterId] = useState(initialSemesterId);
  const [weekFilter, setWeekFilter] = useState<string>("all");
  const [data, setData] = useState<GridResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedSemester = useMemo(
    () => semesters.find((semester) => semester.semesterId === semesterId) ?? null,
    [semesters, semesterId]
  );

  const weekOptions = useMemo(() => {
    const duration = Math.min(Math.max(Number(selectedSemester?.durationWeeks ?? 0), 1), 20);
    return Array.from({ length: duration }, (_, index) => index + 1);
  }, [selectedSemester]);

  useEffect(() => {
    if (!semesterId) {
      setData(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ semesterId });
        if (weekFilter !== "all") {
          params.set("week", weekFilter);
        }

        const response = await fetch(`/api/org/course-grid?${params.toString()}`);
        const json = (await response.json()) as GridResponse | { error?: string };

        if (!response.ok) {
          throw new Error((json as { error?: string }).error ?? "Unable to load course grid.");
        }

        if (!cancelled) {
          setData(json as GridResponse);
        }
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(err instanceof Error ? err.message : "Unable to load course grid.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [semesterId, weekFilter]);

  const students = useMemo(() => {
    if (!data || data.weeks.length === 0) {
      return [];
    }

    const firstWeek = data.weeks[0];
    return firstWeek.students;
  }, [data]);

  return (
    <div className="card">
      <div className="card-header" style={{ alignItems: "flex-end", gap: 16 }}>
        <div>
          <h2>Course Weekly Progress</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
            Threshold model: pass when weekly score meets the global minimum.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <label style={{ display: "grid", gap: 6, minWidth: 260 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
            Course
          </span>
          <select
            value={semesterId}
            onChange={(event) => {
              setSemesterId(event.target.value);
              setWeekFilter("all");
            }}
            style={{ height: 38, borderRadius: 10, border: "1px solid var(--line)", padding: "0 10px", background: "var(--card)" }}
          >
            {semesters.map((semester) => (
              <option key={semester.semesterId} value={semester.semesterId}>
                {semester.courseCode} · {semester.title}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6, minWidth: 180 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
            Week Focus
          </span>
          <select
            value={weekFilter}
            onChange={(event) => setWeekFilter(event.target.value)}
            style={{ height: 38, borderRadius: 10, border: "1px solid var(--line)", padding: "0 10px", background: "var(--card)" }}
          >
            <option value="all">All weeks</option>
            {weekOptions.map((weekNumber) => (
              <option key={weekNumber} value={String(weekNumber)}>
                Week {weekNumber}
              </option>
            ))}
          </select>
        </label>
        </div>
      </div>

      {loading && (
        <div style={{ color: "var(--muted)", padding: "8px 0" }}>
          Loading weekly status grid...
        </div>
      )}

      {!loading && error && (
        <div style={{ color: "var(--danger, #b42318)", padding: "8px 0" }}>
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 10 }}>
            {data.semester.courseCode} · {data.semester.title} · Pass threshold: {data.threshold.passScore}
          </div>
          <div className="table-wrap" style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  {data.weeks.map((week) => (
                    <th
                      key={week.weekNumber}
                      title={`${new Date(week.startsAt).toLocaleDateString()} - ${new Date(week.endsAt).toLocaleDateString()}`}
                      style={
                        week.availability === "future"
                          ? {
                              color: "var(--muted)",
                              background: "color-mix(in srgb, var(--line) 30%, transparent)",
                              borderColor: "var(--line)"
                            }
                          : undefined
                      }
                    >
                      {week.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(2, data.weeks.length + 1)} style={{ textAlign: "center", color: "var(--muted)" }}>
                      No enrolled students found for this course.
                    </td>
                  </tr>
                ) : (
                  students.map((student) => (
                    <tr key={student.userId}>
                      <td>
                        <div style={{ display: "grid" }}>
                          <strong>{student.fullName}</strong>
                          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{student.email || student.userId}</span>
                        </div>
                      </td>
                      {data.weeks.map((week) => {
                        const cell = week.students.find((candidate) => candidate.userId === student.userId);
                        const status = cell?.status ?? "fail";

                        return (
                          <td key={`${student.userId}:${week.weekNumber}`}>
                            {status === "unavailable" ? (
                              <span style={{ color: "var(--muted)" }}>-</span>
                            ) : (
                              <span
                                className={`badge ${status === "pass" ? "badge-teal" : "badge-accent"}`}
                              >
                                {status === "pass" ? "PASS" : "NOT PASSING"}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
