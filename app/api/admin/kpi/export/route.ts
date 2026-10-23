import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "@/lib/db-types";
import { getDb } from "@/lib/db";
import { verifyAdminScope } from "@/lib/admin-auth";
import { isExistingAgencyClientType } from "@/lib/client-types";
import { monthWeekStartForDate } from "@/lib/dae-weeks";
import { buildXlsx, type ExcelCell, type ExcelSheet } from "@/lib/xlsx-export";

export const runtime = "nodejs";
type DmRecord = RowDataPacket & { dm_name:string|null;client_name:string|null;client_type:string|null;activity_date:string|Date;week_start:string|Date;input_frequency:string;contents:number|string;video_views:number|string;tiktok_sales:number|string;shopee_sales:number|string };
type DmMember = RowDataPacket & { full_name:string };
type DmAssignment = RowDataPacket & { dm_name:string;client_name:string;client_type:string;contact_name:string|null;email:string|null;phone:string|null;notes:string|null;assigned_at:string|Date };
type Strategy = RowDataPacket & { dae_person:string;week_start:string|Date;strategy_text:string;client_name:string };
type Visit = RowDataPacket & { dae_person:string;week_start:string|Date;visit_count:number|string;client_name:string };
type Report = RowDataPacket & { dae_person:string;week_start:string|Date;client_retention_count:number|string;strategy_idea_count:number|string;visit_count:number|string;achievement_client_count:number|string;achievement_rank:number|string;team_coordination:string|null;daily_report:string|null };
type Assignment = RowDataPacket & { dae_person:string;agency_client_ids:unknown };
type Client = RowDataPacket & { id:number|string|bigint;client_name:string;client_type:string };
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(new Date(`${value}T00:00:00Z`).valueOf())&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
const day=(value:string|Date)=>typeof value==="string"?value.slice(0,10):new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(value);
const numeric=(value:unknown)=>Number(value??0);
function ids(value:unknown):number[]{try{const source=value instanceof Uint8Array?new TextDecoder().decode(value):value,parsed=typeof source==="string"?JSON.parse(source):source;return Array.isArray(parsed)?[...new Set(parsed.map(Number).filter(id=>Number.isSafeInteger(id)&&id>0))]:[]}catch{return[]}}
function gradeDae(score:number){return score>=95?"A":score>=80?"B":score>=70?"C":"Buruk"}
function reportTable(rows:ExcelCell[][],title:string,range:string):ExcelCell[][]{return [[title], ["Rentang tanggal",range], [], ...rows]}

export async function GET(request:NextRequest){
  const params=request.nextUrl.searchParams,scope=params.get("scope"),all=params.get("all")==="1",start=all?"1000-01-01":params.get("start")??"",end=params.get("end")??"";
  if((scope!=="dm"&&scope!=="dae")||!(await verifyAdminScope(scope)))return NextResponse.json({error:"Sesi tidak memiliki akses untuk export ini."},{status:401});
  if((!all&&!validDate(start))||!validDate(end)||start>end)return NextResponse.json({error:"Rentang tanggal tidak valid."},{status:400});
  const db=getDb(),range=all?`Semua data sampai ${end}`:`${start} — ${end}`,startWeek=monthWeekStartForDate(start)??start,endWeek=monthWeekStartForDate(end)??end;let sheets:ExcelSheet[];
  if(scope==="dm"){
    const [[records],[members],[assignments]] = await Promise.all([
      db.execute<DmRecord[]>("SELECT COALESCE(m.full_name,e.dm_person,u.full_name,'Belum ditentukan') AS dm_name,e.client_name,e.client_type,e.activity_date,e.week_start,e.input_frequency,e.contents,e.video_views,e.tiktok_sales,e.shopee_sales FROM team_activity_entries e LEFT JOIN dm_team_members m ON m.id=e.dm_team_member_id LEFT JOIN users u ON u.id=e.assigned_user_id WHERE e.scope='dm' AND e.entry_type='dm_client' AND ((e.input_frequency='daily' AND e.activity_date>=? AND e.activity_date<=?) OR (e.input_frequency='weekly' AND e.week_start>=? AND e.week_start<=?)) ORDER BY e.activity_date,e.dm_person,e.client_name,e.id",[start,end,startWeek,endWeek]),
      db.execute<DmMember[]>("SELECT full_name FROM dm_team_members ORDER BY full_name"),
      db.execute<DmAssignment[]>("SELECT m.full_name AS dm_name,c.client_name,c.client_type,c.contact_name,c.email,c.phone,c.notes,a.created_at AS assigned_at FROM dm_client_assignments a JOIN dm_team_members m ON m.id=a.dm_team_member_id JOIN agency_clients c ON c.id=a.agency_client_id ORDER BY m.full_name,c.client_name"),
    ]);
    const summary=new Map<string,{entries:number;contents:number;views:number;tiktok:number;shopee:number;clients:Set<string>}>();
    for(const member of members)summary.set(member.full_name,{entries:0,contents:0,views:0,tiktok:0,shopee:0,clients:new Set<string>()});
    const assignedPerformance=new Map<string,{entries:number;contents:number;views:number;tiktok:number;shopee:number}>();
    for(const assignment of assignments){const item=summary.get(assignment.dm_name)??{entries:0,contents:0,views:0,tiktok:0,shopee:0,clients:new Set<string>()};item.clients.add(assignment.client_name);summary.set(assignment.dm_name,item)}
    for(const row of records){const name=row.dm_name??"Belum ditentukan",item=summary.get(name)??{entries:0,contents:0,views:0,tiktok:0,shopee:0,clients:new Set<string>()};item.entries++;item.contents+=numeric(row.contents);item.views+=numeric(row.video_views);item.tiktok+=numeric(row.tiktok_sales);item.shopee+=numeric(row.shopee_sales);summary.set(name,item);if(row.client_name){const key=`${name}\u0000${row.client_name}`,clientTotals=assignedPerformance.get(key)??{entries:0,contents:0,views:0,tiktok:0,shopee:0};clientTotals.entries++;clientTotals.contents+=numeric(row.contents);clientTotals.views+=numeric(row.video_views);clientTotals.tiktok+=numeric(row.tiktok_sales);clientTotals.shopee+=numeric(row.shopee_sales);assignedPerformance.set(key,clientTotals)}}
    const people=[...summary.entries()],max={contents:Math.max(1,...people.map(([,v])=>v.contents)),views:Math.max(1,...people.map(([,v])=>v.views)),sales:Math.max(1,...people.map(([,v])=>v.tiktok+v.shopee))};
    const summaryRows:ExcelCell[][]=[["Nama DM","Jumlah client dipegang","Jumlah laporan","Konten","Views TikTok","Omzet TikTok (Rp)","Omzet Shopee (Rp)","Omzet gabungan (Rp)","Skor weighted (%)","Grade"]];
    for(const [name,value] of people.sort((a,b)=>b[1].contents-a[1].contents)){const score=value.entries?50*value.contents/max.contents+30*value.views/max.views+20*(value.tiktok+value.shopee)/max.sales:0,grade=value.entries?(score>=88?"A":score>=77?"B":score>=70.5?"C":"Buruk"):"";summaryRows.push([name,value.clients.size,value.entries,value.contents,value.views,value.tiktok,value.shopee,value.tiktok+value.shopee,value.entries?Number(score.toFixed(1)):"",grade])}
    const portfolioRows:ExcelCell[][]=[["Nama DM","Nama client","Jenis client","Nama kontak","Email","Telepon","Catatan client","Tanggal penugasan","Jumlah laporan pada rentang","Konten","Views TikTok","Omzet TikTok (Rp)","Omzet Shopee (Rp)","Sumber"]];
    for(const assignment of assignments){const metrics=assignedPerformance.get(`${assignment.dm_name}\u0000${assignment.client_name}`);portfolioRows.push([assignment.dm_name,assignment.client_name,assignment.client_type,assignment.contact_name,assignment.email,assignment.phone,assignment.notes,day(assignment.assigned_at),metrics?.entries??0,metrics?.contents??0,metrics?.views??0,metrics?.tiktok??0,metrics?.shopee??0,"Client yang dipegang saat ini"])}
    const detailRows:ExcelCell[][]=[["Tanggal","Minggu mulai","Frekuensi","Nama DM","Nama client","Jenis client","Konten","Views TikTok","Omzet TikTok (Rp)","Omzet Shopee (Rp)"]];
    for(const row of records)detailRows.push([day(row.activity_date),day(row.week_start),row.input_frequency,row.dm_name,row.client_name,row.client_type,numeric(row.contents),numeric(row.video_views),numeric(row.tiktok_sales),numeric(row.shopee_sales)]);
    const dmRosterRows:ExcelCell[][]=[["Nama DM","Jumlah client dipegang","Jumlah laporan pada rentang","Konten","Views TikTok","Omzet TikTok (Rp)","Omzet Shopee (Rp)"]];
    for(const [name,value] of [...summary.entries()].sort((a,b)=>a[0].localeCompare(b[0],"id"))){dmRosterRows.push([name,value.clients.size,value.entries,value.contents,value.views,value.tiktok,value.shopee])}
    sheets=[{name:"Ringkasan DM",rows:reportTable(summaryRows,"Ringkasan Performa DM",range)},{name:"Daftar Tim DM",rows:reportTable(dmRosterRows,"Daftar Tim DM dan KPI Periode",range)},{name:"Client dipegang DM",rows:reportTable(portfolioRows,"Seluruh Client yang Dipegang Tim DM",`Daftar client terkini; performa mengikuti ${range}`)},{name:"Detail Laporan DM",rows:reportTable(detailRows,"Detail Laporan DM",range)}];
  }else{
    const [[clientRows],[assignments],[strategies],[visits],[reports]]=await Promise.all([
      db.execute<Client[]>("SELECT id,client_name,client_type FROM agency_clients ORDER BY client_name"),
      db.execute<Assignment[]>("SELECT e.dae_person,e.agency_client_ids FROM team_activity_entries e WHERE e.entry_type='dae_team' AND e.dae_person IS NOT NULL AND TRIM(e.dae_person)<>'' AND e.id=(SELECT latest.id FROM team_activity_entries latest WHERE latest.entry_type='dae_team' AND latest.dae_person=e.dae_person ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1) ORDER BY e.dae_person"),
      db.execute<Strategy[]>("SELECT s.dae_person,s.week_start,s.strategy_text,c.client_name FROM dae_strategy_details s JOIN agency_clients c ON c.id=s.agency_client_id WHERE s.week_start>=? AND s.week_start<=? ORDER BY s.week_start,s.dae_person,c.client_name",[startWeek,endWeek]),
      db.execute<Visit[]>("SELECT v.dae_person,v.week_start,v.visit_count,c.client_name FROM dae_visit_details v JOIN agency_clients c ON c.id=v.agency_client_id WHERE v.week_start>=? AND v.week_start<=? ORDER BY v.week_start,v.dae_person,c.client_name",[startWeek,endWeek]),
      db.execute<Report[]>("SELECT dae_person,week_start,client_retention_count,strategy_idea_count,visit_count,achievement_client_count,achievement_rank,team_coordination,daily_report FROM dae_weekly_reports WHERE week_start>=? AND week_start<=? ORDER BY week_start,dae_person",[startWeek,endWeek]),
    ]);
    const clientsById=new Map(clientRows.map(client=>[Number(client.id),client]));
    const roster=assignments.flatMap(person=>ids(person.agency_client_ids).map(id=>{const client=clientsById.get(id);return client?{dae:person.dae_person,client}:null}).filter((value):value is {dae:string;client:Client}=>Boolean(value)));
    type WeeklyMetrics={clients:Set<number>;strategies:number;visits:number;coordination:string;dailyReport:string};
    const weekMetrics=new Map<string,Map<string,WeeklyMetrics>>();
    const metricAt=(week:string,name:string)=>{const team=weekMetrics.get(week)??new Map<string,WeeklyMetrics>(),value=team.get(name)??{clients:new Set<number>(),strategies:0,visits:0,coordination:"",dailyReport:""};team.set(name,value);weekMetrics.set(week,team);return value};
    const weeks=[...new Set([...strategies.map(r=>day(r.week_start)),...visits.map(r=>day(r.week_start)),...reports.map(r=>day(r.week_start))])];
    const existingIds=new Set(clientRows.filter(c=>isExistingAgencyClientType(c.client_type)).map(c=>Number(c.id)));
    for(const week of weeks)for(const person of assignments){const metrics=metricAt(week,person.dae_person);for(const id of ids(person.agency_client_ids))if(existingIds.has(id))metrics.clients.add(id)}
    for(const row of strategies)metricAt(day(row.week_start),row.dae_person).strategies++;
    for(const row of visits){const metrics=metricAt(day(row.week_start),row.dae_person);metrics.visits+=numeric(row.visit_count)}
    for(const row of reports){const metrics=metricAt(day(row.week_start),row.dae_person);metrics.coordination=row.team_coordination??"";metrics.dailyReport=row.daily_report??""}
    const gradePoints:Record<string,number>={A:5,B:3,C:2,Buruk:1},gradedByName=new Map<string,Array<{week:string;grade:string;points:number}>>();
    for(const [week,people] of weekMetrics){const values=[...people.values()],max={clients:Math.max(0,...values.map(v=>v.clients.size)),strategies:Math.max(0,...values.map(v=>v.strategies)),visits:Math.max(0,...values.map(v=>v.visits))};for(const [name,value] of people){const score=Math.round((max.clients?30*value.clients.size/max.clients:0)+(max.strategies?25*value.strategies/max.strategies:0)+(max.visits?20*value.visits/max.visits:0)+(value.clients.size&&max.clients?15*value.clients.size/max.clients:0)+(value.coordination.trim()?7.5:0)+(value.dailyReport.trim()?2.5:0)),grade=gradeDae(score),points=gradedByName.get(name)??[];points.push({week,grade,points:gradePoints[grade]});gradedByName.set(name,points)}}
    const summary=new Map<string,{clients:Set<number>;strategies:number;visits:number;retention:number;achievement:number}>();
    const ensure=(name:string)=>{const item=summary.get(name)??{clients:new Set<number>(),strategies:0,visits:0,retention:0,achievement:0};summary.set(name,item);return item};
    for(const person of assignments){const item=ensure(person.dae_person);for(const id of ids(person.agency_client_ids))if(existingIds.has(id))item.clients.add(id)}
    for(const row of strategies)ensure(row.dae_person).strategies++;
    for(const row of visits)ensure(row.dae_person).visits+=numeric(row.visit_count);
    for(const row of reports){const item=ensure(row.dae_person);item.retention+=numeric(row.client_retention_count);item.achievement+=numeric(row.achievement_client_count)}
    const summaryRows:ExcelCell[][]=[["Nama DAE","Client Existing saat ini","Strategi pada periode","Kunjungan pada periode","Retensi laporan","Pencapaian laporan","Rata-rata nilai grade","Grade per minggu"]];
    for(const [name,item] of [...summary.entries()].sort((a,b)=>a[0].localeCompare(b[0],"id"))){const grades=gradedByName.get(name)??[],average=grades.length?grades.reduce((sum,value)=>sum+value.points,0)/grades.length:null,gradeText=grades.sort((a,b)=>a.week.localeCompare(b.week)).map(value=>`${value.week}: ${value.grade}`).join("; ");summaryRows.push([name,item.clients.size,item.strategies,item.visits,item.retention,item.achievement,average===null?"":Number(average.toFixed(2)),gradeText])}
    const rosterRows:ExcelCell[][]=[["Nama DAE","Nama client","Jenis client","Basis data"]];for(const row of roster)rosterRows.push([row.dae,row.client.client_name,row.client.client_type,"Penugasan tim terkini"]);
    const strategyRows:ExcelCell[][]=[["Minggu mulai","Nama DAE","Nama client","Strategi"]];for(const row of strategies)strategyRows.push([day(row.week_start),row.dae_person,row.client_name,row.strategy_text]);
    const visitRows:ExcelCell[][]=[["Minggu mulai","Nama DAE","Nama client","Jumlah kunjungan"]];for(const row of visits)visitRows.push([day(row.week_start),row.dae_person,row.client_name,numeric(row.visit_count)]);
    const reportRows:ExcelCell[][]=[["Minggu mulai","Nama DAE","Retensi client","Strategi ide bisnis","Kunjungan","Pencapaian client","Peringkat pencapaian","Koordinasi & komunikasi","Laporan harian"]];for(const row of reports)reportRows.push([day(row.week_start),row.dae_person,numeric(row.client_retention_count),numeric(row.strategy_idea_count),numeric(row.visit_count),numeric(row.achievement_client_count),numeric(row.achievement_rank),row.team_coordination,row.daily_report]);
    sheets=[{name:"Ringkasan DAE",rows:reportTable(summaryRows,"Ringkasan Performa DAE",range)},{name:"Tim DAE terkini",rows:reportTable(rosterRows,"Penugasan Client DAE Terkini","Tidak dibatasi rentang laporan")},{name:"Strategi DAE",rows:reportTable(strategyRows,"Detail Strategi DAE",range)},{name:"Kunjungan DAE",rows:reportTable(visitRows,"Detail Kunjungan DAE",range)},{name:"Laporan Mingguan DAE",rows:reportTable(reportRows,"Laporan Mingguan DAE",range)}];
  }
  const bytes=buildXlsx(sheets),filename=all?`solusi-sejalan-${scope}-semua-data-sampai-${end}.xlsx`:`solusi-sejalan-${scope}-${start}-sampai-${end}.xlsx`;
  return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="${filename}"`,"Cache-Control":"private, no-store"}});
}
