import { verifyAdminScope, verifyAdminSession } from "@/lib/admin-auth";
import { syncDmSpreadsheet } from "@/lib/dm-spreadsheet-sync";
import { getDb } from "@/lib/db";
import type { RowDataPacket } from "@/lib/db-types";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(request:Request){
  if(!(await verifyAdminSession())||!(await verifyAdminScope("dm")))return Response.json({error:"Tidak memiliki akses."},{status:403});
  const body=await request.json().catch(()=>null) as {dmId?:number;all?:boolean}|null;
  if(body?.all){const [sources]=await getDb().execute<(RowDataPacket&{dm_team_member_id:number})[]>("SELECT dm_team_member_id FROM dm_spreadsheet_sources ORDER BY dm_team_member_id LIMIT 100");const results=await Promise.all(sources.map(source=>syncDmSpreadsheet(Number(source.dm_team_member_id))));return Response.json({processed:results.length,updated:results.filter(result=>result.ok).length,failed:results.filter(result=>!result.ok).length},{headers:{"Cache-Control":"no-store"}})}
  const dmId=Number(body?.dmId);
  if(!Number.isSafeInteger(dmId)||dmId<1)return Response.json({error:"DM tidak valid."},{status:400});
  const result=await syncDmSpreadsheet(dmId);
  return Response.json(result,{status:result.ok?200:502,headers:{"Cache-Control":"no-store"}});
}
