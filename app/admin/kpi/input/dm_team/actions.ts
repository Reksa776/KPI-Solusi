"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import { getAdminSessionUser, verifyAdminScope } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";

const path="/admin/kpi/input/dm_team";
const read=(form:FormData,key:string,max=160)=>String(form.get(key)??"").trim().slice(0,max);

export async function saveDmTeamMember(form:FormData) {
  if (!(await verifyAdminScope("dm"))) redirect("/admin/kpi");
  const rawId=read(form,"id",16),id=rawId?Number(rawId):null,name=read(form,"full_name");
  if(!name||(id!==null&&(!Number.isSafeInteger(id)||id<1)))redirect(`${path}?error=invalid`);
  const db=getDb();
  const [duplicates]=await db.execute<(RowDataPacket&{id:number})[]>("SELECT id FROM dm_team_members WHERE full_name=? AND id<>? LIMIT 1",[name,id??0]);
  if(duplicates.length)redirect(`${path}?error=duplicate`);
  if(id!==null){
    const [existing]=await db.execute<(RowDataPacket&{id:number})[]>("SELECT id FROM dm_team_members WHERE id=? LIMIT 1",[id]);
    if(!existing.length)redirect(`${path}?error=invalid`);
    await db.transaction(async tx=>{
      await tx.execute("UPDATE dm_team_members SET full_name=? WHERE id=?",[name,id]);
      await tx.execute("UPDATE team_activity_entries SET dm_person=? WHERE dm_team_member_id=? AND entry_type='dm_client'",[name,id]);
    });
  }else{
    const user=await getAdminSessionUser();
    await db.execute("INSERT INTO dm_team_members (full_name,created_by) VALUES (?,?)",[name,user?.id??null]);
  }
  revalidatePath(path); revalidatePath("/admin/kpi"); revalidatePath("/admin"); revalidatePath("/admin/kpi/input/dm_client"); revalidatePath("/performa/dm");
  redirect(`${path}?saved=1`);
}

export async function deleteDmTeamMember(form:FormData) {
  if (!(await verifyAdminScope("dm"))) redirect("/admin/kpi");
  const id=Number(read(form,"id",16));
  if(!Number.isSafeInteger(id)||id<1)redirect(`${path}?error=invalid`);
  await getDb().execute("DELETE FROM dm_team_members WHERE id=?",[id]);
  revalidatePath(path); revalidatePath("/admin/kpi/input/dm_client"); revalidatePath("/admin/kpi"); revalidatePath("/admin"); revalidatePath("/performa/dm");
  redirect(`${path}?deleted=1`);
}
