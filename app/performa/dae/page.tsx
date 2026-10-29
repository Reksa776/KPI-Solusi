import type { Metadata } from "next";
import type { RowDataPacket } from "@/lib/db-types";
import { getDb } from "@/lib/db";
import { getMonthWeekStart, monthWeekFromStart, monthWeekStartForDate } from "@/lib/dae-weeks";
import { isExistingAgencyClientType } from "@/lib/client-types";
import { daeGrade, daeIndicatorScore } from "@/lib/dae-grade";
import { monthlyCumulativeStrategyCount } from "@/lib/dae-strategies";
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
    const weeks=[...new Set([...weekRows.map(row=>{const value=dateValue(row.week_start);return monthWeekStartForDate(value)??value}),...currentPeriods])].sort().reverse().slice(0,26);
    const requestedMonth=query.week?.slice(0,7)??currentMonth;
    const requestedPeriods=Array.from({length:5},(_,index)=>getMonthWeekStart(requestedMonth,index+1)).filter((value):value is string=>Boolean(value));
    const activeWeek=query.week&&requestedPeriods.includes(query.week)?query.week:monthWeekStartForDate(currentDate)??requestedPeriods[0]??"";
    const periodWeeks=Array.from({length:5},(_,index)=>getMonthWeekStart(activeWeek.slice(0,7),index+1)??"");
    const reportWeeks=periodWeeks.filter(Boolean);
    const trendPeriods=[...weeks].sort().filter(period=>period<=activeWeek).slice(-8);
    const reportQuery=reportWeeks.length?db.execute<DaeReport[]>(`SELECT dae_person,week_start,team_coordination,daily_report FROM dae_weekly_reports WHERE week_start IN (${reportWeeks.map(()=>"?").join(",")})`,reportWeeks):Promise.resolve([[] as DaeReport[],[]] as const);
    const [[assignmentRows],[strategyWeekRows],[visitWeekRows],[trendAssignments],[trendStrategies],[trendVisits],[weeklyReports]] = await Promise.all([
      db.execute<Assignment[]>("SELECT e.dae_person,e.week_start,e.agency_client_ids FROM team_activity_entries e WHERE e.entry_type='dae_team' AND e.dae_person IS NOT NULL AND TRIM(e.dae_person)<>'' AND e.id=(SELECT latest.id FROM team_activity_entries latest WHERE latest.entry_type='dae_team' AND latest.dae_person=e.dae_person ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1) ORDER BY e.dae_person"),
      activeWeek?db.execute<WeeklyCount[]>("SELECT dae_person,week_start,COUNT(*) AS total FROM dae_strategy_details WHERE week_start>=? AND week_start<=? GROUP BY dae_person,week_start",[`${activeWeek.slice(0,7)}-01`,activeWeek]):Promise.resolve([[] as WeeklyCount[],[]] as const),
      activeWeek?db.execute<WeeklyCount[]>("SELECT dae_person,week_start,SUM(visit_count) AS total FROM dae_visit_details WHERE week_start=? GROUP BY dae_person,week_start",[activeWeek]):Promise.resolve([[] as WeeklyCount[],[]] as const),
      db.execute<Assignment[]>("SELECT e.dae_person,e.week_start,e.agency_client_ids FROM team_activity_entries e WHERE e.entry_type='dae_team' AND e.dae_person IS NOT NULL AND TRIM(e.dae_person)<>'' AND e.id=(SELECT latest.id FROM team_activity_entries latest WHERE latest.entry_type='dae_team' AND latest.dae_person=e.dae_person ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1) ORDER BY e.dae_person LIMIT 5000"),
      db.execute<WeeklyCount[]>("SELECT dae_person,week_start,COUNT(*) AS total FROM dae_strategy_details GROUP BY dae_person,week_start ORDER BY week_start DESC LIMIT 5000"),
      db.execute<WeeklyCount[]>("SELECT dae_person,week_start,SUM(visit_count) AS total FROM dae_visit_details GROUP BY dae_person,week_start ORDER BY week_start DESC LIMIT 1000"),
      reportQuery
    ]);
    const clientMap=new Map(clientRows.map(client=>[Number(client.id),client]));
    const existingClientIds=new Set(clientRows.filter(client=>isExistingAgencyClientType(client.client_type)).map(client=>Number(client.id)));
    const assignmentsByDae=new Map<string,Set<number>>();
    for(const assignment of assignmentRows){const ids=assignmentsByDae.get(assignment.dae_person)??new Set<number>();readIds(assignment.agency_client_ids).filter(id=>existingClientIds.has(id)).forEach(id=>ids.add(id));assignmentsByDae.set(assignment.dae_person,ids)}
    const strategyMap=new Map<string,number>();for(const assignment of trendAssignments)strategyMap.set(assignment.dae_person,monthlyCumulativeStrategyCount(strategyWeekRows,activeWeek,assignment.dae_person));const visitMap=new Map(visitWeekRows.map(row=>[row.dae_person??"",Number(row.total)]));
    type GradeMetrics={clients:Set<number>;strategies:number;visits:number;coordination:string;dailyReport:string;hasWeeklyInput:boolean};
    const gradeMetrics=new Map<string,Map<string,GradeMetrics>>();
    const getGradeMetrics=(week:string,name:string)=>{const people=gradeMetrics.get(week)??new Map<string,GradeMetrics>(),item=people.get(name)??{clients:new Set<number>(),strategies:0,visits:0,coordination:"",dailyReport:"",hasWeeklyInput:false};people.set(name,item);gradeMetrics.set(week,people);return item};
    for(const period of reportWeeks)for(const assignment of trendAssignments){const item=getGradeMetrics(period,assignment.dae_person);readIds(assignment.agency_client_ids).filter(id=>existingClientIds.has(id)).forEach(id=>item.clients.add(id));item.strategies=monthlyCumulativeStrategyCount(trendStrategies,period,assignment.dae_person)}
    for(const item of trendVisits){const period=dateValue(item.week_start);if(reportWeeks.includes(period)&&item.dae_person){const metrics=getGradeMetrics(period,item.dae_person);metrics.visits=Number(item.total);metrics.hasWeeklyInput=true}}
    for(const report of weeklyReports){const period=dateValue(report.week_start);if(reportWeeks.includes(period)){const item=getGradeMetrics(period,report.dae_person);item.coordination=report.team_coordination??"";item.dailyReport=report.daily_report??"";item.hasWeeklyInput=true}}
    const weeklyGrades=new Map<string,{score:number;grade:string;value:number}>();
    const gradeValues:Record<string,number>={A:5,B:3,C:2,Buruk:1};
    for(const [period,people] of gradeMetrics){for(const [name,item] of people){if(!item.hasWeeklyInput)continue;const score=daeIndicatorScore({clientRetention:item.clients.size,clientTarget:item.clients.size,strategies:item.strategies,visits:item.visits,achievement:item.clients.size,coordination:item.coordination,dailyReport:item.dailyReport});const grade=daeGrade(score);weeklyGrades.set(`${name}\u0000${period}`,{score,grade,value:gradeValues[grade]})}}
    const monthlyScores=new Map<string,{values:number[];scores:number[]}>();for(const period of reportWeeks)for(const [key,rating] of weeklyGrades){const[name,week]=key.split("\u0000");if(week!==period)continue;const bucket=monthlyScores.get(name)??{values:[],scores:[]};bucket.values.push(rating.value);bucket.scores.push(rating.score);monthlyScores.set(name,bucket)}
    const monthlyRanked=[...monthlyScores].map(([name,bucket])=>{const totalGradeScore=bucket.values.reduce((sum,value)=>sum+value,0),average=totalGradeScore/bucket.values.length,score=bucket.scores.reduce((sum,value)=>sum+value,0)/bucket.scores.length;const grade=average>=4?"A":average>=2.5?"B":average>=1.5?"C":"Buruk";return{name,totalGradeScore,average,score,grade,gradeValue:gradeValues[grade],weeks:bucket.values.length}}).sort((a,b)=>b.totalGradeScore-a.totalGradeScore);
    const preliminary=[...assignmentsByDae].map(([name,ids])=>({name,clients:ids.size,strategies:strategyMap.get(name)??0,visits:visitMap.get(name)??0,rank:1})).sort((a,b)=>b.clients-a.clients||b.strategies-a.strategies||b.visits-a.visits||a.name.localeCompare(b.name,"id"));
    const rows:DaeOverviewRow[]=preliminary.map(row=>{const rating=weeklyGrades.get(`${row.name}\u0000${activeWeek}`);return{...row,rank:1+preliminary.filter(other=>other.clients>row.clients).length,score:rating?.score??0,grade:rating?.grade??"Buruk",hasGrade:Boolean(rating)}});
    const selectedDae=rows.some(row=>row.name===query.dae)?query.dae:undefined;
    const weeklyData:Record<string,DaeWeeklyData>={};
    for(const week of reportWeeks){const strategies=selectedDae?monthlyCumulativeStrategyCount(trendStrategies,week,selectedDae):0;weeklyData[week]={clients:0,strategies,visits:0,achievement:0,coordination:"",dailyReport:"",grade:"",gradeValue:0,score:0}}
    const clientsByWeek=new Map<string,Set<number>>();
    if(selectedDae)for(const period of reportWeeks)for(const assignment of trendAssignments){if(assignment.dae_person!==selectedDae)continue;const ids=clientsByWeek.get(period)??new Set<number>();readIds(assignment.agency_client_ids).filter(id=>existingClientIds.has(id)).forEach(id=>ids.add(id));clientsByWeek.set(period,ids)}
    if(selectedDae){
      for(const week of reportWeeks){const count=clientsByWeek.get(week)?.size??0;weeklyData[week].clients=count;weeklyData[week].achievement=count}

      for(const item of trendVisits){const period=dateValue(item.week_start);if(item.dae_person===selectedDae&&weeklyData[period])weeklyData[period].visits=Number(item.total)}
      for(const item of weeklyReports){const period=dateValue(item.week_start);if(item.dae_person===selectedDae&&weeklyData[period]){weeklyData[period].coordination=item.team_coordination??"";weeklyData[period].dailyReport=item.daily_report??""}}
      for(const period of reportWeeks){const rating=weeklyGrades.get(`${selectedDae}\u0000${period}`);if(rating){weeklyData[period].grade=rating.grade;weeklyData[period].gradeValue=rating.value;weeklyData[period].score=rating.score}}
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
    for(const week of trendPeriods)for(const assignment of trendAssignments){const people=dateSets.get(week)??new Map<string,Set<number>>(),ids=people.get(assignment.dae_person)??new Set<number>();readIds(assignment.agency_client_ids).filter(id=>existingClientIds.has(id)).forEach(id=>ids.add(id));people.set(assignment.dae_person,ids);dateSets.set(week,people)}
    const trendCount=(source:WeeklyCount[])=>{const map=new Map<string,number>();for(const item of source){if(selectedDae&&item.dae_person!==selectedDae)continue;const week=dateValue(item.week_start);map.set(week,(map.get(week)??0)+Number(item.total))}return map};
    const strategyTrend=new Map<string,number>();for(const period of trendPeriods)strategyTrend.set(period,monthlyCumulativeStrategyCount(trendStrategies,period,selectedDae));const visitTrend=trendCount(trendVisits);
    const trend:DaeTrendPoint[]=[...new Set([...dateSets.keys(),...strategyTrend.keys(),...visitTrend.keys()])].sort().slice(-8).map(week=>({week,clients:selectedDae?(dateSets.get(week)?.get(selectedDae)?.size??0):[...(dateSets.get(week)?.values()??[])].reduce((sum,ids)=>sum+ids.size,0),strategies:strategyTrend.get(week)??0,visits:visitTrend.get(week)??0}));
  const topMonthly=monthlyRanked[0];
  return <PublicPerformanceShell active="dae" eyebrow={`Overview DAE · ${activeWeek}`} title="Overview DAE" description="Pantau kepemilikan client, strategi, kunjungan, dan grade tim DAE."><div className="dae-kpi-shell public-scope-overview"><DaeKpiOverview publicMode week={activeWeek} weeks={weeks} rows={rows} clients={visibleClients} trend={trend} slices={slices} selectedDae={selectedDae} periodWeeks={periodWeeks} weeklyData={weeklyData} averageGrade={averageGrade} monthlyBest={topMonthly?{name:topMonthly.name,grade:topMonthly.grade,score:topMonthly.score,average:topMonthly.average,weeks:topMonthly.weeks,totalGradeScore:topMonthly.totalGradeScore}:undefined}/></div></PublicPerformanceShell>;
}
