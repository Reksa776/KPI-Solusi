import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import type { RowDataPacket } from "@/lib/db-types";
import { verifyAdminScope, verifyAdminAnyScope, verifyAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";
import { convertLead, deleteLead } from "@/app/admin/workflow-actions";

export const metadata: Metadata = { title: "Brief masuk | Admin" };
type LeadRow = RowDataPacket & { id: number; contact_name: string; company_name: string; email: string; phone: string; campaign_goal: string; preferred_channels: string; budget_min: number | null; budget_max: number | null; status: string; created_at: Date; assigned_name: string | null; follow_up_label: string | null; is_overdue: number };

export default async function Page({ searchParams }: { searchParams: Promise<{ saved?: string; converted?: string; error?: string }> }) {
  if (!(await verifyAdminSession())) redirect("/admin/login");if(!(await verifyAdminScope("dae")))redirect("/admin");
  const [query, [rows]] = await Promise.all([
    searchParams,
    getDb().execute<LeadRow[]>("SELECT l.*,u.full_name assigned_name,DATE_FORMAT(l.follow_up_at,'%d %b %Y · %H:%i') follow_up_label,IF(l.follow_up_at IS NOT NULL AND l.follow_up_at<NOW() AND l.status NOT IN ('converted','closed'),1,0) is_overdue FROM leads l LEFT JOIN users u ON u.id=l.assigned_user_id ORDER BY CASE WHEN l.follow_up_at IS NOT NULL AND l.follow_up_at<NOW() AND l.status NOT IN ('converted','closed') THEN 0 ELSE 1 END,l.created_at DESC LIMIT 300"),
  ]);
  return <div className="admin-page"><AdminNavigation active="brief"/><main className="admin-main admin-section-main"><AdminTopbar section="Operasional" page="Brief masuk"/><div className="admin-shell"><section className="admin-heading"><div><span className="eyebrow">Prospek campaign</span><h1>Brief masuk</h1><p>Kelola brief, penanggung jawab, dan tindak lanjut calon klien.</p></div><Link className="button" href="/admin/brief/baru">＋ Tambah brief</Link></section>
    {query.saved ? <div className="admin-success">Perubahan brief berhasil disimpan.</div> : null}{query.converted ? <div className="admin-success">Brief tersebut sudah dikonversi menjadi campaign.</div> : null}{query.error ? <div className="admin-error">Brief belum berhasil disimpan. Periksa data yang dimasukkan.</div> : null}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Brand / kontak</th><th>Tujuan campaign</th><th>Kanal &amp; budget</th><th>PIC / follow-up</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{rows.map((lead)=>{const overdue=Boolean(lead.is_overdue);return <tr key={lead.id}><td><b>{lead.company_name}</b><small>{lead.contact_name} · {lead.email}</small><small>{lead.phone}</small></td><td>{lead.campaign_goal}</td><td>{lead.preferred_channels}<small>{lead.budget_min?`Rp ${Number(lead.budget_min).toLocaleString("id-ID")}`:"—"} – {lead.budget_max?`Rp ${Number(lead.budget_max).toLocaleString("id-ID")}`:"—"}</small></td><td><b>{lead.assigned_name??"Belum ada PIC"}</b><small className={overdue?"lead-overdue":""}>{lead.follow_up_label?`${overdue?"Terlambat · ":"Follow-up · "}${lead.follow_up_label}`:"Belum dijadwalkan"}</small></td><td><span className={`status-pill ${overdue?"draft":""}`}>{lead.status}</span></td><td><div className="table-actions">{lead.status!=="converted"&&<><Link href={`/admin/brief/${lead.id}`}>Kelola</Link><form action={convertLead}><input type="hidden" name="id" value={lead.id}/><button className="table-action">Buat campaign</button></form></>}<form action={deleteLead}><input type="hidden" name="id" value={lead.id}/><button className="table-delete">Hapus</button></form></div></td></tr>})}{!rows.length&&<tr><td colSpan={6} className="empty-state">Belum ada brief.</td></tr>}</tbody></table></div><p className="admin-footnote">Follow-up yang terlambat ditampilkan lebih dahulu. Atur pengingat dari halaman Kelola pada setiap brief.</p></div></main></div>;
}
