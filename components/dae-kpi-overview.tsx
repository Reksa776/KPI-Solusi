import Link from "next/link";
import KpiExcelExport from "@/components/kpi-excel-export";
import DaeTrendChart from "@/components/dae-trend-chart";
import DaeClientMixChart from "@/components/dae-client-mix-chart";

export type DaeOverviewRow = { name: string; clients: number; strategies: number; visits: number; rank: number; score: number; grade: string };
export type DaeClientRow = { dae: string; name: string; type: string };
export type DaeTrendPoint = { week: string; clients: number; strategies: number; visits: number };
export type DaeTypeSlice = { label: string; count: number; color: string };
export type DaeWeeklyData = { clients: number; strategies: number; visits: number; achievement: number; coordination: string; dailyReport: string; grade: string; gradeValue: number };

const number = (value: number) => value.toLocaleString("id-ID");
const weekLabel = (value: string) => {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(date);
};

export default function DaeKpiOverview({ week, weeks, rows, clients, trend, slices, selectedDae, periodWeeks, weeklyData, averageGrade }: { week: string; weeks: string[]; rows: DaeOverviewRow[]; clients: DaeClientRow[]; trend: DaeTrendPoint[]; slices: DaeTypeSlice[]; selectedDae?: string; periodWeeks: string[]; weeklyData: Record<string, DaeWeeklyData>; averageGrade?: number }) {
  const best = [...rows].sort((a, b) => b.clients - a.clients || b.strategies - a.strategies || b.visits - a.visits)[0];
  const selected = rows.find(row => row.name === selectedDae);
  const featured = best;
  const averageGradeLabel = averageGrade === undefined ? "—" : averageGrade >= 4 ? "A" : averageGrade >= 2.5 ? "B" : averageGrade >= 1.5 ? "C" : "Buruk";
  return <div className="dae-overview-layout">
    <section className="dae-overview-toolbar"><form action="/admin/kpi" method="get"><input type="hidden" name="scope" value="dae"/>{selectedDae&&<input type="hidden" name="dae" value={selectedDae}/>}<label htmlFor="dae-week-filter">Periode laporan</label><div><select id="dae-week-filter" name="week" defaultValue={week}>{weeks.map(value => <option key={value} value={value}>Minggu {weekLabel(value)} · {value}</option>)}</select><button type="submit">Tampilkan</button></div></form><article className="dae-best-card"><span className="dae-best-icon">✳</span><div><small>DAE terbaik pada periode ini</small><strong>{featured?.name ?? "Belum ada data"}</strong></div>{featured&&<span className={`dae-grade grade-${featured.grade.toLowerCase()}`}>Grade {featured.grade}<small>{featured.score}</small></span>}</article></section>
    <div className="kpi-export-row"><KpiExcelExport scope="dae"/></div>

    <div className="dae-overview-grid">
      <section className="dae-overview-panel dae-kpi-panel"><div className="dae-panel-heading"><div><span>RINGKASAN MINGGUAN</span><h2>Nama DAE & KPI</h2></div><small>{week || "Belum ada periode"}</small></div><div className="dae-simple-table-wrap"><table className="dae-simple-table"><thead><tr><th>Nama DAE</th><th>Client</th><th>Strategi</th><th>Kunjungan</th><th>Grade</th></tr></thead><tbody>{rows.map((row, index) => {const href=`/admin/kpi?scope=dae&week=${week}&dae=${encodeURIComponent(row.name)}`,current=row.name===selectedDae;return <tr key={row.name} className={current?"dae-row-selected":""}><td><Link className="dae-row-cell-link dae-name-cell-link" aria-current={current?"page":undefined} href={href}><span className="dae-rank">{String(index + 1).padStart(2, "0")}</span>{row.name}</Link></td><td><Link className="dae-row-cell-link" aria-current={current?"page":undefined} href={href}>{number(row.clients)}</Link></td><td><Link className="dae-row-cell-link" aria-current={current?"page":undefined} href={href}>{number(row.strategies)}</Link></td><td><Link className="dae-row-cell-link" aria-current={current?"page":undefined} href={href}>{number(row.visits)}</Link></td><td><Link className="dae-row-cell-link" aria-current={current?"page":undefined} href={href}><span className={`dae-grade grade-${row.grade.toLowerCase()}`}>{row.grade}</span></Link></td></tr>})}{!rows.length && <tr><td colSpan={5} className="dae-empty">Belum ada Data Tim DAE untuk periode ini.</td></tr>}</tbody></table></div>{selected&&<Link className="dae-clear-filter" href={`/admin/kpi?scope=dae&week=${week}`}>← Tampilkan semua DAE</Link>}</section>

      <section className="dae-overview-panel dae-trend-panel"><div className="dae-panel-heading"><div><span>PERFORMA DAE</span><h2>Tren KPI mingguan</h2></div><span className="dae-period-pill">8 minggu</span></div><DaeTrendChart trend={trend}/><p className="dae-table-footnote">Arahkan kursor ke minggu pada grafik untuk melihat nilai client, strategi, dan kunjungan.</p></section>

      <section className="dae-overview-panel dae-report-panel"><div className="dae-panel-heading"><div><span>DETAIL FUNNEL</span><h2>{selected ? `Data per DAE · ${selected.name}` : "Data per DAE"}</h2></div><Link href="/admin/kpi/input/dae_individual">Laporan mingguan ↗</Link></div><div className="dae-funnel-table-wrap"><table className="dae-funnel-table"><thead><tr><th>DETAIL FUNNEL</th>{periodWeeks.map((period,index)=><th key={`${period}-${index}`}>MINGGU {index+1}{period&&<small>{weekLabel(period)}</small>}</th>)}</tr></thead><tbody>
        <tr><th>Retensi Klien</th>{periodWeeks.map((period,index)=><td key={`${period}-${index}`}>{selected&&period?number(weeklyData[period]?.clients??0):"—"}</td>)}</tr>
        <tr><th>Strategi / Ide Bisnis</th>{periodWeeks.map((period,index)=><td key={`${period}-${index}`}>{selected&&period?number(weeklyData[period]?.strategies??0):"—"}</td>)}</tr>
        <tr><th>Kunjungan Klien/Calon Client/Komunitas</th>{periodWeeks.map((period,index)=><td key={`${period}-${index}`}>{selected&&period?number(weeklyData[period]?.visits??0):"—"}</td>)}</tr>
        <tr><th>Pencapaian Jumlah Klien</th>{periodWeeks.map((period,index)=><td key={`${period}-${index}`}>{selected&&period?number(weeklyData[period]?.achievement??0):"—"}</td>)}</tr>
        <tr><th>Koordinasi & Komunikasi Tim</th>{periodWeeks.map((period,index)=><td key={`${period}-${index}`} className="dae-funnel-note">{selected&&period?(weeklyData[period]?.coordination||"—"):"—"}</td>)}</tr>
        <tr><th>Laporan Harian</th>{periodWeeks.map((period,index)=><td key={`${period}-${index}`} className="dae-funnel-note">{selected&&period?(weeklyData[period]?.dailyReport||"—"):"—"}</td>)}</tr>
        <tr className="dae-funnel-grade-row"><th>Grade DAE Mingguan</th>{periodWeeks.map((period,index)=><td key={`${period}-${index}`}>{selected&&period?(weeklyData[period]?.grade||"—"):"—"}</td>)}</tr>
      </tbody></table></div>{!selected&&<p className="dae-table-footnote">Klik nama DAE di tabel KPI untuk melihat detail funnel per minggu.</p>}<p className="dae-table-footnote">Retensi dan pencapaian dihitung dari jumlah client yang dipegang. Koordinasi serta laporan harian berasal dari input manual.</p></section>

      <section className="dae-overview-panel dae-client-panel"><div className="dae-panel-heading"><div><span>PORTOFOLIO</span><h2>{selected ? `Client milik ${selected.name}` : "Client yang dipegang"}</h2></div><span className="dae-period-pill">{number(clients.length)} client</span></div><div className="dae-simple-table-wrap"><table className="dae-simple-table"><thead><tr>{!selected&&<th>Nama DAE</th>}<th>Client</th><th>Jenis</th></tr></thead><tbody>{clients.slice(0, 8).map((client,index) => <tr key={`${client.dae}-${client.name}-${index}`}>{!selected&&<td><b>{client.dae}</b></td>}<td>{client.name}</td><td><span className="dae-client-type">{client.type}</span></td></tr>)}{!clients.length && <tr><td colSpan={selected?2:3} className="dae-empty">Belum ada client yang ditautkan ke DAE.</td></tr>}</tbody></table></div>{clients.length > 8 && <p className="dae-table-footnote">Menampilkan 8 dari {clients.length} client. <Link href="/admin/kpi/input/dae_team">Lihat semua di Data Tim DAE</Link></p>}</section>
    </div>

    <div className="dae-bottom-grid"><section className="dae-overview-panel dae-grade-panel"><div className="dae-panel-heading"><div><span>PENILAIAN PERIODE</span><h2>Grade DAE</h2></div></div>{selected?<div className="dae-grade-summary"><div className={`dae-grade-average dae-grade-average-${averageGradeLabel.toLowerCase()}`}>{averageGradeLabel}</div><div><strong>{selected.name}</strong><p>Grade <b>{averageGradeLabel}</b> · nilai rata-rata {averageGrade===undefined?"—":averageGrade.toFixed(2)}</p><small>A=5 · B=3 · C=2 · Buruk=1</small></div></div>:<p className="dae-grade-empty">Pilih nama DAE di tabel untuk melihat grade-nya.</p>}</section><section className="dae-overview-panel dae-client-mix"><div className="dae-panel-heading"><div><span>KOMPOSISI CLIENT</span><h2>{selected ? `Jenis client ${selected.name}` : "Jenis client yang dipegang"}</h2></div></div><DaeClientMixChart slices={slices}/></section></div>
  </div>;
}
