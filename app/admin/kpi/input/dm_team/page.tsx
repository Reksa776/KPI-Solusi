import Link from "next/link";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";
import LiveSearchFilter from "@/components/live-search-filter";
import ConfirmDeleteButton from "@/components/confirm-delete-button";
import DmSpreadsheetSource from "@/components/dm-spreadsheet-source";
import { getAdminSessionUser, verifyAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { deleteDmTeamMember, saveDmTeamMember } from "./actions";
import { saveDmSpreadsheetSource } from "../dm_client/actions";

export const metadata = { title: "Data Tim DM | Solusi Sejalan" };
type Member = RowDataPacket & { id:number; full_name:string;spreadsheet_url:string|null;last_synced_at:Date|string|null;last_sync_status:string|null };

export default async function DmTeamPage({ searchParams }: { searchParams:Promise<{saved?:string;deleted?:string;error?:string;search?:string;cascade?:string;synced?:string;processed?:string;rows?:string;created?:string;updated?:string;failed?:string;sync?:string}> }) {
  if (!(await verifyAdminSession())) redirect("/admin/login");
  const user=await getAdminSessionUser();
  if (!(user?.role==="superadmin"||user?.admin_scope==="dm"||user?.admin_scope==="both")) redirect("/admin");
  const query=await searchParams;
  const searchText=(query.search??"").trim().slice(0,100);
  const db=getDb(),[[members],[allMembers]]=await Promise.all([db.execute<Member[]>(`SELECT m.id,m.full_name,s.spreadsheet_url,s.last_synced_at,s.last_sync_status FROM dm_team_members m LEFT JOIN dm_spreadsheet_sources s ON s.dm_team_member_id=m.id${searchText?" WHERE m.full_name LIKE ?":""} ORDER BY m.full_name,m.id LIMIT 500`,searchText?[`%${searchText}%`]:[]),db.execute<Member[]>("SELECT m.id,m.full_name,s.spreadsheet_url,s.last_synced_at,s.last_sync_status FROM dm_team_members m LEFT JOIN dm_spreadsheet_sources s ON s.dm_team_member_id=m.id ORDER BY m.full_name,m.id LIMIT 500")]);
  const spreadsheetUrl=allMembers.find(member=>member.spreadsheet_url)?.spreadsheet_url??null,lastSource=[...allMembers].filter(member=>member.last_synced_at).sort((a,b)=>String(b.last_synced_at).localeCompare(String(a.last_synced_at)))[0];
  return <div className="admin-page"><AdminNavigation active="kpi" teamActive="dm-team"/><main className="admin-main admin-section-main"><AdminTopbar section="Tim" page="Data Tim DM"/><div className="admin-shell admin-form-shell team-kpi-form-shell"><section className="admin-heading"><div><span className="eyebrow">WORKSPACE / DM</span><h1>Data Tim DM</h1><p>Kelola nama orang DM di sini. Penugasan client dibuat terpisah pada halaman Data Client untuk DM.</p></div><Link className="button" href="/admin/kpi/input/dm_client">Buka Data Client DM <span>↗</span></Link></section>
    {query.saved&&<div className="admin-success">{query.saved==="sheet"?query.sync==="error"?"Link spreadsheet disimpan, tetapi sinkronisasi otomatis gagal dijalankan.":`Link disimpan · ${query.synced??0}/${query.processed??0} tab berhasil · ${query.rows??0} baris data dibaca (${query.created??0} baru, ${query.updated??0} diperbarui)${Number(query.failed)>0?` · ${query.failed} tab perlu diperiksa`:""}.`:"Nama anggota DM berhasil disimpan."}</div>}{query.deleted&&<div className="admin-success">Nama DM dan seluruh laporan, target, serta penugasan yang terkait berhasil dihapus.</div>}{query.error&&<div className="admin-error">{query.error==="sheet_url"?"Link harus berupa URL Google Spreadsheet yang valid.":query.error==="duplicate"?"Nama tersebut sudah terdaftar.":query.error==="missing"?"Anggota DM tidak ditemukan.":query.error==="dependencies"?"Anggota DM belum bisa dihapus karena masih terhubung ke data lain. Periksa relasi tim DM, laporan, dan penugasan client.":"Data tidak dapat diproses. Periksa nama lalu coba kembali."}</div>}
    <details className="add-record dm-team-add"><summary>Tambah Orang DM</summary><form action={saveDmTeamMember} className="package-edit-form"><label>Nama orang DM<input name="full_name" required maxLength={160} placeholder="Masukkan nama anggota DM"/><small>Masukkan nama anggota tim DM yang akan dipakai saat membuat penugasan client.</small></label><button className="button">Simpan Nama DM</button></form></details>
    <DmSpreadsheetSource dmIds={allMembers.map(member=>Number(member.id))} dmNames={allMembers.map(member=>member.full_name)} url={spreadsheetUrl} lastSyncedAt={lastSource?.last_synced_at?String(lastSource.last_synced_at):null} lastStatus={lastSource?.last_sync_status??null}/>
    <section className="analytics-panel dae-strategy-summary"><div className="analytics-panel-heading"><div><h2>Daftar Tim DM</h2><p>{members.length} anggota ditemukan</p></div></div><LiveSearchFilter search={searchText} searchLabel="Cari nama DM" placeholder="Ketik nama anggota DM"/><div className="admin-table-wrap"><table className="admin-table dm-team-table"><thead><tr><th>Nama orang DM</th><th>Aksi</th></tr></thead><tbody>{members.map(member=><tr key={member.id}><td data-label="Nama orang DM"><b>{member.full_name}</b></td><td data-label="Aksi"><div className="table-actions"><details className="row-edit"><summary>Edit</summary><form action={saveDmTeamMember} className="workflow-form"><input type="hidden" name="id" value={member.id}/><label className="workflow-wide">Nama orang DM<input name="full_name" defaultValue={member.full_name} required maxLength={160}/></label><button className="button">Simpan</button></form></details><form action={deleteDmTeamMember}><input type="hidden" name="id" value={member.id}/><ConfirmDeleteButton message={`Hapus ${member.full_name} beserta seluruh laporan performa, target konten, dan pasangan client DM-nya? Data yang ikut terhapus tidak dapat dipulihkan.`}/></form></div></td></tr>)}{!members.length&&<tr><td colSpan={2} className="empty-state">{searchText?"Nama anggota DM tidak ditemukan.":"Belum ada nama tim DM. Tambahkan nama untuk mulai membuat penugasan client."}</td></tr>}</tbody></table></div></section>
  </div></main></div>;
}
