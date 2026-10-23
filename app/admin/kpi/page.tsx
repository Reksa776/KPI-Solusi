import Link from "next/link";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";
import { getAdminSessionUser, verifyAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { getMonthWeekStart } from "@/lib/dae-weeks";
import { isExistingAgencyClientType } from "@/lib/client-types";
import { deleteTeamEntry, saveKpiTarget } from "./actions";
import DaeKpiOverview, { type DaeClientRow, type DaeOverviewRow, type DaeTrendPoint, type DaeTypeSlice, type DaeWeeklyData } from "@/components/dae-kpi-overview";
import DmKpiOverview, { type DmOverviewRow, type DmTrendPoint, type DmWeeklyRow } from "@/components/dm-kpi-overview";

export const metadata = { title: "KPI Tim | Solusi Sejalan" };
type Totals = RowDataPacket & { scope: "dm" | "dae"; entries: number; contents: number|string; video_views: number|string; tiktok_sales: number|string; shopee_sales: number|string; new_clients: number|string; strategies: number|string; visits: number|string };
type Target = RowDataPacket & { scope: "dm" | "dae"; metric: string; target_value: number|string };
type Entry = RowDataPacket & { id: number; scope: string; entry_type: string; title: string; client_name: string|null; client_type: string|null; dae_person: string|null; full_name: string|null; activity_date: string; contents: number|string; video_views: number|string; tiktok_sales: number|string; shopee_sales: number|string; new_clients: number|string; strategies: number|string; visits: number|string };
type DmEntry = RowDataPacket & { dm_id:number|null; dm_name:string|null; client_name:string|null; client_type:string|null; activity_date:string|Date; contents:number|string; video_views:number|string; tiktok_sales:number|string; shopee_sales:number|string };
type Assignment = RowDataPacket & { dae_person: string; week_start: string|Date; agency_client_ids: unknown };
type Client = RowDataPacket & { id:number; client_name:string; client_type:string };
type WeeklyCount = RowDataPacket & { dae_person?:string; week_start:string|Date; total:number };
type DaeReport = RowDataPacket & { dae_person:string; week_start:string|Date; team_coordination:string|null; daily_report:string|null };
const labels: Record<string,string> = { contents: "Konten", video_views: "Views video", tiktok_sales: "Omset TikTok", shopee_sales: "Omset Shopee", new_clients: "Client baru", strategies: "Strategi", visits: "Kunjungan" };
const dmMetrics = ["contents","video_views","tiktok_sales","shopee_sales"];
const daeMetrics = ["new_clients","strategies","visits","contents"];
const format = (value: number|string, metric: string) => metric.includes("sales") ? `Rp ${Number(value).toLocaleString("id-ID")}` : Number(value).toLocaleString("id-ID");
const clientTypeLabels: Record<string,string> = { existing:"Client Existing",prospect:"Calon Client",ex_client:"Ex Client",community:"Community",media:"Media",institution:"Instansi",agency_ph:"Agency / PH",etc:"Etc." };
const typeLabels: Record<string,string> = { dm_client:"Data client DM", dae_individual:"Data individu DAE", dae_team:"Data tim DAE", dae_strategy:"Strategi DAE", dae_visit:"Kunjungan DAE", dae_client:"Data client DAE" };
const dateValue=(value:string|Date)=>typeof value==="string"?value.slice(0,10):new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(value);
function readIds(value:unknown):number[]{try{const source=value instanceof Uint8Array?new TextDecoder().decode(value):value;const parsed=typeof source==="string"?JSON.parse(source):source;return Array.isArray(parsed)?[...new Set(parsed.map(Number).filter(id=>Number.isSafeInteger(id)&&id>0))]:[]}catch{return[]}}
const isDaeScope=(value:string)=>value==="dae";

export default async function KpiDashboard({ searchParams }: { searchParams: Promise<{ scope?: string; week?:string; dae?:string; dm?:string; month?:string; weeklyMonth?:string; saved?: string; error?: string }> }) {
  if (!(await verifyAdminSession())) redirect("/admin/login");
  const user = await getAdminSessionUser();
  const canDM = user?.role === "superadmin" || user?.admin_scope === "dm" || user?.admin_scope === "both";
  const canDAE = user?.role === "superadmin" || user?.admin_scope === "dae" || user?.admin_scope === "both";
  const defaultScope = canDM ? "dm" : "dae";
  const query = await searchParams, scope = query.scope === "dae" ? "dae" : query.scope === "dm" ? "dm" : defaultScope;
  const currentMonth = new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Jakarta", year:"numeric", month:"2-digit" }).format(new Date());
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(query.month??"") ? query.month! : currentMonth, db = getDb();
  const [[totals], [targetRows], [entries], [newStrategyRows], [newVisitRows]] = await Promise.all([
    db.execute<Totals[]>("SELECT scope,COUNT(*) entries,COALESCE(SUM(contents),0) contents,COALESCE(SUM(video_views),0) video_views,COALESCE(SUM(tiktok_sales),0) tiktok_sales,COALESCE(SUM(shopee_sales),0) shopee_sales,COALESCE(SUM(new_clients),0) new_clients,COALESCE(SUM(strategies),0) strategies,COALESCE(SUM(visits),0) visits FROM team_activity_entries WHERE activity_date>=? AND activity_date<DATE_ADD(?,INTERVAL 1 MONTH) GROUP BY scope", [`${month}-01`, `${month}-01`]),
    db.execute<Target[]>("SELECT scope,metric,target_value FROM team_kpi_targets WHERE period_month=? AND scope=?", [month, scope]),
    db.execute<Entry[]>("SELECT e.*,COALESCE(m.full_name,e.dm_person,u.full_name) AS full_name FROM team_activity_entries e LEFT JOIN dm_team_members m ON m.id=e.dm_team_member_id LEFT JOIN users u ON u.id=e.assigned_user_id WHERE e.scope=? ORDER BY e.activity_date DESC,e.id DESC LIMIT 20", [scope]),
    scope === "dae" ? db.execute<(RowDataPacket & { total: number })[]>("SELECT COUNT(*) AS total FROM dae_strategy_details WHERE week_start>=? AND week_start<DATE_ADD(?,INTERVAL 1 MONTH)", [`${month}-01`, `${month}-01`]) : Promise.resolve([[] as (RowDataPacket & { total: number })[], []] as const),
    scope === "dae" ? db.execute<(RowDataPacket & { total: number })[]>("SELECT COALESCE(SUM(visit_count),0) AS total FROM dae_visit_details WHERE week_start>=? AND week_start<DATE_ADD(?,INTERVAL 1 MONTH)", [`${month}-01`, `${month}-01`]) : Promise.resolve([[] as (RowDataPacket & { total: number })[], []] as const)
  ]);
  const total = totals.find(row => row.scope === scope), targets = new Map(targetRows.map(row => [row.metric, Number(row.target_value)]));
  const metrics = scope === "dm" ? dmMetrics : daeMetrics;
  const base = scope === "dm" ? "/admin/kpi/input/dm_client" : canDAE ? "/admin/kpi/input/dae_individual" : "/admin/kpi/input/dae_team";
  const metricValue = (metric:string) => Number(total?.[metric as keyof Totals] ?? 0) + (scope === "dae" && metric === "strategies" ? Number(newStrategyRows[0]?.total ?? 0) : 0) + (scope === "dae" && metric === "visits" ? Number(newVisitRows[0]?.total ?? 0) : 0);
  const dateText = new Intl.DateTimeFormat("id-ID", { month:"long", year:"numeric" }).format(new Date());
  if(isDaeScope(scope)){
    const [[weekRows],[clientRows]] = await Promise.all([
      db.execute<(RowDataPacket & {week_start:string|Date})[]>("SELECT DISTINCT week_start FROM (SELECT week_start FROM dae_strategy_details UNION SELECT week_start FROM dae_visit_details UNION SELECT week_start FROM dae_weekly_reports) periods ORDER BY week_start DESC LIMIT 26"),
      db.execute<Client[]>("SELECT id,client_name,client_type FROM agency_clients ORDER BY client_name")
    ]);
    const currentMonth=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit"}).format(new Date());
    const currentPeriods=Array.from({length:5},(_,index)=>getMonthWeekStart(currentMonth,index+1)).filter((value):value is string=>Boolean(value));
    const weeks=[...new Set([...weekRows.map(row=>dateValue(row.week_start)),...currentPeriods])].sort().reverse().slice(0,26);
    const requestedMonth=query.week?.slice(0,7)??currentMonth;
    const requestedPeriods=Array.from({length:5},(_,index)=>getMonthWeekStart(requestedMonth,index+1)).filter((value):value is string=>Boolean(value));
    const activeWeek=query.week&&requestedPeriods.includes(query.week)?query.week:requestedPeriods.find(period=>period===new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()))??requestedPeriods.find(period=>new Date(`${period}T12:00:00+07:00`)<=new Date())??requestedPeriods[0]??"";
    const monthStart=activeWeek?new Date(`${activeWeek.slice(0,7)}-01T00:00:00Z`):null;
    const periodWeeks:string[]=[];
    if(monthStart){
      const weekday=monthStart.getUTCDay();
      monthStart.setUTCDate(monthStart.getUTCDate()+((8-weekday)%7));
      const monthKey=activeWeek.slice(0,7);
      while(monthStart.toISOString().slice(0,7)===monthKey&&periodWeeks.length<5){periodWeeks.push(monthStart.toISOString().slice(0,10));monthStart.setUTCDate(monthStart.getUTCDate()+7)}
    }
    while(periodWeeks.length<5)periodWeeks.push("");
    const reportWeeks=periodWeeks.filter(Boolean);
    const reportQuery=reportWeeks.length?db.execute<DaeReport[]>(`SELECT dae_person,week_start,team_coordination,daily_report FROM dae_weekly_reports WHERE week_start IN (${reportWeeks.map(()=>"?").join(",")})`,reportWeeks):Promise.resolve([[] as DaeReport[],[]] as const);
    const [[assignmentRows],[strategyWeekRows],[visitWeekRows],[trendAssignments],[trendStrategies],[trendVisits],[weeklyReports]] = await Promise.all([
      db.execute<Assignment[]>("SELECT e.dae_person,e.week_start,e.agency_client_ids FROM team_activity_entries e WHERE e.entry_type='dae_team' AND e.dae_person IS NOT NULL AND TRIM(e.dae_person)<>'' AND e.id=(SELECT latest.id FROM team_activity_entries latest WHERE latest.entry_type='dae_team' AND latest.dae_person=e.dae_person ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1) ORDER BY e.dae_person"),
      activeWeek?db.execute<WeeklyCount[]>("SELECT dae_person,week_start,COUNT(*) AS total FROM dae_strategy_details WHERE week_start=? GROUP BY dae_person,week_start",[activeWeek]):Promise.resolve([[] as WeeklyCount[],[]] as const),
      activeWeek?db.execute<WeeklyCount[]>("SELECT dae_person,week_start,SUM(visit_count) AS total FROM dae_visit_details WHERE week_start=? GROUP BY dae_person,week_start",[activeWeek]):Promise.resolve([[] as WeeklyCount[],[]] as const),
      db.execute<Assignment[]>("SELECT e.dae_person,e.week_start,e.agency_client_ids FROM team_activity_entries e WHERE e.entry_type='dae_team' AND e.dae_person IS NOT NULL AND TRIM(e.dae_person)<>'' AND e.id=(SELECT latest.id FROM team_activity_entries latest WHERE latest.entry_type='dae_team' AND latest.dae_person=e.dae_person ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1) ORDER BY e.dae_person LIMIT 5000"),
      db.execute<WeeklyCount[]>("SELECT dae_person,week_start,COUNT(*) AS total FROM dae_strategy_details GROUP BY dae_person,week_start ORDER BY week_start DESC LIMIT 1000"),
      db.execute<WeeklyCount[]>("SELECT dae_person,week_start,SUM(visit_count) AS total FROM dae_visit_details GROUP BY dae_person,week_start ORDER BY week_start DESC LIMIT 1000"),
      reportQuery
    ]);
    const clientMap=new Map(clientRows.map(client=>[Number(client.id),client]));
    const existingClientIds=new Set(clientRows.filter(client=>isExistingAgencyClientType(client.client_type)).map(client=>Number(client.id)));
    const assignmentsByDae=new Map<string,Set<number>>();
    for(const assignment of assignmentRows){const ids=assignmentsByDae.get(assignment.dae_person)??new Set<number>();readIds(assignment.agency_client_ids).forEach(id=>ids.add(id));assignmentsByDae.set(assignment.dae_person,ids)}
    const strategyMap=new Map(strategyWeekRows.map(row=>[row.dae_person??"",Number(row.total)])),visitMap=new Map(visitWeekRows.map(row=>[row.dae_person??"",Number(row.total)]));
    type GradeMetrics={clients:Set<number>;strategies:number;visits:number;coordination:string;dailyReport:string};
    const gradeMetrics=new Map<string,Map<string,GradeMetrics>>();
    const getGradeMetrics=(week:string,name:string)=>{const people=gradeMetrics.get(week)??new Map<string,GradeMetrics>(),item=people.get(name)??{clients:new Set<number>(),strategies:0,visits:0,coordination:"",dailyReport:""};people.set(name,item);gradeMetrics.set(week,people);return item};
    for(const period of reportWeeks)for(const assignment of trendAssignments){const item=getGradeMetrics(period,assignment.dae_person);readIds(assignment.agency_client_ids).filter(id=>existingClientIds.has(id)).forEach(id=>item.clients.add(id))}
    for(const item of trendStrategies){const period=dateValue(item.week_start);if(reportWeeks.includes(period)&&item.dae_person)getGradeMetrics(period,item.dae_person).strategies=Number(item.total)}
    for(const item of trendVisits){const period=dateValue(item.week_start);if(reportWeeks.includes(period)&&item.dae_person)getGradeMetrics(period,item.dae_person).visits=Number(item.total)}
    for(const report of weeklyReports){const period=dateValue(report.week_start);if(reportWeeks.includes(period)){const item=getGradeMetrics(period,report.dae_person);item.coordination=report.team_coordination??"";item.dailyReport=report.daily_report??""}}
    const weeklyGrades=new Map<string,{score:number;grade:string;value:number}>();
    const gradeValues:Record<string,number>={A:5,B:3,C:2,Buruk:1};
    for(const [period,people] of gradeMetrics){const list=[...people.values()],maxClients=Math.max(0,...list.map(item=>item.clients.size)),maxStrategies=Math.max(0,...list.map(item=>item.strategies)),maxVisits=Math.max(0,...list.map(item=>item.visits));for(const [name,item] of people){const score=Math.round((maxClients?30*item.clients.size/maxClients:0)+(maxStrategies?25*item.strategies/maxStrategies:0)+(maxVisits?20*item.visits/maxVisits:0)+(item.clients.size&&maxClients?15*item.clients.size/maxClients:0)+(item.coordination.trim()?7.5:0)+(item.dailyReport.trim()?2.5:0));const grade=score>=95?"A":score>=80?"B":score>=70?"C":"Buruk";weeklyGrades.set(`${name}\u0000${period}`,{score,grade,value:gradeValues[grade]})}}
    const preliminary=[...assignmentsByDae].map(([name,ids])=>({name,clients:ids.size,strategies:strategyMap.get(name)??0,visits:visitMap.get(name)??0,rank:1})).sort((a,b)=>b.clients-a.clients||b.strategies-a.strategies||b.visits-a.visits||a.name.localeCompare(b.name,"id"));
    const rows:DaeOverviewRow[]=preliminary.map(row=>{const rating=weeklyGrades.get(`${row.name}\u0000${activeWeek}`)??{score:0,grade:"Buruk",value:1};return{...row,rank:1+preliminary.filter(other=>other.clients>row.clients).length,score:rating.score,grade:rating.grade}});
    const selectedDae=rows.some(row=>row.name===query.dae)?query.dae:undefined;
    const weeklyData:Record<string,DaeWeeklyData>={};
    for(const week of reportWeeks)weeklyData[week]={clients:0,strategies:0,visits:0,achievement:0,coordination:"",dailyReport:"",grade:"",gradeValue:0};
    const clientsByWeek=new Map<string,Set<number>>();
    if(selectedDae)for(const period of reportWeeks)for(const assignment of trendAssignments){if(assignment.dae_person!==selectedDae)continue;const ids=clientsByWeek.get(period)??new Set<number>();readIds(assignment.agency_client_ids).filter(id=>existingClientIds.has(id)).forEach(id=>ids.add(id));clientsByWeek.set(period,ids)}
    if(selectedDae){
      for(const week of reportWeeks){const count=clientsByWeek.get(week)?.size??0;weeklyData[week].clients=count;weeklyData[week].achievement=count}
      for(const item of trendStrategies){const period=dateValue(item.week_start);if(item.dae_person===selectedDae&&weeklyData[period])weeklyData[period].strategies=Number(item.total)}
      for(const item of trendVisits){const period=dateValue(item.week_start);if(item.dae_person===selectedDae&&weeklyData[period])weeklyData[period].visits=Number(item.total)}
      for(const item of weeklyReports){const period=dateValue(item.week_start);if(item.dae_person===selectedDae&&weeklyData[period]){weeklyData[period].coordination=item.team_coordination??"";weeklyData[period].dailyReport=item.daily_report??""}}
      for(const period of reportWeeks){const rating=weeklyGrades.get(`${selectedDae}\u0000${period}`);if(rating){weeklyData[period].grade=rating.grade;weeklyData[period].gradeValue=rating.value}}
    }
    const gradedValues=selectedDae?reportWeeks.map(period=>weeklyData[period]?.gradeValue).filter((value):value is number=>Boolean(value)):[];
    const averageGrade=gradedValues.length?gradedValues.reduce((sum,value)=>sum+value,0)/gradedValues.length:undefined;
    const daeClients:DaeClientRow[]=[];
    const clientPairs=new Set<string>();
    for(const assignment of assignmentRows)for(const id of readIds(assignment.agency_client_ids)){const client=clientMap.get(id),pair=`${assignment.dae_person}\u0000${id}`;if(client&&!clientPairs.has(pair)){clientPairs.add(pair);daeClients.push({dae:assignment.dae_person,name:client.client_name,type:clientTypeLabels[client.client_type]??client.client_type})}}
    const visibleClients=selectedDae?daeClients.filter(client=>client.dae===selectedDae):daeClients;
    const sliceMap=new Map<string,number>();
    for(const client of visibleClients)sliceMap.set(client.type,(sliceMap.get(client.type)??0)+1);
    const palette=["#d2fb07","#8dbf45","#4ca88b","#c2d976","#7d876c","#d2aa58"];
    const slices:DaeTypeSlice[]=[...sliceMap].map(([label,count],index)=>({label,count,color:palette[index%palette.length]})).sort((a,b)=>b.count-a.count);
    const dateSets=new Map<string,Map<string,Set<number>>>();
    for(const week of reportWeeks)for(const assignment of trendAssignments){const people=dateSets.get(week)??new Map<string,Set<number>>(),ids=people.get(assignment.dae_person)??new Set<number>();readIds(assignment.agency_client_ids).forEach(id=>ids.add(id));people.set(assignment.dae_person,ids);dateSets.set(week,people)}
    const trendCount=(source:WeeklyCount[])=>{const map=new Map<string,number>();for(const item of source){if(selectedDae&&item.dae_person!==selectedDae)continue;const week=dateValue(item.week_start);map.set(week,(map.get(week)??0)+Number(item.total))}return map};
    const strategyTrend=trendCount(trendStrategies),visitTrend=trendCount(trendVisits);
    const trend:DaeTrendPoint[]=[...new Set([...dateSets.keys(),...strategyTrend.keys(),...visitTrend.keys()])].sort().slice(-8).map(week=>({week,clients:selectedDae?(dateSets.get(week)?.get(selectedDae)?.size??0):[...(dateSets.get(week)?.values()??[])].reduce((sum,ids)=>sum+ids.size,0),strategies:strategyTrend.get(week)??0,visits:visitTrend.get(week)??0}));
    return <div className="admin-page admin-theme-dashboard"><AdminNavigation active="kpi" teamActive="dae-overview"/><main className="admin-main admin-section-main"><AdminTopbar section="Tim" page="Overview DAE"/><div className="admin-shell team-kpi-shell dae-kpi-shell"><section className="admin-heading"><div><span className="eyebrow">WORKSPACE / DAE</span><h1>Overview DAE</h1><p>Pantau kepemilikan client dan aktivitas tim berdasarkan periode mingguan.</p></div><div className="team-kpi-tabs"><Link href="/admin/kpi?scope=dm">DM</Link><Link className="active" href="/admin/kpi?scope=dae">DAE</Link></div></section><DaeKpiOverview week={activeWeek} weeks={weeks} rows={rows} clients={visibleClients} trend={trend} slices={slices} selectedDae={selectedDae} periodWeeks={periodWeeks} weeklyData={weeklyData} averageGrade={averageGrade} roundedGrade={averageGrade===undefined?undefined:Math.round(averageGrade)} gradedWeeks={gradedValues.length}/></div></main></div>;
  }
  if (scope === "dm") {
    const [dmEntries] = await db.execute<DmEntry[]>("SELECT COALESCE(e.dm_team_member_id,e.assigned_user_id) AS dm_id,COALESCE(m.full_name,e.dm_person,u.full_name) AS dm_name,e.client_name,e.client_type,e.activity_date,e.contents,e.video_views,e.tiktok_sales,e.shopee_sales FROM team_activity_entries e LEFT JOIN dm_team_members m ON m.id=e.dm_team_member_id LEFT JOIN users u ON u.id=e.assigned_user_id WHERE e.scope='dm' AND e.entry_type='dm_client' AND e.activity_date>=? AND e.activity_date<DATE_ADD(?,INTERVAL 1 MONTH) ORDER BY e.activity_date,e.id", [`${month}-01`, `${month}-01`]);
    const map = new Map<string,DmOverviewRow>();
    const ensure = (id:number|null,name:string) => { const key = name || "Belum ditentukan"; let row = map.get(key); if (!row) { row={id,name:key,clients:0,contents:0,videoViews:0,tiktokSales:0,shopeeSales:0,score:0}; map.set(key,row); } return row; };
    for (const entry of dmEntries) { const row=ensure(entry.dm_id,entry.dm_name??"Belum ditentukan"); row.clients += entry.client_name ? 1 : 0; row.contents += Number(entry.contents); row.videoViews += Number(entry.video_views); row.tiktokSales += Number(entry.tiktok_sales); row.shopeeSales += Number(entry.shopee_sales); }
    const rows=[...map.values()];
    const max={contents:Math.max(1,...rows.map(row=>row.contents)),videoViews:Math.max(1,...rows.map(row=>row.videoViews)),tiktokSales:Math.max(1,...rows.map(row=>row.tiktokSales)),shopeeSales:Math.max(1,...rows.map(row=>row.shopeeSales))};
    for(const row of rows)row.score=Math.round((row.contents/max.contents+row.videoViews/max.videoViews+row.tiktokSales/max.tiktokSales+row.shopeeSales/max.shopeeSales)*25);
    rows.sort((a,b)=>b.score-a.score||b.videoViews-a.videoViews||a.name.localeCompare(b.name,"id"));
    const selectedDm=rows.some(row=>row.name===query.dm)?query.dm:undefined;
    const periods=Array.from({length:5},(_,index)=>getMonthWeekStart(month,index+1));
    const weeklyMonth=/^\d{4}-(0[1-9]|1[0-2])$/.test(query.weeklyMonth??"")?query.weeklyMonth!:month;
    const weeklyPeriods=Array.from({length:5},(_,index)=>getMonthWeekStart(weeklyMonth,index+1));
    const weeklyEntries=weeklyMonth===month?dmEntries:(await db.execute<DmEntry[]>("SELECT COALESCE(e.dm_team_member_id,e.assigned_user_id) AS dm_id,COALESCE(m.full_name,e.dm_person,u.full_name) AS dm_name,e.client_name,e.client_type,e.activity_date,e.contents,e.video_views,e.tiktok_sales,e.shopee_sales FROM team_activity_entries e LEFT JOIN dm_team_members m ON m.id=e.dm_team_member_id LEFT JOIN users u ON u.id=e.assigned_user_id WHERE e.scope='dm' AND e.entry_type='dm_client' AND e.activity_date>=? AND e.activity_date<DATE_ADD(?,INTERVAL 1 MONTH) ORDER BY e.activity_date,e.id", [`${weeklyMonth}-01`, `${weeklyMonth}-01`]))[0];
    const trendMap=new Map<string,DmTrendPoint>();
    const setPoint=(date:string,name:string)=>{const key=`${date}\u0000${name}`;let point=trendMap.get(key);if(!point){point={week:date,dm:name,contents:0,videoViews:0,sales:0};trendMap.set(key,point)}return point};
    const periodForMonthDate=(date:string|Date,monthKey:string,monthPeriods:(string|null)[])=>{const day=dateValue(date);if(day.slice(0,7)!==monthKey)return null;const starts=monthPeriods.filter((period):period is string=>Boolean(period));return [...starts].reverse().find(start=>start<=day)??starts[0]??null};
    for(const entry of dmEntries){const date=dateValue(entry.activity_date),name=entry.dm_name??"Belum ditentukan";for(const bucket of [setPoint(date,name),setPoint(date,"__all__")]){bucket.contents+=Number(entry.contents);bucket.videoViews+=Number(entry.video_views);bucket.sales+=Number(entry.tiktok_sales)+Number(entry.shopee_sales)}}
    const trends=[...trendMap.values()].sort((a,b)=>a.week.localeCompare(b.week));
    type ClientPerformance={dm:string;name:string;type:string;contents:number;videoViews:number;tiktokSales:number;shopeeSales:number;weeks:Record<string,ClientWeek>};
    type ClientWeek={contents:number;videoViews:number;tiktokSales:number;shopeeSales:number};
    const performanceMap=new Map<string,ClientPerformance>();
    const clientWeekly=new Map<string,Record<string,ClientWeek>>();
    for(const entry of dmEntries){const name=entry.dm_name??"Belum ditentukan";if(selectedDm&&name!==selectedDm)continue;
      if(entry.client_name){
        const type=clientTypeLabels[entry.client_type??""]??entry.client_type??"Belum diklasifikasi",key=`${name}\u0000${entry.client_name}\u0000${type}`;
        const total=performanceMap.get(key)??{dm:name,name:entry.client_name,type,contents:0,videoViews:0,tiktokSales:0,shopeeSales:0,weeks:{}};
        total.contents+=Number(entry.contents);total.videoViews+=Number(entry.video_views);total.tiktokSales+=Number(entry.tiktok_sales);total.shopeeSales+=Number(entry.shopee_sales);performanceMap.set(key,total);
        const week=periodForMonthDate(entry.activity_date,month,periods);
        if(week){const byWeek=clientWeekly.get(key)??{};const value=byWeek[week]??{contents:0,videoViews:0,tiktokSales:0,shopeeSales:0};value.contents+=Number(entry.contents);value.videoViews+=Number(entry.video_views);value.tiktokSales+=Number(entry.tiktok_sales);value.shopeeSales+=Number(entry.shopee_sales);byWeek[week]=value;clientWeekly.set(key,byWeek);total.weeks=byWeek}
      }
    }
    const performanceRows=[...performanceMap.values()].sort((a,b)=>b.videoViews-a.videoViews||a.name.localeCompare(b.name,"id"));
    const weeklyDm=new Map<string,Record<string,ClientWeek>>();
    for(const entry of weeklyEntries){const name=entry.dm_name??"Belum ditentukan";if(selectedDm&&name!==selectedDm)continue;const week=periodForMonthDate(entry.activity_date,weeklyMonth,weeklyPeriods);if(!week)continue;const byWeek=weeklyDm.get(name)??{};const value=byWeek[week]??{contents:0,videoViews:0,tiktokSales:0,shopeeSales:0};value.contents+=Number(entry.contents);value.videoViews+=Number(entry.video_views);value.tiktokSales+=Number(entry.tiktok_sales);value.shopeeSales+=Number(entry.shopee_sales);byWeek[week]=value;weeklyDm.set(name,byWeek)}
    const weeklyDmRows:DmWeeklyRow[]=[...weeklyDm].map(([name,weeks])=>({name,weeks})).sort((a,b)=>a.name.localeCompare(b.name,"id"));
    return <div className="admin-page admin-theme-dashboard"><AdminNavigation active="kpi" teamActive="dm-overview"/><main className="admin-main admin-section-main"><AdminTopbar section="Tim" page="Overview DM"/><div className="admin-shell team-kpi-shell dae-kpi-shell"><section className="admin-heading"><div><span className="eyebrow">WORKSPACE / DM</span><h1>Overview DM</h1><p>Pantau performa konten, views video, dan omset tim DM.</p></div><div className="team-kpi-tabs"><Link className="active" href="/admin/kpi?scope=dm">DM</Link><Link href="/admin/kpi?scope=dae">DAE</Link></div></section><DmKpiOverview month={month} weeklyMonth={weeklyMonth} rows={rows} trends={trends} selectedDm={selectedDm} periods={periods} weeklyPeriods={weeklyPeriods} performanceRows={performanceRows} weeklyDmRows={weeklyDmRows}/></div></main></div>;
  }
  const outputScope: string = scope;
  return <div className="admin-page admin-theme-dashboard"><AdminNavigation active="kpi" teamActive={outputScope==="dm"?"dm-overview":"dae-overview"}/><main className="admin-main admin-section-main"><AdminTopbar section="Tim" page="KPI & aktivitas"/><div className="admin-shell team-kpi-shell">
    <section className="admin-heading"><div><span className="eyebrow">WORKSPACE / {outputScope.toUpperCase()}</span><h1>KPI {outputScope.toUpperCase()}</h1><p>Pantau target dan masukkan aktivitas tim untuk {dateText}.</p></div><div className="team-kpi-tabs"><Link className={outputScope==="dm"?"active":""} href="/admin/kpi?scope=dm">DM</Link><Link className={outputScope==="dae"?"active":""} href="/admin/kpi?scope=dae">DAE</Link></div></section>
    {query.saved&&<div className="admin-success">Target KPI berhasil disimpan.</div>}{query.error&&<div className="admin-error">Data belum valid. Periksa kembali target dan periode.</div>}
    <div className="team-kpi-grid">{metrics.map(metric=>{const actual=metricValue(metric),target=targets.get(metric)??0,percent=target?Math.min(100,Math.round(actual/target*100)):0;return <article className="team-kpi-card" key={metric}><span>{labels[metric]}</span><strong>{format(actual,metric)}</strong><div className="team-kpi-track"><i style={{width:`${percent}%`}}/></div><small>{target?`${percent}% dari target ${format(target,metric)}`:"Target belum diatur untuk bulan ini"}</small></article>})}</div>
    {((outputScope==="dm"&&canDM)||(outputScope==="dae"&&canDAE))?<section className="analytics-panel team-kpi-target-panel"><div className="analytics-panel-heading"><div><h2>Atur target KPI {outputScope.toUpperCase()}</h2><p>Target berlaku untuk satu bulan dan bisa diperbarui kapan saja.</p></div></div><form action={saveKpiTarget} className="team-kpi-target-form"><input type="hidden" name="scope" value={outputScope}/><label>Indikator<select name="metric">{metrics.map(metric=><option key={metric} value={metric}>{labels[metric]}</option>)}</select></label><label>Bulan<input type="month" name="period_month" defaultValue={month} required/></label><label>Target<input type="number" name="target_value" min="0" step="1" required placeholder="0"/></label><button className="button">Simpan target <span>↗</span></button></form></section>:<section className="analytics-panel team-kpi-target-panel"><div className="analytics-panel-heading"><div><h2>Target KPI {outputScope.toUpperCase()}</h2><p>Mode lihat saja. Pengaturan target tersedia untuk admin lingkup {outputScope.toUpperCase()}.</p></div></div><ul className="team-kpi-target-list">{metrics.map(metric=><li key={metric}><span>{labels[metric]}</span><b>{targets.has(metric)?format(targets.get(metric)!,metric):"Belum diatur"}</b></li>)}</ul></section>}
    <section className="analytics-panel team-kpi-entries"><div className="analytics-panel-heading"><div><h2>Aktivitas {outputScope.toUpperCase()}</h2><p>Catatan terbaru yang masuk ke dashboard tim.</p></div>{((outputScope==="dm"&&canDM)||(outputScope==="dae"&&(canDAE||canDM)))&&<Link className="button" href={base}>＋ Input data</Link>}</div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Tanggal</th><th>Aktivitas</th><th>Penanggung jawab</th><th>Client</th><th>Ringkasan</th><th>Aksi</th></tr></thead><tbody>{entries.map(entry=>{const canEdit=(entry.scope==="dm"&&canDM)||(entry.scope==="dae"&&(canDAE||(["dae_team","dae_strategy","dae_visit"].includes(entry.entry_type)&&canDM)));return <tr key={entry.id}><td>{new Date(entry.activity_date).toLocaleDateString("id-ID")}</td><td><b>{typeLabels[entry.entry_type]??entry.title}</b><small>{entry.title}</small></td><td>{entry.dae_person??entry.full_name??"Belum ditentukan"}</td><td>{entry.client_name??"—"}{entry.client_type&&<small>{clientTypeLabels[entry.client_type]??entry.client_type}</small>}</td><td>{metrics.slice(0,2).map(metric=>`${labels[metric]} ${format(entry[metric as keyof Entry] as number|string,metric)}`).join(" · ")}</td><td>{canEdit?<div className="table-actions"><Link href={`/admin/kpi/input/${entry.entry_type}?id=${entry.id}`}>Edit</Link><form action={deleteTeamEntry}><input type="hidden" name="id" value={entry.id}/><input type="hidden" name="entry_type" value={entry.entry_type}/><button className="table-delete">Hapus</button></form></div>:"—"}</td></tr>})}{!entries.length&&<tr><td colSpan={6} className="empty-state">Belum ada catatan. Tambahkan aktivitas pertama untuk mulai mengukur KPI.</td></tr>}</tbody></table></div></section>
    <p className="admin-footnote">Angka KPI berasal dari input manual tim. Pastikan laporan sudah diverifikasi sebelum digunakan ke client.</p>
  </div></main></div>;
}
