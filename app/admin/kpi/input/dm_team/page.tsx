import Link from "next/link";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";
import LiveSearchFilter from "@/components/live-search-filter";
import { getAdminSessionUser, verifyAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { deleteDmTeamMember, saveDmTeamMember } from "./actions";

export const metadata = { title: "Data Tim DM | Solusi Sejalan" };
type Member = RowDataPacket & { id:number; full_name:string };

export default async function DmTeamPage({ searchParams }: { searchParams:Promise<{saved?:string;deleted?:string;error?:string;search?:string}> }) {
  if (!(await verifyAdminSession())) redirect("/admin/login");
  const user=await getAdminSessionUser();
  if (!(user?.role==="superadmin"||user?.admin_scope==="dm"||user?.admin_scope==="both")) redirect("/admin");
  const query=await searchParams;
  const searchText=(query.search??"").trim().slice(0,100);
  const [members]=await getDb().execute<Member[]>(`SELECT id,full_name FROM dm_team_members${searchText?" WHERE full_name LIKE ?":""} ORDER BY full_name,id LIMIT 500`,searchText?[`%${searchText}%`]:[]);
  return <div className="admin-page"><AdminNavigation active="kpi" teamActive="dm-team"/><main className="admin-main admin-section-main"><AdminTopbar section="Tim" page="Data Tim DM"/><div className="admin-shell admin-form-shell team-kpi-form-shell"><section className="admin-heading"><div><span className="eyebrow">WORKSPACE / DM</span><h1>Data Tim DM</h1><p>Kelola nama orang DM di sini. Penugasan client dibuat terpisah pada halaman Data Client untuk DM.</p></div><Link className="button" href="/admin/kpi/input/dm_client">Buka Data Client DM <span>↗</span></Link></section>
    {query.saved&&<div className="admin-success">Nama anggota DM berhasil disimpan.</div>}{query.deleted&&<div className="admin-success">Nama anggota DM berhasil dihapus.</div>}{query.error&&<div className="admin-error">{query.error==="duplicate"?"Nama tersebut sudah terdaftar.":"Data tidak dapat diproses. Periksa nama lalu coba kembali."}</div>}
    <details className="add-record dm-team-add"><summary>Tambah Orang DM</summary><form action={saveDmTeamMember} className="package-edit-form"><label>Nama orang DM<input name="full_name" required maxLength={160} placeholder="Masukkan nama anggota DM"/><small>Masukkan nama anggota tim DM yang akan dipakai saat membuat penugasan client.</small></label><button className="button">Simpan Nama DM</button></form></details>
    <section className="analytics-panel dae-strategy-summary"><div className="analytics-panel-heading"><div><h2>Daftar Tim DM</h2><p>{members.length} anggota ditemukan</p></div></div><LiveSearchFilter search={searchText} searchLabel="Cari nama DM" placeholder="Ketik nama anggota DM"/><div className="admin-table-wrap"><table className="admin-table dm-team-table"><thead><tr><th>Nama orang DM</th><th>Aksi</th></tr></thead><tbody>{members.map(member=><tr key={member.id}><td data-label="Nama orang DM"><b>{member.full_name}</b></td><td data-label="Aksi"><div className="table-actions"><details className="row-edit"><summary>Edit</summary><form action={saveDmTeamMember} className="workflow-form"><input type="hidden" name="id" value={member.id}/><label className="workflow-wide">Nama orang DM<input name="full_name" defaultValue={member.full_name} required maxLength={160}/></label><button className="button">Simpan</button></form></details><form action={deleteDmTeamMember}><input type="hidden" name="id" value={member.id}/><button className="table-delete">Hapus</button></form></div></td></tr>)}{!members.length&&<tr><td colSpan={2} className="empty-state">{searchText?"Nama anggota DM tidak ditemukan.":"Belum ada nama tim DM. Tambahkan nama untuk mulai membuat penugasan client."}</td></tr>}</tbody></table></div></section>
  </div></main></div>;
}
