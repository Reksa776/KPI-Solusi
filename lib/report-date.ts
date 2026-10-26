const monthNumbers: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function toYear(value: string | undefined, fallbackYear: number): number {
  if (!value) return fallbackYear;
  const year = Number(value);
  if (value.length === 2) return year <= 69 ? 2000 + year : 1900 + year;
  return year;
}

function formatDate(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parses common spreadsheet date strings without relying on browser locale heuristics. */
export function parseReportDate(input: string, fallbackYear = new Date().getFullYear()): string {
  const value = input.trim().replace(/^'+/, "").replace(/\s+/g, " ");
  if (!value) return "";

  // Excel's 1900 date serial is sometimes exposed as a plain number in sheet XML.
  if (/^\d{5}(?:\.\d+)?$/.test(value)) {
    const serial = Number(value);
    if (serial >= 1 && serial <= 2_958_465) {
      const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000);
      return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }
  }

  const iso = value.match(/\b(\d{4})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/);
  if (iso) return formatDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const local = value.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](\d{2}|\d{4})\b/);
  if (local) return formatDate(toYear(local[3], fallbackYear), Number(local[2]), Number(local[1]));

  const monthPattern = Object.keys(monthNumbers).join("|");
  const monthFirst = value.match(new RegExp(`\\b(${monthPattern})\\s+(\\d{1,2})(?:,?\\s+(\\d{2}|\\d{4}))?\\b`, "i"));
  if (monthFirst) return formatDate(toYear(monthFirst[3], fallbackYear), monthNumbers[monthFirst[1].toLowerCase()], Number(monthFirst[2]));

  const dayFirst = value.match(new RegExp(`\\b(\\d{1,2})\\s+(${monthPattern})(?:\\s+(\\d{2}|\\d{4}))?\\b`, "i"));
  if (dayFirst) return formatDate(toYear(dayFirst[3], fallbackYear), monthNumbers[dayFirst[2].toLowerCase()], Number(dayFirst[1]));

  return "";
}
