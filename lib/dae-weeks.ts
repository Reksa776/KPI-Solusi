export type MonthWeek = { month: string; week: number; weekStart: string };

export function getMonthWeekStart(month: string, week: number): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isInteger(week) || week < 1 || week > 5) return null;
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const offset = (8 - first.getUTCDay()) % 7;
  const start = new Date(Date.UTC(year, monthNumber - 1, 1 + offset + (week - 1) * 7));
  if (start.getUTCMonth() !== monthNumber - 1) return null;
  return start.toISOString().slice(0, 10);
}

export function monthWeekFromStart(value: string): MonthWeek | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const month = value.slice(0, 7);
  for (let week = 1; week <= 5; week++) {
    if (getMonthWeekStart(month, week) === value) return { month, week, weekStart: value };
  }
  return null;
}

export function formatMonthWeek(value: string): string {
  const parsed = monthWeekFromStart(value);
  if (!parsed) return value;
  const date = new Date(`${parsed.month}-01T12:00:00Z`);
  const monthName = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  return `${monthName} · Minggu ${parsed.week}`;
}
