export type DmRangeMode = "month" | "7d" | "custom";
export type DmComparisonPeriod = { from: string; to: string; previousLabel: string; currentLabel: string };

const date = (value: string) => new Date(`${value}T00:00:00Z`);
const dayString = (value: Date) => value.toISOString().slice(0, 10);
const shiftDays = (value: string, amount: number) => {
  const result = date(value);
  result.setUTCDate(result.getUTCDate() + amount);
  return dayString(result);
};
const daysBetween = (from: string, to: string) => Math.max(1, Math.round((date(to).getTime() - date(from).getTime()) / 86_400_000) + 1);
const monthLabel = (value: string) => new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(date(value));
const shortRange = (from: string, to: string) => `${new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(date(from))}–${new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(date(to))}`;

export function getDmComparisonPeriod(mode: DmRangeMode, from: string, to: string, month: string): DmComparisonPeriod {
  const length = daysBetween(from, to);
  let previousFrom: string, previousTo: string, previousLabel: string, currentLabel: string;
  if (mode === "month") {
    const currentMonthStart = `${month}-01`;
    const previousMonthDate = date(currentMonthStart);
    previousMonthDate.setUTCDate(0);
    const previousMonth = dayString(previousMonthDate).slice(0, 7);
    const previousMonthStart = `${previousMonth}-01`;
    const previousMonthEnd = dayString(new Date(Date.UTC(Number(previousMonth.slice(0, 4)), Number(previousMonth.slice(5, 7)), 0)));
    const previousLength = Math.min(length, Number(previousMonthEnd.slice(8, 10)));
    previousFrom = previousMonthStart;
    previousTo = shiftDays(previousFrom, previousLength - 1);
    previousLabel = monthLabel(previousMonthStart);
    currentLabel = monthLabel(currentMonthStart);
  } else {
    previousTo = shiftDays(from, -1);
    previousFrom = shiftDays(previousTo, -(length - 1));
    previousLabel = mode === "7d" ? "7 hari sebelumnya" : shortRange(previousFrom, previousTo);
    currentLabel = mode === "7d" ? "7 hari terakhir" : shortRange(from, to);
  }
  return { from: previousFrom, to: previousTo, previousLabel, currentLabel };
}
