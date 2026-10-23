"use client";

import Link from "next/link";
import { useState } from "react";
import { saveDmClientBatch } from "@/app/admin/kpi/actions";
import DmInputPeriod from "@/components/dm-input-period";

type Client = { id:number; client_name:string; client_type:string };
type Dm = { id:number; full_name:string };
type Row = { key:number; clientId:string; dmId:string; contents:string; videoViews:string; tiktokSales:string; shopeeSales:string };

export default function DmClientPerformanceForm({ clients, dms, initialClientId, initialWeekStart, initialDate }: { clients:Client[]; dms:Dm[]; initialClientId:number; initialWeekStart:string; initialDate:string }) {
  const [rows, setRows] = useState<Row[]>([{ key:0, clientId:String(initialClientId), dmId:"", contents:"0", videoViews:"0", tiktokSales:"0", shopeeSales:"0" }]);
  const [nextKey, setNextKey] = useState(1);
  function update(key:number, field:keyof Omit<Row,"key">, value:string) {
    setRows(current => current.map(row => row.key === key ? { ...row, [field]:value } : row));
  }
  return <form action={saveDmClientBatch} className="package-edit-form dm-client-batch-form">
    <section className="dm-client-performance-rows">
      <div className="dae-strategy-section-heading"><div><h2>Data Performa Client</h2><p>Pilih input harian atau mingguan. Tambahkan beberapa client sekaligus untuk periode yang sama.</p></div></div>
      <DmInputPeriod initialWeekStart={initialWeekStart} initialDate={initialDate}/>
      {rows.map((row,index) => <article className="dm-client-performance-row" key={row.key}>
        <div className="dm-client-row-heading"><b>Client {index + 1}</b>{rows.length > 1&&<button type="button" className="dae-strategy-remove" aria-label={`Hapus input client ${index+1}`} onClick={() => setRows(current => current.filter(item => item.key !== row.key))}>×</button>}</div>
        <div className="form-grid"><label>Nama Client<select name="agency_client_ids" required value={row.clientId} onChange={event => update(row.key,"clientId",event.target.value)}><option value="" disabled>Pilih client</option>{clients.map(client=><option key={client.id} value={client.id}>{client.client_name} · {client.client_type}</option>)}</select></label><label>Nama DM<select name="dm_team_member_ids" required value={row.dmId} onChange={event => update(row.key,"dmId",event.target.value)}><option value="" disabled>Pilih anggota DM</option>{dms.map(dm=><option key={dm.id} value={dm.id}>{dm.full_name}</option>)}</select></label></div>
        <div className="form-grid dm-client-metrics"><label>Konten<input name="contents" type="number" min="0" step="1" required value={row.contents} onChange={event => update(row.key,"contents",event.target.value)}/></label><label>Views Video<input name="video_views" type="number" min="0" step="1" required value={row.videoViews} onChange={event => update(row.key,"videoViews",event.target.value)}/></label><label>Omset TikTok (Rp)<input name="tiktok_sales" type="number" min="0" step="1" required value={row.tiktokSales} onChange={event => update(row.key,"tiktokSales",event.target.value)}/></label><label>Omset Shopee (Rp)<input name="shopee_sales" type="number" min="0" step="1" required value={row.shopeeSales} onChange={event => update(row.key,"shopeeSales",event.target.value)}/></label></div>
      </article>)}
      <button type="button" className="button light" disabled={!clients.length} onClick={() => { setRows(current => [...current, { key:nextKey, clientId:"", dmId:"", contents:"0", videoViews:"0", tiktokSales:"0", shopeeSales:"0" }]); setNextKey(value => value + 1); }}>＋ Tambah Client</button>
      {!clients.length&&<p className="dae-client-empty">Belum ada client. Tambahkan client terlebih dahulu di <Link href="/admin/client">Data Client</Link>.</p>}
      {!dms.length&&<p className="dae-client-empty">Belum ada anggota DM aktif yang bisa dipilih.</p>}
    </section>
    <div className="form-actions"><Link className="button light" href="/admin/kpi/input/dm_client">Kembali</Link><button className="button" disabled={!clients.length||!dms.length}>Simpan Data Client <span>↗</span></button></div>
  </form>;
}
