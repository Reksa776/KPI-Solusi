import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import type { RowDataPacket } from "@/lib/db-types";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";
import LiveSearchFilter from "@/components/live-search-filter";
import { verifyAdminAnyScope, verifyAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { deleteAgencyClient, saveAgencyClient } from "./actions";
import { clientTypes } from "@/components/admin-client-form";

export const metadata: Metadata = { title: "Client | Solusi Sejalan" };
type ClientRow = RowDataPacket & { id:number;client_name:string;client_type:string };
type CountRow = RowDataPacket & { total:number };
const pageSize=20;
export default async function ClientPage({ searchParams }: { searchParams: Promise<{ saved?:string; deleted?:string; error?:string; type?:string; page?:string; search?:string }> }) {
  if (!(await verifyAdminSession())) redirect("/admin/login");
  if (!(await verifyAdminAnyScope(["dm","dae"]))) redirect("/admin");
  const query = await searchParams;
  const selectedType=clientTypes.some(([value])=>value===query.type)?query.type!:"";
  const searchText=(query.search??"").trim().slice(0,120);
  const requestedPage=Number.parseInt(query.page??"1",10);
  const safePage=Number.isSafeInteger(requestedPage)&&requestedPage>0?requestedPage:1;
  const clauses:string[]=[];
  const params:(string|number)[]=[];
  if(selectedType){clauses.push("client_type=?");params.push(selectedType)}
  if(searchText){clauses.push("client_name LIKE ?");params.push(`%${searchText}%`)}
  const where=clauses.length?` WHERE ${clauses.join(" AND ")}`:"";
  const [[countRows]] = await Promise.all([getDb().execute<CountRow[]>(`SELECT COUNT(*) AS total FROM agency_clients${where}`,params)]);
  const total=Number(countRows[0]?.total??0),pageCount=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(safePage,pageCount),offset=(page-1)*pageSize;
  const [rows]=await getDb().execute<ClientRow[]>(`SELECT id,client_name,client_type FROM agency_clients${where} ORDER BY client_name ASC,id DESC LIMIT ? OFFSET ?`,[...params,pageSize,offset]);
  const labels=Object.fromEntries(clientTypes);
  const pageHref=(nextPage:number)=>`/admin/client?${new URLSearchParams({...(selectedType?{type:selectedType}:{}),...(searchText?{search:searchText}:{}),page:String(nextPage)}).toString()}`;
  return <div className="admin-page"><AdminNavigation active="client"/><main className="admin-main admin-section-main"><AdminTopbar section="Client" page="Data client"/><div className="admin-shell"><section className="admin-heading"><div><span className="eyebrow">DATA DM &amp; DAE</span><h1>Client</h1><p>Daftar client beserta jenisnya untuk kebutuhan input DM dan DAE.</p></div></section>
    {query.saved&&<div className="admin-success">Data client berhasil disimpan.</div>}{query.deleted&&<div className="admin-success">Client berhasil dihapus.</div>}{query.error&&<div className="admin-error">Data tidak dapat diproses. Periksa kembali isian yang dimasukkan.</div>}
    <div className="client-list-toolbar"><LiveSearchFilter search={searchText} searchLabel="Cari client" placeholder="Ketik nama client" select={{name:"type",label:"Jenis Client",value:selectedType,options:[{value:"",label:"Semua jenis client"},...clientTypes.map(([value,label])=>({value,label}))]}}/><details className="client-add-panel"><summary className="button">＋ Tambah Client</summary><form action={saveAgencyClient} className="client-add-form"><label>Nama Client<input name="client_name" required maxLength={180} placeholder="Masukkan nama client"/></label><label>Jenis Client<select name="client_type" defaultValue="prospect" required>{clientTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button className="button">Simpan Client</button></form></details></div>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Client</th><th>Jenis Client</th><th>Aksi</th></tr></thead><tbody>{rows.map(client=><tr key={client.id}><td><b>{client.client_name}</b></td><td><span className="client-type-pill">{labels[client.client_type]??client.client_type}</span></td><td><div className="table-actions"><a href={`/admin/client/${client.id}`}>Edit</a><form action={deleteAgencyClient}><input type="hidden" name="id" value={client.id}/><button className="table-delete">Hapus</button></form></div></td></tr>)}{!rows.length&&<tr><td colSpan={3} className="empty-state">{selectedType?"Belum ada client dengan jenis ini.":"Belum ada client. Tekan “Tambah Client” untuk mulai mengisi data."}</td></tr>}</tbody></table></div>
    <nav className="client-pagination" aria-label="Navigasi halaman client"><span>{total?`Menampilkan ${offset+1}–${Math.min(offset+rows.length,total)} dari ${total} client`:`0 client`}</span><div><Link aria-disabled={page<=1} className={page<=1?"disabled":""} href={pageHref(Math.max(1,page-1))}>Sebelumnya</Link><span>Halaman {page} dari {pageCount}</span><Link aria-disabled={page>=pageCount} className={page>=pageCount?"disabled":""} href={pageHref(Math.min(pageCount,page+1))}>Berikutnya</Link></div></nav>
  </div></main></div>;
}
