"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import { getAdminSessionUser, verifyAdminAnyScope } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { monthWeekFromStart } from "@/lib/dae-weeks";

const path = "/admin/kpi/input/dae_visit";
function readIds(value: unknown): number[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.map(Number).filter(id => Number.isSafeInteger(id) && id > 0) : [];
  } catch { return []; }
}

export async function saveDaeVisits(form: FormData) {
  if (!(await verifyAdminAnyScope(["dm", "dae"]))) redirect("/admin/kpi");
  const person = String(form.get("dae_person") ?? "").trim().slice(0, 160);
  const weekStart=String(form.get("week_start")??"").trim();
  const replacePerson = String(form.get("replace_dae_person") ?? "").trim().slice(0, 160);
  const replaceWeekStart=String(form.get("replace_week_start")??"").trim();
  const rawClientIds = form.getAll("agency_client_ids").map(value => Number(String(value)));
  const visitCounts = form.getAll("visit_counts").map(value => Number(String(value)));
  const clientIds = [...new Set(rawClientIds)];
  const weekValid=/^\d{4}-\d{2}-\d{2}$/.test(weekStart)&&!Number.isNaN(Date.parse(`${weekStart}T00:00:00Z`))&&Boolean(monthWeekFromStart(weekStart));
  if (!person || !weekValid || !monthWeekFromStart(weekStart) || !clientIds.length || clientIds.length > 100 || rawClientIds.length !== visitCounts.length || clientIds.length !== rawClientIds.length || visitCounts.some(count => !Number.isSafeInteger(count) || count < 1 || count > 1000)) redirect(`${path}?${replacePerson ? `edit=${encodeURIComponent(replacePerson)}&week=${encodeURIComponent(replaceWeekStart)}` : "new=1"}&error=invalid`);
  const db = getDb();
  const [assignments] = await db.execute<(RowDataPacket & { agency_client_ids: unknown })[]>("SELECT agency_client_ids FROM team_activity_entries WHERE entry_type='dae_team' AND dae_person=? ORDER BY updated_at DESC,id DESC LIMIT 1", [person]);
  if (!assignments.length) redirect(`${path}?${replacePerson ? `edit=${encodeURIComponent(replacePerson)}&week=${encodeURIComponent(replaceWeekStart)}` : "new=1"}&error=person`);
  const assignedIds = new Set(assignments.flatMap(row => readIds(row.agency_client_ids)));
  if (clientIds.some(id => !assignedIds.has(id))) redirect(`${path}?${replacePerson ? `edit=${encodeURIComponent(replacePerson)}` : "new=1"}&error=client`);
  if (replacePerson) {
    const [oldRows] = await db.execute<(RowDataPacket & { dae_person: string })[]>("SELECT dae_person FROM team_activity_entries WHERE entry_type='dae_team' AND dae_person=? LIMIT 1", [replacePerson]);
    if (!oldRows.length) redirect(`${path}?error=person`);
  }
  const user = await getAdminSessionUser();
  await db.transaction(async tx => {
    if (replacePerson) await tx.execute("DELETE FROM dae_visit_details WHERE dae_person=? AND week_start=?", [replacePerson,replaceWeekStart]);
    for (let index = 0; index < clientIds.length; index++) await tx.execute("INSERT INTO dae_visit_details (dae_person,week_start,agency_client_id,visit_count,created_by) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE visit_count=VALUES(visit_count),created_by=VALUES(created_by)", [person,weekStart,clientIds[index],visitCounts[index],user?.id ?? null]);
  });
  revalidatePath(path);
  revalidatePath("/admin/kpi");
  revalidatePath("/admin");
  redirect(`${path}?saved=1`);
}

export async function deleteDaeVisits(form: FormData) {
  if (!(await verifyAdminAnyScope(["dm", "dae"]))) redirect("/admin/kpi");
  const person = String(form.get("dae_person") ?? "").trim().slice(0, 160);
  const weekStart=String(form.get("week_start")??"").trim();
  if (!person||!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) redirect(path);
  await getDb().execute("DELETE FROM dae_visit_details WHERE dae_person=? AND week_start=?", [person,weekStart]);
  revalidatePath(path);
  revalidatePath("/admin/kpi");
  revalidatePath("/admin");
  redirect(`${path}?deleted=1`);
}
