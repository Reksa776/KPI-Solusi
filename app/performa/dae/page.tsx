import type { Metadata } from "next";
import type { RowDataPacket } from "@/lib/db-types";
import { getDb } from "@/lib/db";
import { getMonthWeekStart, monthWeekFromStart, monthWeekStartForDate } from "@/lib/dae-weeks";
import { isExistingAgencyClientType } from "@/lib/client-types";
import PublicPerformanceShell from "@/components/public-performance-shell";
import DaeKpiOverview, { type DaeClientRow, type DaeOverviewRow, type DaeTrendPoint, type DaeTypeSlice, type DaeWeeklyData } from "@/components/dae-kpi-overview";

export const metadata:Metadata={title:"Overview DAE | Solusi Sejalan",description:"Performa mingguan tim Digital Account Executive."};
type Query={week?:string;dae?:string};
type Client=RowDataPacket&{id:number;client_name:string;client_type:string};
type Assignment=RowDataPacket&{dae_person:string;week_start:string|Date;agency_client_ids:unknown};
type WeeklyCount=RowDataPacket&{dae_person?:string;week_start:string|Date;total:number};
type DaeReport=RowDataPacket&{dae_person:string;week_start:string|Date;team_coordination:string|null;daily_report:string|null};
const clientTypeLabels:Record<string,string>={existing:"Client Existing",prospect:"Calon Client",ex_client:"Ex Client",community:"Community",media:"Media",institution:"Instansi",agency_ph:"Agency / PH",etc:"Etc."};
const dateValue=(value:string|Date)=>typeof value==="string"?value.slice(0,10):new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(value);
function readIds(value:unknown):number[]{try{const source=value instanceof Uint8Array?new TextDecoder().decode(value):value;const parsed=typeof source==="string"?JSON.parse(source):source;return Array.isArray(parsed)?[...new Set(parsed.map(Number).filter(id=>Number.isSafeInteger(id)&&id>0))]:[]}catch{return[]}}

export default async function PublicDaePerformancePage({searchParams}:{searchParams:Promise<Query>}){
  const query=await searchParams,db=getDb();
  const [[weekRows],[clientRows]] = await Promise.all([
      db.execute<(RowDataPacket & {week_start:string|Date})[]>("SELECT DISTINCT week_start FROM (SELECT week_start FROM dae_strategy_details UNION SELECT week_start FROM dae_visit_details UNION SELECT week_start FROM dae_weekly_reports) periods ORDER BY week_start DESC LIMIT 26"),
      db.execute<Client[]>("SELECT id,client_name,client_type FROM agency_clients ORDER BY client_name")
    ]);
    const currentMonth=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit"}).format(new Date());
    const currentDate=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    const currentPeriods=Array.from({length:5},(_,index)=>getMonthWeekStart(currentMonth,index+1)).filter((value):value is string=>Boolean(value));
    const weeks=[...new Set([...weekRows.map(row=>dateValue(row.week_start)),...currentPeriods])].sort().reverse().slice(0,26);
    const requestedMonth=query.week?.slice(0,7)??currentMonth;
    const requestedPeriods=Array.from({length:5},(_,index)=>getMonthWeekStart(requestedMonth,index+1)).filter((value):value is string=>Boolean(value));
    const activeWeek=query.week&&requestedPeriods.includes(query.week)?query.week:monthWeekStartForDate(currentDate)??requestedPeriods[0]??"";
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
  return <PublicPerformanceShell active="dae" eyebrow={`Overview DAE · ${activeWeek}`} title="Overview DAE" description="Pantau kepemilikan client, strategi, kunjungan, dan grade tim DAE."><div className="dae-kpi-shell public-scope-overview"><DaeKpiOverview publicMode week={activeWeek} weeks={weeks} rows={rows} clients={visibleClients} trend={trend} slices={slices} selectedDae={selectedDae} periodWeeks={periodWeeks} weeklyData={weeklyData} averageGrade={averageGrade}/></div></PublicPerformanceShell>;
}
