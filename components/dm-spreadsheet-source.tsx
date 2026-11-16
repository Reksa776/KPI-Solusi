"use client";

import { useCallback,useEffect,useRef,useState } from "react";
import { useRouter } from "next/navigation";
import { saveDmSpreadsheetSource } from "@/app/admin/kpi/input/dm_client/actions";

export default function DmSpreadsheetSource({dmIds,dmNames,url,lastSyncedAt,lastStatus}:{dmIds:number[];dmNames:string[];url:string|null;lastSyncedAt:string|null;lastStatus:string|null}){
  const router=useRouter(),dmCount=dmIds.length,[status,setStatus]=useState(lastStatus??""),[busy,setBusy]=useState(false),running=useRef(false);
  const sync=useCallback(async()=>{
    if(!url||running.current||!dmCount)return;
    running.current=true;setBusy(true);
    try{const response=await fetch("/api/admin/kpi/dm-spreadsheet-sync",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({all:true}),cache:"no-store"});const result=await response.json() as {processed?:number;updated?:number;failed?:number;error?:string;results?:{dm?:string;ok?:boolean;error?:string}[]};if(!response.ok)throw new Error(result.error??"Sinkronisasi gagal.");const errors=(result.results??[]).filter(item=>!item.ok).map(item=>`${item.dm??"DM"}: ${item.error??"Gagal"}`).join(" · ");setStatus(`${result.updated??0}/${result.processed??0} tab DM tersinkron${result.failed?` · ${result.failed} gagal${errors?`: ${errors}`}`:""}`);router.refresh()}catch(error){setStatus(error instanceof Error?error.message:"Sinkronisasi gagal.")}finally{running.current=false;setBusy(false)}
  },[url,dmCount,router]);
  useEffect(()=>{if(url)void sync()},[url,sync]);
  return <section className="analytics-panel dm-sheet-source"><div className="analytics-panel-heading"><div><h2>Sinkronisasi Google Spreadsheet</h2><p>Link satu kali untuk semua tab DM ({dmNames.join(", ")}). Kolom Views dan Jumlah Upload disimpan sebagai total tiap DM.</p></div>{url&&<button type="button" className="button light" onClick={()=>void sync()} disabled={busy}>{busy?"Memperbarui…":"↻ Perbarui sekarang"}</button>}</div>
    <form action={saveDmSpreadsheetSource} className="dm-sheet-source-form"><label>Link Google Spreadsheet<input type="url" name="spreadsheet_url" defaultValue={url??""} placeholder="https://docs.google.com/spreadsheets/d/.../edit" required/></label><div className="form-actions"><button className="button">{url?"Simpan link":"Hubungkan spreadsheet"}</button></div></form>
    <p className="form-hint">Pastikan spreadsheet dibagikan sebagai <b>Siapa saja yang memiliki link · Viewer</b>, dan nama setiap tab sama dengan nama DM. Sinkronisasi berjalan otomatis tiap menit. File Excel tetap bisa diimpor dari menu “Impor beberapa tanggal”.</p>{status&&<small className="dm-report-notice">{status}{lastSyncedAt?` · Terakhir: ${new Date(lastSyncedAt).toLocaleString("id-ID")}`:""}</small>}
  </section>;
}
