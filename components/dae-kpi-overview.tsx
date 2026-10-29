"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import KpiExcelExport from "@/components/kpi-excel-export";
import DaeTrendChart from "@/components/dae-trend-chart";
import DaeClientMixChart from "@/components/dae-client-mix-chart";

export type DaeOverviewRow = { name: string; clients: number; strategies: number; visits: number; rank: number; score: number; grade: string; hasGrade?:boolean };
export type DaeClientRow = { dae: string; name: string; type: string };
export type DaeTrendPoint = { week: string; clients: number; strategies: number; visits: number };
export type DaeTypeSlice = { label: string; count: number; color: string };
export type DaeWeeklyData = { clients: number; strategies: number; visits: number; achievement: number; coordination: string; dailyReport: string; grade: string; gradeValue: number; score: number };

const number = (value: number) => value.toLocaleString("id-ID");
const weekLabel = (value: string) => {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(date);
};

export default function DaeKpiOverview({ week, weeks, rows, clients, trend, slices, selectedDae, periodWeeks, weeklyData, averageGrade, monthlyBest, publicMode = false }: { week: string; weeks: string[]; rows: DaeOverviewRow[]; clients: DaeClientRow[]; trend: DaeTrendPoint[]; slices: DaeTypeSlice[]; selectedDae?: string; periodWeeks: string[]; weeklyData: Record<string, DaeWeeklyData>; averageGrade?: number; monthlyBest?: {name:string;grade:string;score:number;average:number;weeks:number}; publicMode?: boolean }) {
  const route=publicMode?"/performa/dae":"/admin/kpi";
  const [kpiSort,setKpiSort]=useState<"clients"|"strategies"|"visits"|"grade">("clients");
  const [portfolioType,setPortfolioType]=useState("");
  const sortedRows=useMemo(()=>[...rows].sort((a,b)=>{
    if(kpiSort==="grade"){
      const gradeRank=(grade:string)=>grade.toLowerCase()==="a"?4:grade.toLowerCase()==="b"?3:grade.toLowerCase()==="c"?2:1;
      return gradeRank(b.grade)-gradeRank(a.grade)||a.name.localeCompare(b.name,"id");
    }
    return b[kpiSort]-a[kpiSort]||a.name.localeCompare(b.name,"id");
  }),[rows,kpiSort]);
  const clientTypes=useMemo(()=>[...new Set(clients.map(client=>client.type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id")),[clients]);
  const activePortfolioType=clientTypes.includes(portfolioType)?portfolioType:"";
  const filteredClients=useMemo(()=>activePortfolioType?clients.filter(client=>client.type===activePortfolioType):clients,[clients,activePortfolioType]);
  const gradeRank=(grade:string)=>grade.toLowerCase()==="a"?4:grade.toLowerCase()==="b"?3:grade.toLowerCase()==="c"?2:1;
  const best = [...rows].filter(row=>row.hasGrade).sort((a, b) => gradeRank(b.grade)-gradeRank(a.grade)||b.score-a.score||a.name.localeCompare(b.name,"id"))[0];
  const selected = rows.find(row => row.name === selectedDae);
  const featured = best;
  const averageGradeLabel = averageGrade === undefined ? "—" : averageGrade >= 4 ? "A" : averageGrade >= 2.5 ? "B" : averageGrade >= 1.5 ? "C" : "Buruk";
  const validWeeks = periodWeeks.filter(period => Boolean(period && weeklyData[period]?.grade));
  const totalIndicator = selected && validWeeks.length ? `${Math.round(validWeeks.reduce((sum, period) => sum + (weeklyData[period]?.score ?? 0), 0) / validWeeks.length)}%` : "—";
  return <div className="dae-overview-layout">
    <section className="dae-overview-toolbar"><form action={route} method="get">{!publicMode&&<input type="hidden" name="scope" value="dae"/>}{selectedDae&&<input type="hidden" name="dae" value={selectedDae}/>}<label htmlFor="dae-week-filter">Periode laporan</label><div><select id="dae-week-filter" name="week" defaultValue={week}>{weeks.map(value => <option key={value} value={value}>Minggu {weekLabel(value)} · {value}</option>)}</select><button type="submit">Tampilkan</button></div></form><div className="dae-best-cards"><article className="dae-best-card"><span className="dae-best-icon">✳</span><div><small>Grade terbaik · {week?`Minggu ${weekLabel(week)}`:"minggu ini"}</small><strong>{featured?.name ?? "Belum ada grade"}</strong></div>{featured&&<span className={`dae-grade grade-${featured.grade.toLowerCase()}`}>{featured.grade}<small>{featured.score}%</small></span>}</article><article className="dae-best-card"><span className="dae-best-icon">✦</span><div><small>Grade bulanan terbaik · nilai tertinggi</small><strong>{monthlyBest?.name ?? "Belum ada grade"}</strong></div>{monthlyBest&&<span className={`dae-grade grade-${monthlyBest.grade.toLowerCase()}`}>{monthlyBest.grade}<small>Rata-rata {monthlyBest.average.toFixed(2)}</small></span>}</article></div></section>
    {!publicMode&&<div className="kpi-export-row"><KpiExcelExport scope="dae"/></div>}

    <div className="dae-overview-grid">
      <section className="dae-overview-panel dae-kpi-panel"><div className="dae-panel-heading"><div><span>RINGKASAN MINGGUAN</span><h2>Nama DAE & KPI</h2></div><div className="dae-overview-controls"><label>Urutkan<select aria-label="Urutkan daftar DAE" value={kpiSort} onChange={event=>setKpiSort(event.target.value as typeof kpiSort)}><option value="clients">Client Existing terbanyak</option><option value="strategies">Strategi terbanyak</option><option value="visits">Kunjungan terbanyak</option><option value="grade">Grade tertinggi</option></select></label><small>{week || "Belum ada periode"}</small></div></div><div className="dae-simple-table-wrap"><table className="dae-simple-table"><thead><tr><th>Nama DAE</th><th>Client Existing</th><th>Strategi Bulanan</th><th>Kunjungan</th><th>Grade</th></tr></thead><tbody>{sortedRows.map((row, index) => {const href=`${route}?${publicMode?"":"scope=dae&"}week=${week}&dae=${encodeURIComponent(row.name)}`,current=row.name===selectedDae;return <tr key={row.name} className={current?"dae-row-selected":""}><td><Link className="dae-row-cell-link dae-name-cell-link" aria-current={current?"page":undefined} href={href}><span className="dae-rank">{String(index + 1).padStart(2, "0")}</span>{row.name}</Link></td><td><Link className="dae-row-cell-link" aria-current={current?"page":undefined} href={href}>{number(row.clients)}</Link></td><td><Link className="dae-row-cell-link" aria-current={current?"page":undefined} href={href}>{number(row.strategies)}</Link></td><td><Link className="dae-row-cell-link" aria-current={current?"page":undefined} href={href}>{number(row.visits)}</Link></td><td><Link className="dae-row-cell-link" aria-current={current?"page":undefined} href={href}><span className={`dae-grade grade-${row.grade.toLowerCase()}`}>{row.grade}</span></Link></td></tr>})}{!rows.length && <tr><td colSpan={5} className="dae-empty">Belum ada Data Tim DAE untuk periode ini.</td></tr>}</tbody></table></div>{selected&&<Link className="dae-clear-filter" href={`${route}?${publicMode?"":"scope=dae&"}week=${week}`}>← Tampilkan semua DAE</Link>}</section>

      <section className="dae-overview-panel dae-trend-panel"><div className="dae-panel-heading"><div><span>PERFORMA DAE</span><h2>Tren KPI mingguan</h2></div><span className="dae-period-pill">8 minggu</span></div><DaeTrendChart trend={trend}/><p className="dae-table-footnote">Strategi terakumulasi dari awal bulan hingga minggu berjalan, lalu kembali dihitung dari nol pada bulan baru. Arahkan kursor untuk melihat nilainya.</p></section>

      <section className="dae-overview-panel dae-report-panel"><div className="dae-panel-heading"><div><span>DETAIL FUNNEL</span><h2>{selected ? `Data per DAE · ${selected.name}` : "Data per DAE"}</h2></div><span className="dae-period-pill">Total indikator: {totalIndicator}</span>{!publicMode&&<Link href="/admin/kpi/input/dae_individual">Laporan mingguan ↗</Link>}</div><div className="dae-funnel-table-wrap"><table className="dae-funnel-table"><thead><tr><th>DETAIL FUNNEL</th>{periodWeeks.map((period,index)=><th key={`${period}-${index}`}>MINGGU {index+1}{period&&<small>{weekLabel(period)}</small>}</th>)}</tr></thead><tbody>
        <tr><th>Retensi Klien</th>{periodWeeks.map((period,index)=><td key={`${period}-${index}`}>{selected&&period?number(weeklyData[period]?.clients??0):"—"}</td>)}</tr>
        <tr><th>Strategi / Ide Bisnis · Kumulatif Bulanan</th>{periodWeeks.map((period,index)=><td key={`${period}-${index}`}>{selected&&period?number(weeklyData[period]?.strategies??0):"—"}</td>)}</tr>
        <tr><th>Kunjungan Klien/Calon Client/Komunitas</th>{periodWeeks.map((period,index)=><td key={`${period}-${index}`}>{selected&&period?number(weeklyData[period]?.visits??0):"—"}</td>)}</tr>
        <tr><th>Pencapaian Jumlah Klien</th>{periodWeeks.map((period,index)=><td key={`${period}-${index}`}>{selected&&period?number(weeklyData[period]?.achievement??0):"—"}</td>)}</tr>
        <tr><th>Koordinasi & Komunikasi Tim</th>{periodWeeks.map((period,index)=><td key={`${period}-${index}`} className="dae-funnel-note">{selected&&period?(weeklyData[period]?.coordination||"—"):"—"}</td>)}</tr>
        <tr><th>Laporan Harian</th>{periodWeeks.map((period,index)=><td key={`${period}-${index}`} className="dae-funnel-note">{selected&&period?(weeklyData[period]?.dailyReport||"—"):"—"}</td>)}</tr>
        <tr className="dae-funnel-grade-row"><th>Total Indikator</th>{periodWeeks.map((period,index)=><td key={`${period}-${index}`}>{selected&&period&&weeklyData[period]?.grade?`${weeklyData[period].score}%`:"—"}</td>)}</tr>
        <tr className="dae-funnel-grade-row"><th>Grade DAE Mingguan</th>{periodWeeks.map((period,index)=><td key={`${period}-${index}`}>{selected&&period?(weeklyData[period]?.grade||"—"):"—"}</td>)}</tr>
      </tbody></table></div>{!selected&&<p className="dae-table-footnote">Klik nama DAE di tabel KPI untuk melihat detail funnel per minggu.</p>}<p className="dae-table-footnote">Retensi dan pencapaian dihitung dari jumlah client yang dipegang. Koordinasi serta laporan harian berasal dari input manual.</p></section>

      <section className="dae-overview-panel dae-client-panel"><div className="dae-panel-heading"><div><span>PORTOFOLIO</span><h2>{selected ? `Client milik ${selected.name}` : "Client yang dipegang"}</h2></div><div className="dae-overview-controls"><label>Jenis client<select aria-label="Filter client berdasarkan jenis" value={activePortfolioType} onChange={event=>setPortfolioType(event.target.value)}><option value="">Semua jenis</option>{clientTypes.map(type=><option key={type} value={type}>{type}</option>)}</select></label><span className="dae-period-pill">{number(filteredClients.length)} client</span></div></div><div className="dae-simple-table-wrap"><table className="dae-simple-table"><thead><tr>{!selected&&<th>Nama DAE</th>}<th>Client</th><th>Jenis</th></tr></thead><tbody>{filteredClients.slice(0, 8).map((client,index) => <tr key={`${client.dae}-${client.name}-${index}`}>{!selected&&<td><b>{client.dae}</b></td>}<td>{client.name}</td><td><span className="dae-client-type">{client.type}</span></td></tr>)}{!filteredClients.length && <tr><td colSpan={selected?2:3} className="dae-empty">{activePortfolioType?"Tidak ada client dengan jenis ini pada periode tersebut.":"Belum ada client yang ditautkan ke DAE."}</td></tr>}</tbody></table></div>{filteredClients.length > 8 && <p className="dae-table-footnote">Menampilkan 8 dari {filteredClients.length} client. {!publicMode&&<Link href="/admin/kpi/input/dae_team">Lihat semua di Data Tim DAE</Link>}</p>}</section>
    </div>

    <div className="dae-bottom-grid"><section className="dae-overview-panel dae-grade-panel"><div className="dae-panel-heading"><div><span>PENILAIAN PERIODE</span><h2>Grade DAE</h2></div></div>{selected?<div className="dae-grade-summary"><div className={`dae-grade-average dae-grade-average-${averageGradeLabel.toLowerCase()}`}>{averageGradeLabel}</div><div><strong>{selected.name}</strong><p>Grade <b>{averageGradeLabel}</b> · nilai rata-rata {averageGrade===undefined?"—":averageGrade.toFixed(2)}</p><small>A=5 · B=3 · C=2 · Buruk=1</small></div></div>:<p className="dae-grade-empty">Pilih nama DAE di tabel untuk melihat grade-nya.</p>}</section><section className="dae-overview-panel dae-client-mix"><div className="dae-panel-heading"><div><span>KOMPOSISI CLIENT</span><h2>{selected ? `Jenis client ${selected.name}` : "Jenis client yang dipegang"}</h2></div></div><DaeClientMixChart slices={slices}/></section></div>
  </div>;
}
