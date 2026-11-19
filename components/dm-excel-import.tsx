"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type PreviewRow = { dmId:number; dmName:string; clientId:number; clientName:string; clientType:string; date:string; contents:number; views:number; willUpdate:boolean };
type ClearRow = { dmId:number; dmName:string; clientId:number; clientName:string; date:string; contents:number; views:number };
type Coverage = { dmId:number; dmName:string; clientId:number; clientName:string; start:string; end:string };
type Preview = { rows:PreviewRow[]; coverage:Coverage[]; clearRows:ClearRow[]; warnings:string[]; sheets:string[] };
const number=(value:number)=>value.toLocaleString("id-ID");
const dateLabel=(value:string)=>new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}T00:00:00Z`));

export default function DmExcelImport(){
  const router=useRouter();
  const inputRef=useRef<HTMLInputElement>(null);
  const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState<Preview|null>(null),[error,setError]=useState(""),[uploadWarnings,setUploadWarnings]=useState<string[]>([]),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  async function readFile(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!file)return;
    setBusy(true);setError("");setUploadWarnings([]);setMessage("");setPreview(null);
    try{
      const form=new FormData();form.set("file",file);
      const response=await fetch("/api/admin/kpi/dm-excel-import",{method:"POST",body:form,cache:"no-store"});
      const result=await response.json() as Preview&{error?:string};
      if(!response.ok){setUploadWarnings(result.warnings??[]);throw new Error(result.error??"File tidak dapat dipratinjau.")}
      setPreview(result);
    }catch(cause){setError(cause instanceof Error?cause.message:"File tidak dapat dipratinjau.")}finally{setBusy(false)}
  }
  async function importRows(){
    if(!preview?.rows.length)return;
    setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/admin/kpi/dm-excel-import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rows:preview.rows,coverage:preview.coverage}),cache:"no-store"});
      const result=await response.json() as {inserted?:number;overwritten?:number;cleared?:number;removed?:number;total?:number;error?:string};
      if(!response.ok)throw new Error(result.error??"Data belum masuk ke database aplikasi.");
      setMessage(`${number(result.total??0)} baris masuk ke database KPI web · ${number(result.inserted??0)} baru · ${number(result.overwritten??0)} ditimpa · ${number(result.removed??0)} tanggal kosong di luar Excel dihapus · ${number(result.cleared??0)} tanggal omzetnya dipertahankan.`);
      setPreview(null);setFile(null);if(inputRef.current)inputRef.current.value="";router.refresh();
    }catch(cause){setError(cause instanceof Error?cause.message:"Data belum masuk ke database aplikasi.")}finally{setBusy(false)}
  }
  return <section className="analytics-panel dm-excel-import">
    <div className="analytics-panel-heading"><div><h2>Impor performa dari file Excel</h2><p>Unggah file .xlsx hasil unduhan. Pratinjau konten dan views per client/tanggal dahulu; data baru masuk ke database KPI web setelah dikonfirmasi.</p></div></div>
    <form className="dm-excel-upload" onSubmit={event=>void readFile(event)}><label>File Excel (.xlsx)<input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event=>{setFile(event.target.files?.[0]??null);setPreview(null);setError("");setUploadWarnings([]);setMessage("")}} required/></label><button className="button" disabled={!file||busy}>{busy&&!preview?"Membaca file…":"Pratinjau data"}</button></form>
    {error&&<p className="dm-excel-error" role="alert">{error}</p>}{uploadWarnings.length>0&&<div className="dm-excel-warnings">{uploadWarnings.map((warning,index)=><small key={`${index}-${warning}`}>{warning}</small>)}</div>}{message&&<p className="admin-success" role="status">{message}</p>}
    {preview&&<div className="dm-excel-preview"><div className="dm-excel-preview-summary"><b>{number(preview.rows.length)} baris siap diimpor</b><span>{number(preview.rows.filter(row=>row.willUpdate).length)} akan menimpa data tanggal yang sudah ada · {number(preview.rows.filter(row=>!row.willUpdate).length)} data baru · {number(preview.clearRows.length)} tanggal lama di aplikasi tidak ada di rentang Excel</span></div>
      {preview.warnings.length>0&&<div className="dm-excel-warnings"><b>Perlu diperhatikan</b>{preview.warnings.map((warning,index)=><small key={`${index}-${warning}`}>{warning}</small>)}</div>}
      <div className="dm-excel-table-wrap"><table className="admin-table dm-team-table"><thead><tr><th>Tanggal</th><th>Nama DM</th><th>Client</th><th>Konten</th><th>Views</th><th>Aksi</th></tr></thead><tbody>{preview.rows.map((row,index)=><tr key={`${row.dmId}-${row.clientId}-${row.date}-${index}`}><td>{dateLabel(row.date)}</td><td>{row.dmName}</td><td>{row.clientName}</td><td>{number(row.contents)}</td><td>{number(row.views)}</td><td><span className={`dm-excel-badge ${row.willUpdate?"is-update":"is-new"}`}>{row.willUpdate?"Timpa data":"Data baru"}</span></td></tr>)}</tbody></table></div>
      {preview.clearRows.length>0&&<><h3 className="dm-excel-clear-heading">Tanggal di database yang tidak memiliki data di Excel</h3><div className="dm-excel-table-wrap"><table className="admin-table dm-team-table"><thead><tr><th>Tanggal</th><th>Nama DM</th><th>Client</th><th>Konten saat ini</th><th>Views saat ini</th><th>Aksi setelah konfirmasi</th></tr></thead><tbody>{preview.clearRows.map((row,index)=><tr key={`${row.dmId}-${row.clientId}-${row.date}-${index}`}><td>{dateLabel(row.date)}</td><td>{row.dmName}</td><td>{row.clientName}</td><td>{number(row.contents)}</td><td>{number(row.views)}</td><td><span className="dm-excel-badge is-update">Hapus jika kosong; omzet tetap</span></td></tr>)}</tbody></table></div></>}
      <div className="dm-excel-confirm"><small>Hanya tanggal dengan nilai konten atau views yang terisi di Excel yang diimpor. Data yang sudah ada diganti sesuai file. Tanggal dalam cakupan bulan Excel yang tidak memiliki data akan dihapus jika kosong; jika ada omzet/aktivitas lain, data itu tetap disimpan dan konten/views dikosongkan.</small><button type="button" className="button" onClick={()=>void importRows()} disabled={busy}>{busy?"Memasukkan data…":`Masukkan ${number(preview.rows.length)} baris ke database web`}</button></div>
    </div>}
  </section>;
}
