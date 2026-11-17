"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import { verifyAdminScope } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { syncAllDmSpreadsheets } from "@/lib/dm-spreadsheet-sync";

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
  revalidatePath(path); revalidatePath("/admin/kpi/input/dm_team"); revalidatePath("/admin/kpi"); revalidatePath("/admin");
  redirect(`${path}?dm_id=${dmId}&client_id=${clientId}&saved=1`);
}

export async function saveDmSpreadsheetSource(form:FormData) {
  if(!(await verifyAdminScope("dm")))redirect("/admin/kpi");
  const url=String(form.get("spreadsheet_url")??"").trim().slice(0,1000);
  let parsed:URL;
  try{parsed=new URL(url)}catch{redirect(`/admin/kpi/input/dm_team?error=sheet_url`)}
  if(parsed.protocol!=="https:"||parsed.hostname!=="docs.google.com"||!/^\/spreadsheets\/d\/[a-zA-Z0-9_-]+/.test(parsed.pathname))redirect(`/admin/kpi/input/dm_team?error=sheet_url`);
  const db=getDb(),[members]=await db.execute<(RowDataPacket&{id:number})[]>("SELECT id FROM dm_team_members ORDER BY id LIMIT 500");
  if(!members.length)redirect(`/admin/kpi/input/dm_team?error=missing`);
  await db.transaction(async tx=>{for(const member of members)await tx.execute("INSERT INTO dm_spreadsheet_sources (dm_team_member_id,spreadsheet_url) VALUES (?,?) ON DUPLICATE KEY UPDATE spreadsheet_url=VALUES(spreadsheet_url),last_synced_at=NULL,last_sync_status=NULL",[member.id,url])});
  // Import the workbook as part of saving its source so the application
  // database is populated even before the client page hydrates.
  let syncSummary="sync=error";
  try{
    const result=await syncAllDmSpreadsheets(),successful=result.results.filter(item=>item.ok);
    const rows=successful.reduce((sum,item)=>sum+((item as {total?:number}).total??0),0),created=successful.reduce((sum,item)=>sum+((item as {created?:number}).created??0),0),updated=successful.reduce((sum,item)=>sum+((item as {updated?:number}).updated??0),0);
    syncSummary=new URLSearchParams({synced:String(result.updated),processed:String(result.processed),rows:String(rows),created:String(created),updated:String(updated),failed:String(result.failed)}).toString();
  }catch{}
  revalidatePath(path);revalidatePath("/performa/dm");
  revalidatePath("/admin/kpi/input/dm_team");
  redirect(`/admin/kpi/input/dm_team?saved=sheet&${syncSummary}`);
}

export async function saveSpreadsheetDmRevenue(form:FormData) {
  if(!(await verifyAdminScope("dm")))redirect("/admin/kpi");
  const id=number(form,"id"),tiktok=number(form,"tiktok_sales"),shopee=number(form,"shopee_sales");
  if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(tiktok)||tiktok<0||!Number.isSafeInteger(shopee)||shopee<0)redirect("/admin/kpi/input/dm_team?error=sales");
  const db=getDb(),[rows]=await db.execute<(RowDataPacket&{id:number})[]>("SELECT id FROM team_activity_entries WHERE id=? AND entry_type='dm_client' AND input_frequency='daily' AND agency_client_id IS NULL AND title LIKE 'Performa spreadsheet · %' LIMIT 1",[id]);
  if(!rows.length)redirect("/admin/kpi/input/dm_team?error=sales");
  await db.execute("UPDATE team_activity_entries SET tiktok_sales=?,shopee_sales=? WHERE id=?",[tiktok,shopee,id]);
  revalidatePath("/admin/kpi/input/dm_team");revalidatePath("/admin/kpi");revalidatePath("/performa/dm");revalidatePath("/admin");
  redirect("/admin/kpi/input/dm_team?revenueSaved=1");
}

export async function deleteDmClientAssignment(form:FormData) {
  if(!(await verifyAdminScope("dm")))redirect("/admin/kpi");
  const dmId=number(form,"dm_team_member_id"),clientId=number(form,"agency_client_id");
  if(!Number.isSafeInteger(dmId)||dmId<1||!Number.isSafeInteger(clientId)||clientId<1)redirect(`${path}?error=invalid`);
  try{await getDb().transaction(async tx=>{
    await tx.execute("DELETE FROM team_activity_entries WHERE entry_type='dm_client' AND dm_team_member_id=? AND agency_client_id=?",[dmId,clientId]);
    await tx.execute("DELETE FROM dm_content_targets WHERE dm_team_member_id=? AND agency_client_id=?",[dmId,clientId]);
    await tx.execute("DELETE FROM dm_client_assignments WHERE dm_team_member_id=? AND agency_client_id=?",[dmId,clientId]);
  })}catch{redirect(`${path}?dm_id=${dmId}&client_id=${clientId}&error=dependencies`)}
  revalidatePath(path); revalidatePath("/admin/kpi"); revalidatePath("/admin");
  revalidatePath("/admin/kpi/input/dm_targets");revalidatePath("/performa/dm");
  redirect(`${path}?deleted=1&cascade=1`);
}
