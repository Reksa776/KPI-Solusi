"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import { getAdminSessionUser, verifyAdminAnyScope } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { monthWeekFromStart } from "@/lib/dae-weeks";
import { isExistingAgencyClientType } from "@/lib/client-types";

const path = "/admin/kpi/input/dae_individual";
type Assignment = RowDataPacket & { dae_person: string; agency_client_ids: unknown };
function readIds(value: unknown): number[] {
  try { const source = value instanceof Uint8Array ? new TextDecoder().decode(value) : value; const parsed = typeof source === "string" ? JSON.parse(source) : source; return Array.isArray(parsed) ? [...new Set(parsed.map(Number).filter(id => Number.isSafeInteger(id) && id > 0))] : []; }
  catch { return []; }
}
function validWeek(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value && Boolean(monthWeekFromStart(value));
}

export async function saveDaeWeeklyReport(form: FormData) {
  if (!(await verifyAdminAnyScope(["dm", "dae"]))) redirect("/admin/kpi");
  const id = Number(form.get("id") ?? 0);
  const person = String(form.get("dae_person") ?? "").trim().slice(0, 160);
  const week = String(form.get("week_start") ?? "").trim();
  const coordination = String(form.get("team_coordination") ?? "").trim().slice(0, 5000);
  const dailyReport = String(form.get("daily_report") ?? "").trim().slice(0, 10000);
  if (!person || !validWeek(week) || !monthWeekFromStart(week) || (id && (!Number.isSafeInteger(id) || id < 1))) redirect(`${path}?${id ? `edit=${id}` : "new=1"}&error=invalid`);

  const db = getDb();
  const [assignments] = await db.execute<Assignment[]>("SELECT dae_person,agency_client_ids FROM team_activity_entries WHERE entry_type='dae_team' AND dae_person=? ORDER BY updated_at DESC,id DESC LIMIT 1", [person]);
  if (!assignments.length) redirect(`${path}?${id ? `edit=${id}` : "new=1"}&error=person`);
  const [existingRows] = await db.execute<(RowDataPacket & { id: number; client_type: string })[]>("SELECT id,client_type FROM agency_clients");
  const existingClientIds = new Set(existingRows.filter(row => isExistingAgencyClientType(row.client_type)).map(row => Number(row.id)));
  const clients = new Set(assignments.flatMap(row => readIds(row.agency_client_ids)).filter(clientId => existingClientIds.has(clientId)));
  const [strategies] = await db.execute<(RowDataPacket & { total: number })[]>("SELECT COUNT(*) AS total FROM dae_strategy_details WHERE dae_person=? AND week_start>=? AND week_start<DATE_ADD(?,INTERVAL 1 MONTH)", [person,`${week.slice(0,7)}-01`,`${week.slice(0,7)}-01`]);
  const [visits] = await db.execute<(RowDataPacket & { total: number })[]>("SELECT COALESCE(SUM(visit_count),0) AS total FROM dae_visit_details WHERE dae_person=? AND week_start=?", [person, week]);
  const [weekAssignments] = await db.execute<Assignment[]>("SELECT e.dae_person,e.agency_client_ids FROM team_activity_entries e WHERE e.entry_type='dae_team' AND e.dae_person IS NOT NULL AND TRIM(e.dae_person)<>'' AND e.id=(SELECT latest.id FROM team_activity_entries latest WHERE latest.entry_type='dae_team' AND latest.dae_person=e.dae_person ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1)");
  const counts = new Map<string, Set<number>>();
  for (const row of weekAssignments) {
    const bucket = counts.get(row.dae_person) ?? new Set<number>();
    readIds(row.agency_client_ids).filter(clientId => existingClientIds.has(clientId)).forEach(clientId => bucket.add(clientId));
    counts.set(row.dae_person, bucket);
  }
  const higher = [...counts.values()].filter(bucket => bucket.size > clients.size).length;
  const rank = higher + 1;
  const user = await getAdminSessionUser();
  if (id) {
    const [conflicts] = await db.execute<(RowDataPacket & { id: number })[]>("SELECT id FROM dae_weekly_reports WHERE dae_person=? AND week_start=? AND id<>? LIMIT 1", [person, week, id]);
    if (conflicts.length) redirect(`${path}?edit=${id}&error=exists`);
    const [result] = await db.execute("UPDATE dae_weekly_reports SET dae_person=?,week_start=?,client_retention_count=?,strategy_idea_count=?,visit_count=?,achievement_client_count=?,achievement_rank=?,team_coordination=?,daily_report=? WHERE id=?", [person, week, clients.size, Number(strategies[0]?.total ?? 0), Number(visits[0]?.total ?? 0), clients.size, rank, coordination || null, dailyReport || null, id]);
    if ((result as { affectedRows: number }).affectedRows === 0) redirect(`${path}?error=missing`);
  } else {
    try {
      await db.execute("INSERT INTO dae_weekly_reports (dae_person,week_start,client_retention_count,strategy_idea_count,visit_count,achievement_client_count,achievement_rank,team_coordination,daily_report,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)", [person, week, clients.size, Number(strategies[0]?.total ?? 0), Number(visits[0]?.total ?? 0), clients.size, rank, coordination || null, dailyReport || null, user?.id ?? null]);
    } catch (error) {
      if ((error as { code?: string }).code === "ER_DUP_ENTRY") redirect(`${path}?new=1&error=exists`);
      throw error;
    }
  }
  revalidatePath(path);
  revalidatePath("/admin/kpi");
  redirect(`${path}?saved=1`);
}

export async function deleteDaeWeeklyReport(form: FormData) {
  if (!(await verifyAdminAnyScope(["dm", "dae"]))) redirect("/admin/kpi");
  const id = Number(form.get("id"));
  if (!Number.isSafeInteger(id) || id < 1) redirect(path);
  await getDb().execute("DELETE FROM dae_weekly_reports WHERE id=?", [id]);
  revalidatePath(path);
  revalidatePath("/admin/kpi");
  redirect(`${path}?deleted=1`);
}
