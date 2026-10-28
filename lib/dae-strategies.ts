import { monthWeekStartForDate } from "@/lib/dae-weeks";

export type DaeStrategyWeekCount = {
  dae_person?: string | null;
  week_start: string | Date;
  total: number | string;
};

function dateValue(value: string | Date): string {
  return typeof value === "string"
    ? value.slice(0, 10)
    : new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(value);
}

/** Counts strategies cumulatively through a week, restarting at each month boundary. */
export function monthlyCumulativeStrategyCount(
  rows: DaeStrategyWeekCount[],
  period: string,
  daePerson?: string,
): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) return 0;
  const month = period.slice(0, 7);
  return rows.reduce((sum, row) => {
    if (daePerson && row.dae_person !== daePerson) return sum;
    const strategyWeek = monthWeekStartForDate(dateValue(row.week_start));
    if (!strategyWeek || strategyWeek.slice(0, 7) !== month || strategyWeek > period) return sum;
    return sum + Number(row.total);
  }, 0);
}
