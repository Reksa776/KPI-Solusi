import Link from "next/link";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";
import { getAdminSessionUser, verifyAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import DaeTeamClientFields from "@/components/dae-team-client-fields";
import { deleteDmTeamMember, saveDmTeamMember } from "./actions";

export const metadata = { title: "Data Tim DM | Solusi Sejalan" };
type Member = RowDataPacket & { id:number; full_name:string };
type Client = RowDataPacket & { id:number; client_name:string; client_type:string };
type Assignment = RowDataPacket & { dm_team_member_id:number; agency_client_id:number };

export default async function DmTeamPage({ searchParams }: { searchParams:Promise<{saved?:string;deleted?:string;error?:string}> }) {
  if (!(await verifyAdminSession())) redirect("/admin/login");
  const user=await getAdminSessionUser();
  if (!(user?.role==="superadmin"||user?.admin_scope==="dm"||user?.admin_scope==="both")) redirect("/admin");
  const query=await searchParams;
  const db=getDb();
  const [[members],[clientRows],[assignmentRows]]=await Promise.all([
    db.execute<Member[]>("SELECT id,full_name FROM dm_team_members ORDER BY full_name,id LIMIT 500"),
    db.execute<Client[]>("SELECT id,client_name,client_type FROM agency_clients ORDER BY client_name LIMIT 2000"),
    db.execute<Assignment[]>("SELECT dm_team_member_id,agency_client_id FROM dm_client_assignments ORDER BY dm_team_member_id,agency_client_id")
  ]);
  const clients=clientRows.map(client=>({...client,id:Number(client.id)}));
  const assignments=new Map<number,number[]>();
  for(const row of assignmentRows){const ids=assignments.get(Number(row.dm_team_member_id))??[];ids.push(Number(row.agency_client_id));assignments.set(Number(row.dm_team_member_id),ids)}
  const namesById=new Map(clients.map(client=>[client.id,client.client_name]));
  return <div className="admin-page"><AdminNavigation active="kpi" teamActive="dm-team"/><main className="admin-main admin-section-main"><AdminTopbar section="Tim" page="Data Tim DM"/><div className="admin-shell admin-form-shell team-kpi-form-shell"><section className="admin-heading"><div><span className="eyebrow">WORKSPACE / DM</span><h1>Data Tim DM</h1><p>Tetapkan client yang ditangani tiap DM sekali saja. Daftar ini akan otomatis muncul saat input performa.</p></div><Link className="button" href="/admin/kpi/input/dm_client">Input Data Client <span>↗</span></Link></section>
    {query.saved&&<div className="admin-success">Nama anggota DM berhasil disimpan.</div>}{query.deleted&&<div className="admin-success">Nama anggota DM berhasil dihapus.</div>}{query.error&&<div className="admin-error">{query.error==="duplicate"?"Nama tersebut sudah terdaftar.":query.error==="client"?"Ada client yang sudah tidak tersedia. Muat ulang dan pilih kembali.":"Data tidak dapat diproses. Periksa nama dan penugasan client."}</div>}
    <details className="add-record dm-team-add"><summary>Tambah DM dan client yang ditangani</summary><form action={saveDmTeamMember} className="package-edit-form"><label>Nama orang DM<input name="full_name" required maxLength={160} placeholder="Masukkan nama anggota DM"/></label><DaeTeamClientFields clients={clients}/><button className="button">Simpan DM dan client</button></form></details>
    <section className="analytics-panel dae-strategy-summary"><div className="analytics-panel-heading"><div><h2>Daftar Tim DM</h2><p>{members.length} anggota terdaftar</p></div></div><div className="admin-table-wrap"><table className="admin-table dm-team-table"><thead><tr><th>Nama orang DM</th><th>Client yang ditangani</th><th>Jumlah client</th><th>Aksi</th></tr></thead><tbody>{members.map(member=>{const clientIds=assignments.get(Number(member.id))??[],clientNames=clientIds.map(id=>namesById.get(id)).filter((name):name is string=>Boolean(name));return <tr key={member.id}><td><b>{member.full_name}</b></td><td>{clientNames.length?clientNames.join(", "):"Belum ada client"}</td><td>{clientNames.length}</td><td><div className="table-actions"><details className="row-edit"><summary>Edit</summary><form action={saveDmTeamMember} className="workflow-form"><input type="hidden" name="id" value={member.id}/><label className="workflow-wide">Nama orang DM<input name="full_name" defaultValue={member.full_name} required maxLength={160}/></label><div className="workflow-wide"><DaeTeamClientFields clients={clients} selectedIds={clientIds}/></div><button className="button">Simpan</button></form></details><form action={deleteDmTeamMember}><input type="hidden" name="id" value={member.id}/><button className="table-delete">Hapus</button></form></div></td></tr>})}{!members.length&&<tr><td colSpan={4} className="empty-state">Belum ada nama tim DM. Tambahkan DM dan client yang ditangani untuk mulai input otomatis.</td></tr>}</tbody></table></div></section>
  </div></main></div>;
}
