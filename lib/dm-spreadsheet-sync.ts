import { inflateRawSync } from "node:zlib";
import { getDb } from "@/lib/db";
import { monthWeekStartForDate } from "@/lib/dae-weeks";
import { parseReportDate } from "@/lib/report-date";
import type { RowDataPacket } from "@/lib/db-types";

type CsvRow=string[];
type MetricRow={date:string;contents:number;views:number};
type WorkbookSheet={name:string;rows:CsvRow[]};
const decoder=new TextDecoder();
function zipEntry(bytes:Buffer,wanted:string){
  let end=-1;for(let offset=Math.max(0,bytes.length-65557);offset<=bytes.length-22;offset++)if(bytes.readUInt32LE(offset)===0x06054b50)end=offset;
  if(end<0)throw new Error("Google tidak mengirim workbook Excel yang valid.");
  const count=bytes.readUInt16LE(end+10);let cursor=bytes.readUInt32LE(end+16);
  for(let i=0;i<count;i++){
    if(bytes.readUInt32LE(cursor)!==0x02014b50)throw new Error("Daftar isi workbook Excel tidak valid.");
    const method=bytes.readUInt16LE(cursor+10),compressedSize=bytes.readUInt32LE(cursor+20),expandedSize=bytes.readUInt32LE(cursor+24),nameLength=bytes.readUInt16LE(cursor+28),extraLength=bytes.readUInt16LE(cursor+30),commentLength=bytes.readUInt16LE(cursor+32),localOffset=bytes.readUInt32LE(cursor+42),name=decoder.decode(bytes.subarray(cursor+46,cursor+46+nameLength));
    if(name===wanted){if(expandedSize>32*1024*1024)throw new Error("Sheet terlalu besar untuk dibaca.");const localName=bytes.readUInt16LE(localOffset+26),localExtra=bytes.readUInt16LE(localOffset+28),start=localOffset+30+localName+localExtra,compressed=bytes.subarray(start,start+compressedSize);if(method===0)return compressed;if(method===8)return inflateRawSync(compressed,{maxOutputLength:32*1024*1024});throw new Error("Jenis kompresi workbook tidak didukung.")}
    cursor+=46+nameLength+extraLength+commentLength;
  }
  return undefined;
}
function decodeXml(value:string){return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(entity,code:string)=>{if(code[0]==="#"){const number=code[1]?.toLowerCase()==="x"?Number.parseInt(code.slice(2),16):Number.parseInt(code.slice(1),10);return Number.isFinite(number)?String.fromCodePoint(number):entity}return({amp:"&",lt:"<",gt:">",quot:'"',apos:"'"} as Record<string,string>)[code.toLowerCase()]??entity})}
function attribute(tag:string,name:string){for(const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))if(match[1]===name)return decodeXml(match[2]??match[3]??"");return""}
function xmlText(xml:string){return decodeXml(xml.replace(/<[^>]*>/g,""))}
function columnIndex(reference:string){let result=0;for(const char of reference.match(/^[A-Z]+/i)?.[0].toUpperCase()??"")result=result*26+char.charCodeAt(0)-64;return result-1}
function parseWorkbook(bytes:Buffer):WorkbookSheet[]{
  const workbook=zipEntry(bytes,"xl/workbook.xml"),relationships=zipEntry(bytes,"xl/_rels/workbook.xml.rels");if(!workbook||!relationships)throw new Error("Sheet tidak ditemukan di workbook.");
  const rels=new Map(Array.from(relationships.toString("utf8").matchAll(/<Relationship\b[^>]*>/g),match=>[attribute(match[0],"Id"),attribute(match[0],"Target")]));
  const sharedXml=zipEntry(bytes,"xl/sharedStrings.xml")?.toString("utf8")??"",shared=Array.from(sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g),match=>xmlText(match[1]));
  const tags=Array.from(workbook.toString("utf8").matchAll(/<sheet\b[^>]*>/g),match=>match[0]);
  return tags.flatMap(tag=>{
    const name=attribute(tag,"name"),target=rels.get(attribute(tag,"r:id"));if(!target)return[];
    const path=(target.startsWith("/")?target.slice(1):`xl/${target}`).split("/").reduce<string[]>((parts,part)=>part===".."?parts.slice(0,-1):part==="."||!part?parts:[...parts,part],[]).join("/"),xml=zipEntry(bytes,path);if(!xml)return[];
    const rows=Array.from(xml.toString("utf8").matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g),rowMatch=>{
      const values:string[]=[];for(const cell of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){const index=columnIndex(attribute(cell[1],"r"));if(index<0)continue;const type=attribute(cell[1],"t"),value=cell[2].match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1]??"";values[index]=type==="s"?shared[Number(value)]??"":type==="inlineStr"?xmlText(cell[2]):decodeXml(value)}return values;
    });
    return[{name,rows}];
  });
}
const normalize=(value:string)=>value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
function reportDate(value:string){const google=value.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})\)$/);if(google)return parseReportDate(`${google[3]}/${Number(google[2])+1}/${google[1]}`);return parseReportDate(value)}
function number(value:string){const direct=Number(value.trim());if(Number.isSafeInteger(direct)&&direct>=0)return direct;const digits=Number(value.replace(/[^\d-]/g,""));return Number.isSafeInteger(digits)&&digits>=0?digits:0}
function parseKpiRows(rows:CsvRow[],dmName:string):MetricRow[]{
  for(let header=0;header<Math.min(rows.length,25);header++){
    const headers=rows[header].map(normalize);
    const views=headers.findIndex(value=>["views","view","tayangan"].includes(value)),contents=headers.findIndex(value=>["jumlahupload","jumlahkonten","konten"].includes(value));
    if(views<0||contents<0)continue;
    let dateColumn=headers.findIndex(value=>["tanggal","date"].includes(value));if(dateColumn<0){for(let i=header-1;i>=Math.max(0,header-5);i--){dateColumn=rows[i].findIndex(value=>["tanggal","date"].includes(normalize(value)));if(dateColumn>=0)break}}
    if(dateColumn<0)dateColumn=1;
    const records=new Map<string,MetricRow>();for(const row of rows.slice(header+1)){const date=reportDate(row[dateColumn]??""),marker=(row[0]??"").trim();if(!date||/^total\s+(week|minggu)/i.test(marker))continue;records.set(date,{date,contents:number(row[contents]??""),views:number(row[views]??"")})}
    if(records.size)return[...records.values()].sort((a,b)=>a.date.localeCompare(b.date));
  }
  throw new Error(`Kolom Tanggal, Views, dan Jumlah Upload tidak ditemukan pada tab ${dmName}.`);
}
function sheetId(url:string){const parsed=new URL(url);if(parsed.protocol!=="https:"||parsed.hostname!=="docs.google.com")throw new Error("Link harus berasal dari Google Sheets.");const match=parsed.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);if(!match)throw new Error("Format link spreadsheet tidak valid.");return match[1]}
type SourceMember={dm_team_member_id:number;full_name:string;spreadsheet_url:string};
async function syncMember(dm:SourceMember,sheets:WorkbookSheet[]){
  const sheet=sheets.find(item=>normalize(item.name)===normalize(dm.full_name));
  if(!sheet)throw new Error(`Tab “${dm.full_name}” tidak ada. Tab yang ditemukan: ${sheets.map(item=>item.name).join(", ")}.`);
  const records=parseKpiRows(sheet.rows,dm.full_name),weekOf=(date:string)=>monthWeekStartForDate(date)??date,sourceTitle=`Performa spreadsheet · ${dm.full_name}`,db=getDb();let created=0,updated=0;
  await db.transaction(async tx=>{
    for(const item of records){const week=weekOf(item.date);const[daily]=await tx.execute<(RowDataPacket&{id:number})[]>("SELECT id FROM team_activity_entries WHERE entry_type='dm_client' AND input_frequency='daily' AND dm_team_member_id=? AND agency_client_id IS NULL AND title=? AND activity_date=? ORDER BY id LIMIT 1 FOR UPDATE",[dm.dm_team_member_id,sourceTitle,item.date]);
      let weeklyEntry=false;if(!daily.length){const[weekly]=await tx.execute<(RowDataPacket&{id:number})[]>("SELECT id FROM team_activity_entries WHERE entry_type='dm_client' AND input_frequency='weekly' AND dm_team_member_id=? AND agency_client_id IS NULL AND week_start=? ORDER BY id LIMIT 1 FOR UPDATE",[dm.dm_team_member_id,week]);weeklyEntry=Boolean(weekly[0])}
      if(weeklyEntry)throw new Error(`Tanggal ${item.date} bertabrakan dengan laporan mingguan tingkat DM.`);
      if(daily[0]){await tx.execute("UPDATE team_activity_entries SET contents=?,video_views=? WHERE id=?",[item.contents,item.views,daily[0].id]);updated++}
      else{await tx.execute("INSERT INTO team_activity_entries (scope,entry_type,title,activity_date,week_start,input_frequency,contents,video_views,tiktok_sales,shopee_sales,new_clients,strategies,visits,dm_team_member_id,dm_person) VALUES ('dm','dm_client',?,?,?, 'daily', ?,?,0,0,0,0,0,?,?)",[sourceTitle,item.date,week,item.contents,item.views,dm.dm_team_member_id,dm.full_name]);created++}
    }
    const dates=records.map(item=>item.date),placeholders=dates.map(()=>"?").join(","),[stale]=await tx.execute<(RowDataPacket&{id:number})[]>(`SELECT id FROM team_activity_entries WHERE entry_type='dm_client' AND input_frequency='daily' AND dm_team_member_id=? AND agency_client_id IS NULL AND title=?${dates.length?` AND activity_date NOT IN (${placeholders})`:""} FOR UPDATE`,[dm.dm_team_member_id,sourceTitle,...dates]);
    for(const old of stale)await tx.execute("UPDATE team_activity_entries SET contents=0,video_views=0 WHERE id=?",[old.id]);
  });
  const status=`OK · ${records.length} tanggal · ${created} baru, ${updated} diperbarui`;await db.execute("UPDATE dm_spreadsheet_sources SET last_synced_at=CURRENT_TIMESTAMP,last_sync_status=? WHERE dm_team_member_id=?",[status,dm.dm_team_member_id]);return{ok:true,dm:dm.full_name,dmId:Number(dm.dm_team_member_id),total:records.length,created,updated};
}
async function setError(dm:SourceMember,error:string){await getDb().execute("UPDATE dm_spreadsheet_sources SET last_synced_at=CURRENT_TIMESTAMP,last_sync_status=? WHERE dm_team_member_id=?",[error.slice(0,500),dm.dm_team_member_id]).catch(()=>undefined);return{ok:false,dm:dm.full_name,dmId:Number(dm.dm_team_member_id),error}}

export async function syncAllDmSpreadsheets(){
  const db=getDb(),[members]=await db.execute<SourceMember[]>("SELECT s.dm_team_member_id,m.full_name,s.spreadsheet_url FROM dm_spreadsheet_sources s JOIN dm_team_members m ON m.id=s.dm_team_member_id ORDER BY m.full_name LIMIT 100");
  if(!members.length)return{processed:0,updated:0,failed:0,results:[]};
  let sheets:WorkbookSheet[];
  try{
    const url=`https://docs.google.com/spreadsheets/d/${sheetId(members[0].spreadsheet_url)}/export?format=xlsx`,response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`Google mengembalikan HTTP ${response.status}. Pastikan akses spreadsheet “Siapa saja yang memiliki link · Viewer”.`);
    const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length<4||bytes.readUInt32LE(0)!==0x04034b50)throw new Error("Google tidak mengirim file Excel. Pastikan spreadsheet bisa diunduh oleh viewer.");
    sheets=parseWorkbook(bytes);
  }catch(error){const message=error instanceof Error?error.message:"Workbook spreadsheet tidak bisa dibaca.";const results=await Promise.all(members.map(member=>setError(member,message)));return{processed:results.length,updated:0,failed:results.length,results}}
  const linkId=sheetId(members[0].spreadsheet_url),results=await Promise.all(members.map(async member=>{
    if(sheetId(member.spreadsheet_url)!==linkId)return setError(member,"Link spreadsheet DM ini berbeda dari link utama.");
    try{return await syncMember(member,sheets)}catch(error){return setError(member,error instanceof Error?error.message:"Sinkronisasi gagal.")}
  }));
  return{processed:results.length,updated:results.filter(result=>result.ok).length,failed:results.filter(result=>!result.ok).length,results};
}

export async function syncDmSpreadsheet(dmId:number){
  const result=await syncAllDmSpreadsheets();return result.results.find(item=>item.dmId===dmId)??{ok:false,dmId,error:"DM tidak ditemukan pada daftar sinkronisasi."};
}
