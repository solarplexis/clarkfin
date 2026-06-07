import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { CourseEditForm } from "@/components/course-edit-form";
import { requireRole } from "@/src/lib/auth/session";
import { getSemesterById, getSyllabus } from "@/src/lib/data/repositories";

export const metadata: Metadata = {
  title: "Edit Course"
};

export default async function CourseEditPage({
  params
}: {
  params: Promise<{ semesterId: string }>;
}) {
  const user = await requireRole("ORG_ADMIN");
  const { semesterId } = await params;
  const semester = await getSemesterById(semesterId);

  if (!semester || semester.orgId !== (user.organizationId ?? "")) {
    notFound();
  }

  const syllabusHtml = await getSyllabus(semesterId);

  return (
    <DashboardShell user={user}>
      <div className="page-header">
        <div className="page-header-text">
          <a
            href="/app/org"
            style={{ fontSize: "0.875rem", color: "var(--muted)", textDecoration: "none" }}
          >
            ← Courses
          </a>
          <h1 style={{ marginTop: 4 }}>{semester.title}</h1>
          <p>{semester.courseCode} · {semester.semesterId}</p>
        </div>
      </div>

      <CourseEditForm semester={semester} initialSyllabusHtml={syllabusHtml ?? ""} />
    </DashboardShell>
  );
}
