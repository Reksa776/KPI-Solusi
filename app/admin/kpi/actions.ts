"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSessionUser, verifyAdminScope } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { monthWeekFromStart, monthWeekStartForDate } from "@/lib/dae-weeks";

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
  revalidatePath("/admin");
  redirect(`/admin/kpi?scope=${scope}&saved=target`);
}

export async function saveTeamEntry(form: FormData) {
  const type = text(form, "entry_type"), scope = type.startsWith("dm_") ? "dm" : "dae";
  const sharedDaeEntry = ["dae_team", "dae_strategy", "dae_visit"].includes(type);
  const allowed = sharedDaeEntry ? await (async()=>Boolean(await verifyAdminScope("dm")||await verifyAdminScope("dae")))() : await verifyAdminScope(scope);
  if (!entryTypes.includes(type) || !allowed) redirect("/admin/kpi");
  let id = Number(text(form, "id") || 0);
  const title = text(form, "title", 180), clientInput = text(form, "client_name", 160), daePersonInput = text(form, "dae_person", 160), postedDate = text(form, "activity_date", 10), requestedWeek = text(form, "week_start", 10), inputMode = type === "dm_client" ? text(form, "input_mode", 10) || "weekly" : "weekly", date = type === "dm_client" && inputMode === "weekly" ? requestedWeek : postedDate, notes = text(form, "notes", 4000);
  const weekDate = type === "dm_client" ? date : requestedWeek || date;
  const weekStart = validDate(weekDate) ? new Date(`${weekDate}T12:00:00Z`) : null;
  if (type !== "dm_client" && weekStart) weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
  const weekValue = type === "dm_client" ? monthWeekStartForDate(date) ?? "" : weekStart?.toISOString().slice(0, 10) ?? "";
  const selectedClientIds = [...new Set(form.getAll("agency_client_ids").map(value => Number(String(value))).filter(value => Number.isSafeInteger(value) && value > 0))];
  const selectedAgencyClientIdRaw = text(form, "agency_client_id", 16);
  const selectedAgencyClientId = selectedAgencyClientIdRaw ? Number(selectedAgencyClientIdRaw) : null;
  const dmMemberIdRaw = text(form, "dm_team_member_id", 16), dmMemberId = dmMemberIdRaw ? Number(dmMemberIdRaw) : null;
  const assigneeRaw = text(form, "assigned_user_id", 16), assignee = assigneeRaw ? Number(assigneeRaw) : null;
  const fields = ["contents", "video_views", "tiktok_sales", "shopee_sales", "new_clients", "strategies", "visits"] as const;
  const numbers = fields.map((field) => Number(text(form, field) || 0));
  if (!title || !validDate(date) || !weekValue || (type.startsWith("dae_") && type !== "dae_team" && !monthWeekFromStart(weekValue)) || (type === "dm_client" && (!monthWeekFromStart(weekValue) || !["daily", "weekly"].includes(inputMode) || (inputMode === "daily" ? requestedWeek !== weekValue : date !== weekValue))) || (type === "dae_team" && !daePersonInput) || numbers.some((number) => !Number.isSafeInteger(number) || number < 0) || selectedClientIds.length > 100 || (assignee !== null && (!Number.isSafeInteger(assignee) || assignee < 1)) || (type === "dm_client" && (!selectedAgencyClientId || !Number.isSafeInteger(selectedAgencyClientId) || selectedAgencyClientId < 1 || !dmMemberId || !Number.isSafeInteger(dmMemberId) || dmMemberId < 1)) || (type !== "dm_client" && dmMemberId !== null) || (id && (!Number.isSafeInteger(id) || id < 1)) || (type !== "dae_team" && selectedClientIds.length > 0) || (type !== "dm_client" && selectedAgencyClientId !== null)) redirect(`/admin/kpi/input/${type}?error=invalid`);
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
  if (type === "dm_client") {
    const [conflicts] = await db.execute<(import("@/lib/db-types").RowDataPacket & { id:number; input_frequency:string; activity_date:string|Date })[]>("SELECT id,input_frequency,activity_date FROM team_activity_entries WHERE entry_type='dm_client' AND dm_team_member_id=? AND agency_client_id=? AND week_start=? AND id<>?", [dmMemberId, agencyClientId, weekValue, id || 0]);
    const duplicate = conflicts.some(row => inputMode === "weekly" || row.input_frequency === "weekly" || String(row.activity_date).slice(0, 10) === date);
    if (duplicate) redirect(`/admin/kpi/input/${type}?id=${id || ""}&error=period`);
  }
  if (type === "dae_team" && selectedClientIds.length) {
    const placeholders = selectedClientIds.map(() => "?").join(",");
    const [clients] = await db.execute<(import("@/lib/db-types").RowDataPacket & { id: number; client_name: string; client_type: string })[]>(`SELECT id,client_name,client_type FROM agency_clients WHERE id IN (${placeholders}) ORDER BY client_name`, selectedClientIds);
    if (clients.length !== selectedClientIds.length) redirect(`/admin/kpi/input/${type}?error=client`);
    client = clients.map(row => row.client_name).join(", ").slice(0, 160);
    clientType = clients.length === 1 ? clients[0].client_type : null;
    clientIdsJson = JSON.stringify(clients.map(row => Number(row.id)));
  }
  const values = [scope, type, title, client, date, weekValue, inputMode, ...numbers, notes || null, type === "dae_team" || type === "dm_client" ? null : assignee, type === "dm_client" ? dmMemberId : null, dmPerson, daePerson, clientType, agencyClientId, clientIdsJson];
  if (id) {
    const [existing] = await db.execute<(import("@/lib/db-types").RowDataPacket & { id:number })[]>("SELECT id FROM team_activity_entries WHERE id=? AND entry_type=? LIMIT 1", [id, type]);
    if (!existing.length) redirect(`/admin/kpi/input/${type}?error=notfound`);
    await db.execute("UPDATE team_activity_entries SET scope=?,entry_type=?,title=?,client_name=?,activity_date=?,week_start=?,input_frequency=?,contents=?,video_views=?,tiktok_sales=?,shopee_sales=?,new_clients=?,strategies=?,visits=?,notes=?,assigned_user_id=?,dm_team_member_id=?,dm_person=?,dae_person=?,client_type=?,agency_client_id=?,agency_client_ids=? WHERE id=? AND entry_type=?", [...values, id, type]);
    if (type === "dae_team") await db.execute("DELETE FROM team_activity_entries WHERE entry_type='dae_team' AND dae_person=? AND id<>?", [daePersonInput, id]);
  } else {
    await db.execute("INSERT INTO team_activity_entries (scope,entry_type,title,client_name,activity_date,week_start,input_frequency,contents,video_views,tiktok_sales,shopee_sales,new_clients,strategies,visits,notes,assigned_user_id,dm_team_member_id,dm_person,dae_person,client_type,agency_client_id,agency_client_ids,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [...values, user?.id ?? null]);
  }
  revalidatePath("/admin/kpi");
  revalidatePath("/admin");
  revalidatePath(`/admin/kpi/input/${type}`);
  if(type==="dm_client"){revalidatePath("/performa/dm");revalidatePath("/admin/kpi/input/dm_targets")}
  if (type === "dm_client" && dmMemberId && selectedAgencyClientId) redirect(`/admin/kpi/input/dm_client?dm_id=${dmMemberId}&client_id=${selectedAgencyClientId}&saved=1`);
  redirect(`/admin/kpi/input/${type}?saved=1`);
}

export async function saveDmClientBatch(form: FormData) {
  if (!(await verifyAdminScope("dm"))) redirect("/admin/kpi");
  const clientIds = form.getAll("agency_client_ids").map(value => Number(String(value)));
  const dmMemberIds = form.getAll("dm_team_member_ids").map(value => Number(String(value)));
  const fallback = "/admin/kpi/input/dm_client?new=1&error=invalid";
  const pairUrl = (error?: string, saved = false) => {
    const clientId = clientIds[0], dmId = dmMemberIds[0];
    if (!Number.isSafeInteger(clientId) || clientId < 1 || !Number.isSafeInteger(dmId) || dmId < 1) return fallback;
    return `/admin/kpi/input/dm_client?dm_id=${dmId}&client_id=${clientId}${saved ? "&saved=1" : "&entry_new=1"}${error ? `&error=${error}` : ""}`;
  };
  const metricNames = ["contents", "video_views", "tiktok_sales", "shopee_sales"] as const;
  const metrics = Object.fromEntries(metricNames.map(name => [name, form.getAll(name).map(value => Number(String(value)))])) as Record<typeof metricNames[number], number[]>;
  const inputMode = text(form, "input_mode", 10) || "weekly";
  const activityDate = text(form, "activity_date", 10);
  const weekStart = text(form, "week_start", 10);
  const rowCount = clientIds.length;
  const expectedWeek = monthWeekStartForDate(inputMode === "weekly" ? weekStart : activityDate);
  if (!["daily", "weekly"].includes(inputMode) || !monthWeekFromStart(weekStart) || expectedWeek !== weekStart || (inputMode === "weekly" ? activityDate !== weekStart : !validDate(activityDate)) || rowCount < 1 || rowCount > 500 || dmMemberIds.length !== rowCount || metricNames.some(name => metrics[name].length !== rowCount) || clientIds.some(id => !Number.isSafeInteger(id) || id < 1) || dmMemberIds.some(id => !Number.isSafeInteger(id) || id < 1) || metricNames.some(name => metrics[name].some(value => !Number.isSafeInteger(value) || value < 0)) || new Set(clientIds.map((clientId,index) => `${dmMemberIds[index]}:${clientId}`)).size !== rowCount) redirect(pairUrl("invalid"));

  const db = getDb();
  const clientPlaceholders = clientIds.map(() => "?").join(",");
  const dmPlaceholders = dmMemberIds.map(() => "?").join(",");
  const [clients] = await db.execute<(import("@/lib/db-types").RowDataPacket & { id:number; client_name:string; client_type:string })[]>(`SELECT id,client_name,client_type FROM agency_clients WHERE id IN (${clientPlaceholders})`, clientIds);
  const [dms] = await db.execute<(import("@/lib/db-types").RowDataPacket & { id:number; full_name:string })[]>(`SELECT id,full_name FROM dm_team_members WHERE id IN (${dmPlaceholders})`, dmMemberIds);
  // agency_clients.id is MySQL BIGINT, so Prisma returns bigint while form
  // values are numeric strings. Normalize map keys so selected clients resolve.
  const clientsById = new Map(clients.map(client => [Number(client.id), client]));
  const dmsById = new Map(dms.map(dm => [Number(dm.id), dm]));
  const selectedClients = clientIds.map(id => clientsById.get(id));
  const selectedDms = dmMemberIds.map(id => dmsById.get(id));
  if (selectedClients.some(client => !client) || selectedDms.some(dm => !dm)) {
    redirect(pairUrl("missing"));
  }
  const [assignedPairs] = await db.execute<(import("@/lib/db-types").RowDataPacket & { dm_team_member_id:number; agency_client_id:number })[]>(`SELECT dm_team_member_id,agency_client_id FROM dm_client_assignments WHERE dm_team_member_id IN (${dmPlaceholders}) AND agency_client_id IN (${clientPlaceholders})`, [...dmMemberIds,...clientIds]);
  const assignedKeys = new Set(assignedPairs.map(pair=>`${Number(pair.dm_team_member_id)}:${Number(pair.agency_client_id)}`));
  if(assignedPairs.length!==rowCount||dmMemberIds.some((dmId,index)=>!assignedKeys.has(`${dmId}:${clientIds[index]}`)))redirect(pairUrl("assignment"));

  const user = await getAdminSessionUser();
  try {
    await db.transaction(async tx => {
      for (let index = 0; index < rowCount; index++) {
        const [conflicts] = await tx.execute<(import("@/lib/db-types").RowDataPacket & { input_frequency:string; activity_date:string|Date;video_views:number|string;tiktok_sales:number|string;shopee_sales:number|string })[]>("SELECT input_frequency,activity_date,video_views,tiktok_sales,shopee_sales FROM team_activity_entries WHERE entry_type='dm_client' AND dm_team_member_id=? AND agency_client_id=? AND week_start=? FOR UPDATE", [dmMemberIds[index], clientIds[index], weekStart]);
        if (conflicts.some(row => inputMode === "weekly" || (row.input_frequency === "weekly" && (Number(row.video_views)>0||Number(row.tiktok_sales)>0||Number(row.shopee_sales)>0)) || (row.input_frequency === "daily" && String(row.activity_date).slice(0, 10) === activityDate))) throw new Error("DM_PERIOD_CONFLICT");
        const client = selectedClients[index]!;
        const dm = selectedDms[index]!;
        await tx.execute("INSERT INTO team_activity_entries (scope,entry_type,title,client_name,activity_date,week_start,input_frequency,contents,video_views,tiktok_sales,shopee_sales,new_clients,strategies,visits,assigned_user_id,dm_team_member_id,dm_person,client_type,agency_client_id,created_by) VALUES ('dm','dm_client',?,?,?,?,?,?,?,?,?,0,0,0,NULL,?,?,?,?,?)", [`Performa ${client.client_name}`,client.client_name,activityDate,weekStart,inputMode,metrics.contents[index],metrics.video_views[index],metrics.tiktok_sales[index],metrics.shopee_sales[index],dm.id,dm.full_name,client.client_type,client.id,user?.id??null]);
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "DM_PERIOD_CONFLICT") redirect(pairUrl("period"));
    throw error;
  }
  revalidatePath("/admin/kpi");
  revalidatePath("/admin");
  revalidatePath("/admin/kpi/input/dm_client");
  revalidatePath("/admin/kpi/input/dm_team");
  redirect(pairUrl(undefined, true));
}

export async function saveDmClientDailyReports(form: FormData) {
  if (!(await verifyAdminScope("dm"))) redirect("/admin/kpi");
  const dmId=Number(text(form,"dm_team_member_id",16)),clientId=Number(text(form,"agency_client_id",16));
  const dates=form.getAll("report_dates").map(value=>String(value)),metricNames=["contents","video_views","tiktok_sales","shopee_sales"] as const;
  const metrics=Object.fromEntries(metricNames.map(name=>[name,form.getAll(name).map(value=>String(value)===""?0:Number(String(value)))])) as Record<typeof metricNames[number],number[]>;
  const detail=`/admin/kpi/input/dm_client?dm_id=${dmId}&client_id=${clientId}`,fail=(error:string):never=>redirect(Number.isSafeInteger(dmId)&&dmId>0&&Number.isSafeInteger(clientId)&&clientId>0?`${detail}&entry_new=multi&error=${error}`:`/admin/kpi/input/dm_client?error=${error}`);
  const validCalendarDate=(value:string)=>{if(!validDate(value))return false;const parsed=new Date(`${value}T00:00:00Z`);return !Number.isNaN(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value};
  if(!Number.isSafeInteger(dmId)||dmId<1||!Number.isSafeInteger(clientId)||clientId<1||dates.length<1||dates.length>100||new Set(dates).size!==dates.length||dates.some(date=>!validCalendarDate(date))||metricNames.some(name=>metrics[name].length!==dates.length||metrics[name].some(value=>!Number.isSafeInteger(value)||value<0)))fail("invalid");
  const db=getDb();
  const [[pairs],[members],[clients]]=await Promise.all([
    db.execute<(import("@/lib/db-types").RowDataPacket&{dm_team_member_id:number;agency_client_id:number})[]>("SELECT dm_team_member_id,agency_client_id FROM dm_client_assignments WHERE dm_team_member_id=? AND agency_client_id=? LIMIT 1",[dmId,clientId]),
    db.execute<(import("@/lib/db-types").RowDataPacket&{id:number;full_name:string})[]>("SELECT id,full_name FROM dm_team_members WHERE id=? LIMIT 1",[dmId]),
    db.execute<(import("@/lib/db-types").RowDataPacket&{id:number;client_name:string;client_type:string})[]>("SELECT id,client_name,client_type FROM agency_clients WHERE id=? LIMIT 1",[clientId]),
  ]);
  if(!pairs.length)fail("assignment");if(!members.length||!clients.length)fail("missing");
  const user=await getAdminSessionUser();
  try{await db.transaction(async tx=>{for(let index=0;index<dates.length;index++){
    const weekStart=monthWeekStartForDate(dates[index]);if(!weekStart)throw new Error("DAILY_DATE_INVALID");
    const [conflicts]=await tx.execute<(import("@/lib/db-types").RowDataPacket&{input_frequency:string;activity_date:string|Date;video_views:number|string; tiktok_sales:number|string;shopee_sales:number|string})[]>("SELECT input_frequency,activity_date,video_views,tiktok_sales,shopee_sales FROM team_activity_entries WHERE entry_type='dm_client' AND dm_team_member_id=? AND agency_client_id=? AND week_start=? FOR UPDATE",[dmId,clientId,weekStart]);
    if(conflicts.some(row=>(row.input_frequency==="weekly"&&(Number(row.video_views)>0||Number(row.tiktok_sales)>0||Number(row.shopee_sales)>0))||(row.input_frequency==="daily"&&String(row.activity_date).slice(0,10)===dates[index])))throw new Error("DM_PERIOD_CONFLICT");
    await tx.execute("INSERT INTO team_activity_entries (scope,entry_type,title,client_name,activity_date,week_start,input_frequency,contents,video_views,tiktok_sales,shopee_sales,new_clients,strategies,visits,assigned_user_id,dm_team_member_id,dm_person,client_type,agency_client_id,created_by) VALUES ('dm','dm_client',?,?,?,?, 'daily', ?,?,?,?,0,0,0,NULL,?,?,?,?,?)",[`Performa ${clients[0].client_name}`,clients[0].client_name,dates[index],weekStart,metrics.contents[index],metrics.video_views[index],metrics.tiktok_sales[index],metrics.shopee_sales[index],members[0].id,members[0].full_name,clients[0].client_type,clients[0].id,user?.id??null]);
  }})}catch(error){if(error instanceof Error&&error.message==="DM_PERIOD_CONFLICT")fail("period");throw error}
  revalidatePath("/admin/kpi");revalidatePath("/admin");revalidatePath("/admin/kpi/input/dm_client");revalidatePath("/admin/kpi/input/dm_team");
  redirect(`${detail}&saved=1`);
}

export async function saveDmWeeklyContent(form: FormData) {
  if (!(await verifyAdminScope("dm"))) redirect("/admin/kpi");
  const dmId=Number(text(form,"dm_team_member_id",16)),clientId=Number(text(form,"agency_client_id",16)),weekStart=text(form,"week_start",10),contents=Number(text(form,"contents",16));
  const detail=`/admin/kpi/input/dm_client?dm_id=${dmId}&client_id=${clientId}`,fail=(error:string):never=>redirect(Number.isSafeInteger(dmId)&&dmId>0&&Number.isSafeInteger(clientId)&&clientId>0?`${detail}&content_week=${weekStart}&error=${error}`:`/admin/kpi/input/dm_client?error=${error}`);
  if(!Number.isSafeInteger(dmId)||dmId<1||!Number.isSafeInteger(clientId)||clientId<1||monthWeekFromStart(weekStart)?.weekStart!==weekStart||!Number.isSafeInteger(contents)||contents<0)fail("invalid");
  const db=getDb();
  const [[pairs],[members],[clients]]=await Promise.all([
    db.execute<(import("@/lib/db-types").RowDataPacket&{dm_team_member_id:number;agency_client_id:number})[]>("SELECT dm_team_member_id,agency_client_id FROM dm_client_assignments WHERE dm_team_member_id=? AND agency_client_id=? LIMIT 1",[dmId,clientId]),
    db.execute<(import("@/lib/db-types").RowDataPacket&{id:number;full_name:string})[]>("SELECT id,full_name FROM dm_team_members WHERE id=? LIMIT 1",[dmId]),
    db.execute<(import("@/lib/db-types").RowDataPacket&{id:number;client_name:string;client_type:string})[]>("SELECT id,client_name,client_type FROM agency_clients WHERE id=? LIMIT 1",[clientId]),
  ]);
  if(!pairs.length)fail("assignment");if(!members.length||!clients.length)fail("missing");
  const user=await getAdminSessionUser();
  await db.transaction(async tx=>{
    const [weekly]=await tx.execute<(import("@/lib/db-types").RowDataPacket&{id:number})[]>("SELECT id FROM team_activity_entries WHERE entry_type='dm_client' AND input_frequency='weekly' AND dm_team_member_id=? AND agency_client_id=? AND week_start=? ORDER BY id LIMIT 1 FOR UPDATE",[dmId,clientId,weekStart]);
    if(weekly.length){await tx.execute("UPDATE team_activity_entries SET contents=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND entry_type='dm_client'",[contents,weekly[0].id]);return;}
    await tx.execute("INSERT INTO team_activity_entries (scope,entry_type,title,client_name,activity_date,week_start,input_frequency,contents,video_views,tiktok_sales,shopee_sales,new_clients,strategies,visits,assigned_user_id,dm_team_member_id,dm_person,client_type,agency_client_id,created_by) VALUES ('dm','dm_client',?,?,?,?, 'weekly', ?,0,0,0,0,0,0,NULL,?,?,?,?,?)",[`Performa ${clients[0].client_name}`,clients[0].client_name,weekStart,weekStart,contents,members[0].id,members[0].full_name,clients[0].client_type,clients[0].id,user?.id??null]);
  });
  revalidatePath("/admin/kpi");revalidatePath("/admin");revalidatePath("/admin/kpi/input/dm_client");
  redirect(`${detail}&saved=1`);
}

export async function deleteTeamEntry(form: FormData) {
  const id = Number(text(form, "id")), type = text(form, "entry_type");
  const returnDmId = Number(text(form, "return_dm_id", 16)), returnClientId = Number(text(form, "return_client_id", 16));
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
  revalidatePath("/admin");
  revalidatePath(`/admin/kpi/input/${type}`);
  if(type==="dm_client"){revalidatePath("/performa/dm");revalidatePath("/admin/kpi/input/dm_targets")}
  if (type === "dm_client" && Number.isSafeInteger(returnDmId) && returnDmId > 0 && Number.isSafeInteger(returnClientId) && returnClientId > 0) redirect(`/admin/kpi/input/dm_client?dm_id=${returnDmId}&client_id=${returnClientId}&deleted=1`);
  redirect(`/admin/kpi/input/${type}?deleted=1`);
}
