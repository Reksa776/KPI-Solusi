export type DmMonthWeek = { month: string; week: number; weekStart: string };

/** DM weeks use fixed calendar dates: 1–7, 8–14, 15–21, 22–28, 29–end. */
export function getDmMonthWeekStart(month: string, week: number): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isInteger(week) || week < 1 || week > 5) return null;
  const [year, monthNumber] = month.split("-").map(Number);
  const startDay = 1 + (week - 1) * 7;
  const start = new Date(Date.UTC(year, monthNumber - 1, startDay));
  if (start.getUTCMonth() !== monthNumber - 1) return null;
  return start.toISOString().slice(0, 10);
}

export function dmMonthWeekStartForDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const month = value.slice(0, 7);
  let selected: string | null = null;
  for (let week = 1; week <= 5; week++) {
    const start = getDmMonthWeekStart(month, week);
    if (start && start <= value) selected = start;
  }
  return selected;
}

/** Re-buckets older weekly DM records whose saved start was the old Monday anchor. */
export function dmMonthWeekStartForEntry(value: string, frequency: string): string | null {
  if (frequency !== "weekly" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return dmMonthWeekStartForDate(value);
  const canonical = dmMonthWeekFromStart(value);
  if (canonical) return canonical.weekStart;
  const month = value.slice(0, 7), [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const firstMonday = 1 + ((8 - first.getUTCDay()) % 7);
  for (let week = 2; week <= 5; week++) {
    const oldStart = new Date(Date.UTC(year, monthNumber - 1, firstMonday + (week - 2) * 7)).toISOString().slice(0, 10);
    if (oldStart === value) return getDmMonthWeekStart(month, week);
  }
  return dmMonthWeekStartForDate(value);
}

export function dmMonthWeekFromStart(value: string): DmMonthWeek | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const month = value.slice(0, 7);
  for (let week = 1; week <= 5; week++) {
    if (getDmMonthWeekStart(month, week) === value) return { month, week, weekStart: value };
  }
  return null;
}
