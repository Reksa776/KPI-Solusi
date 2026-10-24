import type { Metadata } from "next";
import type { RowDataPacket } from "@/lib/db-types";
import { getDb } from "@/lib/db";
import PublicPerformanceShell from "@/components/public-performance-shell";
import DashboardPerformanceChart from "@/components/dashboard-performance-chart";
import DashboardPerformanceTable from "@/components/dashboard-performance-table";

export const metadata: Metadata = { title: "Overview Performa | Solusi Sejalan", description: "Ringkasan performa umum tim digital marketing dan digital account executive." };
type Score = RowDataPacket & { full_name: string; contents: number|string; video_views: number|string; tiktok_sales: number|string; shopee_sales: number|string; secondary: number|string; assigned_clients?: number|string; strategies?: number|string; visits?: number|string };
type Daily = RowDataPacket & { day: string; total: number|string };
const count = (value: number|string|undefined) => Number(value ?? 0);

export default async function PublicPerformancePage() {
  const db = getDb();
  const [[dms], [daes], [clients], [dmDaily], [daeDaily], [clientDaily]] = await Promise.all([
    db.execute<Score[]>("SELECT m.full_name,COALESCE(SUM(e.contents),0) contents,COALESCE(SUM(e.video_views),0) video_views,COALESCE(SUM(e.tiktok_sales),0) tiktok_sales,COALESCE(SUM(e.shopee_sales),0) shopee_sales,COALESCE(SUM(e.tiktok_sales+e.shopee_sales),0) secondary FROM dm_team_members m LEFT JOIN team_activity_entries e ON e.dm_team_member_id=m.id AND e.scope='dm' AND e.entry_type='dm_client' GROUP BY m.id,m.full_name ORDER BY secondary DESC,video_views DESC,contents DESC LIMIT 100"),
    db.execute<Score[]>("SELECT e.dae_person full_name,COALESCE(JSON_LENGTH(e.agency_client_ids),0) assigned_clients,COALESCE((SELECT COUNT(*) FROM dae_strategy_details s WHERE s.dae_person=e.dae_person),0) strategies,COALESCE((SELECT SUM(v.visit_count) FROM dae_visit_details v WHERE v.dae_person=e.dae_person),0) visits,COALESCE((SELECT SUM(r.achievement_client_count) FROM dae_weekly_reports r WHERE r.dae_person=e.dae_person),0) secondary,0 contents,0 video_views,0 tiktok_sales,0 shopee_sales FROM team_activity_entries e WHERE e.entry_type='dae_team' AND e.dae_person IS NOT NULL AND TRIM(e.dae_person)<>'' AND e.id=(SELECT latest.id FROM team_activity_entries latest WHERE latest.entry_type='dae_team' AND latest.dae_person=e.dae_person ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1) ORDER BY secondary DESC,strategies DESC,visits DESC,e.dae_person LIMIT 100"),
    db.execute<Score[]>("SELECT c.client_name full_name,COALESCE(SUM(e.contents),0) contents,COALESCE(SUM(e.video_views),0) video_views,COALESCE(SUM(e.tiktok_sales),0) tiktok_sales,COALESCE(SUM(e.shopee_sales),0) shopee_sales,COALESCE(SUM(e.tiktok_sales+e.shopee_sales),0) secondary FROM agency_clients c LEFT JOIN team_activity_entries e ON e.agency_client_id=c.id AND e.scope='dm' AND e.entry_type='dm_client' GROUP BY c.id,c.client_name ORDER BY secondary DESC,contents DESC LIMIT 100"),
    db.execute<Daily[]>("SELECT DATE_FORMAT(activity_date,'%Y-%m-%d') day,COALESCE(SUM(contents),0) total FROM team_activity_entries WHERE scope='dm' AND entry_type='dm_client' AND activity_date>=DATE_SUB(CURDATE(),INTERVAL 29 DAY) GROUP BY DATE_FORMAT(activity_date,'%Y-%m-%d')"),
    db.execute<Daily[]>("SELECT day,SUM(total) total FROM (SELECT DATE_FORMAT(week_start,'%Y-%m-%d') day,COUNT(*) total FROM dae_strategy_details WHERE week_start>=DATE_SUB(CURDATE(),INTERVAL 29 DAY) GROUP BY DATE_FORMAT(week_start,'%Y-%m-%d') UNION ALL SELECT DATE_FORMAT(week_start,'%Y-%m-%d') day,COALESCE(SUM(visit_count),0) total FROM dae_visit_details WHERE week_start>=DATE_SUB(CURDATE(),INTERVAL 29 DAY) GROUP BY DATE_FORMAT(week_start,'%Y-%m-%d')) dae_activity GROUP BY day"),
    db.execute<Daily[]>("SELECT DATE_FORMAT(activity_date,'%Y-%m-%d') day,COALESCE(SUM(tiktok_sales+shopee_sales),0) total FROM team_activity_entries WHERE scope='dm' AND entry_type='dm_client' AND activity_date>=DATE_SUB(CURDATE(),INTERVAL 29 DAY) GROUP BY DATE_FORMAT(activity_date,'%Y-%m-%d')"),
  ]);

  const today = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric" }).format(new Date());
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [year, month, day] = todayIso.split("-").map(Number);
  const chartDays = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day - 29 + index)).toISOString().slice(0, 10);
    return { day: date, dmContent: count(dmDaily.find((row) => row.day === date)?.total), daeConversions: count(daeDaily.find((row) => row.day === date)?.total), clientRevenue: count(clientDaily.find((row) => row.day === date)?.total) };
  });
  const bestDm = dms.find((row) => count(row.contents) > 0 || count(row.video_views) > 0 || count(row.tiktok_sales) + count(row.shopee_sales) > 0);
  const bestDae = daes.find((row) => count(row.secondary) > 0 || count(row.strategies) > 0 || count(row.visits) > 0 || count(row.assigned_clients) > 0);
  const bestClient = clients.find((row) => count(row.contents) > 0 || count(row.tiktok_sales) + count(row.shopee_sales) > 0);
  const serializable = (rows: Score[]) => rows.map((row) => ({ full_name: row.full_name, contents: count(row.contents), video_views: count(row.video_views), tiktok_sales: count(row.tiktok_sales), shopee_sales: count(row.shopee_sales), secondary: count(row.secondary), assigned_clients: count(row.assigned_clients), strategies: count(row.strategies), visits: count(row.visits) }));

  return <PublicPerformanceShell active="general" eyebrow="SOLUSI SEJALAN / PERFORMANCE" title="Analytics overview" description="Performa tim marketing, account executive, dan client.">
    <div className="public-general-dashboard dashboard-v2-content">
      <section className="dashboard-v2-heading"><div><span className="dashboard-kicker">SOLUSI SEJALAN / PERFORMANCE</span><h1>Analytics overview</h1><p>Performa tim marketing, account executive, dan client.</p></div><div className="dashboard-date"><span>DATA DIPERBARUI</span><b>{today}</b></div></section>
      <section className="dashboard-v2-metrics performer-metrics" aria-label="Performa terbaik">
        <article className="dashboard-v2-metric"><div><span>DM terbaik</span><i>DM</i></div><strong className="performer-name">{bestDm?.full_name ?? "Belum ada data"}</strong><small>{bestDm ? `${count(bestDm.contents).toLocaleString("id-ID")} konten · ${count(bestDm.video_views).toLocaleString("id-ID")} views · Rp ${(count(bestDm.tiktok_sales) + count(bestDm.shopee_sales)).toLocaleString("id-ID")} omset` : "Belum ada laporan DM."}</small><span className="metric-accent"/></article>
        <article className="dashboard-v2-metric"><div><span>DAE terbaik</span><i>DAE</i></div><strong className="performer-name">{bestDae?.full_name ?? "Belum ada data"}</strong><small>{bestDae ? `${count(bestDae.strategies)} strategi · ${count(bestDae.visits)} kunjungan · ${count(bestDae.assigned_clients)} client dipegang` : "Belum ada aktivitas DAE."}</small><span className="metric-accent"/></article>
        <article className="dashboard-v2-metric"><div><span>Client terbaik</span><i>CLIENT</i></div><strong className="performer-name">{bestClient?.full_name ?? "Belum ada data"}</strong><small>{bestClient ? `${count(bestClient.contents)} konten · Rp ${(count(bestClient.tiktok_sales) + count(bestClient.shopee_sales)).toLocaleString("id-ID")} omset tercatat` : "Belum ada laporan client."}</small><span className="metric-accent"/></article>
      </section>
      <section className="dashboard-v2-panel dashboard-v2-chart-panel"><div className="dashboard-v2-panel-heading"><div><span className="dashboard-kicker">30 HARI TERAKHIR</span><h2>Performa DM, DAE, dan client</h2><p>Konten DM, aktivitas DAE per minggu, dan omset client dari laporan yang masuk.</p></div></div><DashboardPerformanceChart points={chartDays}/></section>
      <DashboardPerformanceTable dm={serializable(dms)} dae={serializable(daes)} clients={serializable(clients)}/>
      <p className="dashboard-v2-note">Sumber data: laporan DM, strategi dan kunjungan DAE, serta client yang sudah tersimpan.</p>
    </div>
  </PublicPerformanceShell>;
}
