import type { Semester } from "@/types/domain";
import { getAdminDb } from "@/src/lib/firebase/admin";
import { getUserProfileById } from "@/src/lib/data/repositories";

export type CourseWeekAvailability = "available" | "future";
export type CourseWeekPassStatus = "pass" | "fail" | "unavailable";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export const MAX_GRID_WEEKS = 20;
export const WEEKLY_PASS_THRESHOLD = 2;

export interface CourseWeekStudentStatus {
  userId: string;
  fullName: string;
  email: string;
  status: CourseWeekPassStatus;
}

export interface CourseWeekResult {
  weekNumber: number;
  label: string;
  startsAt: string;
  endsAt: string;
  availability: CourseWeekAvailability;
  students: CourseWeekStudentStatus[];
}

export interface OrgCourseGridResult {
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
    maxScore: number;
    rubric: Array<{ key: string; points: number; description: string }>;
  };
  weeks: CourseWeekResult[];
}

export interface CourseWeekCriterionStatus {
  key: string;
  points: number;
  description: string;
  met: boolean;
}

export interface StudentCurrentWeekProgress {
  semester: {
    semesterId: string;
    title: string;
    courseCode: string;
    durationWeeks: number;
    startsAt: string;
  };
  week: {
    weekNumber: number;
    currentWeekNumber: number;
    label: string;
    startsAt: string;
    endsAt: string;
    availability: CourseWeekAvailability;
  };
  threshold: {
    model: "score-threshold";
    passScore: number;
    maxScore: number;
  };
  score: number;
  status: CourseWeekPassStatus;
  criteria: CourseWeekCriterionStatus[];
}

function parseStartDate(startsAt: string) {
  const trimmed = startsAt.trim();
  // Treat plain YYYY-MM-DD as a UTC date to avoid environment-local drift.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsedUtc = new Date(`${trimmed}T00:00:00.000Z`);
    if (!Number.isNaN(parsedUtc.getTime())) {
      return parsedUtc;
    }
  }

  const parsed = new Date(startsAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function toEventDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    const dt = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getWeekWindow(semesterStart: Date, weekNumber: number) {
  const weekStart = new Date(semesterStart.getTime() + (weekNumber - 1) * MS_PER_WEEK);
  const weekEnd = new Date(weekStart.getTime() + (MS_PER_WEEK - 1));
  return { weekStart, weekEnd };
}

function getWeekNumberFromDate(semesterStart: Date, value: Date) {
  const diffMs = value.getTime() - semesterStart.getTime();
  if (diffMs < 0) {
    return 0;
  }
  return Math.floor(diffMs / MS_PER_WEEK) + 1;
}

type StudentWeekSignal = {
  budgetTouched: boolean;
  debtTouched: boolean;
  meaningfulActivityCount: number;
};

const SCORING_RUBRIC = [
  {
    key: "budget_touched",
    points: 1,
    description: "Student performed at least one budget action in the week."
  },
  {
    key: "debt_touched",
    points: 1,
    description: "Student performed at least one debt action in the week."
  },
  {
    key: "activity_volume",
    points: 1,
    description: "Student logged at least 3 meaningful activity events in the week."
  }
] as const;

const WEEKLY_MAX_SCORE = SCORING_RUBRIC.reduce((sum, criterion) => sum + criterion.points, 0);

function computeScore(signal: StudentWeekSignal) {
  let score = 0;
  if (signal.budgetTouched) score += 1;
  if (signal.debtTouched) score += 1;
  if (signal.meaningfulActivityCount >= 3) score += 1;
  return score;
}

function buildCriteria(signal: StudentWeekSignal): CourseWeekCriterionStatus[] {
  return SCORING_RUBRIC.map((criterion) => {
    let met = false;
    if (criterion.key === "budget_touched") {
      met = signal.budgetTouched;
    } else if (criterion.key === "debt_touched") {
      met = signal.debtTouched;
    } else if (criterion.key === "activity_volume") {
      met = signal.meaningfulActivityCount >= 3;
    }

    return {
      key: criterion.key,
      points: criterion.points,
      description: criterion.description,
      met
    };
  });
}

export async function getStudentCurrentWeekProgress(input: {
  organizationId: string;
  userId: string;
  semester: Semester;
  weekNumber?: number;
  now?: Date;
}): Promise<StudentCurrentWeekProgress> {
  if (!input.semester.startsAt) {
    throw new Error("Course start date is required to evaluate weekly progress.");
  }

  const semesterStart = parseStartDate(input.semester.startsAt);
  if (!semesterStart) {
    throw new Error("Course start date is invalid.");
  }

  const durationWeeks = Math.min(Math.max(Number(input.semester.durationWeeks || 0), 1), MAX_GRID_WEEKS);
  const now = input.now ?? new Date();
  const computedWeekNumber = getWeekNumberFromDate(semesterStart, now);
  const currentWeekNumber = computedWeekNumber < 1 ? 1 : Math.min(computedWeekNumber, durationWeeks);

  if (input.weekNumber && (input.weekNumber < 1 || input.weekNumber > durationWeeks)) {
    throw new Error(`week must be between 1 and ${durationWeeks} for this course.`);
  }

  const weekNumber = input.weekNumber ?? currentWeekNumber;
  const { weekStart, weekEnd } = getWeekWindow(semesterStart, weekNumber);
  const availability: CourseWeekAvailability = now >= weekStart ? "available" : "future";

  const signal: StudentWeekSignal = {
    budgetTouched: false,
    debtTouched: false,
    meaningfulActivityCount: 0
  };

  if (availability === "available") {
    const adminDb = getAdminDb();
    const logSnapshot = await adminDb
      .collection("activity_logs")
      .where("organizationId", "==", input.organizationId)
      .where("semesterId", "==", input.semester.semesterId)
      .where("userId", "==", input.userId)
      .limit(1000)
      .get();

    for (const doc of logSnapshot.docs) {
      const data = doc.data();
      const occurredDate = toEventDate(data.occurredAt);

      if (!occurredDate) {
        continue;
      }
      if (occurredDate < weekStart || occurredDate > weekEnd) {
        continue;
      }

      const moduleName = String(data.module ?? "");
      const actionName = String(data.action ?? "");
      if (moduleName === "budget" && ["saved", "submitted", "actuals_saved"].includes(actionName)) {
        signal.budgetTouched = true;
      }
      if (moduleName === "debt" && ["saved", "submitted"].includes(actionName)) {
        signal.debtTouched = true;
      }
      if (moduleName === "budget" || moduleName === "debt") {
        signal.meaningfulActivityCount += 1;
      }
    }

    // Income/expense entries are budget activity even if activity_logs were not emitted.
    const [incomeSnapshot, expenseSnapshot] = await Promise.all([
      adminDb
        .collection("income_entries")
        .where("organizationId", "==", input.organizationId)
        .where("semesterId", "==", input.semester.semesterId)
        .where("userId", "==", input.userId)
        .limit(1000)
        .get(),
      adminDb
        .collection("expense_entries")
        .where("organizationId", "==", input.organizationId)
        .where("semesterId", "==", input.semester.semesterId)
        .where("userId", "==", input.userId)
        .limit(1000)
        .get()
    ]);

    for (const doc of [...incomeSnapshot.docs, ...expenseSnapshot.docs]) {
      const data = doc.data();
      const eventDate = toEventDate(data.updatedAt) ?? toEventDate(data.createdAt);
      if (!eventDate || eventDate < weekStart || eventDate > weekEnd) {
        continue;
      }

      signal.budgetTouched = true;
      signal.meaningfulActivityCount += 1;
    }
  }

  const score = availability === "future" ? 0 : computeScore(signal);
  const status: CourseWeekPassStatus =
    availability === "future"
      ? "unavailable"
      : score >= WEEKLY_PASS_THRESHOLD
        ? "pass"
        : "fail";

  return {
    semester: {
      semesterId: input.semester.semesterId,
      title: input.semester.title,
      courseCode: input.semester.courseCode,
      durationWeeks,
      startsAt: input.semester.startsAt
    },
    week: {
      weekNumber,
      currentWeekNumber,
      label: `Week ${weekNumber}`,
      startsAt: weekStart.toISOString(),
      endsAt: weekEnd.toISOString(),
      availability
    },
    threshold: {
      model: "score-threshold",
      passScore: WEEKLY_PASS_THRESHOLD,
      maxScore: WEEKLY_MAX_SCORE
    },
    score,
    status,
    criteria: buildCriteria(signal)
  };
}

export async function buildOrgCourseWeekGrid(input: {
  organizationId: string;
  semester: Semester;
  weekFilter?: number;
}): Promise<OrgCourseGridResult> {
  if (!input.semester.startsAt) {
    throw new Error("Course start date is required to build weekly grid.");
  }

  const semesterStart = parseStartDate(input.semester.startsAt);
  if (!semesterStart) {
    throw new Error("Course start date is invalid.");
  }

  const durationWeeks = Math.min(Math.max(Number(input.semester.durationWeeks || 0), 1), MAX_GRID_WEEKS);
  if (input.weekFilter && input.weekFilter > durationWeeks) {
    throw new Error(`week must be between 1 and ${durationWeeks} for this course.`);
  }
  const weeksToRender = input.weekFilter ? [input.weekFilter] : Array.from({ length: durationWeeks }, (_, i) => i + 1);

  const adminDb = getAdminDb();
  const enrollmentSnapshot = await adminDb
    .collection("student_enrollments")
    .where("organizationId", "==", input.organizationId)
    .where("semesterId", "==", input.semester.semesterId)
    .get();

  const userIds = Array.from(
    new Set(
      enrollmentSnapshot.docs
        .map((doc) => String(doc.data().userId ?? "").trim())
        .filter(Boolean)
    )
  );

  const users = await Promise.all(
    userIds.map(async (userId) => {
      const profile = await getUserProfileById(userId);
      return {
        userId,
        fullName: profile?.fullName ?? userId,
        email: profile?.email ?? ""
      };
    })
  );

  users.sort((a, b) => a.fullName.localeCompare(b.fullName));

  const signalsByUserWeek = new Map<string, StudentWeekSignal>();

  if (userIds.length > 0) {
    const logSnapshot = await adminDb
      .collection("activity_logs")
      .where("organizationId", "==", input.organizationId)
      .where("semesterId", "==", input.semester.semesterId)
      .limit(10000)
      .get();

    const enrolledUserSet = new Set(userIds);

    for (const doc of logSnapshot.docs) {
      const data = doc.data();
      const userId = String(data.userId ?? "");

      if (!enrolledUserSet.has(userId)) {
        continue;
      }

      const occurredDate = toEventDate(data.occurredAt);

      if (!occurredDate) {
        continue;
      }

      const weekNumber = getWeekNumberFromDate(semesterStart, occurredDate);
      if (weekNumber < 1 || weekNumber > durationWeeks) {
        continue;
      }

      const key = `${userId}:${weekNumber}`;
      const current = signalsByUserWeek.get(key) ?? {
        budgetTouched: false,
        debtTouched: false,
        meaningfulActivityCount: 0
      };

      const moduleName = String(data.module ?? "");
      const actionName = String(data.action ?? "");
      // Use || to avoid overwriting an already-true signal from an earlier log entry.
      if (moduleName === "budget" && ["saved", "submitted", "actuals_saved"].includes(actionName)) {
        current.budgetTouched = true;
      }
      if (moduleName === "debt" && ["saved", "submitted"].includes(actionName)) {
        current.debtTouched = true;
      }
      if (moduleName === "budget" || moduleName === "debt") {
        current.meaningfulActivityCount += 1;
      }

      signalsByUserWeek.set(key, current);
    }

    const [incomeSnapshot, expenseSnapshot] = await Promise.all([
      adminDb
        .collection("income_entries")
        .where("organizationId", "==", input.organizationId)
        .where("semesterId", "==", input.semester.semesterId)
        .limit(10000)
        .get(),
      adminDb
        .collection("expense_entries")
        .where("organizationId", "==", input.organizationId)
        .where("semesterId", "==", input.semester.semesterId)
        .limit(10000)
        .get()
    ]);

    for (const doc of [...incomeSnapshot.docs, ...expenseSnapshot.docs]) {
      const data = doc.data();
      const userId = String(data.userId ?? "");
      if (!enrolledUserSet.has(userId)) {
        continue;
      }

      const eventDate = toEventDate(data.updatedAt) ?? toEventDate(data.createdAt);
      if (!eventDate) {
        continue;
      }

      const weekNumber = getWeekNumberFromDate(semesterStart, eventDate);
      if (weekNumber < 1 || weekNumber > durationWeeks) {
        continue;
      }

      const key = `${userId}:${weekNumber}`;
      const current = signalsByUserWeek.get(key) ?? {
        budgetTouched: false,
        debtTouched: false,
        meaningfulActivityCount: 0
      };

      current.budgetTouched = true;
      current.meaningfulActivityCount += 1;
      signalsByUserWeek.set(key, current);
    }
  }

  const now = new Date();

  const weeks = weeksToRender.map((weekNumber) => {
    const { weekStart, weekEnd } = getWeekWindow(semesterStart, weekNumber);
    const availability: CourseWeekAvailability = now >= weekStart ? "available" : "future";

    const students: CourseWeekStudentStatus[] = users.map((student) => {
      if (availability === "future") {
        return {
          userId: student.userId,
          fullName: student.fullName,
          email: student.email,
          status: "unavailable"
        };
      }

      const key = `${student.userId}:${weekNumber}`;
      const signal = signalsByUserWeek.get(key) ?? {
        budgetTouched: false,
        debtTouched: false,
        meaningfulActivityCount: 0
      };

      const score = computeScore(signal);

      return {
        userId: student.userId,
        fullName: student.fullName,
        email: student.email,
        status: score >= WEEKLY_PASS_THRESHOLD ? "pass" : "fail"
      };
    });

    return {
      weekNumber,
      label: `Week ${weekNumber}`,
      startsAt: weekStart.toISOString(),
      endsAt: weekEnd.toISOString(),
      availability,
      students
    } satisfies CourseWeekResult;
  });

  return {
    semester: {
      semesterId: input.semester.semesterId,
      title: input.semester.title,
      courseCode: input.semester.courseCode,
      durationWeeks,
      startsAt: input.semester.startsAt
    },
    threshold: {
      model: "score-threshold",
      passScore: WEEKLY_PASS_THRESHOLD,
      maxScore: WEEKLY_MAX_SCORE,
      rubric: SCORING_RUBRIC.map((criterion) => ({
        key: criterion.key,
        points: criterion.points,
        description: criterion.description
      }))
    },
    weeks
  };
}
