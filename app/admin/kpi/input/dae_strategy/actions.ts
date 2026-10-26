"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import { getAdminSessionUser, verifyAdminAnyScope } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";

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
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])-01$/.test(weekStart);
  if (!daePerson || !validMonth || !strategyTexts.length || strategyTexts.length !== clientIds.length || strategyTexts.length > 50 || strategyTexts.some(text => !text) || clientIds.some(id => !Number.isSafeInteger(id) || id < 1)) redirect(`${path}?${replaceDaePerson ? `edit=${encodeURIComponent(replaceDaePerson)}&week=${encodeURIComponent(replaceWeekStart.slice(0,7))}` : "new=1"}&error=invalid`);
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
  await db.transaction(async tx => {
    if (replaceDaePerson) await tx.execute("DELETE FROM dae_strategy_details WHERE dae_person=? AND week_start>=? AND week_start<DATE_ADD(?,INTERVAL 1 MONTH)", [replaceDaePerson, `${replaceWeekStart.slice(0,7)}-01`, `${replaceWeekStart.slice(0,7)}-01`]);
    for (let index = 0; index < strategyTexts.length; index++) {
      await tx.execute("INSERT INTO dae_strategy_details (dae_person,week_start,strategy_text,agency_client_id,created_by) VALUES (?,?,?,?,?)", [daePerson, weekStart, strategyTexts[index], clientIds[index], user?.id ?? null]);
    }
  });
  revalidatePath(path);
  revalidatePath("/admin/kpi");
  revalidatePath("/admin");
  redirect(`${path}?saved=1`);
}

export async function deleteDaeStrategiesByPerson(form: FormData) {
  if (!(await verifyAdminAnyScope(["dm", "dae"]))) redirect("/admin/kpi");
  const person = String(form.get("dae_person") ?? "").trim().slice(0, 160);
  const month=String(form.get("week_start")??"").trim().slice(0,7);
  if (!person||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) redirect(path);
  await getDb().execute("DELETE FROM dae_strategy_details WHERE dae_person=? AND week_start>=? AND week_start<DATE_ADD(?,INTERVAL 1 MONTH)", [person,`${month}-01`,`${month}-01`]);
  revalidatePath(path);
  revalidatePath("/admin/kpi");
  revalidatePath("/admin");
  redirect(`${path}?deleted=1`);
}
