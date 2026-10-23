"use client";

import Link from "next/link";
import { useState, type ChangeEvent } from "react";
import { saveDmClientDailyReports } from "@/app/admin/kpi/actions";
import { parseDatedReport } from "@/components/dm-client-metrics-fields";
import { monthWeekFromStart, monthWeekStartForDate } from "@/lib/dae-weeks";

type Metric="video_views"|"tiktok_sales"|"shopee_sales";
type DailyRow={key:string;date:string;contents:string;video_views:string;tiktok_sales:string;shopee_sales:string};
type ImportResult={date:string;value:number|null};
type Source={kind:"views"|"tiktok"|"shopee";title:string;description:string;metric:Metric};
const sources:Source[]=[
  {kind:"views",title:"Laporan Views TikTok",description:"Membuat laporan harian dari tiap tanggal di sheet Viewers.",metric:"video_views"},
  {kind:"tiktok",title:"Laporan Omset TikTok",description:"GMV masuk pada tanggal analisis laporan.",metric:"tiktok_sales"},
  {kind:"shopee",title:"Laporan Omset Shopee",description:"Total Penjualan masuk pada tanggal laporan.",metric:"shopee_sales"},
];
const blank=(date:string):DailyRow=>({key:globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random()}`,date,contents:"",video_views:"",tiktok_sales:"",shopee_sales:""});
function nextDay(value:string){const date=new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+1);return date.toISOString().slice(0,10)}
function weeklyLabel(date:string){const start=monthWeekStartForDate(date),week=start?monthWeekFromStart(start):null;return week?`Minggu ${week.week}`:"Minggu belum ditentukan"}

export default function DmClientDailyReportsForm({dmId,clientId,dmName,clientName,initialDate}:{dmId:number;clientId:number;dmName:string;clientName:string;initialDate:string}){
  const [rows,setRows]=useState<DailyRow[]>([blank(initialDate)]);
  const [imports,setImports]=useState<Record<string,{name:string;results:ImportResult[]}|undefined>>({});
  const [errors,setErrors]=useState<Record<string,string>>({});
  const importFile=async(event:ChangeEvent<HTMLInputElement>,source:Source)=>{
    const file=event.target.files?.[0];if(!file)return;
    setErrors(current=>({...current,[source.kind]:""}));
    try{
      let results:ImportResult[];
      if(source.kind==="views"){
        const payload=new FormData();payload.set("file",file);
        const response=await fetch("/api/admin/kpi/import-viewers",{method:"POST",body:payload});
        const data=await response.json() as {results?:ImportResult[];error?:string};
        if(!response.ok)throw new Error(data.error??"Laporan Views tidak dapat dibaca.");
        results=data.results??[];
      }else results=await parseDatedReport(file,source.kind);
      if(!results.length)throw new Error("Tanggal dan angka tidak ditemukan pada file.");
      setRows(current=>{
        const next=[...current];
        for(const result of results){
          let index=next.findIndex(row=>row.date===result.date);
          if(index<0){next.push(blank(result.date));index=next.length-1;}
          next[index]={...next[index],[source.metric]:result.value===null?"":String(result.value)};
        }
        return next.sort((a,b)=>a.date.localeCompare(b.date));
      });
      setImports(current=>({...current,[source.kind]:{name:file.name,results}}));
    }catch(error){
      setErrors(current=>({...current,[source.kind]:error instanceof Error?error.message:"File tidak dapat dibaca."}));
      setImports(current=>({...current,[source.kind]:undefined}));
    }
  };
  const addDate=()=>setRows(current=>[...current,blank(nextDay(current.reduce((latest,row)=>row.date>latest?row.date:latest,initialDate)))]);
  const removeDate=(key:string)=>setRows(current=>current.length>1?current.filter(row=>row.key!==key):current);
  const update=(key:string,field:keyof DailyRow,value:string)=>setRows(current=>current.map(row=>row.key===key?{...row,[field]:value}:row));

  return <form action={saveDmClientDailyReports} className="package-edit-form dm-daily-batch-form">
    <input type="hidden" name="dm_team_member_id" value={dmId}/><input type="hidden" name="agency_client_id" value={clientId}/>
    <div className="dm-pair-identity"><span>CLIENT <b>{clientName}</b></span><span>DM <b>{dmName}</b></span></div>
    <section className="dm-report-import dm-daily-import"><h2>Impor laporan berdasarkan tanggal</h2><p>Setiap nilai tetap disimpan sebagai data harian. Di riwayat, pilih bulan dan minggu untuk melihat laporan yang termasuk periode tersebut. Omset otomatis masuk ke tanggal laporan.</p>
      {sources.map(source=>{const imported=imports[source.kind];return <div className="dm-daily-source" key={source.kind}>
        <label><b>{source.title}</b><small>{source.description}</small><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event=>void importFile(event,source)}/></label>
        {imported&&<><span className="dm-report-filename">{imported.name} · {imported.results.length} tanggal terbaca</span><div className="dm-import-preview"><b>Tanggal</b><b>Nilai</b><b>Minggu</b>{imported.results.map((result,index)=><span key={`${result.date}-${index}`}><time>{new Date(`${result.date}T12:00:00Z`).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"})}</time><strong>{result.value===null?"Tidak tersedia":result.value.toLocaleString("id-ID")}</strong><small>{weeklyLabel(result.date)}</small></span>)}</div></>}
        {errors[source.kind]&&<span className="dm-report-error">{errors[source.kind]}</span>}
      </div>;})}
    </section>
    <section className="dm-daily-rows"><div className="dm-daily-heading"><div><h2>Laporan harian</h2><p>Data akan tersimpan per tanggal dan otomatis masuk ke rekap minggu bulan terkait. Semua angka opsional; yang kosong dihitung 0.</p></div><button className="button light" type="button" onClick={addDate}>＋ Tambah tanggal</button></div>
      {rows.map((row,index)=><article className="dm-daily-row" key={row.key}>
        <input type="hidden" name="report_dates" value={row.date}/>
        <header><b>{`Laporan ${index+1} · ${weeklyLabel(row.date)}`}</b><button type="button" aria-label={`Hapus laporan ${index+1}`} onClick={()=>removeDate(row.key)}>×</button></header>
        <label className="dm-daily-date">Tanggal laporan<input type="date" value={row.date} onChange={event=>update(row.key,"date",event.target.value)} required/></label>
        <div className="form-grid dm-client-metrics"><label>Konten<input name="contents" type="number" min="0" step="1" value={row.contents} onChange={event=>update(row.key,"contents",event.target.value)}/></label><label>Views TikTok<input name="video_views" type="number" min="0" step="1" value={row.video_views} onChange={event=>update(row.key,"video_views",event.target.value)}/></label><label>Omset TikTok (Rp)<input name="tiktok_sales" type="number" min="0" step="1" value={row.tiktok_sales} onChange={event=>update(row.key,"tiktok_sales",event.target.value)}/></label><label>Omset Shopee (Rp)<input name="shopee_sales" type="number" min="0" step="1" value={row.shopee_sales} onChange={event=>update(row.key,"shopee_sales",event.target.value)}/></label></div>
      </article>)}
    </section>
    <div className="form-actions"><Link className="button light" href={`/admin/kpi/input/dm_client?dm_id=${dmId}&client_id=${clientId}`}>Kembali</Link><button className="button">Simpan {rows.length} laporan harian</button></div>
  </form>;
}
