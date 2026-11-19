export type DmMonthWeek = { month: string; week: number; weekStart: string };

/** DM weeks follow Monday–Sunday calendar weeks, numbered from the first Monday in the month. */
export function getDmMonthWeekStart(month: string, week: number): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isInteger(week) || week < 1 || week > 5) return null;
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const firstMonday = 1 + ((8 - first.getUTCDay()) % 7);
  const startDay = firstMonday + (week - 1) * 7;
  const start = new Date(Date.UTC(year, monthNumber - 1, startDay));
  if (start.getUTCMonth() !== monthNumber - 1) return null;
  return start.toISOString().slice(0, 10);
}

export function dmMonthWeekStartForDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const month = value.slice(0, 7);
  const firstWeek = getDmMonthWeekStart(month, 1);
  if (!firstWeek) return null;
  let selected: string | null = null;
  for (let week = 1; week <= 5; week++) {
    const start = getDmMonthWeekStart(month, week);
    if (start && start <= value) selected = start;
  }
  // Opening dates before the first Monday remain included in the month's first report week.
  return selected ?? firstWeek;
}

/** Re-buckets older weekly DM records whose saved start used the previous month-week rule. */
export function dmMonthWeekStartForEntry(value: string, frequency: string): string | null {
  if (frequency !== "weekly" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return dmMonthWeekStartForDate(value);
  const canonical = dmMonthWeekFromStart(value);
  if (canonical) return canonical.weekStart;
  const month = value.slice(0, 7);
  for (let week = 1; week <= 5; week++) {
    const firstOfMonth = `${month}-01`;
    const oldStart = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1 + (week - 1) * 7)).toISOString().slice(0, 10);
    if (oldStart === value) return getDmMonthWeekStart(month, week) ?? dmMonthWeekStartForDate(firstOfMonth);
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
