import { redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";
import DmClientOverview, { type ClientOverviewItem, type ClientWeekPoint } from "@/components/dm-client-overview";
import { getAdminSessionUser, verifyAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { getMonthWeekStart, monthWeekStartForDate } from "@/lib/dae-weeks";

export const metadata = { title: "Overview Client | Solusi Sejalan" };
type Query = { month?: string; dm?: string; client?: string };
type Assignment = RowDataPacket & { client_id: number; client_name: string; client_type: string; dm_id: number; dm_name: string };
type Report = RowDataPacket & { dm_team_member_id: number; agency_client_id: number; week_start: string | Date; contents: number | bigint; video_views: number | bigint; tiktok_sales: number | bigint; shopee_sales: number | bigint };
const dateValue = (value: string | Date) => typeof value === "string" ? value.slice(0, 10) : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
const monthValid = (value?: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? "");

export default async function AdminClientOverviewPage({ searchParams }: { searchParams: Promise<Query> }) {
  if (!(await verifyAdminSession())) redirect("/admin/login");
  const user = await getAdminSessionUser();
  if (!(user?.role === "superadmin" || user?.admin_scope === "dm" || user?.admin_scope === "dae" || user?.admin_scope === "both")) redirect("/admin");
  const query = await searchParams;
  const month = monthValid(query.month) ? query.month! : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date());
  const db = getDb();
  const [[assignmentRows], [reportRows]] = await Promise.all([
    db.execute<Assignment[]>("SELECT a.agency_client_id AS client_id,c.client_name,c.client_type,m.id AS dm_id,m.full_name AS dm_name FROM dm_client_assignments a JOIN agency_clients c ON c.id=a.agency_client_id JOIN dm_team_members m ON m.id=a.dm_team_member_id ORDER BY c.client_name,m.full_name LIMIT 5000"),
    db.execute<Report[]>("SELECT dm_team_member_id,agency_client_id,week_start,contents,video_views,tiktok_sales,shopee_sales FROM team_activity_entries WHERE entry_type='dm_client' AND week_start>=? AND week_start<DATE_ADD(?,INTERVAL 1 MONTH) ORDER BY week_start", [`${month}-01`, `${month}-01`]),
  ]);
  const assignments = assignmentRows.map(row => ({ ...row, client_id: Number(row.client_id), dm_id: Number(row.dm_id) }));
  const reports = reportRows.map(row => ({ ...row, agency_client_id: Number(row.agency_client_id), dm_team_member_id: Number(row.dm_team_member_id) }));
  const monthPeriods = Array.from({ length: 5 }, (_, index) => getMonthWeekStart(month, index + 1));
  const clients: ClientOverviewItem[] = assignments.map(assignment => {
    const weekly = new Map<string, ClientWeekPoint>();
    for (const row of reports) {
      if (row.agency_client_id !== assignment.client_id || row.dm_team_member_id !== assignment.dm_id) continue;
      const key = monthWeekStartForDate(dateValue(row.week_start));
      if (!key) continue;
      const week = monthPeriods.indexOf(key) + 1;
      if (week < 1) continue;
      const point = weekly.get(key) ?? { week, start: key, contents: 0, views: 0, tiktok: 0, shopee: 0, hasData: false };
      point.hasData = true;
      point.contents += Number(row.contents ?? 0);
      point.views += Number(row.video_views ?? 0);
      point.tiktok += Number(row.tiktok_sales ?? 0);
      point.shopee += Number(row.shopee_sales ?? 0);
      weekly.set(key, point);
    }
    return {
      id: assignment.client_id,
      dmId: assignment.dm_id,
      dmName: assignment.dm_name,
      name: assignment.client_name,
      type: assignment.client_type,
      points: monthPeriods.map((start, index) => start ? weekly.get(start) ?? { week: index + 1, start, contents: 0, views: 0, tiktok: 0, shopee: 0, hasData: false } : { week: index + 1, start: null, contents: 0, views: 0, tiktok: 0, shopee: 0, hasData: false }),
    };
  });
  const requestedClientId = Number(query.client), requestedDmId = Number(query.dm);
  const active = clients.find(client => client.id === requestedClientId && client.dmId === requestedDmId) ?? clients[0];
  return <div className="admin-page"><AdminNavigation active="kpi" teamActive="client-overview"/><main className="admin-main admin-section-main"><AdminTopbar section="DAE" page="Overview Client"/><div className="admin-shell dm-client-overview-shell">
    <section className="admin-heading dm-client-overview-heading"><div><span className="eyebrow">WORKSPACE / CLIENT</span><h1>Overview Client</h1><p>Pantau total konten, views, dan omzet mingguan dari client yang dipegang semua DM.</p></div><form className="dm-client-overview-filters" action="/admin/kpi/client" method="get">{active&&<><input type="hidden" name="dm" value={active.dmId}/><input type="hidden" name="client" value={active.id}/></>}<label>Periode laporan<input type="month" name="month" defaultValue={month}/></label><button className="button">Tampilkan</button></form>{active&&<div className="dm-client-overview-dm"><small>Nama DM</small><b>{active.dmName}</b></div>}</section>
    <DmClientOverview month={month} dmId={active?.dmId ?? null} clientId={active?.id ?? null} clients={clients} dmName={active?.dmName ?? "Belum ada DM"}/>
  </div></main></div>;
}
