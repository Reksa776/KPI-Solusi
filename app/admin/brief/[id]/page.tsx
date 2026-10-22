import { notFound, redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import { verifyAdminScope, verifyAdminAnyScope, verifyAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import type { LeadActivity, LeadAssignee } from "@/lib/lead-types";
import AdminBriefForm from "@/components/admin-brief-form";

type Lead = RowDataPacket & { id: number; contact_name: string; company_name: string; email: string; phone: string; campaign_goal: string; target_audience: string; preferred_channels: string; website_or_social: string | null; budget_min: number | null; budget_max: number | null; status: string; assigned_user_id: number | null; follow_up_value: string | null; internal_notes: string | null };
type ActivityRow = RowDataPacket & LeadActivity;
type UserRow = RowDataPacket & LeadAssignee;

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  if (!(await verifyAdminSession())) redirect("/admin/login");if(!(await verifyAdminScope("dae")))redirect("/admin");
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const db = getDb();
  const [[leads], [assignees], [activities], query] = await Promise.all([
    db.execute<Lead[]>("SELECT l.*,DATE_FORMAT(l.follow_up_at,'%Y-%m-%dT%H:%i') follow_up_value FROM leads l WHERE l.id=?", [id]),
    db.execute<UserRow[]>("SELECT id,full_name FROM users WHERE role IN ('superadmin','admin') AND status='active' ORDER BY full_name"),
    db.execute<ActivityRow[]>("SELECT a.id,a.activity_type,a.description,a.created_at,u.full_name actor_name,CASE a.activity_type WHEN 'created' THEN 'Brief diterima' WHEN 'status' THEN 'Status diperbarui' WHEN 'note' THEN 'Catatan internal' WHEN 'assignment' THEN 'Penanggung jawab diperbarui' WHEN 'follow_up' THEN 'Jadwal follow-up diperbarui' WHEN 'converted' THEN 'Brief menjadi campaign' ELSE 'Aktivitas' END label FROM lead_activities a LEFT JOIN users u ON u.id=a.actor_user_id WHERE a.lead_id=? ORDER BY a.created_at DESC,a.id DESC LIMIT 100", [id]),
    searchParams,
  ]);
  if (!leads[0]) notFound();
  if (leads[0].status === "converted") redirect("/admin/brief?converted=1");
  return <AdminBriefForm lead={leads[0]} operations={{ leadId: id, assignedUserId: leads[0].assigned_user_id, followUpValue: leads[0].follow_up_value ?? "", internalNotes: leads[0].internal_notes, assignees, activities, saved: Boolean(query.saved), error: query.error }} />;
}
