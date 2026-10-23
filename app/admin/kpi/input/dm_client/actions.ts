"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import { verifyAdminScope } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";

const path="/admin/kpi/input/dm_client";
const number=(form:FormData,key:string)=>Number(String(form.get(key)??""));

export async function saveDmClientAssignment(form:FormData) {
  if(!(await verifyAdminScope("dm")))redirect("/admin/kpi");
  const dmId=number(form,"dm_team_member_id"),clientId=number(form,"agency_client_id");
  const oldDmRaw=String(form.get("old_dm_team_member_id")??""),oldClientRaw=String(form.get("old_agency_client_id")??"");
  const oldDm=oldDmRaw?Number(oldDmRaw):null,oldClient=oldClientRaw?Number(oldClientRaw):null;
  const edit=oldDm!==null||oldClient!==null;
  const fail=(error:string):never=>redirect(`${path}?new=1&error=${error}`);
  if(!Number.isSafeInteger(dmId)||dmId<1||!Number.isSafeInteger(clientId)||clientId<1||(edit&&(!Number.isSafeInteger(oldDm)||oldDm!<1||!Number.isSafeInteger(oldClient)||oldClient!<1)))fail("invalid");
  const db=getDb();
  const [[dms],[clients]] = await Promise.all([
    db.execute<(RowDataPacket&{id:number})[]>("SELECT id FROM dm_team_members WHERE id=? LIMIT 1",[dmId]),
    db.execute<(RowDataPacket&{id:number})[]>("SELECT id FROM agency_clients WHERE id=? LIMIT 1",[clientId]),
  ]);
  if(!dms.length||!clients.length)fail("missing");
  const [duplicate]=await db.execute<(RowDataPacket&{dm_team_member_id:number})[]>("SELECT dm_team_member_id FROM dm_client_assignments WHERE dm_team_member_id=? AND agency_client_id=? LIMIT 1",[dmId,clientId]);
  if(duplicate.length&&!(edit&&dmId===oldDm&&clientId===oldClient))fail("duplicate");
  if(edit){
    const [old]=await db.execute<(RowDataPacket&{dm_team_member_id:number})[]>("SELECT dm_team_member_id FROM dm_client_assignments WHERE dm_team_member_id=? AND agency_client_id=? LIMIT 1",[oldDm,oldClient]);
    if(!old.length)fail("missing");
    if(dmId!==oldDm||clientId!==oldClient){
      const [history]=await db.execute<(RowDataPacket&{total:bigint|number})[]>("SELECT COUNT(*) AS total FROM team_activity_entries WHERE entry_type='dm_client' AND dm_team_member_id=? AND agency_client_id=?",[oldDm,oldClient]);
      if(Number(history[0]?.total??0)>0)fail("inuse");
    }
  }
  try {
    await db.transaction(async tx=>{
      if(edit&&(dmId!==oldDm||clientId!==oldClient))await tx.execute("DELETE FROM dm_client_assignments WHERE dm_team_member_id=? AND agency_client_id=?",[oldDm,oldClient]);
      if(!edit||(dmId!==oldDm||clientId!==oldClient))await tx.execute("INSERT INTO dm_client_assignments (dm_team_member_id,agency_client_id) VALUES (?,?)",[dmId,clientId]);
    });
  } catch(error) {
    if(error&&typeof error==="object"&&"code" in error)fail("duplicate");
    throw error;
  }
  revalidatePath(path); revalidatePath("/admin/kpi/input/dm_team"); revalidatePath("/admin/kpi");
  redirect(`${path}?dm_id=${dmId}&client_id=${clientId}&saved=1`);
}

export async function deleteDmClientAssignment(form:FormData) {
  if(!(await verifyAdminScope("dm")))redirect("/admin/kpi");
  const dmId=number(form,"dm_team_member_id"),clientId=number(form,"agency_client_id");
  if(!Number.isSafeInteger(dmId)||dmId<1||!Number.isSafeInteger(clientId)||clientId<1)redirect(`${path}?error=invalid`);
  const [history]=await getDb().execute<(RowDataPacket&{total:bigint|number})[]>("SELECT COUNT(*) AS total FROM team_activity_entries WHERE entry_type='dm_client' AND dm_team_member_id=? AND agency_client_id=?",[dmId,clientId]);
  if(Number(history[0]?.total??0)>0)redirect(`${path}?dm_id=${dmId}&client_id=${clientId}&error=inuse`);
  await getDb().execute("DELETE FROM dm_client_assignments WHERE dm_team_member_id=? AND agency_client_id=?",[dmId,clientId]);
  revalidatePath(path); revalidatePath("/admin/kpi");
  redirect(`${path}?deleted=1`);
}
