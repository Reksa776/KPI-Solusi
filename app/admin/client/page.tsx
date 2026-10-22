import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { RowDataPacket } from "@/lib/db-types";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";
import { verifyAdminAnyScope, verifyAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { deleteAgencyClient, saveAgencyClient } from "./actions";
import { clientTypes } from "@/components/admin-client-form";

export const metadata: Metadata = { title: "Client | Solusi Sejalan" };
type ClientRow = RowDataPacket & { id:number;client_name:string;client_type:string };
export default async function ClientPage({ searchParams }: { searchParams: Promise<{ saved?:string; deleted?:string; error?:string }> }) {
  if (!(await verifyAdminSession())) redirect("/admin/login");
  if (!(await verifyAdminAnyScope(["dm","dae"]))) redirect("/admin");
  const query = await searchParams;
  const [rows]=await getDb().execute<ClientRow[]>("SELECT id,client_name,client_type FROM agency_clients ORDER BY client_name ASC,id DESC LIMIT 500");
  const labels=Object.fromEntries(clientTypes);
  return <div className="admin-page"><AdminNavigation active="client"/><main className="admin-main admin-section-main"><AdminTopbar section="Client" page="Data client"/><div className="admin-shell"><section className="admin-heading"><div><span className="eyebrow">DATA DM &amp; DAE</span><h1>Client</h1><p>Daftar client beserta jenisnya untuk kebutuhan input DM dan DAE.</p></div></section>
    {query.saved&&<div className="admin-success">Data client berhasil disimpan.</div>}{query.deleted&&<div className="admin-success">Client berhasil dihapus.</div>}{query.error&&<div className="admin-error">Data tidak dapat diproses. Periksa kembali isian yang dimasukkan.</div>}
    <details className="client-add-panel"><summary className="button">＋ Tambah Client</summary><form action={saveAgencyClient} className="client-add-form"><label>Nama Client<input name="client_name" required maxLength={180} placeholder="Masukkan nama client"/></label><label>Jenis Client<select name="client_type" defaultValue="prospect" required>{clientTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button className="button">Simpan Client</button></form></details>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Client</th><th>Jenis Client</th><th>Aksi</th></tr></thead><tbody>{rows.map(client=><tr key={client.id}><td><b>{client.client_name}</b></td><td><span className="client-type-pill">{labels[client.client_type]??client.client_type}</span></td><td><div className="table-actions"><a href={`/admin/client/${client.id}`}>Edit</a><form action={deleteAgencyClient}><input type="hidden" name="id" value={client.id}/><button className="table-delete">Hapus</button></form></div></td></tr>)}{!rows.length&&<tr><td colSpan={3} className="empty-state">Belum ada client. Tekan “Tambah Client” untuk mulai mengisi data.</td></tr>}</tbody></table></div>
  </div></main></div>;
}
