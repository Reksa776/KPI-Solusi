"use client";

import { useMemo, useState } from "react";
import { getMonthWeekStart, monthWeekFromStart } from "@/lib/dae-weeks";
import { getDmMonthWeekStart, dmMonthWeekFromStart } from "@/lib/dm-weeks";

function currentMonth() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date());
}
function dmWeekRange(value: string) {
  const [year, month, day] = value.split("-").map(Number), lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${day}–${Math.min(day + 6, lastDay)} ${new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)))}`;
}

export default function DaeMonthWeekPicker({ name = "week_start", initialWeekStart = "", periods, onChange, weekMode = "dae" }: { name?: string; initialWeekStart?: string; periods?: string[]; onChange?: (value: string) => void; weekMode?: "dae" | "dm" }) {
  const allowed = useMemo(() => periods ? [...new Set(periods)].sort() : undefined, [periods]);
  const getWeekStart = weekMode === "dm" ? getDmMonthWeekStart : getMonthWeekStart;
  const parseWeekStart = weekMode === "dm" ? dmMonthWeekFromStart : monthWeekFromStart;
  const initialParsed = initialWeekStart ? parseWeekStart(initialWeekStart) : null;
  const [month, setMonth] = useState(initialParsed?.month ?? (initialWeekStart ? initialWeekStart.slice(0, 7) : currentMonth()));
  const [week, setWeek] = useState(String(initialParsed?.week ?? 1));
  const choices = [1, 2, 3, 4, 5].map(number => { const value = getWeekStart(month, number) ?? ""; return { value, number, label: `Minggu ${number}${weekMode === "dm" && value ? ` · ${dmWeekRange(value)}` : ""}`, disabled: !value }; });
  const selected = choices.find(item => String(item.number) === week);
  const months = allowed ? [...new Set(allowed.map(value => value.slice(0, 7)))].sort().reverse() : undefined;
  function changeMonth(nextMonth: string) {
    setMonth(nextMonth);
    setWeek("1");
    onChange?.(getWeekStart(nextMonth, 1) ?? "");
  }
  function changeWeek(nextWeek: string) {
    setWeek(nextWeek);
    const next = choices.find(item => String(item.number) === nextWeek);
    onChange?.(next?.value ?? "");
  }
  return <div className="form-grid dae-month-week-picker">
    <label>Bulan laporan {months ? <select value={months.includes(month) ? month : months[0]} onChange={event => changeMonth(event.target.value)}>{months.map(value => <option key={value} value={value}>{new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T12:00:00Z`))}</option>)}</select> : <input type="month" value={month} onChange={event => changeMonth(event.target.value)} required />}</label>
    <label>Minggu ke<select value={week} onChange={event => changeWeek(event.target.value)} required><option value="" disabled>Pilih minggu</option>{choices.map(item => <option key={item.number} value={item.number} disabled={item.disabled}>{item.label}{item.disabled ? " · Tidak ada periode dalam bulan ini" : ""}</option>)}</select></label>
    <input type="hidden" name="period_month" value={month}/>
    <input type="hidden" name={name} value={selected?.value ?? ""}/>
  </div>;
}
