"use client";

import { useState } from "react";

export type DaeChartPoint = { week: string; clients: number; strategies: number; visits: number };

const number = (value: number) => value.toLocaleString("id-ID");
const weekLabel = (value: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`));

function linePath(values: number[], width: number, height: number, max: number) {
  return values.map((value, index) => `${index ? "L" : "M"}${values.length < 2 ? width / 2 : 24 + index * (width - 48) / (values.length - 1)},${height - 20 - value / max * (height - 42)}`).join(" ");
}

export default function DaeTrendChart({ trend }: { trend: DaeChartPoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const width = 760, height = 238;
  const max = Math.max(1, ...trend.flatMap(point => [point.clients, point.strategies, point.visits]));
  const xAt = (index: number) => trend.length < 2 ? width / 2 : 24 + index * (width - 48) / (trend.length - 1);
  const yAt = (value: number) => height - 20 - value / max * (height - 42);
  const active = hoveredIndex === null ? null : trend[hoveredIndex];

  return <>
    <div className="dae-chart-wrap" onPointerLeave={() => setHoveredIndex(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Arahkan kursor ke minggu pada grafik untuk melihat jumlah client, strategi, dan kunjungan DAE">
        {[0, 1, 2, 3].map(i => <g key={i}><line x1="24" x2={width - 24} y1={25 + i * 57} y2={25 + i * 57} stroke="#2d322a" strokeDasharray="3 5"/><text x="0" y={29 + i * 57} fill="#82897c" fontSize="10">{Math.round(max * (1 - i / 3)).toLocaleString("id-ID")}</text></g>)}
        <path d={linePath(trend.map(point => point.clients), width, height, max)} fill="none" stroke="#d2fb07" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d={linePath(trend.map(point => point.strategies), width, height, max)} fill="none" stroke="#80b948" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d={linePath(trend.map(point => point.visits), width, height, max)} fill="none" stroke="#46a68a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {trend.map((point, index) => <g key={point.week} className="dae-chart-point" role="button" tabIndex={0} aria-label={`${weekLabel(point.week)}: ${number(point.clients)} client dipegang, ${number(point.strategies)} strategi, ${number(point.visits)} kunjungan`} aria-pressed={hoveredIndex === index} onPointerEnter={() => setHoveredIndex(index)} onFocus={() => setHoveredIndex(index)} onBlur={() => setHoveredIndex(null)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setHoveredIndex(index); } }}>
          <rect x={xAt(index) - 12} y="0" width="24" height={height} fill="transparent"/>
          <circle cx={xAt(index)} cy={yAt(point.clients)} r={hoveredIndex === index ? 6 : 4} fill="#d2fb07"/>
          <circle cx={xAt(index)} cy={yAt(point.strategies)} r={hoveredIndex === index ? 6 : 4} fill="#80b948"/>
          <circle cx={xAt(index)} cy={yAt(point.visits)} r={hoveredIndex === index ? 6 : 4} fill="#46a68a"/>
          <text x={xAt(index)} y={height - 3} textAnchor="middle" fill="#82897c" fontSize="9">{weekLabel(point.week)}</text>
        </g>)}
      </svg>
      {active && <div className="dae-chart-hover-tooltip" style={{ left: `${Math.max(13, Math.min(87, xAt(hoveredIndex!) / width * 100))}%` }}>
        <b>{weekLabel(active.week)}</b>
        <span><i className="client"/>Client dipegang <strong>{number(active.clients)}</strong></span>
        <span><i className="strategy"/>Strategi ide <strong>{number(active.strategies)}</strong></span>
        <span><i className="visit"/>Kunjungan <strong>{number(active.visits)}</strong></span>
      </div>}
    </div>
    <div className="dae-chart-legend"><span><i className="client"/>Client dipegang</span><span><i className="strategy"/>Strategi ide</span><span><i className="visit"/>Kunjungan</span></div>
  </>;
}
