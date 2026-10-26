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
type DmRow = RowDataPacket & { id: number; full_name: string };
type Assignment = RowDataPacket & { client_id: number; client_name: string; client_type: string; dm_id: number; dm_name: string };
type Report = RowDataPacket & { agency_client_id: number; week_start: string | Date; contents: number | bigint; video_views: number | bigint; tiktok_sales: number | bigint; shopee_sales: number | bigint };
const dateValue = (value: string | Date) => typeof value === "string" ? value.slice(0, 10) : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
const monthValid = (value?: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? "");

export default async function AdminClientOverviewPage({ searchParams }: { searchParams: Promise<Query> }) {
  if (!(await verifyAdminSession())) redirect("/admin/login");
  const user = await getAdminSessionUser();
  if (!(user?.role === "superadmin" || user?.admin_scope === "dm" || user?.admin_scope === "dae" || user?.admin_scope === "both")) redirect("/admin");
  const query = await searchParams;
  const month = monthValid(query.month) ? query.month! : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date());
  const db = getDb();
  const [[dms]] = await Promise.all([db.execute<DmRow[]>("SELECT id,full_name FROM dm_team_members ORDER BY full_name LIMIT 1000")]);
  const dmIdFromQuery = Number(query.dm);
  const selectedDm = dms.find(dm => Number(dm.id) === dmIdFromQuery) ?? dms[0];
  let assignments: Assignment[] = [];
  let reports: Report[] = [];
  if (selectedDm) {
    const [assignmentRows] = await db.execute<Assignment[]>("SELECT a.agency_client_id AS client_id,c.client_name,c.client_type,m.id AS dm_id,m.full_name AS dm_name FROM dm_client_assignments a JOIN agency_clients c ON c.id=a.agency_client_id JOIN dm_team_members m ON m.id=a.dm_team_member_id WHERE a.dm_team_member_id=? ORDER BY c.client_name LIMIT 2000", [selectedDm.id]);
    assignments = assignmentRows.map(row => ({ ...row, client_id: Number(row.client_id), dm_id: Number(row.dm_id) }));
    if (assignments.length) {
      const [reportRows] = await db.execute<Report[]>("SELECT agency_client_id,week_start,contents,video_views,tiktok_sales,shopee_sales FROM team_activity_entries WHERE entry_type='dm_client' AND dm_team_member_id=? AND week_start>=? AND week_start<DATE_ADD(?,INTERVAL 1 MONTH) ORDER BY week_start", [selectedDm.id, `${month}-01`, `${month}-01`]);
      reports = reportRows.map(row => ({ ...row, agency_client_id: Number(row.agency_client_id) }));
    }
  }
  const monthPeriods = Array.from({ length: 5 }, (_, index) => getMonthWeekStart(month, index + 1));
  const clients: ClientOverviewItem[] = assignments.map(assignment => {
    const weekly = new Map<string, ClientWeekPoint>();
    for (const row of reports) {
      if (row.agency_client_id !== assignment.client_id) continue;
      const key = monthWeekStartForDate(dateValue(row.week_start));
      if (!key) continue;
      const week = monthPeriods.indexOf(key) + 1;
      if (week < 1) continue;
      const point = weekly.get(key) ?? { week, start: key, contents: 0, views: 0, tiktok: 0, shopee: 0 };
      point.contents += Number(row.contents ?? 0);
      point.views += Number(row.video_views ?? 0);
      point.tiktok += Number(row.tiktok_sales ?? 0);
      point.shopee += Number(row.shopee_sales ?? 0);
      weekly.set(key, point);
    }
    return {
      id: assignment.client_id,
      name: assignment.client_name,
      type: assignment.client_type,
      points: monthPeriods.map((start, index) => start ? weekly.get(start) ?? { week: index + 1, start, contents: 0, views: 0, tiktok: 0, shopee: 0 } : { week: index + 1, start: null, contents: 0, views: 0, tiktok: 0, shopee: 0 }),
    };
  });
  const requestedClientId = Number(query.client);
  const selectedClientId = clients.some(client => client.id === requestedClientId) ? requestedClientId : clients[0]?.id ?? null;
  const dmChoices = dms.map(dm => ({ id: Number(dm.id), name: dm.full_name }));
  return <div className="admin-page"><AdminNavigation active="kpi" teamActive="client-overview"/><main className="admin-main admin-section-main"><AdminTopbar section="DAE" page="Overview Client"/><div className="admin-shell dm-client-overview-shell">
    <section className="admin-heading dm-client-overview-heading"><div><span className="eyebrow">WORKSPACE / CLIENT</span><h1>Overview Client</h1><p>Pantau total konten, views, dan omzet mingguan dari client yang dipegang DM.</p></div><form className="dm-client-overview-filters" action="/admin/kpi/client" method="get"><label>Periode laporan<input type="month" name="month" defaultValue={month}/></label><label>Nama DM<select name="dm" defaultValue={selectedDm ? Number(selectedDm.id) : ""}>{dmChoices.map(dm => <option key={dm.id} value={dm.id}>{dm.name}</option>)}</select></label><button className="button">Tampilkan</button></form></section>
    <DmClientOverview month={month} dmId={Number(selectedDm?.id ?? 0)} clientId={selectedClientId} clients={clients} dmName={selectedDm?.full_name ?? "Belum ada DM"}/>
  </div></main></div>;
}
