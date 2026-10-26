import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import { getAdminSessionUser, verifyAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";
import DashboardPerformanceTable from "@/components/dashboard-performance-table";
import DashboardPerformanceChart from "@/components/dashboard-performance-chart";
import { daeGrade, daeIndicatorScore } from "@/lib/dae-grade";
import { isExistingAgencyClientType } from "@/lib/client-types";
import { monthWeekStartForDate } from "@/lib/dae-weeks";

export const metadata: Metadata = { title: "Dashboard Performa | Solusi Sejalan" };
export const dynamic = "force-dynamic";
type Score=RowDataPacket&{full_name:string;contents:number|string;video_views:number|string;tiktok_sales:number|string;shopee_sales:number|string;secondary:number|string;assigned_clients?:number|string;strategies?:number|string;visits?:number|string;score?:number;grade?:string};
type Daily=RowDataPacket&{day:string;total:number|string};
type DaeRoster=RowDataPacket&{dae_person:string;agency_client_ids:unknown};
type ClientKind=RowDataPacket&{id:number|string;client_type:string};
type DaeMetric=RowDataPacket&{dae_person:string;total:number|string};
type DaeNote=RowDataPacket&{dae_person:string;team_coordination:string|null;daily_report:string|null};
const count=(v:number|string|undefined)=>Number(v??0);
const money=(v:number|string|undefined)=>"Rp "+count(v).toLocaleString("id-ID");
const gradeForDmScore=(score:number)=>score>=88?"A":score>=77?"B":score>=70.5?"C":"Buruk";
function clientIds(value:unknown):number[]{try{const source=value instanceof Uint8Array?new TextDecoder().decode(value):value;const parsed=typeof source==="string"?JSON.parse(source):source;return Array.isArray(parsed)?[...new Set(parsed.map(Number).filter(id=>Number.isSafeInteger(id)&&id>0))]:[]}catch{return[]}}
export default async function AdminDashboard(){
  if(!(await verifyAdminSession()))redirect("/admin/login");
  const user=await getAdminSessionUser();const db=getDb();
  const currentDate=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const currentMonth=currentDate.slice(0,7), currentWeek=monthWeekStartForDate(currentDate)??`${currentMonth}-01`;
  const [[dms],[daes],[clients],[dmDaily],[daeDaily],[clientDaily],[dmMonthRows],[clientMonthRows],[daeRoster],[clientKinds],[daeStrategies],[daeVisits],[daeReports]] = await Promise.all([
    db.execute<Score[]>("SELECT m.full_name,COALESCE(SUM(e.contents),0) contents,COALESCE(SUM(e.video_views),0) video_views,COALESCE(SUM(e.tiktok_sales),0) tiktok_sales,COALESCE(SUM(e.shopee_sales),0) shopee_sales,COALESCE(SUM(e.tiktok_sales+e.shopee_sales),0) secondary FROM dm_team_members m LEFT JOIN team_activity_entries e ON e.dm_team_member_id=m.id AND e.scope='dm' AND e.entry_type='dm_client' GROUP BY m.id,m.full_name ORDER BY secondary DESC,video_views DESC,contents DESC LIMIT 100"),
    db.execute<Score[]>("SELECT e.dae_person full_name,COALESCE(JSON_LENGTH(e.agency_client_ids),0) assigned_clients,COALESCE((SELECT COUNT(*) FROM dae_strategy_details s WHERE s.dae_person=e.dae_person),0) strategies,COALESCE((SELECT SUM(v.visit_count) FROM dae_visit_details v WHERE v.dae_person=e.dae_person),0) visits,COALESCE((SELECT SUM(r.achievement_client_count) FROM dae_weekly_reports r WHERE r.dae_person=e.dae_person),0) secondary,0 contents,0 video_views,0 tiktok_sales,0 shopee_sales FROM team_activity_entries e WHERE e.entry_type='dae_team' AND e.dae_person IS NOT NULL AND TRIM(e.dae_person)<>'' AND e.id=(SELECT latest.id FROM team_activity_entries latest WHERE latest.entry_type='dae_team' AND latest.dae_person=e.dae_person ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1) ORDER BY secondary DESC,strategies DESC,visits DESC,e.dae_person LIMIT 100"),
    db.execute<Score[]>("SELECT c.client_name full_name,COALESCE(SUM(e.contents),0) contents,COALESCE(SUM(e.video_views),0) video_views,COALESCE(SUM(e.tiktok_sales),0) tiktok_sales,COALESCE(SUM(e.shopee_sales),0) shopee_sales,COALESCE(SUM(e.tiktok_sales+e.shopee_sales),0) secondary FROM agency_clients c LEFT JOIN team_activity_entries e ON e.agency_client_id=c.id AND e.scope='dm' AND e.entry_type='dm_client' GROUP BY c.id,c.client_name ORDER BY secondary DESC,contents DESC LIMIT 100"),
    db.execute<Daily[]>("SELECT DATE_FORMAT(activity_date,'%Y-%m-%d') day,COALESCE(SUM(contents),0) total FROM team_activity_entries WHERE scope='dm' AND entry_type='dm_client' AND activity_date>=DATE_SUB(CURDATE(),INTERVAL 29 DAY) GROUP BY DATE_FORMAT(activity_date,'%Y-%m-%d')"),
    db.execute<Daily[]>("SELECT day,SUM(total) total FROM (SELECT DATE_FORMAT(week_start,'%Y-%m-%d') day,COUNT(*) total FROM dae_strategy_details WHERE week_start>=DATE_SUB(CURDATE(),INTERVAL 29 DAY) GROUP BY DATE_FORMAT(week_start,'%Y-%m-%d') UNION ALL SELECT DATE_FORMAT(week_start,'%Y-%m-%d') day,COALESCE(SUM(visit_count),0) total FROM dae_visit_details WHERE week_start>=DATE_SUB(CURDATE(),INTERVAL 29 DAY) GROUP BY DATE_FORMAT(week_start,'%Y-%m-%d')) dae_activity GROUP BY day"),
    db.execute<Daily[]>("SELECT DATE_FORMAT(activity_date,'%Y-%m-%d') day,COALESCE(SUM(tiktok_sales+shopee_sales),0) total FROM team_activity_entries WHERE scope='dm' AND entry_type='dm_client' AND activity_date>=DATE_SUB(CURDATE(),INTERVAL 29 DAY) GROUP BY DATE_FORMAT(activity_date,'%Y-%m-%d')"),
    db.execute<Score[]>("SELECT m.full_name,COALESCE(SUM(e.contents),0) contents,COALESCE(SUM(e.video_views),0) video_views,COALESCE(SUM(e.tiktok_sales),0) tiktok_sales,COALESCE(SUM(e.shopee_sales),0) shopee_sales,0 secondary FROM dm_team_members m LEFT JOIN team_activity_entries e ON e.dm_team_member_id=m.id AND e.scope='dm' AND e.entry_type='dm_client' AND e.activity_date>=? AND e.activity_date<DATE_ADD(?,INTERVAL 1 MONTH) GROUP BY m.id,m.full_name ORDER BY m.full_name",[`${currentMonth}-01`,`${currentMonth}-01`]),
    db.execute<Score[]>("SELECT c.client_name full_name,COALESCE(SUM(e.contents),0) contents,COALESCE(SUM(e.video_views),0) video_views,COALESCE(SUM(e.tiktok_sales),0) tiktok_sales,COALESCE(SUM(e.shopee_sales),0) shopee_sales,0 secondary FROM agency_clients c LEFT JOIN team_activity_entries e ON e.agency_client_id=c.id AND e.scope='dm' AND e.entry_type='dm_client' AND e.activity_date>=? AND e.activity_date<DATE_ADD(?,INTERVAL 1 MONTH) GROUP BY c.id,c.client_name ORDER BY c.client_name",[`${currentMonth}-01`,`${currentMonth}-01`]),
    db.execute<DaeRoster[]>("SELECT e.dae_person,e.agency_client_ids FROM team_activity_entries e WHERE e.entry_type='dae_team' AND e.dae_person IS NOT NULL AND TRIM(e.dae_person)<>'' AND e.id=(SELECT latest.id FROM team_activity_entries latest WHERE latest.entry_type='dae_team' AND latest.dae_person=e.dae_person ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1) ORDER BY e.dae_person LIMIT 5000"),
    db.execute<ClientKind[]>("SELECT id,client_type FROM agency_clients"),
    db.execute<DaeMetric[]>("SELECT dae_person,COUNT(*) total FROM dae_strategy_details WHERE week_start>=? AND week_start<DATE_ADD(?,INTERVAL 1 MONTH) GROUP BY dae_person",[`${currentMonth}-01`,`${currentMonth}-01`]),
    db.execute<DaeMetric[]>("SELECT dae_person,SUM(visit_count) total FROM dae_visit_details WHERE week_start=? GROUP BY dae_person",[currentWeek]),
    db.execute<DaeNote[]>("SELECT dae_person,team_coordination,daily_report FROM dae_weekly_reports WHERE week_start=?",[currentWeek])
  ]);
  const today=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"numeric",month:"short",year:"numeric"}).format(new Date());
  const todayIso=currentDate;
  const [year,month,dayPart]=todayIso.split("-").map(Number);
  const chartDays=Array.from({length:30},(_,index)=>{
    const day=new Date(Date.UTC(year,month-1,dayPart-29+index)).toISOString().slice(0,10);
    return{day,dmContent:count(dmDaily.find(row=>row.day===day)?.total),daeConversions:count(daeDaily.find(row=>row.day===day)?.total),clientRevenue:count(clientDaily.find(row=>row.day===day)?.total)};
  });
  const canDM=user?.role==="superadmin"||user?.admin_scope==="dm"||user?.admin_scope==="both",canDAE=user?.role==="superadmin"||user?.admin_scope==="dae"||user?.admin_scope==="both";
  const dmMax={contents:Math.max(1,...dmMonthRows.map(row=>count(row.contents))),views:Math.max(1,...dmMonthRows.map(row=>count(row.video_views))),sales:Math.max(1,...dmMonthRows.map(row=>count(row.tiktok_sales)+count(row.shopee_sales)))};
  const gradedDms=dmMonthRows.map(row=>{const score=50*count(row.contents)/dmMax.contents+30*count(row.video_views)/dmMax.views+20*(count(row.tiktok_sales)+count(row.shopee_sales))/dmMax.sales;return{...row,score,grade:gradeForDmScore(score)}});
  const dm=[...gradedDms].filter(row=>row.score>0).sort((a,b)=>b.score-a.score||a.full_name.localeCompare(b.full_name,"id"))[0];
  const existingClientIds=new Set(clientKinds.filter(row=>isExistingAgencyClientType(row.client_type)).map(row=>Number(row.id)));
  const strategyByDae=new Map(daeStrategies.map(row=>[row.dae_person,count(row.total)])),visitsByDae=new Map(daeVisits.map(row=>[row.dae_person,count(row.total)])),notesByDae=new Map(daeReports.map(row=>[row.dae_person,row]));
  const gradedDaes=daeRoster.map(row=>{const clientsCount=clientIds(row.agency_client_ids).filter(id=>existingClientIds.has(id)).length,strategies=strategyByDae.get(row.dae_person)??0,visits=visitsByDae.get(row.dae_person)??0,note=notesByDae.get(row.dae_person);const hasWeeklyInput=visitsByDae.has(row.dae_person)||notesByDae.has(row.dae_person);const score=hasWeeklyInput?daeIndicatorScore({clientRetention:clientsCount,clientTarget:clientsCount,strategies,visits,achievement:clientsCount,coordination:note?.team_coordination,dailyReport:note?.daily_report}):0;return{full_name:row.dae_person,score,grade:daeGrade(score),strategies,visits,assigned_clients:clientsCount}});
  const dae=[...gradedDaes].sort((a,b)=>b.assigned_clients-a.assigned_clients||b.strategies-a.strategies||b.visits-a.visits||a.full_name.localeCompare(b.full_name,"id"))[0];
  const clientMax={contents:Math.max(1,...clientMonthRows.map(row=>count(row.contents))),views:Math.max(1,...clientMonthRows.map(row=>count(row.video_views))),sales:Math.max(1,...clientMonthRows.map(row=>count(row.tiktok_sales)+count(row.shopee_sales)))};
  const gradedClients=clientMonthRows.map(row=>{const score=50*count(row.contents)/clientMax.contents+30*count(row.video_views)/clientMax.views+20*(count(row.tiktok_sales)+count(row.shopee_sales))/clientMax.sales;return{...row,score,grade:gradeForDmScore(score)}});
  const client=[...gradedClients].filter(row=>row.score>0).sort((a,b)=>b.score-a.score||a.full_name.localeCompare(b.full_name,"id"))[0];
  const serializableScores = (rows: Score[]) => rows.map(row => ({
    full_name: row.full_name,
    contents: count(row.contents),
    video_views: count(row.video_views),
    tiktok_sales: count(row.tiktok_sales),
    shopee_sales: count(row.shopee_sales),
    secondary: count(row.secondary),
    assigned_clients: count(row.assigned_clients),
    strategies: count(row.strategies),
    visits: count(row.visits),
  }));
  return <div className="admin-page admin-theme-dashboard"><AdminNavigation active="dashboard" teamActive="overview"/><main className={"admin-main admin-dashboard-main dashboard-v2 scope-"+(canDM&&canDAE?"both":canDM?"dm":"dae")}><AdminTopbar section="Overview" page="DM · DAE · Client"/><div className="dashboard-content dashboard-v2-content">
    <section className="dashboard-v2-heading"><div><span className="dashboard-kicker">SOLUSI SEJALAN / PERFORMANCE</span><h1>Analytics overview</h1><p>Performa tim marketing, account executive, dan client.</p></div><div className="dashboard-date"><span>DATA DIPERBARUI</span><b>{today}</b></div></section>
    <section className="dashboard-v2-metrics performer-metrics" aria-label="Performa terbaik">
      <article className="dashboard-v2-metric"><div><span>DM terbaik · {currentMonth}</span><i>{dm?.grade??"—"}</i></div><strong className="performer-name">{dm?.full_name??"Belum ada data periode ini"}</strong><small>{dm?`Grade ${dm.grade} · skor ${dm.score.toFixed(1)} · ${count(dm.contents)} konten · ${count(dm.video_views).toLocaleString("id-ID")} views · ${money(count(dm.tiktok_sales)+count(dm.shopee_sales))} omset`:"Belum ada laporan DM pada bulan ini."}</small><span className="metric-accent"/></article>
      <article className="dashboard-v2-metric"><div><span>DAE terbaik · Minggu ini</span><i>{dae?.grade??"—"}</i></div><strong className="performer-name">{dae?.full_name??"Belum ada data periode ini"}</strong><small>{dae?`Grade ${dae.grade} · indikator ${dae.score}% · ${dae.strategies} strategi · ${dae.visits} kunjungan · ${dae.assigned_clients} client existing`:"Belum ada input mingguan DAE."}</small><span className="metric-accent"/></article>
      <article className="dashboard-v2-metric"><div><span>Client terbaik · {currentMonth}</span><i>{client?.grade??"—"}</i></div><strong className="performer-name">{client?.full_name??"Belum ada data periode ini"}</strong><small>{client?`Grade ${client.grade} · skor ${client.score.toFixed(1)} · ${count(client.contents)} konten · ${money(count(client.tiktok_sales)+count(client.shopee_sales))} omset tercatat`:"Belum ada laporan client pada bulan ini."}</small><span className="metric-accent"/></article>
    </section>
    <section className="dashboard-v2-panel dashboard-v2-chart-panel"><div className="dashboard-v2-panel-heading"><div><span className="dashboard-kicker">30 HARI TERAKHIR</span><h2>Performa DM, DAE, dan client</h2><p>Konten DM, aktivitas DAE per minggu, dan omset client dari laporan yang masuk.</p></div><Link href="/admin/analytics">Analytics lengkap <span>↗</span></Link></div><DashboardPerformanceChart points={chartDays}/></section>
    <DashboardPerformanceTable dm={serializableScores(dms)} dae={serializableScores(daes)} clients={serializableScores(clients)}/><p className="dashboard-v2-note">Sumber data: laporan mingguan/harian DM, data strategi dan kunjungan DAE, serta client yang sudah tersimpan.</p>
  </div></main></div>
}
