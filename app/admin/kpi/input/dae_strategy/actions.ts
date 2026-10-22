"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { getAdminSessionUser, verifyAdminAnyScope } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { monthWeekFromStart } from "@/lib/dae-weeks";

const path = "/admin/kpi/input/dae_strategy";
function readIds(value: unknown): number[] { try { const parsed=typeof value==="string"?JSON.parse(value):value; return Array.isArray(parsed)?parsed.map(Number).filter(id=>Number.isSafeInteger(id)&&id>0):[]; } catch { return []; } }
export async function saveDaeStrategies(form: FormData) {
  if (!(await verifyAdminAnyScope(["dm", "dae"]))) redirect("/admin/kpi");
  const daePerson = String(form.get("dae_person") ?? "").trim().slice(0, 160);
  const weekStart = String(form.get("week_start") ?? "").trim();
  const replaceDaePerson = String(form.get("replace_dae_person") ?? "").trim().slice(0, 160);
  const replaceWeekStart = String(form.get("replace_week_start") ?? "").trim();
  const strategyTexts = form.getAll("strategy_text").map(value => String(value).trim().slice(0, 500));
  const clientIds = form.getAll("strategy_client_id").map(value => Number(String(value)));
  const validWeek = /^\d{4}-\d{2}-\d{2}$/.test(weekStart) && !Number.isNaN(Date.parse(`${weekStart}T00:00:00Z`));
  if (!daePerson || !validWeek || !monthWeekFromStart(weekStart) || !strategyTexts.length || strategyTexts.length !== clientIds.length || strategyTexts.length > 50 || strategyTexts.some(text => !text) || clientIds.some(id => !Number.isSafeInteger(id) || id < 1)) redirect(`${path}?${replaceDaePerson ? `edit=${encodeURIComponent(replaceDaePerson)}&week=${encodeURIComponent(replaceWeekStart)}` : "new=1"}&error=invalid`);
  const db = getDb();
  const [people] = await db.execute<(RowDataPacket & { agency_client_ids: unknown })[]>("SELECT agency_client_ids FROM team_activity_entries WHERE entry_type='dae_team' AND dae_person=? ORDER BY updated_at DESC,id DESC LIMIT 1", [daePerson]);
  if (!people.length) redirect(`${path}?${replaceDaePerson ? `edit=${encodeURIComponent(replaceDaePerson)}&week=${encodeURIComponent(replaceWeekStart)}` : "new=1"}&error=person`);
  const assignedIds = new Set(people.flatMap(row => readIds(row.agency_client_ids)));
  if(clientIds.some(id=>!assignedIds.has(id))) redirect(`${path}?${replaceDaePerson ? `edit=${encodeURIComponent(replaceDaePerson)}&week=${encodeURIComponent(replaceWeekStart)}` : "new=1"}&error=client`);
  if (replaceDaePerson) {
    const [oldPeople] = await db.execute<(RowDataPacket & { dae_person: string })[]>("SELECT dae_person FROM team_activity_entries WHERE entry_type='dae_team' AND dae_person=? LIMIT 1", [replaceDaePerson]);
    if (!oldPeople.length) redirect(`${path}?error=person`);
  }
  const placeholders = clientIds.map(() => "?").join(",");
  const [clients] = await db.execute<(RowDataPacket & { id: number })[]>(`SELECT id FROM agency_clients WHERE id IN (${placeholders})`, [...new Set(clientIds)]);
  if (clients.length !== new Set(clientIds).size) redirect(`${path}?${replaceDaePerson ? `edit=${encodeURIComponent(replaceDaePerson)}&week=${encodeURIComponent(replaceWeekStart)}` : "new=1"}&error=client`);
  const user = await getAdminSessionUser();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    if (replaceDaePerson) await connection.execute("DELETE FROM dae_strategy_details WHERE dae_person=? AND week_start=?", [replaceDaePerson, replaceWeekStart]);
    for (let index = 0; index < strategyTexts.length; index++) {
      await connection.execute("INSERT INTO dae_strategy_details (dae_person,week_start,strategy_text,agency_client_id,created_by) VALUES (?,?,?,?,?)", [daePerson, weekStart, strategyTexts[index], clientIds[index], user?.id ?? null]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  revalidatePath(path);
  revalidatePath("/admin/kpi");
  redirect(`${path}?saved=1`);
}

export async function deleteDaeStrategiesByPerson(form: FormData) {
  if (!(await verifyAdminAnyScope(["dm", "dae"]))) redirect("/admin/kpi");
  const person = String(form.get("dae_person") ?? "").trim().slice(0, 160);
  const weekStart=String(form.get("week_start")??"").trim();
  if (!person||!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) redirect(path);
  await getDb().execute("DELETE FROM dae_strategy_details WHERE dae_person=? AND week_start=?", [person,weekStart]);
  revalidatePath(path);
  revalidatePath("/admin/kpi");
  redirect(`${path}?deleted=1`);
}
