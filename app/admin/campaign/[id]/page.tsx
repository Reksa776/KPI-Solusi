import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import type { RowDataPacket } from "mysql2";
import { verifyAdminScope, verifyAdminAnyScope, verifyAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";
import ClippingCampaignFields from "@/components/clipping-campaign-fields";
import { saveCampaign, deleteCampaign, deleteDeliverable, reviewCampaignClip } from "@/app/admin/workflow-actions";

export const metadata: Metadata = { title: "Edit campaign | Admin" };
type C = RowDataPacket & { id:number;title:string;objective:string;status:string;assigned_dm_user_id:number|null;client_name:string;client_email:string;budget:number|null;start_date:string|null;end_date:string|null;campaign_type:string;clipping_source_url:string|null;clipping_rules:string|null;clipping_rights_confirmed:number;clipping_rate_per_1000:number;clipping_budget_cap:number|null;clipping_min_views:number };
type D = RowDataPacket & { id:number;title:string;platform:string;status:string;reach:number;impressions:number;engagements:number;video_views:number;tiktok_sales:number;shopee_sales:number;scheduled_at:Date|null };
type Clip = RowDataPacket & { id:number;clip_title:string;display_name:string;platform:string;post_url:string;status:string;views:number;clipper_note:string|null;reviewer_note:string|null };

export default async function Page({ params, searchParams }: { params:Promise<{id:string}>; searchParams:Promise<{error?:string;clip_error?:string;clip_reviewed?:string}> }) {
  if (!(await verifyAdminSession())) redirect("/admin/login");if(!(await verifyAdminAnyScope(["dm","dae"])))redirect("/admin");
  const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<1)notFound();
  const [[cs],[ds],[clips],[managers],query] = await Promise.all([
    getDb().execute<C[]>("SELECT * FROM campaigns WHERE id=?",[id]),
    getDb().execute<D[]>("SELECT * FROM campaign_deliverables WHERE campaign_id=? ORDER BY created_at DESC",[id]),
    getDb().execute<Clip[]>("SELECT cc.*,p.display_name FROM campaign_clips cc JOIN partners p ON p.id=cc.partner_id WHERE cc.campaign_id=? ORDER BY cc.submitted_at DESC",[id]),
    getDb().execute<(RowDataPacket&{id:number;full_name:string})[]>("SELECT id,full_name FROM users WHERE role IN ('admin','superadmin') AND status='active' AND admin_scope IN ('dm','both') ORDER BY full_name"),
    searchParams,
  ]);
  const c=cs[0];if(!c)notFound();
  const rate=BigInt(c.clipping_rate_per_1000||0),min=BigInt(c.clipping_min_views||0);
  const approvedReward=clips.filter(x=>x.status==="approved").reduce((sum,x)=>{const views=BigInt(x.views||0);return sum+(views>=min?views*rate/BigInt(1000):BigInt(0))},BigInt(0));
  const money=(value:bigint)=>`Rp ${value.toLocaleString("id-ID")}`;
  return <div className="admin-page"><AdminNavigation active="campaign"/><main className="admin-main admin-section-main"><AdminTopbar section="Campaign" page="Edit campaign"/><div className="admin-shell">
    <section className="admin-heading"><div><span className="eyebrow">{c.client_name} · {c.client_email}</span><h1>Edit campaign</h1><p>Atur campaign, deliverable, atau aktivasi KOL Clipping.</p></div></section>
    {query.error==="manager"&&<div className="admin-error">Pilih penanggung jawab DM yang masih aktif.</div>}{query.error==="clip_settings"&&<div className="admin-error">Lengkapi URL sumber, brief, izin penggunaan, rate, dan batas budget. Batas clipping tidak boleh melebihi budget campaign.</div>}
    {query.error==="clip_in_use"&&<div className="admin-error">Jenis campaign tidak bisa diubah karena sudah memiliki kiriman klip. Selesaikan dan arsipkan data clipping terlebih dahulu.</div>}
    {query.clip_error==="budget"&&<div className="admin-error">Persetujuan ini melewati sisa budget clipping. Kurangi views atau tambah batas budget sebelum menyetujui.</div>}
    {query.clip_reviewed&&<div className="admin-success">Review klip berhasil disimpan.</div>}
    <form action={saveCampaign} className="package-edit-form workflow-panel"><input type="hidden" name="id" value={id}/>
      <div className="form-grid"><label>Nama campaign<input name="title" defaultValue={c.title} required maxLength={180}/></label><label>Status<select name="status" defaultValue={c.status}><option value="planning">Perencanaan</option><option value="active">Aktif</option><option value="paused">Jeda</option><option value="completed">Selesai</option><option value="cancelled">Dibatalkan</option></select></label></div>
      <div className="form-grid"><label>Nama client<input name="client_name" defaultValue={c.client_name} required maxLength={160}/></label><label>Email client<input name="client_email" type="email" defaultValue={c.client_email} required maxLength={191}/></label><label>Penanggung jawab DM<select name="assigned_dm_user_id" defaultValue={c.assigned_dm_user_id??""}><option value="">Belum ditentukan</option>{managers.map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}</select></label></div>
      <label>Tujuan<textarea name="objective" defaultValue={c.objective} maxLength={4000} rows={3}/></label>
      <div className="form-grid"><label>Tanggal mulai<input name="start_date" type="date" defaultValue={c.start_date??""}/></label><label>Tanggal selesai<input name="end_date" type="date" defaultValue={c.end_date??""}/></label></div>
      <label>Budget keseluruhan (Rp)<input name="budget" type="number" min="0" defaultValue={c.budget??""}/></label>
      <ClippingCampaignFields values={c}/>
      <div className="form-actions"><button className="button">Simpan campaign <span>↗</span></button></div>
    </form>
    <section className="admin-section-label"><div><h2>Deliverables ({ds.length})</h2><p>Aktivitas, partner, jadwal, dan performa.</p></div><Link className="button" href={`/admin/campaign/${id}/deliverable/baru`}>＋ Tambah deliverable</Link></section>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Aktivitas</th><th>Platform</th><th>Status</th><th>Jadwal</th><th>Performa</th><th>Aksi</th></tr></thead><tbody>{ds.map(d=><tr key={d.id}><td><b>{d.title}</b></td><td>{d.platform}</td><td><span className="status-pill">{d.status}</span></td><td>{d.scheduled_at?new Date(d.scheduled_at).toLocaleString("id-ID"):"—"}</td><td>Reach {Number(d.reach).toLocaleString("id-ID")}<small>Views {Number(d.video_views).toLocaleString("id-ID")} · TikTok Rp {Number(d.tiktok_sales).toLocaleString("id-ID")} · Shopee Rp {Number(d.shopee_sales).toLocaleString("id-ID")}</small></td><td><div className="table-actions"><Link href={`/admin/campaign/${id}/deliverable/${d.id}`}>Edit</Link><form action={deleteDeliverable}><input type="hidden" name="id" value={d.id}/><input type="hidden" name="campaign_id" value={id}/><button className="table-delete">Hapus</button></form></div></td></tr>)}{!ds.length&&<tr><td colSpan={6} className="empty-state">Belum ada deliverable.</td></tr>}</tbody></table></div>
    {c.campaign_type==="kol_clipping"&&<>
      <section className="analytics-panel"><div className="analytics-panel-heading"><div><h2>KOL Clipping · review klip</h2><p>{clips.length} kiriman · estimasi reward disetujui {money(approvedReward)} dari batas {money(BigInt(c.clipping_budget_cap??0))}</p></div></div>
      {clips.length?<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Klip / clipper</th><th>Platform</th><th>Status</th><th>Views &amp; estimasi</th><th>Review</th></tr></thead><tbody>{clips.map(clip=>{const views=BigInt(clip.views||0),reward=views>=min?views*rate/BigInt(1000):BigInt(0);return <tr key={clip.id}><td><b>{clip.clip_title}</b><small>{clip.display_name}</small><a href={clip.post_url} target="_blank" rel="noreferrer">Buka klip ↗</a>{clip.clipper_note&&<small>{clip.clipper_note}</small>}</td><td>{clip.platform}</td><td><span className="status-pill">{clip.status}</span></td><td>{Number(clip.views).toLocaleString("id-ID")} views<small>{money(reward)}</small></td><td>{clip.status==="pending"?<form action={reviewCampaignClip} className="clip-review-form"><input type="hidden" name="id" value={clip.id}/><input name="views" type="number" min="0" step="1" placeholder="Views" required/><input name="reviewer_note" maxLength={1000} placeholder="Catatan (opsional)"/><div><button className="table-action" name="status" value="approved">Setujui</button><button className="table-delete" name="status" value="rejected">Tolak</button></div></form>:<small>{clip.reviewer_note??"—"}</small>}</td></tr>})}</tbody></table></div>:<p className="analytics-empty">Belum ada kiriman klip untuk campaign ini.</p>}</section>
    </>}
    <form action={deleteCampaign} className="workflow-delete"><input type="hidden" name="id" value={id}/><button className="table-delete">Hapus campaign</button><small>Deliverables dan kiriman klip ikut terhapus; studi kasusnya tetap tersimpan.</small></form>
  </div></main></div>;
}
