"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import { getAdminSessionUser, verifyAdminScope } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";

const path = "/admin/kpi/input/dm_team";
const read = (form:FormData,key:string,max=160) => String(form.get(key)??"").trim().slice(0,max);

export async function saveDmTeamMember(form:FormData) {
  if (!(await verifyAdminScope("dm"))) redirect("/admin/kpi");
  const idRaw=read(form,"id",16),id=idRaw?Number(idRaw):null,name=read(form,"full_name");
  const rawClientIds=form.getAll("agency_client_ids").map(value=>String(value));
  const clientIds=[...new Set(rawClientIds.map(Number).filter(value=>Number.isSafeInteger(value)&&value>0))];
  if (!name||(id!==null&&(!Number.isSafeInteger(id)||id<1))||clientIds.length>100||clientIds.length!==rawClientIds.length) redirect(`${path}?error=invalid`);
  const db=getDb();
  const [duplicates]=await db.execute<(RowDataPacket&{id:number})[]>("SELECT id FROM dm_team_members WHERE full_name=? AND id<>? LIMIT 1",[name,id??0]);
  if(duplicates.length)redirect(`${path}?error=duplicate`);
  if(clientIds.length){
    const [clients]=await db.execute<(RowDataPacket&{id:number})[]>(`SELECT id FROM agency_clients WHERE id IN (${clientIds.map(()=>"?").join(",")})`,clientIds);
    if(clients.length!==clientIds.length)redirect(`${path}?error=client`);
  }
  const user=await getAdminSessionUser();
  await db.transaction(async tx=>{
    let memberId=id;
    if(id!==null){
      const [existing]=await tx.execute<(RowDataPacket&{id:number})[]>("SELECT id FROM dm_team_members WHERE id=? LIMIT 1",[id]);
      if(!existing.length)throw new Error("DM_MEMBER_NOT_FOUND");
      await tx.execute("UPDATE dm_team_members SET full_name=? WHERE id=?",[name,id]);
      await tx.execute("UPDATE team_activity_entries SET dm_person=? WHERE dm_team_member_id=? AND entry_type='dm_client'",[name,id]);
    }else{
      const [result]=await tx.execute<{insertId:number}>("INSERT INTO dm_team_members (full_name,created_by) VALUES (?,?)",[name,user?.id??null]);
      memberId=Number(result.insertId);
    }
    await tx.execute("DELETE FROM dm_client_assignments WHERE dm_team_member_id=?",[memberId]);
    for(const clientId of clientIds)await tx.execute("INSERT INTO dm_client_assignments (dm_team_member_id,agency_client_id) VALUES (?,?)",[memberId,clientId]);
  }).catch(error=>{
    if(error instanceof Error&&error.message==="DM_MEMBER_NOT_FOUND")redirect(`${path}?error=notfound`);
    throw error;
  });
  revalidatePath(path); revalidatePath("/admin/kpi"); revalidatePath("/admin/kpi/input/dm_client");
  redirect(`${path}?saved=1`);
}

export async function deleteDmTeamMember(form:FormData) {
  if (!(await verifyAdminScope("dm"))) redirect("/admin/kpi");
  const id=Number(read(form,"id",16));
  if(!Number.isSafeInteger(id)||id<1)redirect(`${path}?error=invalid`);
  await getDb().execute("DELETE FROM dm_team_members WHERE id=?",[id]);
  revalidatePath(path); revalidatePath("/admin/kpi/input/dm_client");
  redirect(`${path}?deleted=1`);
}
