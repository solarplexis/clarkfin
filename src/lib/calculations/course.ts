export interface CourseMilestone {
  weekNum: number;
  label: string;
  isFinal: boolean;
  isUnlocked: boolean;
  unlockDate: Date;
  months: { year: number; month: number }[];
}

export function getCourseWeek(startsAt: string): number {
  const start = new Date(startsAt);
  const diffMs = Date.now() - start.getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
}

function monthsInRange(from: Date, to: Date): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur <= end) {
    result.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 });
    cur.setMonth(cur.getMonth() + 1);
  }
  return result;
}

export function getCourseMilestones(startsAt: string, durationWeeks: number): CourseMilestone[] {
  const start = new Date(startsAt);
  const checkpoints = durationWeeks >= 10 ? [4, 8, 10] : [4, 8];
  const now = new Date();

  return checkpoints.map((weekNum, i) => {
    const unlockDate = new Date(start.getTime() + weekNum * 7 * 24 * 60 * 60 * 1000);
    const isFinal = weekNum === durationWeeks;
    const periodStart = i === 0
      ? start
      : new Date(start.getTime() + checkpoints[i - 1] * 7 * 24 * 60 * 60 * 1000);

    const label = durationWeeks >= 10
      ? weekNum === 4 ? "Month 1" : weekNum === 8 ? "Month 2" : "Class to Date"
      : weekNum === 4 ? "Month 1" : "Class to Date";

    // Final report aggregates from course start; others cover their own period only
    const rangeStart = isFinal ? start : periodStart;
    const months = monthsInRange(rangeStart, unlockDate);

    return { weekNum, label, isFinal, isUnlocked: now >= unlockDate, unlockDate, months };
  });
}
