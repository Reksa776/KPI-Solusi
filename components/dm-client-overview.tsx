"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type ClientWeekPoint = { week: number; start: string | null; contents: number; views: number; tiktok: number; shopee: number };
export type ClientOverviewItem = { id: number; name: string; type: string; points: ClientWeekPoint[] };
type Props = { month: string; dmId: number; clientId: number | null; clients: ClientOverviewItem[]; dmName: string };
const colors = { contents: "#d2fb07", views: "#82bd43", sales: "#4bb39a" };
const number = (value: number) => value.toLocaleString("id-ID");
const money = (value: number) => `Rp ${number(value)}`;
const shortDate = (value: string | null) => value ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)) : "—";

export default function DmClientOverview({ month, dmId, clientId, clients, dmName }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const active = clients.find(client => client.id === clientId) ?? clients[0];
  const points = active?.points ?? [];
  const maxima = useMemo(() => ({
    contents: Math.max(1, ...points.map(point => point.contents)),
    views: Math.max(1, ...points.map(point => point.views)),
    sales: Math.max(1, ...points.map(point => point.tiktok + point.shopee)),
  }), [points]);
  const width = 760, height = 250, left = 42, right = 18, top = 24, bottom = 34;
  const x = (index: number) => left + index * (width - left - right) / Math.max(1, points.length - 1);
  const y = (value: number, max: number) => top + (1 - value / max) * (height - top - bottom);
  const lines = [
    { key: "contents", label: "Konten", color: colors.contents, value: (point: ClientWeekPoint) => point.contents, max: maxima.contents },
    { key: "views", label: "Views video", color: colors.views, value: (point: ClientWeekPoint) => point.views, max: maxima.views },
    { key: "sales", label: "Omzet gabungan", color: colors.sales, value: (point: ClientWeekPoint) => point.tiktok + point.shopee, max: maxima.sales },
  ];
  const href = (client: number) => `/admin/kpi/client?month=${month}&dm=${dmId}&client=${client}`;
  return <div className="dm-client-overview-layout">
    <aside className="analytics-panel dm-client-overview-list"><div className="analytics-panel-heading"><div><span className="eyebrow">CLIENT TIM DM</span><h2>Client yang dipegang</h2><p>{clients.length} client · {dmName}</p></div></div><nav aria-label="Pilih client">{clients.map(client => <Link key={client.id} href={href(client.id)} className={`dm-client-overview-item${client.id === active?.id ? " active" : ""}`} aria-current={client.id === active?.id ? "page" : undefined}><span><b>{client.name}</b><small>{client.type}</small></span><i>↗</i></Link>)}{!clients.length && <p className="analytics-empty">Belum ada client yang ditugaskan ke DM ini.</p>}</nav></aside>
    <div className="dm-client-overview-content">
      <section className="analytics-panel dm-client-overview-chart"><div className="analytics-panel-heading"><div><span className="eyebrow">PERFORMA MINGGUAN</span><h2>{active?.name ?? "Pilih client"}</h2><p>{dmName} · {month}</p></div></div>
        {active ? <><div className="dm-client-chart-visual" onPointerLeave={() => setHover(null)}><div className="dm-client-chart-scroll"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafik performa konten, views, dan omzet per minggu">
          {[0, 1, 2, 3, 4].map(i => { const gy = top + i * (height - top - bottom) / 4; return <g key={i}><line x1={left} x2={width - right} y1={gy} y2={gy} stroke="#2d322a" strokeDasharray="3 5"/><text x={left - 9} y={gy + 3} fill="#81887a" fontSize="10" textAnchor="end">{100 - i * 25}%</text></g>; })}
          {lines.map(line => <g key={line.key}><path d={points.map((point, index) => `${index ? "L" : "M"}${x(index)},${y(line.value(point), line.max)}`).join(" ")} fill="none" stroke={line.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>{points.map((point, index) => <circle key={`${line.key}-${index}`} cx={x(index)} cy={y(line.value(point), line.max)} r={hover === index ? 6 : 4} fill={line.color}/>)}</g>)}
          {points.map((point, index) => <g key={point.week} role="button" tabIndex={0} aria-label={`Minggu ${point.week}: ${number(point.contents)} konten, ${number(point.views)} views, ${money(point.tiktok + point.shopee)} omzet`} onPointerEnter={() => setHover(index)} onFocus={() => setHover(index)} onBlur={() => setHover(null)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setHover(index); } }}><rect x={x(index) - 22} y={top} width="44" height={height - top - bottom} fill="transparent"/><text x={x(index)} y={height - 9} fill="#aeb3a6" fontSize="11" textAnchor="middle">Minggu {point.week}</text></g>)}
          {hover !== null && points[hover] && <line x1={x(hover)} x2={x(hover)} y1={top} y2={height - bottom} stroke="#f4f5ef" strokeDasharray="4 5" opacity=".45"/>}
        </svg></div>{hover !== null && points[hover] && <div className="dm-client-chart-hover"><b>Minggu {points[hover].week} · {shortDate(points[hover].start)}</b><span><i style={{ background: colors.contents }}/>Konten <strong>{number(points[hover].contents)}</strong></span><span><i style={{ background: colors.views }}/>Views video <strong>{number(points[hover].views)}</strong></span><span><i style={{ background: colors.sales }}/>Omzet gabungan <strong>{money(points[hover].tiktok + points[hover].shopee)}</strong></span></div>}</div><div className="dm-client-chart-legend">{lines.map(line => <span key={line.key}><i style={{ background: line.color }}/>{line.label}</span>)}</div>
        </> : <p className="analytics-empty">Pilih DM yang memiliki client untuk melihat performa.</p>}
      </section>
      <section className="analytics-panel dm-client-weekly-detail"><div className="analytics-panel-heading"><div><span className="eyebrow">DETAIL PERIODE</span><h2>Rekap {active?.name ?? "client"} · Minggu 1–5</h2><p>Omzet TikTok dan Shopee ditampilkan terpisah serta dijumlahkan.</p></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Minggu</th><th>Konten</th><th>Views video</th><th>Omzet TikTok</th><th>Omzet Shopee</th><th>Omzet gabungan</th></tr></thead><tbody>{points.map(point => <tr key={point.week}><td><b>Minggu {point.week}</b><small>{shortDate(point.start)}</small></td><td>{number(point.contents)}</td><td>{number(point.views)}</td><td>{money(point.tiktok)}</td><td>{money(point.shopee)}</td><td><b>{money(point.tiktok + point.shopee)}</b></td></tr>)}{!points.some(point => point.contents || point.views || point.tiktok || point.shopee) && <tr><td colSpan={6} className="empty-state">Belum ada laporan pada bulan ini.</td></tr>}</tbody></table></div></section>
    </div>
  </div>;
}
