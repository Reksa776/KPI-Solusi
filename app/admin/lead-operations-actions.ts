"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import { getAdminSessionUser, verifyAdminScope } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";

export async function updateLeadOperations(formData: FormData) {
  const actor = await getAdminSessionUser();
  if (!actor || !(await verifyAdminScope("dae"))) redirect("/admin/login");

  const id = Number(formData.get("id"));
  const assigneeRaw = String(formData.get("assigned_user_id") ?? "");
  const assigneeId = assigneeRaw ? Number(assigneeRaw) : null;
  const followUpRaw = String(formData.get("follow_up_at") ?? "");
  const followUp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(followUpRaw) ? `${followUpRaw.replace("T", " ")}:00` : null;
  const note = String(formData.get("internal_note") ?? "").trim().slice(0, 2000);

  if (!Number.isSafeInteger(id) || id < 1 || (assigneeId !== null && (!Number.isSafeInteger(assigneeId) || assigneeId < 1)) || (followUpRaw && !followUp)) redirect("/admin/brief");
  const db = getDb();
  if (assigneeId !== null) {
    const [users] = await db.execute<(RowDataPacket & { id: number })[]>("SELECT id FROM users WHERE id=? AND role IN ('superadmin','admin') AND status='active' LIMIT 1", [assigneeId]);
    if (!users.length) redirect(`/admin/brief/${id}?error=operations`);
  }

  const [[lead]] = await db.execute<(RowDataPacket & { assigned_user_id: number | null; follow_up_value: string | null; internal_notes: string | null; status: string })[]>("SELECT assigned_user_id,DATE_FORMAT(follow_up_at,'%Y-%m-%dT%H:%i') follow_up_value,internal_notes,status FROM leads WHERE id=?", [id]);
  if (!lead || lead.status === "converted") redirect("/admin/brief?converted=1");
  const assigneeChanged = Number(lead.assigned_user_id ?? 0) !== Number(assigneeId ?? 0);
  const followUpChanged = (lead.follow_up_value ?? "") !== followUpRaw;
  const noteEntry = note ? `${actor.full_name ?? "Pengelola"} — ${note}` : "";

  await db.execute("UPDATE leads SET assigned_user_id=?,follow_up_at=?,internal_notes=CASE WHEN ?='' THEN internal_notes ELSE CONCAT_WS('\\n\\n',NULLIF(internal_notes,''),?) END WHERE id=?", [assigneeId, followUp, note, noteEntry, id]);
  if (assigneeChanged) await db.execute("INSERT INTO lead_activities (lead_id,actor_user_id,activity_type,description) VALUES (?,?, 'assignment',?)", [id, actor.id, assigneeId ? `PIC brief dialihkan ke user #${assigneeId}.` : "PIC brief dihapus."]);
  if (followUpChanged) await db.execute("INSERT INTO lead_activities (lead_id,actor_user_id,activity_type,description) VALUES (?,?, 'follow_up',?)", [id, actor.id, followUp ? `Jadwal follow-up diatur ke ${followUpRaw.replace("T", " ")}.` : "Jadwal follow-up dihapus."]);
  if (note) await db.execute("INSERT INTO lead_activities (lead_id,actor_user_id,activity_type,description) VALUES (?,?, 'note',?)", [id, actor.id, note]);
  revalidatePath(`/admin/brief/${id}`);
  revalidatePath("/admin/brief");
  redirect(`/admin/brief/${id}?saved=1`);
}

export async function saveLeadRecord(formData: FormData) {
  const actor = await getAdminSessionUser();
  if (!actor || !(await verifyAdminScope("dae"))) redirect("/admin/login");
  const id = Number(formData.get("id"));
  const text = (key: string, max: number) => String(formData.get(key) ?? "").trim().slice(0, max);
  const contact = text("contact_name", 160);
  const company = text("company_name", 160);
  const email = text("email", 191).toLowerCase();
  const phone = text("phone", 40);
  const goal = text("campaign_goal", 4000);
  const audience = text("target_audience", 255);
  const channels = text("preferred_channels", 255);
  const website = text("website_or_social", 255);
  const status = text("status", 16);
  const minRaw = text("budget_min", 20);
  const maxRaw = text("budget_max", 20);
  const min = minRaw ? Number(minRaw) : null;
  const max = maxRaw ? Number(maxRaw) : null;
  if (!Number.isSafeInteger(id) || id < 1 || !contact || !company || !/^\S+@\S+\.\S+$/.test(email) || !phone || !goal || !audience || !channels || !["new", "reviewing", "proposal", "closed"].includes(status) || [min, max].some((v) => v !== null && (!Number.isSafeInteger(v) || v < 0)) || (min !== null && max !== null && max < min)) redirect("/admin/brief?error=invalid");
  const db = getDb();
  const [[prior]] = await db.execute<(RowDataPacket & { status: string })[]>("SELECT status FROM leads WHERE id=? AND status<>'converted'", [id]);
  if (!prior) redirect("/admin/brief?converted=1");
  await db.execute("UPDATE leads SET contact_name=?,company_name=?,email=?,phone=?,campaign_goal=?,target_audience=?,preferred_channels=?,website_or_social=?,budget_min=?,budget_max=?,status=? WHERE id=?", [contact, company, email, phone, goal, audience, channels, website || null, min, max, status, id]);
  if (prior.status !== status) await db.execute("INSERT INTO lead_activities (lead_id,actor_user_id,activity_type,description) VALUES (?,?, 'status',?)", [id, actor.id, `Status berubah dari ${prior.status} menjadi ${status}.`]);
  revalidatePath(`/admin/brief/${id}`);
  revalidatePath("/admin/brief");
  redirect(`/admin/brief/${id}?saved=1`);
}
