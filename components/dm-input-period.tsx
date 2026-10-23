"use client";

import { useState } from "react";
import DaeMonthWeekPicker from "@/components/dae-month-week-picker";
import { monthWeekStartForDate } from "@/lib/dae-weeks";

export type DmInputMode = "daily" | "weekly";

export default function DmInputPeriod({ initialWeekStart, initialDate, initialMode = "weekly" }: {
  initialWeekStart: string;
  initialDate: string;
  initialMode?: DmInputMode;
}) {
  const [mode, setMode] = useState<DmInputMode>(initialMode);
  const [date, setDate] = useState(initialDate);
  const [weekStart, setWeekStart] = useState(initialWeekStart);

  return <section className="dm-input-period">
    <div className="form-grid">
      <label>Periode input
        <select value={mode} onChange={event => setMode(event.target.value as DmInputMode)}>
          <option value="weekly">Mingguan</option>
          <option value="daily">Harian</option>
        </select>
      </label>
    </div>
    <input type="hidden" name="input_mode" value={mode}/>
    {mode === "weekly" ? <>
      <DaeMonthWeekPicker initialWeekStart={weekStart} onChange={value => setWeekStart(value)}/>
      <input type="hidden" name="activity_date" value={weekStart}/>
      <p className="form-hint">Satu catatan untuk tiap client pada minggu yang dipilih.</p>
    </> : <>
      <div className="form-grid">
        <label>Tanggal<input type="date" name="activity_date" value={date} onChange={event => setDate(event.target.value)} required/></label>
      </div>
      <input type="hidden" name="week_start" value={monthWeekStartForDate(date) ?? ""}/>
      <p className="form-hint">Input harian akan masuk ke rekap minggu sesuai tanggalnya.</p>
    </>}
  </section>;
}
