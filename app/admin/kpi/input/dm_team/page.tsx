import Link from "next/link";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";
import { getAdminSessionUser, verifyAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { deleteDmTeamMember, saveDmTeamMember } from "./actions";

export const metadata = { title: "Data Tim DM | Solusi Sejalan" };
type Member = RowDataPacket & { id:number; full_name:string };

export default async function DmTeamPage({ searchParams }: { searchParams:Promise<{saved?:string;deleted?:string;error?:string}> }) {
  if (!(await verifyAdminSession())) redirect("/admin/login");
  const user=await getAdminSessionUser();
  if (!(user?.role==="superadmin"||user?.admin_scope==="dm"||user?.admin_scope==="both")) redirect("/admin");
  const query=await searchParams;
  const [members]=await getDb().execute<Member[]>("SELECT id,full_name FROM dm_team_members ORDER BY full_name,id LIMIT 500");
  return <div className="admin-page"><AdminNavigation active="kpi" teamActive="dm-team"/><main className="admin-main admin-section-main"><AdminTopbar section="Tim" page="Data Tim DM"/><div className="admin-shell admin-form-shell team-kpi-form-shell"><section className="admin-heading"><div><span className="eyebrow">WORKSPACE / DM</span><h1>Data Tim DM</h1><p>Kelola nama anggota tim DM yang akan dipilih saat mengisi performa client.</p></div><Link className="button" href="/admin/kpi/input/dm_client">Input Data Client <span>↗</span></Link></section>
    {query.saved&&<div className="admin-success">Nama anggota DM berhasil disimpan.</div>}{query.deleted&&<div className="admin-success">Nama anggota DM berhasil dihapus.</div>}{query.error&&<div className="admin-error">{query.error==="duplicate"?"Nama tersebut sudah terdaftar.":"Data tidak dapat diproses. Periksa nama yang dimasukkan."}</div>}
    <details className="add-record dm-team-add"><summary>Tambah Nama DM</summary><form action={saveDmTeamMember} className="client-add-form"><label>Nama orang DM<input name="full_name" required maxLength={160} placeholder="Masukkan nama anggota DM"/></label><button className="button">Simpan Nama</button></form></details>
    <section className="analytics-panel dae-strategy-summary"><div className="analytics-panel-heading"><div><h2>Daftar Tim DM</h2><p>{members.length} anggota terdaftar</p></div></div><div className="admin-table-wrap"><table className="admin-table dm-team-table"><thead><tr><th>Nama orang DM</th><th>Aksi</th></tr></thead><tbody>{members.map(member=><tr key={member.id}><td><b>{member.full_name}</b></td><td><div className="table-actions"><details className="row-edit"><summary>Edit</summary><form action={saveDmTeamMember} className="workflow-form"><input type="hidden" name="id" value={member.id}/><label className="workflow-wide">Nama orang DM<input name="full_name" defaultValue={member.full_name} required maxLength={160}/></label><button className="button">Simpan</button></form></details><form action={deleteDmTeamMember}><input type="hidden" name="id" value={member.id}/><button className="table-delete">Hapus</button></form></div></td></tr>)}{!members.length&&<tr><td colSpan={2} className="empty-state">Belum ada nama tim DM. Tekan “Tambah Nama DM” untuk mulai mengisi.</td></tr>}</tbody></table></div></section>
  </div></main></div>;
}
