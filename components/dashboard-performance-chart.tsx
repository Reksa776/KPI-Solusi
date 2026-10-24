"use client";

import { useMemo, useState, type PointerEvent } from "react";

type Point = { day: string; dmContent: number; daeConversions: number; clientRevenue: number };
const money = (value: number) => "Rp " + value.toLocaleString("id-ID");
const compact = (value: number) => new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const lines = [
  { key: "dmContent", label: "Konten · DM", color: "#d2fb07", format: (v: number) => `${v.toLocaleString("id-ID")} konten`, axis: compact },
  { key: "daeConversions", label: "Aktivitas · DAE", color: "#8fd4b2", format: (v: number) => `${v.toLocaleString("id-ID")} aktivitas`, axis: compact },
  { key: "clientRevenue", label: "Omset · Client", color: "#f2b45c", format: (v: number) => money(v), axis: (v: number) => `Rp ${compact(v)}` },
] as const;

const left = 128;
const right = 976;
const bands = [{ top: 25, bottom: 91 }, { top: 119, bottom: 185 }, { top: 213, bottom: 279 }];

function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  return points.reduce((path, current, index) => {
    if (index === 0) return `M ${current.x} ${current.y}`;
    const previous = points[index - 1];
    const before = points[index - 2] ?? previous;
    const after = points[index + 1] ?? current;
    const clampY = (value: number) => Math.max(Math.min(previous.y, current.y), Math.min(Math.max(previous.y, current.y), value));
    const control1 = { x: previous.x + (current.x - before.x) / 6, y: clampY(previous.y + (current.y - before.y) / 6) };
    const control2 = { x: current.x - (after.x - previous.x) / 6, y: clampY(current.y - (after.y - previous.y) / 6) };
    return `${path} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${current.x} ${current.y}`;
  }, "");
}

export default function DashboardPerformanceChart({ points }: { points: Point[] }) {
  const [selected, setSelected] = useState(Math.max(0, points.length - 1));
  const geometry = useMemo(() => lines.map((line, row) => {
    const vals = points.map((point) => Math.max(0, Number(point[line.key]) || 0));
    const max = Math.max(1, ...vals);
    const band = bands[row];
    const xy = vals.map((value, index) => ({
      x: left + index * ((right - left) / Math.max(1, points.length - 1)),
      y: band.bottom - (value / max) * (band.bottom - band.top),
    }));
    return { ...line, vals, max, band, xy, path: smoothPath(xy) };
  }), [points]);

  const point = points[selected];
  const formatDate = (day: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(day + "T12:00:00"));
  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    if (points.length < 2) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * 1000;
    setSelected(Math.max(0, Math.min(points.length - 1, Math.round((x - left) / (right - left) * (points.length - 1)))));
  };

  return <div className="dashboard-performance-chart">
    <svg viewBox="0 0 1000 300" preserveAspectRatio="none" role="img" aria-label="Grafik performa DM, DAE, dan client dengan skala nilai asli" onPointerMove={onMove}>
      {geometry.map((line, row) => {
        const { top, bottom } = line.band;
        const middle = (top + bottom) / 2;
        return <g key={line.key}>
          <text x="12" y={top + 8} fill={line.color} className="performance-series-label">{line.label}</text>
          {[top, middle, bottom].map((y, tick) => {
            const value = tick === 0 ? line.max : tick === 1 ? line.max / 2 : 0;
            return <g key={y}>
              <line className="performance-gridline" x1={left} x2={right} y1={y} y2={y} />
              <text className="performance-axis-label" x={left - 9} y={y + 3} textAnchor="end">{line.axis(value)}</text>
            </g>;
          })}
          <path d={line.path} fill="none" stroke={line.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {line.xy.map((dot, index) => line.vals[index] > 0 && <circle key={index} cx={dot.x} cy={dot.y} r="2.4" fill={line.color} fillOpacity=".78" vectorEffect="non-scaling-stroke" />)}
          {point && <circle cx={line.xy[selected]?.x ?? left} cy={line.xy[selected]?.y ?? bottom} r="4.5" fill={line.color} stroke="#171a16" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />}
        </g>;
      })}
      {point && <line x1={geometry[0]?.xy[selected]?.x ?? left} x2={geometry[0]?.xy[selected]?.x ?? left} y1="15" y2="284" className="performance-cursor" />}
      {[0, 7, 14, 21, 29].map((i) => points[i] && <text key={i} x={left + i * ((right - left) / 29)} y="296" textAnchor={i === 0 ? "start" : i === 29 ? "end" : "middle"} className="performance-axis-label">{new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(points[i].day + "T12:00:00"))}</text>)}
    </svg>
    <input className="performance-chart-range" type="range" min="0" max={Math.max(0, points.length - 1)} value={selected} onChange={(event) => setSelected(Number(event.target.value))} aria-label="Pilih tanggal untuk melihat nilai grafik" />
    <div className="performance-chart-readout"><b>{point ? formatDate(point.day) : "—"}</b>{geometry.map((line) => <div key={line.key}><i style={{ background: line.color }} /><span>{line.label}</span><strong>{line.format(Number(point?.[line.key] ?? 0))}</strong></div>)}</div>
    <div className="performance-chart-legend">{geometry.map((line) => <span key={line.key}><i style={{ background: line.color }} />{line.label}</span>)}</div>
    <p className="performance-chart-caption">Setiap metrik memakai skala angka aslinya sendiri. Geser penunjuk pada grafik atau kontrol tanggal untuk melihat nilai tepat per hari.</p>
  </div>;
}
