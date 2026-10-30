import Link from "next/link";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";
import ConfirmDeleteButton from "@/components/confirm-delete-button";
import { getAdminSessionUser, verifyAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { getMonthWeekStart, monthWeekStartForDate } from "@/lib/dae-weeks";
import { deleteDmContentTarget, saveDmContentTargets } from "./actions";

export const metadata = { title: "Target Konten DM | Solusi Sejalan" };
type Query = { month?: string; dm_id?: string; client_id?: string; saved?: string; deleted?:string; error?: string };
type Assignment = RowDataPacket & { dm_team_member_id: number; agency_client_id: number; dm_name: string; client_name: string; client_type: string };
type TargetRow = RowDataPacket & { dm_team_member_id: number; agency_client_id: number; target_contents: number | string; week_start: string | Date };
type Report = RowDataPacket & { dm_team_member_id: number; agency_client_id: number; week_start: string | Date; input_frequency: string; contents: number | string };
type Week = { index: number; start: string; planned: number; actual: number; carried: number; remaining: number; available: number };
const todayMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date());
const dateValue = (value: string | Date) => typeof value === "string" ? value.slice(0, 10) : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
const count = (value: number | string | undefined) => Number(value ?? 0);
const monthLabel = (month: string) => new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));

function getWeeks(month: string, targetByWeek: Map<string, number>, reportByWeek: Map<string, number>) {
  const weeks: Week[] = [];
  let carried = 0;
  for (let index = 0; index < 5; index++) {
    const start = getMonthWeekStart(month, index + 1);
    if (!start) continue;
    const planned = targetByWeek.get(start) ?? 0;
    const actual = reportByWeek.get(start) ?? 0;
    const available = planned + carried;
    const remaining = Math.max(0, available - actual);
    weeks.push({ index: index + 1, start, planned, actual, carried, remaining, available });
    carried = remaining;
  }
  return weeks;
}

export default async function DmContentTargetsPage({ searchParams }: { searchParams: Promise<Query> }) {
  if (!(await verifyAdminSession())) redirect("/admin/login");
  const user = await getAdminSessionUser();
  if (!(user?.role === "superadmin" || user?.admin_scope === "dm" || user?.admin_scope === "both")) redirect("/admin");
  const query = await searchParams;
  const currentMonth = todayMonth();
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(query.month ?? "") ? query.month! : currentMonth;
  const db = getDb();
  const [[assignments], [targetRows], [reports]] = await Promise.all([
    db.execute<Assignment[]>("SELECT a.dm_team_member_id,a.agency_client_id,m.full_name AS dm_name,c.client_name,c.client_type FROM dm_client_assignments a JOIN dm_team_members m ON m.id=a.dm_team_member_id JOIN agency_clients c ON c.id=a.agency_client_id ORDER BY m.full_name,c.client_name"),
    db.execute<TargetRow[]>("SELECT dm_team_member_id,agency_client_id,target_contents,week_start FROM dm_content_targets WHERE week_start>=? AND week_start<DATE_ADD(?,INTERVAL 1 MONTH)", [`${month}-01`, `${month}-01`]),
    db.execute<Report[]>("SELECT dm_team_member_id,agency_client_id,week_start,input_frequency,SUM(contents) AS contents FROM team_activity_entries WHERE entry_type='dm_client' AND scope='dm' AND week_start>=? AND week_start<DATE_ADD(?,INTERVAL 1 MONTH) GROUP BY dm_team_member_id,agency_client_id,week_start,input_frequency", [`${month}-01`, `${month}-01`]),
  ]);
  const dmId = query.dm_id && Number.isSafeInteger(Number(query.dm_id)) ? Number(query.dm_id) : null;
  const selectedPair = query.client_id?.split(":").map(Number) ?? [];
  const clientId = selectedPair.length === 2 && selectedPair.every(value => Number.isSafeInteger(value) && value > 0) ? selectedPair[1] : query.client_id && Number.isSafeInteger(Number(query.client_id)) && Number(query.client_id) > 0 ? Number(query.client_id) : null;
  const selected = assignments.find(row => Number(row.dm_team_member_id) === (selectedPair.length === 2 ? selectedPair[0] : dmId) && Number(row.agency_client_id) === clientId);
  const targetMap = new Map<string, number>();
  for (const row of targetRows) {
    const start = dateValue(row.week_start);
    if (start.slice(0, 7) === month && monthWeekStartForDate(start) === start) targetMap.set(`${Number(row.dm_team_member_id)}:${Number(row.agency_client_id)}:${start}`, count(row.target_contents));
  }
  const dailyReportMap = new Map<string, number>();
  const weeklyReportMap = new Map<string, number>();
  for (const row of reports) {
    const key = `${Number(row.dm_team_member_id)}:${Number(row.agency_client_id)}:${dateValue(row.week_start)}`;
    const reportMap = row.input_frequency === "weekly" ? weeklyReportMap : dailyReportMap;
    reportMap.set(key, (reportMap.get(key) ?? 0) + count(row.contents));
  }
  const reportMap = new Map([...dailyReportMap].map(([key, actual]) => [key, actual + (weeklyReportMap.get(key) ?? 0)]));
  for (const [key, actual] of weeklyReportMap) if (!reportMap.has(key)) reportMap.set(key, actual);
  const currentWeek = monthWeekStartForDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())) ?? "";
  const selectedWeeks = selected ? getWeeks(month,
    new Map([...targetMap].filter(([key]) => key.startsWith(`${Number(selected.dm_team_member_id)}:${Number(selected.agency_client_id)}:`)).map(([key, value]) => [key.split(":").at(-1)!, value])),
    new Map([...reportMap].filter(([key]) => key.startsWith(`${Number(selected.dm_team_member_id)}:${Number(selected.agency_client_id)}:`)).map(([key, value]) => [key.split(":").at(-1)!, value])),
  ) : [];

  return <div className="admin-page"><AdminNavigation active="kpi" teamActive="dm-targets"/><main className="admin-main admin-section-main"><AdminTopbar section="Tim" page="Target Konten DM"/><div className="admin-shell admin-form-shell team-kpi-form-shell dm-target-workspace">
    <section className="admin-heading"><div><span className="eyebrow">WORKSPACE / DM</span><h1>Target Konten DM</h1><p>Tetapkan target kerja konten bulanan per pasangan DM-client, lalu pantau realisasi mingguan serta sisa target yang bergeser otomatis.</p></div><Link className="button light" href="/admin/kpi/input/dm_team">← Data Tim DM</Link></section>
    {query.saved && <div className="admin-success">Target mingguan berhasil disimpan untuk minggu yang dipilih.</div>}{query.deleted&&<div className="admin-success">Target minggu tersebut berhasil dihapus. Data laporan performa tetap tersimpan.</div>}
    {query.error === "assignment" && <div className="admin-error">Pasangan DM dan client tidak ditemukan atau sudah tidak aktif.</div>}
    {query.error === "invalid" && <div className="admin-error">Periksa bulan dan jumlah target untuk setiap minggu.</div>}
    <section className="analytics-panel dm-target-filter"><form action="/admin/kpi/input/dm_targets" method="get" className="dm-target-filter-form"><label>Bulan target<input type="month" name="month" defaultValue={month}/></label><label>DM<select name="dm_id" defaultValue={selected?Number(selected.dm_team_member_id):""}><option value="">Pilih DM</option>{[...new Map(assignments.map(item=>[Number(item.dm_team_member_id),item])).values()].map(item=><option key={item.dm_team_member_id} value={Number(item.dm_team_member_id)}>{item.dm_name}</option>)}</select></label><label>Client<select name="client_id" defaultValue={selected?`${Number(selected.dm_team_member_id)}:${Number(selected.agency_client_id)}`:""}><option value="">Pilih client</option>{assignments.filter(item=>!dmId||Number(item.dm_team_member_id)===dmId).map(item=><option key={`${item.dm_team_member_id}-${item.agency_client_id}`} value={`${Number(item.dm_team_member_id)}:${Number(item.agency_client_id)}`}>{item.client_name} · {item.dm_name}</option>)}</select></label><button className="button">Tampilkan</button></form></section>
    {!assignments.length && <section className="analytics-panel"><p className="empty-state">Belum ada pasangan DM-client. Buat penugasan dulu di <Link href="/admin/kpi/input/dm_client">Data Client untuk DM</Link>.</p></section>}
    {assignments.length > 0 && !selected && <section className="analytics-panel dm-target-overview"><div className="analytics-panel-heading"><div><span className="eyebrow">SEMUA PENUGASAN</span><h2>Ringkasan target bulan ini</h2><p>Pilih pasangan DM-client untuk mengatur target dan melihat rincian mingguan.</p></div></div><div className="admin-table-wrap"><table className="admin-table dm-target-table"><thead><tr><th>Nama DM</th><th>Nama Client</th><th>Target bulan ini</th><th>Konten tercatat</th><th>Sisa</th><th>Aksi</th></tr></thead><tbody>{assignments.map(item=>{const prefix=`${Number(item.dm_team_member_id)}:${Number(item.agency_client_id)}:`,weeks=getWeeks(month,new Map([...targetMap].filter(([key])=>key.startsWith(prefix)).map(([key,value])=>[key.split(":").at(-1)!,value])),new Map([...reportMap].filter(([key])=>key.startsWith(prefix)).map(([key,value])=>[key.split(":").at(-1)!,value]))),target=weeks.reduce((sum,week)=>sum+week.planned,0),actual=weeks.reduce((sum,week)=>sum+week.actual,0),remaining=weeks.at(-1)?.remaining??0;return <tr key={prefix}><td><b>{item.dm_name}</b></td><td>{item.client_name}<small>{item.client_type}</small></td><td>{target.toLocaleString("id-ID")}</td><td>{actual.toLocaleString("id-ID")}</td><td>{remaining.toLocaleString("id-ID")}</td><td><Link className="table-action" href={`/admin/kpi/input/dm_targets?month=${month}&dm_id=${Number(item.dm_team_member_id)}&client_id=${Number(item.dm_team_member_id)}:${Number(item.agency_client_id)}`}>Kelola target</Link></td></tr>})}</tbody></table></div></section>}
    {selected && <>
      <section className="analytics-panel dm-target-editor"><div className="analytics-panel-heading"><div><span className="eyebrow">{monthLabel(month)}</span><h2>{selected.dm_name} · {selected.client_name}</h2><p>Isi target masing-masing minggu. Minggu yang sudah lewat dan yang akan datang tetap bisa diedit; sisa target yang belum tercapai ikut terbawa ke minggu berikutnya.</p></div></div><form action={saveDmContentTargets} className="dm-target-plan-form"><input type="hidden" name="period_month" value={month}/><input type="hidden" name="dm_team_member_id" value={selected.dm_team_member_id}/><input type="hidden" name="agency_client_id" value={Number(selected.agency_client_id)}/><div className="dm-weekly-target-inputs">{selectedWeeks.map(week=><label key={week.start}>Minggu {week.index} · {new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short",timeZone:"UTC"}).format(new Date(`${week.start}T12:00:00Z`))}<input name="week_start" type="hidden" value={week.start}/><input name="weekly_target" type="number" min="0" max="4294967295" step="1" defaultValue={week.planned} required/></label>)}</div><p>Target bulanan merupakan jumlah target Minggu 1–5. Realisasi diperbarui dari laporan konten DM.</p><div className="form-actions"><button className="button">Simpan target mingguan</button><span>Semua minggu bisa diatur kapan saja</span></div></form></section>
      <section className="analytics-panel dm-target-table-panel"><div className="analytics-panel-heading"><div><span className="eyebrow">PEMANTAUAN REALISASI</span><h2>Target konten · {monthLabel(month)}</h2><p>Realisasi dihitung dari laporan konten DM pada tiap minggu. Sisa target yang belum tercapai otomatis ditambahkan ke beban minggu berikutnya.</p></div></div><div className="admin-table-wrap"><table className="admin-table dm-target-table"><thead><tr><th>Minggu</th><th>Nama Client</th><th>Target minggu ini</th><th>Bawaan minggu lalu</th><th>Target berjalan</th><th>Realisasi</th><th>Sisa dibawa</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{selectedWeeks.map(week=>{const isCurrent=week.start===currentWeek,done=week.available>0&&week.actual>=week.available;return <tr key={week.start} className={isCurrent?"dm-target-current-week":""}><td><b>Minggu {week.index}</b><small>{new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short",timeZone:"UTC"}).format(new Date(`${week.start}T12:00:00Z`))}</small>{isCurrent&&<span className="dm-target-current-badge">Minggu ini</span>}</td><td><b>{selected.client_name}</b><small>{selected.dm_name}</small></td><td>{week.planned.toLocaleString("id-ID")}</td><td>{week.carried.toLocaleString("id-ID")}</td><td><b>{week.available.toLocaleString("id-ID")}</b></td><td>{week.actual.toLocaleString("id-ID")}</td><td>{week.remaining.toLocaleString("id-ID")}</td><td><span className={`status-pill ${done?"published":week.start>currentWeek?"":"draft"}`}>{week.available===0?"Belum ada target":done?"Tercapai":week.start>currentWeek?"Mendatang":"Belum tercapai"}</span></td><td>{week.planned>0&&<form action={deleteDmContentTarget}><input type="hidden" name="period_month" value={month}/><input type="hidden" name="dm_team_member_id" value={selected.dm_team_member_id}/><input type="hidden" name="agency_client_id" value={Number(selected.agency_client_id)}/><input type="hidden" name="week_start" value={week.start}/><ConfirmDeleteButton message={`Hapus target konten Minggu ${week.index} untuk ${selected.client_name}? Laporan realisasi tetap tersimpan.`}/></form>}</td></tr>})}{!selectedWeeks.length&&<tr><td colSpan={9} className="empty-state">Tidak ada minggu pada bulan ini.</td></tr>}</tbody></table></div></section>

    </>}
  </div></main></div>;
}
