"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSessionUser, verifyAdminScope } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { monthWeekFromStart } from "@/lib/dae-weeks";

const text = (form: FormData, key: string, max = 255) => String(form.get(key) ?? "").trim().slice(0, max);
const validMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const entryTypes = ["dm_client", "dae_individual", "dae_team", "dae_strategy", "dae_visit", "dae_client"];

export async function saveKpiTarget(form: FormData) {
  const scope = text(form, "scope");
  if ((scope !== "dm" && scope !== "dae") || !(await verifyAdminScope(scope))) redirect("/admin/kpi");
  const metric = text(form, "metric"), month = text(form, "period_month"), value = Number(text(form, "target_value"));
  const allowed = scope === "dm" ? ["contents", "video_views", "tiktok_sales", "shopee_sales"] : ["new_clients", "strategies", "visits", "contents"];
  if (!allowed.includes(metric) || !validMonth(month) || !Number.isSafeInteger(value) || value < 0) redirect("/admin/kpi?error=target");
  const user = await getAdminSessionUser();
  await getDb().execute("INSERT INTO team_kpi_targets (scope,metric,period_month,target_value,updated_by) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE target_value=VALUES(target_value),updated_by=VALUES(updated_by)", [scope, metric, month, value, user?.id ?? null]);
  revalidatePath("/admin/kpi");
  redirect(`/admin/kpi?scope=${scope}&saved=target`);
}

export async function saveTeamEntry(form: FormData) {
  const type = text(form, "entry_type"), scope = type.startsWith("dm_") ? "dm" : "dae";
  const sharedDaeEntry = ["dae_team", "dae_strategy", "dae_visit"].includes(type);
  const allowed = sharedDaeEntry ? await (async()=>Boolean(await verifyAdminScope("dm")||await verifyAdminScope("dae")))() : await verifyAdminScope(scope);
  if (!entryTypes.includes(type) || !allowed) redirect("/admin/kpi");
  let id = Number(text(form, "id") || 0);
  const title = text(form, "title", 180), clientInput = text(form, "client_name", 160), daePersonInput = text(form, "dae_person", 160), date = text(form, "activity_date", 10), requestedWeek = text(form, "week_start", 10), notes = text(form, "notes", 4000);
  const weekDate = requestedWeek || date;
  const weekStart = validDate(weekDate) ? new Date(`${weekDate}T12:00:00Z`) : null;
  if (weekStart) weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
  const weekValue = weekStart?.toISOString().slice(0, 10) ?? "";
  const selectedClientIds = [...new Set(form.getAll("agency_client_ids").map(value => Number(String(value))).filter(value => Number.isSafeInteger(value) && value > 0))];
  const selectedAgencyClientIdRaw = text(form, "agency_client_id", 16);
  const selectedAgencyClientId = selectedAgencyClientIdRaw ? Number(selectedAgencyClientIdRaw) : null;
  const dmMemberIdRaw = text(form, "dm_team_member_id", 16), dmMemberId = dmMemberIdRaw ? Number(dmMemberIdRaw) : null;
  const assigneeRaw = text(form, "assigned_user_id", 16), assignee = assigneeRaw ? Number(assigneeRaw) : null;
  const fields = ["contents", "video_views", "tiktok_sales", "shopee_sales", "new_clients", "strategies", "visits"] as const;
  const numbers = fields.map((field) => Number(text(form, field) || 0));
  if (!title || !validDate(date) || !weekValue || (type.startsWith("dae_") && type !== "dae_team" && !monthWeekFromStart(weekValue)) || (type === "dae_team" && !daePersonInput) || numbers.some((number) => !Number.isSafeInteger(number) || number < 0) || selectedClientIds.length > 100 || (assignee !== null && (!Number.isSafeInteger(assignee) || assignee < 1)) || (type === "dm_client" && (!selectedAgencyClientId || !Number.isSafeInteger(selectedAgencyClientId) || selectedAgencyClientId < 1 || !dmMemberId || !Number.isSafeInteger(dmMemberId) || dmMemberId < 1)) || (type !== "dm_client" && dmMemberId !== null) || (id && (!Number.isSafeInteger(id) || id < 1)) || (type !== "dae_team" && selectedClientIds.length > 0) || (type !== "dm_client" && selectedAgencyClientId !== null)) redirect(`/admin/kpi/input/${type}?error=invalid`);
  const user = await getAdminSessionUser(), db = getDb();
  if (type === "dae_team" && !id) {
    const [existingRoster] = await db.execute<(import("@/lib/db-types").RowDataPacket & { id: number })[]>("SELECT id FROM team_activity_entries WHERE entry_type='dae_team' AND dae_person=? ORDER BY updated_at DESC,id DESC LIMIT 1", [daePersonInput]);
    id = Number(existingRoster[0]?.id ?? 0);
  }
  const daePerson: string | null = type === "dae_team" ? daePersonInput || null : null;
  let dmPerson: string | null = null;
  if (type === "dm_client" && dmMemberId) {
    const [members] = await db.execute<(import("@/lib/db-types").RowDataPacket & { full_name:string })[]>("SELECT full_name FROM dm_team_members WHERE id=? LIMIT 1", [dmMemberId]);
    if (!members[0]) redirect(`/admin/kpi/input/${type}?error=dm`);
    dmPerson = members[0].full_name;
  }
  if (assignee !== null && type !== "dae_team") {
    const [users] = await db.execute<(import("@/lib/db-types").RowDataPacket & { id: number; full_name: string })[]>("SELECT id,full_name FROM users WHERE id=? AND role IN ('admin','superadmin') AND status='active' AND admin_scope IN (?, 'both') LIMIT 1", [assignee, scope]);
    if (!users.length) redirect(`/admin/kpi/input/${type}?error=assignee`);
  }
  let client = type === "dae_team" ? null : clientInput || null, clientType: string | null = null;
  let agencyClientId: number | null = null;
  let clientIdsJson: string | null = null;
  if (type === "dm_client" && selectedAgencyClientId) {
    const [clients] = await db.execute<(import("@/lib/db-types").RowDataPacket & { id:number; client_name:string; client_type:string })[]>("SELECT id,client_name,client_type FROM agency_clients WHERE id=? LIMIT 1", [selectedAgencyClientId]);
    if (!clients[0]) redirect(`/admin/kpi/input/${type}?select=1&error=client`);
    client = clients[0].client_name;
    clientType = clients[0].client_type;
    agencyClientId = clients[0].id;
  }
  if (type === "dae_team" && selectedClientIds.length) {
    const placeholders = selectedClientIds.map(() => "?").join(",");
    const [clients] = await db.execute<(import("@/lib/db-types").RowDataPacket & { id: number; client_name: string; client_type: string })[]>(`SELECT id,client_name,client_type FROM agency_clients WHERE id IN (${placeholders}) ORDER BY client_name`, selectedClientIds);
    if (clients.length !== selectedClientIds.length) redirect(`/admin/kpi/input/${type}?error=client`);
    client = clients.map(row => row.client_name).join(", ").slice(0, 160);
    clientType = clients.length === 1 ? clients[0].client_type : null;
    clientIdsJson = JSON.stringify(clients.map(row => Number(row.id)));
  }
  const values = [scope, type, title, client, date, weekValue, ...numbers, notes || null, type === "dae_team" || type === "dm_client" ? null : assignee, type === "dm_client" ? dmMemberId : null, dmPerson, daePerson, clientType, agencyClientId, clientIdsJson];
  if (id) {
    const [existing] = await db.execute<(import("@/lib/db-types").RowDataPacket & { id:number })[]>("SELECT id FROM team_activity_entries WHERE id=? AND entry_type=? LIMIT 1", [id, type]);
    if (!existing.length) redirect(`/admin/kpi/input/${type}?error=notfound`);
    await db.execute("UPDATE team_activity_entries SET scope=?,entry_type=?,title=?,client_name=?,activity_date=?,week_start=?,contents=?,video_views=?,tiktok_sales=?,shopee_sales=?,new_clients=?,strategies=?,visits=?,notes=?,assigned_user_id=?,dm_team_member_id=?,dm_person=?,dae_person=?,client_type=?,agency_client_id=?,agency_client_ids=? WHERE id=? AND entry_type=?", [...values, id, type]);
    if (type === "dae_team") await db.execute("DELETE FROM team_activity_entries WHERE entry_type='dae_team' AND dae_person=? AND id<>?", [daePersonInput, id]);
  } else {
    await db.execute("INSERT INTO team_activity_entries (scope,entry_type,title,client_name,activity_date,week_start,contents,video_views,tiktok_sales,shopee_sales,new_clients,strategies,visits,notes,assigned_user_id,dm_team_member_id,dm_person,dae_person,client_type,agency_client_id,agency_client_ids,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [...values, user?.id ?? null]);
  }
  revalidatePath("/admin/kpi");
  revalidatePath(`/admin/kpi/input/${type}`);
  redirect(`/admin/kpi/input/${type}?saved=1`);
}

export async function saveDmClientBatch(form: FormData) {
  if (!(await verifyAdminScope("dm"))) redirect("/admin/kpi");
  const clientIds = form.getAll("agency_client_ids").map(value => Number(String(value)));
  const dmMemberIds = form.getAll("dm_team_member_ids").map(value => Number(String(value)));
  const metricNames = ["contents", "video_views", "tiktok_sales", "shopee_sales"] as const;
  const metrics = Object.fromEntries(metricNames.map(name => [name, form.getAll(name).map(value => Number(String(value)))])) as Record<typeof metricNames[number], number[]>;
  const date = text(form, "activity_date", 10);
  const rowCount = clientIds.length;
  if (!validDate(date) || rowCount < 1 || rowCount > 50 || dmMemberIds.length !== rowCount || metricNames.some(name => metrics[name].length !== rowCount) || clientIds.some(id => !Number.isSafeInteger(id) || id < 1) || dmMemberIds.some(id => !Number.isSafeInteger(id) || id < 1) || metricNames.some(name => metrics[name].some(value => !Number.isSafeInteger(value) || value < 0))) redirect("/admin/kpi/input/dm_client?select=1&error=invalid");

  const db = getDb();
  const clientPlaceholders = clientIds.map(() => "?").join(",");
  const dmPlaceholders = dmMemberIds.map(() => "?").join(",");
  const [clients] = await db.execute<(import("@/lib/db-types").RowDataPacket & { id:number; client_name:string; client_type:string })[]>(`SELECT id,client_name,client_type FROM agency_clients WHERE id IN (${clientPlaceholders})`, clientIds);
  const [dms] = await db.execute<(import("@/lib/db-types").RowDataPacket & { id:number; full_name:string })[]>(`SELECT id,full_name FROM dm_team_members WHERE id IN (${dmPlaceholders})`, dmMemberIds);
  const clientsById = new Map(clients.map(client => [client.id, client]));
  const dmsById = new Map(dms.map(dm => [dm.id, dm]));
  if (clientsById.size !== new Set(clientIds).size || dmsById.size !== new Set(dmMemberIds).size) redirect("/admin/kpi/input/dm_client?select=1&error=client");

  const user = await getAdminSessionUser();
  await db.transaction(async tx => {
    for (let index = 0; index < rowCount; index++) {
      const client = clientsById.get(clientIds[index])!;
      const dm=dmsById.get(dmMemberIds[index])!;
      await tx.execute("INSERT INTO team_activity_entries (scope,entry_type,title,client_name,activity_date,week_start,contents,video_views,tiktok_sales,shopee_sales,new_clients,strategies,visits,assigned_user_id,dm_team_member_id,dm_person,client_type,agency_client_id,created_by) VALUES ('dm','dm_client',?,?,?,?,?,?,?, ?,0,0,0,NULL,?,?,?,?,?)", [`Performa ${client.client_name}`,client.client_name,date,date,metrics.contents[index],metrics.video_views[index],metrics.tiktok_sales[index],metrics.shopee_sales[index],dm.id,dm.full_name,client.client_type,client.id,user?.id??null]);
    }
  });
  revalidatePath("/admin/kpi");
  revalidatePath("/admin/kpi/input/dm_client");
  revalidatePath("/admin/kpi/input/dm_team");
  redirect("/admin/kpi/input/dm_client?saved=1");
}

export async function deleteTeamEntry(form: FormData) {
  const id = Number(text(form, "id")), type = text(form, "entry_type");
  const scope = type.startsWith("dm_") ? "dm" : "dae";
  const sharedDaeEntry = ["dae_team", "dae_strategy", "dae_visit"].includes(type);
  const allowed = sharedDaeEntry ? await (async()=>Boolean(await verifyAdminScope("dm")||await verifyAdminScope("dae")))() : await verifyAdminScope(scope);
  if (!entryTypes.includes(type) || !Number.isSafeInteger(id) || id < 1 || !allowed) redirect("/admin/kpi");
  if (type === "dae_team") {
    const db = getDb();
    const [rows] = await db.execute<(import("@/lib/db-types").RowDataPacket & { dae_person: string | null })[]>("SELECT dae_person FROM team_activity_entries WHERE id=? AND entry_type='dae_team' LIMIT 1", [id]);
    if (rows[0]?.dae_person) await db.execute("DELETE FROM team_activity_entries WHERE entry_type='dae_team' AND dae_person=?", [rows[0].dae_person]);
    else await db.execute("DELETE FROM team_activity_entries WHERE id=? AND entry_type=?", [id, type]);
  } else await getDb().execute("DELETE FROM team_activity_entries WHERE id=? AND entry_type=?", [id, type]);
  revalidatePath("/admin/kpi");
  revalidatePath(`/admin/kpi/input/${type}`);
  redirect(`/admin/kpi/input/${type}?deleted=1`);
}
