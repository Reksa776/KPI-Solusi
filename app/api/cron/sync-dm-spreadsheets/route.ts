import { timingSafeEqual } from "node:crypto";
import { syncAllDmSpreadsheets } from "@/lib/dm-spreadsheet-sync";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(request:Request){
  const secret=process.env.CRON_SECRET,supplied=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")??"";
  if(!secret||!sameSecret(supplied,secret))return Response.json({error:"Unauthorized"},{status:401});
  return Response.json(await syncAllDmSpreadsheets());
}

function sameSecret(left:string,right:string){const a=Buffer.from(left),b=Buffer.from(right);return a.length===b.length&&timingSafeEqual(a,b)}
