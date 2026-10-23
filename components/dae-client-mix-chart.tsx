"use client";

import { useState, type PointerEvent } from "react";

export type DaeMixSlice = { label: string; count: number; color: string };

const number = (value: number) => value.toLocaleString("id-ID");

export default function DaeClientMixChart({ slices }: { slices: DaeMixSlice[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  const active = hoveredIndex === null ? null : slices[hoveredIndex];
  let running = 0;
  const gradient = total ? `conic-gradient(${slices.map(slice => {
    const start = running;
    running += slice.count / total * 100;
    return `${slice.color} ${start}% ${running}%`;
  }).join(",")})` : "conic-gradient(#34392f 0% 100%)";

  function selectFromPointer(event: PointerEvent<HTMLButtonElement>) {
    if (!total) return;
    setPointer({
      x: Math.min(event.clientX + 14, window.innerWidth - 170),
      y: Math.min(event.clientY + 14, window.innerHeight - 90),
    });
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    if (Math.hypot(x, y) < rect.width * .27) return;
    const angle = (Math.atan2(y, x) * 180 / Math.PI + 450) % 360;
    const percent = angle / 360 * 100;
    let cumulative = 0;
    const found = slices.findIndex(slice => {
      cumulative += slice.count / total * 100;
      return percent < cumulative;
    });
    setHoveredIndex(found < 0 ? slices.length - 1 : found);
  }

  return <div className="dae-donut-layout">
    <div className="dae-donut-stage">
      <button type="button" className="dae-donut" style={{ background: gradient }} aria-label="Arahkan kursor ke irisan untuk melihat jenis client, persentase, dan jumlahnya" onPointerMove={selectFromPointer} onPointerLeave={() => { setHoveredIndex(null); setPointer(null); }}>
        <span className="dae-donut-center">{active ? <><b title={active.label}>{active.label}</b><strong>{total ? `${(active.count / total * 100).toFixed(1)}%` : "0%"}</strong><small>{number(active.count)} client</small></> : <><b>{number(total)}</b><small>Total client</small></>}</span>
      </button>
      {active && pointer && <span className="dae-donut-tooltip" style={{ left: pointer.x, top: pointer.y }}><b>{active.label}</b><strong>{total ? `${(active.count / total * 100).toFixed(1)}%` : "0%"}</strong><small>{number(active.count)} client</small></span>}
    </div>
    <ul>{slices.slice(0, 5).map((slice, index) => <li key={slice.label} onPointerEnter={() => setHoveredIndex(index)} onPointerLeave={() => setHoveredIndex(null)}><i style={{ background: slice.color }}/><span>{slice.label}</span><b>{slice.count}<small>{total ? `${(slice.count / total * 100).toFixed(1)}%` : "0%"}</small></b></li>)}{!slices.length && <li className="dae-empty">Belum ada komposisi client.</li>}</ul>
  </div>;
}
