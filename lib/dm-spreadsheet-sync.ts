import { getDb } from "@/lib/db";
import { monthWeekStartForDate } from "@/lib/dae-weeks";
import { parseReportDate } from "@/lib/report-date";
import type { RowDataPacket } from "@/lib/db-types";

type CsvRow=string[];
type MetricRow={date:string;contents:number;views:number};
function parseCsv(input:string):CsvRow[]{
  const source=input.replace(/^\uFEFF/,"");const rows:CsvRow[]=[];let row:string[]=[],cell="",quoted=false;
  for(let i=0;i<source.length;i++){const c=source[i];if(c==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===","&&!quoted){row.push(cell.trim());cell=""}else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&source[i+1]==="\n")i++;row.push(cell.trim());if(row.some(value=>value!==""))rows.push(row);row=[];cell=""}else cell+=c}
  row.push(cell.trim());if(row.some(value=>value!==""))rows.push(row);return rows;
}
const norm=(value:string)=>value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
function reportDate(value:string){const google=value.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})\)$/);if(google)return parseReportDate(`${google[3]}/${Number(google[2])+1}/${google[1]}`);return parseReportDate(value)}
function number(value:string){const parsed=Number(value.replace(/[^\d-]/g,""));return Number.isSafeInteger(parsed)&&parsed>=0?parsed:0}
function parseKpiRows(rows:CsvRow[],dmName:string):MetricRow[]{
  for(let header=0;header<Math.min(rows.length,25);header++){
    const headers=rows[header].map(norm),window=rows.slice(Math.max(0,header-5),header+1).flat().map(norm);
    const views=headers.findIndex(value=>["views","view","tayangan"].includes(value)),contents=headers.findIndex(value=>["jumlah upload","jumlah konten","konten"].includes(value));
    if(views<0||contents<0||!window.some(value=>["tanggal","date"].includes(value)))continue;
    let dateColumn=headers.findIndex(value=>["tanggal","date"].includes(value));
    if(dateColumn<0){for(let i=header-1;i>=Math.max(0,header-5);i--){dateColumn=rows[i].findIndex(value=>["tanggal","date"].includes(norm(value)));if(dateColumn>=0)break}}
    if(dateColumn<0)dateColumn=1;
    const records=new Map<string,MetricRow>();
    for(const row of rows.slice(header+1)){const date=reportDate(row[dateColumn]??""),marker=(row[0]??"").trim();if(!date||/^total\s+(week|minggu)/i.test(marker))continue;records.set(date,{date,contents:number(row[contents]??""),views:number(row[views]??"")})}
    if(records.size)return [...records.values()].sort((a,b)=>a.date.localeCompare(b.date));
  }
  throw new Error(`Kolom Tanggal, Views, dan Jumlah Upload tidak terbaca pada tab ${dmName}.`);
}
function sheetId(url:string){const parsed=new URL(url);if(parsed.protocol!=="https:"||parsed.hostname!=="docs.google.com")throw new Error("Link harus berasal dari Google Sheets.");const match=parsed.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);if(!match)throw new Error("Format link spreadsheet tidak valid.");return match[1]}

export async function syncDmSpreadsheet(dmId:number){
  const db=getDb();
  try{
    const [[sources],[members]]=await Promise.all([
      db.execute<(RowDataPacket&{spreadsheet_url:string})[]>("SELECT spreadsheet_url FROM dm_spreadsheet_sources WHERE dm_team_member_id=? LIMIT 1",[dmId]),
      db.execute<(RowDataPacket&{full_name:string})[]>("SELECT full_name FROM dm_team_members WHERE id=? LIMIT 1",[dmId]),
    ]);
    if(!sources[0]||!members[0])throw new Error("Tautan spreadsheet belum disimpan untuk DM ini.");
    const url=`https://docs.google.com/spreadsheets/d/${sheetId(sources[0].spreadsheet_url)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(members[0].full_name.toLocaleUpperCase("id-ID"))}`;
    const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error("Spreadsheet tidak dapat dibaca. Pastikan akses viewer untuk siapa saja yang memiliki link.");
    const csv=await response.text();if(!csv||/<!doctype html|accounts\.google\.com/i.test(csv.slice(0,1000)))throw new Error("Spreadsheet belum dapat dibaca. Aktifkan akses viewer untuk siapa saja yang memiliki link.");
    const records=parseKpiRows(parseCsv(csv),members[0].full_name),weekOf=(date:string)=>monthWeekStartForDate(date)??date,sourceTitle=`Performa spreadsheet · ${members[0].full_name}`;
    let created=0,updated=0;
    await db.transaction(async tx=>{
      for(const item of records){
        const week=weekOf(item.date);
        const [daily]=await tx.execute<(RowDataPacket&{id:number})[]>("SELECT id FROM team_activity_entries WHERE entry_type='dm_client' AND input_frequency='daily' AND dm_team_member_id=? AND agency_client_id IS NULL AND title=? AND activity_date=? ORDER BY id LIMIT 1 FOR UPDATE",[dmId,sourceTitle,item.date]);
        let weeklyEntry=false;
        if(!daily.length){const [weekly]=await tx.execute<(RowDataPacket&{id:number})[]>("SELECT id FROM team_activity_entries WHERE entry_type='dm_client' AND input_frequency='weekly' AND dm_team_member_id=? AND agency_client_id IS NULL AND week_start=? ORDER BY id LIMIT 1 FOR UPDATE",[dmId,week]);weeklyEntry=Boolean(weekly[0]);}
        if(weeklyEntry)throw new Error(`Tanggal ${item.date} berada pada minggu dengan laporan mingguan tingkat DM.`);
        if(daily[0]){await tx.execute("UPDATE team_activity_entries SET contents=?,video_views=? WHERE id=?",[item.contents,item.views,daily[0].id]);updated++}
        else{await tx.execute("INSERT INTO team_activity_entries (scope,entry_type,title,activity_date,week_start,input_frequency,contents,video_views,tiktok_sales,shopee_sales,new_clients,strategies,visits,dm_team_member_id,dm_person) VALUES ('dm','dm_client',?,?,?, 'daily', ?,?,0,0,0,0,0,?,?)",[sourceTitle,item.date,week,item.contents,item.views,dmId,members[0].full_name]);created++}
      }
      const dates=records.map(item=>item.date),placeholders=dates.map(()=>"?").join(",");
      const [stale]=await tx.execute<(RowDataPacket&{id:number})[]>(`SELECT id FROM team_activity_entries WHERE entry_type='dm_client' AND input_frequency='daily' AND dm_team_member_id=? AND agency_client_id IS NULL AND title=?${dates.length?` AND activity_date NOT IN (${placeholders})`:""} FOR UPDATE`,[dmId,sourceTitle,...dates]);
      for(const old of stale)await tx.execute("UPDATE team_activity_entries SET contents=0,video_views=0 WHERE id=?",[old.id]);
    });
    const status=`OK · ${records.length} tanggal · ${created} baru, ${updated} diperbarui`;
    await db.execute("UPDATE dm_spreadsheet_sources SET last_synced_at=CURRENT_TIMESTAMP,last_sync_status=? WHERE dm_team_member_id=?",[status,dmId]);
    return {ok:true,dmId,total:records.length,created,updated};
  }catch(error){
    const message=error instanceof Error?error.message:"Sinkronisasi spreadsheet gagal.";
    await db.execute("UPDATE dm_spreadsheet_sources SET last_synced_at=CURRENT_TIMESTAMP,last_sync_status=? WHERE dm_team_member_id=?",[message.slice(0,500),dmId]).catch(()=>undefined);
    return {ok:false,dmId,error:message};
  }
}
