import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";
import DaeWeeklyReportForm from "@/components/dae-weekly-report-form";
import { deleteDaeWeeklyReport } from "./actions";
import { getDb } from "@/lib/db";
import { verifyAdminAnyScope, verifyAdminSession } from "@/lib/admin-auth";
import { getMonthWeekStart } from "@/lib/dae-weeks";
import { isExistingAgencyClientType } from "@/lib/client-types";

export const metadata = { title: "Data Per DAE | Solusi Sejalan" };
type Assignment = RowDataPacket & { dae_person: string; week_start: string | Date; agency_client_ids: unknown };
type AgencyClient = RowDataPacket & { id: number; client_type: string };
type CountRow = RowDataPacket & { dae_person: string; week_start: string | Date; total: number };
type Report = RowDataPacket & { id: number; dae_person: string; week_start: string | Date; client_retention_count: number; strategy_idea_count: number; visit_count: number; achievement_client_count: number; achievement_rank: number; team_coordination: string | null; daily_report: string | null };
const path = "/admin/kpi/input/dae_individual";
const dateValue = (value: string | Date) => typeof value === "string" ? value.slice(0, 10) : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
const keyOf = (person: string, week: string) => `${person}\u0000${week}`;
function readIds(value: unknown): number[] { try { const source = value instanceof Uint8Array ? new TextDecoder().decode(value) : value; const parsed = typeof source === "string" ? JSON.parse(source) : source; return Array.isArray(parsed) ? parsed.map(Number).filter(id => Number.isSafeInteger(id) && id > 0) : []; } catch { return []; } }

export default async function DaeIndividualPage({ searchParams }: { searchParams: Promise<{ new?: string; edit?: string; saved?: string; deleted?: string; error?: string }> }) {
  if (!(await verifyAdminSession())) redirect("/admin/login");
  if (!(await verifyAdminAnyScope(["dm", "dae"]))) redirect("/admin");
  const query = await searchParams;
  const editId = Number(query.edit ?? 0), adding = query.new === "1";
  const [assignments, strategyCounts, visitCounts, reports, existingClients] = await Promise.all([
    getDb().execute<Assignment[]>("SELECT e.dae_person,e.week_start,e.agency_client_ids FROM team_activity_entries e WHERE e.entry_type='dae_team' AND e.dae_person IS NOT NULL AND TRIM(e.dae_person)<>'' AND e.id=(SELECT latest.id FROM team_activity_entries latest WHERE latest.entry_type='dae_team' AND latest.dae_person=e.dae_person ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1) ORDER BY e.dae_person"),
    getDb().execute<CountRow[]>("SELECT dae_person,DATE_FORMAT(week_start,'%Y-%m-01') AS week_start,COUNT(*) AS total FROM dae_strategy_details GROUP BY dae_person,DATE_FORMAT(week_start,'%Y-%m-01')"),
    getDb().execute<CountRow[]>("SELECT dae_person,week_start,SUM(visit_count) AS total FROM dae_visit_details GROUP BY dae_person,week_start"),
    getDb().execute<Report[]>("SELECT id,dae_person,week_start,client_retention_count,strategy_idea_count,visit_count,achievement_client_count,achievement_rank,team_coordination,daily_report FROM dae_weekly_reports ORDER BY week_start DESC,dae_person"),
    getDb().execute<AgencyClient[]>("SELECT id,client_type FROM agency_clients"),
  ]);
  const existingClientIds = new Set(existingClients[0].filter(client => isExistingAgencyClientType(client.client_type)).map(client => Number(client.id)));
  const clientCounts = new Map<string, Set<number>>();
  for (const row of assignments[0]) {
    const bucket = clientCounts.get(row.dae_person) ?? new Set<number>();
    readIds(row.agency_client_ids).filter(id => existingClientIds.has(id)).forEach(id => bucket.add(id));
    clientCounts.set(row.dae_person, bucket);
  }
  const strategies = new Map(strategyCounts[0].map(row => [keyOf(row.dae_person, dateValue(row.week_start).slice(0,7)), Number(row.total)]));
  const visits = new Map(visitCounts[0].map(row => [keyOf(row.dae_person, dateValue(row.week_start)), Number(row.total)]));
  const monthNow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date());
  const knownWeeks = new Set([...visitCounts[0].map(row => dateValue(row.week_start)), ...reports[0].map(row => dateValue(row.week_start))]);
  for (let number = 1; number <= 5; number++) { const value = getMonthWeekStart(monthNow, number); if (value) knownWeeks.add(value); }
  const base = [...knownWeeks].flatMap(week_start => [...clientCounts].map(([dae_person, clientIds]) => {
    const key = keyOf(dae_person, week_start);
    return { dae_person, week_start, clients: clientIds.size, strategies: strategies.get(keyOf(dae_person, week_start.slice(0,7))) ?? 0, visits: visits.get(key) ?? 0, rank: 1, dae_count: 1 };
  }));
  const byWeek = new Map<string, typeof base>();
  for (const row of base) byWeek.set(row.week_start, [...(byWeek.get(row.week_start) ?? []), row]);
  for (const weekRows of byWeek.values()) {
    for (const row of weekRows) { row.rank = 1 + weekRows.filter(other => other.clients > row.clients).length; row.dae_count = weekRows.length; }
  }
  const reportById = reports[0].find(report => Number(report.id) === editId);
  if (editId && !reportById) notFound();
  const stats = base.sort((a, b) => b.week_start.localeCompare(a.week_start) || a.dae_person.localeCompare(b.dae_person, "id"));
  const statsByKey = new Map(stats.map(row => [keyOf(row.dae_person, row.week_start), row]));
  const formattedReports = reports[0].map(report => {
    const week = dateValue(report.week_start), current = statsByKey.get(keyOf(report.dae_person, week));
    return { ...report, week_start: week, client_retention_count: current?.clients ?? 0, strategy_idea_count: strategies.get(keyOf(report.dae_person, week.slice(0,7))) ?? 0, visit_count: current?.visits ?? 0, achievement_client_count: current?.clients ?? 0, achievement_rank: current?.rank ?? report.achievement_rank };
  });
  const selectedReport = reportById ? { ...reportById, week_start: dateValue(reportById.week_start) } : undefined;
  const addingMode = adding || Boolean(editId);
  return <div className="admin-page"><AdminNavigation active="kpi" teamActive="dae-individual"/><main className="admin-main admin-section-main"><AdminTopbar section="KPI DAE" page="Data Per DAE"/><div className="admin-shell admin-form-shell team-kpi-form-shell">
    <section className="admin-heading"><div><span className="eyebrow">KPI DAE / LAPORAN MINGGUAN</span><h1>{editId ? "Edit Laporan DAE" : adding ? "Tambah Laporan DAE" : "Data Per DAE"}</h1><p>{addingMode ? "Pilih DAE dan minggu. Strategi dihitung per bulan, sedangkan client dan kunjungan mengikuti periode mingguan." : "Ringkasan mingguan DAE dengan strategi bulanan serta catatan koordinasi dan laporan harian."}</p></div>{!addingMode && <Link className="button" href={`${path}?new=1`}>＋ Tambah Data</Link>}</section>
    {query.saved && <div className="admin-success">Laporan mingguan DAE berhasil disimpan.</div>}{query.deleted && <div className="admin-success">Laporan DAE berhasil dihapus.</div>}{query.error && <div className="admin-error">{query.error === "person" ? "Nama DAE harus tersedia di Data Tim pada minggu yang dipilih." : query.error === "exists" ? "Laporan untuk DAE dan minggu tersebut sudah ada. Silakan edit data yang tersedia." : query.error === "missing" ? "Laporan yang akan diedit tidak ditemukan." : "Periksa kembali nama DAE dan minggu laporan."}</div>}
    {addingMode ? <><div className="dae-strategy-back"><Link href={path}>← Kembali ke daftar laporan</Link></div><DaeWeeklyReportForm stats={stats} report={selectedReport}/></> : <section className="analytics-panel dae-strategy-summary"><div className="analytics-panel-heading"><div><h2>Laporan Per DAE · Mingguan</h2><p>Retensi dan pencapaian menghitung Client Existing yang dipegang tiap DAE.</p></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Minggu</th><th>Nama DAE</th><th>Retensi Existing</th><th>Strategi Bulanan</th><th>Kunjungan</th><th>Pencapaian Existing</th><th>Aksi</th></tr></thead><tbody>{formattedReports.map(report => <tr key={report.id}><td>{report.week_start}</td><td><b>{report.dae_person}</b></td><td>{report.client_retention_count} client</td><td>{report.strategy_idea_count} strategi</td><td>{report.visit_count} kunjungan</td><td>{report.achievement_client_count} client · #{report.achievement_rank}</td><td><div className="table-actions"><Link href={`${path}?edit=${report.id}`}>Edit</Link><form action={deleteDaeWeeklyReport}><input type="hidden" name="id" value={report.id}/><button className="table-delete">Hapus</button></form></div></td></tr>)}{!formattedReports.length && <tr><td colSpan={7} className="empty-state">Belum ada laporan per DAE. Pilih Tambah Data untuk membuat laporan minggu pertama.</td></tr>}</tbody></table></div></section>}
  </div></main></div>;
}
