import { verifyAdminScope, verifyAdminSession } from "@/lib/admin-auth";
import { syncAllDmSpreadsheets, syncDmSpreadsheet } from "@/lib/dm-spreadsheet-sync";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(request:Request){
  if(!(await verifyAdminSession())||!(await verifyAdminScope("dm")))return Response.json({error:"Tidak memiliki akses."},{status:403});
  const body=await request.json().catch(()=>null) as {dmId?:number;all?:boolean}|null;
  if(body?.all)return Response.json(await syncAllDmSpreadsheets(),{headers:{"Cache-Control":"no-store"}});
  const dmId=Number(body?.dmId);
  if(!Number.isSafeInteger(dmId)||dmId<1)return Response.json({error:"DM tidak valid."},{status:400});
  const result=await syncDmSpreadsheet(dmId);
  return Response.json(result,{status:result.ok?200:502,headers:{"Cache-Control":"no-store"}});
}
