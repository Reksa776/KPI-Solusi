"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type RangeMode = "month" | "7d" | "custom";
const parseDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
};
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const shiftDate = (value: string, amount: number) => {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateKey(date);
};
const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
const monthDate = (value: string) => new Date(`${value}-01T12:00:00Z`);
const monthTitle = (date: Date) => new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
const displayDate = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" }).format(parseDate(value));
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default function DmDateRangePicker({ mode, from, to }: { mode: RangeMode; from: string; to: string }) {
  const [open, setOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<RangeMode>(mode);
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const [leftMonth, setLeftMonth] = useState(monthKey(parseDate(from)));
  const [dragging, setDragging] = useState(false);
  const [anchor, setAnchor] = useState("");
  const pointerSelection = useRef(false);
  const dragMoved = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeEscape);
    return () => { window.removeEventListener("pointerdown", closeOutside); window.removeEventListener("keydown", closeEscape); };
  }, [open]);

  const rightMonth = useMemo(() => monthKey(new Date(Date.UTC(monthDate(leftMonth).getUTCFullYear(), monthDate(leftMonth).getUTCMonth() + 1, 1, 12))), [leftMonth]);
  const monthGrid = (key: string) => {
    const first = monthDate(key), offset = (first.getUTCDay() + 6) % 7;
    const gridStart = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1 - offset, 12));
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setUTCDate(gridStart.getUTCDate() + index);
      return { key: dateKey(day), day: day.getUTCDate(), inMonth: day.getUTCMonth() === first.getUTCMonth() };
    });
  };
  const quickRange = (preset: "today" | "yesterday" | "7d" | "30d" | "month") => {
    const fromValue = preset === "today" ? TODAY : preset === "yesterday" ? shiftDate(TODAY, -1) : preset === "7d" ? shiftDate(TODAY, -6) : preset === "30d" ? shiftDate(TODAY, -29) : `${TODAY.slice(0, 7)}-01`;
    const toValue = preset === "yesterday" ? shiftDate(TODAY, -1) : TODAY;
    setStart(fromValue); setEnd(toValue); setAnchor(""); setActiveMode(preset === "7d" ? "7d" : preset === "month" ? "month" : "custom");
    setLeftMonth(monthKey(parseDate(fromValue)));
  };
  const chooseDay = (value: string) => {
    if (!anchor) {
      setAnchor(value); setStart(value); setEnd(value); setActiveMode("custom"); return;
    }
    const first = value < anchor ? value : anchor, last = value < anchor ? anchor : value;
    setStart(first); setEnd(last); setAnchor(""); setActiveMode("custom");
  };
  const goMonth = (delta: number) => setLeftMonth(monthKey(new Date(Date.UTC(monthDate(leftMonth).getUTCFullYear(), monthDate(leftMonth).getUTCMonth() + delta, 1, 12))));
  const days = (key: string) => monthGrid(key);
  const weekdayLabels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  const presets: { label: string; value: "today" | "yesterday" | "7d" | "30d" | "month" }[] = [
    { label: "Hari ini", value: "today" }, { label: "Kemarin", value: "yesterday" }, { label: "7 hari terakhir", value: "7d" }, { label: "30 hari terakhir", value: "30d" }, { label: "Bulan ini", value: "month" },
  ];

  return <div className="dm-date-range-picker" ref={root}>
    <input type="hidden" name="range" value={activeMode}/><input type="hidden" name="from" value={start}/><input type="hidden" name="to" value={end}/>
    <button className="dm-date-range-trigger" type="button" aria-expanded={open} onClick={() => setOpen(!open)}><span>{displayDate(start)} <i>–</i> {displayDate(end)}</span><b>▾</b></button>
    {open && <div className="dm-date-range-popover">
      <aside className="dm-date-range-presets">{presets.map(preset => <button type="button" key={preset.value} onClick={() => quickRange(preset.value)}>{preset.label}</button>)}</aside>
      <div className="dm-date-range-calendar">
        <header><button type="button" aria-label="Bulan sebelumnya" onClick={() => goMonth(-1)}>‹</button><strong>{monthTitle(monthDate(leftMonth))}</strong><strong>{monthTitle(monthDate(rightMonth))}</strong><button type="button" aria-label="Bulan berikutnya" onClick={() => goMonth(1)}>›</button></header>
        <div className="dm-date-range-months">{[leftMonth, rightMonth].map(key => <section className="dm-date-range-month" key={key}><div className="dm-date-range-weekdays">{weekdayLabels.map(label => <span key={label}>{label}</span>)}</div><div className="dm-date-range-days">{days(key).map(day => {
          const selected = day.key === start || day.key === end, inside = day.key > start && day.key < end, disabled = day.key > TODAY;
          return <button type="button" key={day.key} disabled={disabled} className={`${day.inMonth ? "" : "outside"}${selected ? " selected" : ""}${inside ? " in-range" : ""}`} onPointerDown={event => { if (event.button === 0 && !disabled) { event.preventDefault(); pointerSelection.current = true; setDragging(true); dragMoved.current = false; if (!anchor) { setAnchor(day.key); setStart(day.key); setEnd(day.key); setActiveMode("custom"); } else { const first = day.key < anchor ? day.key : anchor, last = day.key < anchor ? anchor : day.key; setStart(first); setEnd(last); setAnchor(""); } } }} onPointerEnter={() => { if (dragging && anchor) { if (day.key !== anchor) dragMoved.current = true; const first = day.key < anchor ? day.key : anchor, last = day.key < anchor ? anchor : day.key; setStart(first); setEnd(last); } }} onPointerUp={() => { setDragging(false); if (dragMoved.current) setAnchor(""); dragMoved.current = false; }} onClick={() => { if (pointerSelection.current) pointerSelection.current = false; else chooseDay(day.key); }}>{day.day}</button>;
        })}</div></section>)}</div>
        <footer><span>{start ? displayDate(start) : "Pilih tanggal awal"} – {end ? displayDate(end) : "Pilih tanggal akhir"}</span><div><button type="button" className="dm-date-range-cancel" onClick={() => setOpen(false)}>Batal</button><button type="submit" className="dm-date-range-apply" onClick={() => setOpen(false)}>Terapkan</button></div></footer>
      </div>
    </div>}
  </div>;
}
