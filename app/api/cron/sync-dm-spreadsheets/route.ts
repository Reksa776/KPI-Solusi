import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import type { RowDataPacket } from "@/lib/db-types";
import { syncDmSpreadsheet } from "@/lib/dm-spreadsheet-sync";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(request:Request){
  const secret=process.env.CRON_SECRET,supplied=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")??"";
  if(!secret||!sameSecret(supplied,secret))return Response.json({error:"Unauthorized"},{status:401});
  const [sources]=await getDb().execute<(RowDataPacket&{dm_team_member_id:number})[]>("SELECT dm_team_member_id FROM dm_spreadsheet_sources ORDER BY dm_team_member_id LIMIT 100");
  const results=await Promise.all(sources.map(source=>syncDmSpreadsheet(Number(source.dm_team_member_id))));
  return Response.json({processed:results.length,updated:results.filter(result=>result.ok).length,failed:results.filter(result=>!result.ok).length});
}

function sameSecret(left:string,right:string){const a=Buffer.from(left),b=Buffer.from(right);return a.length===b.length&&timingSafeEqual(a,b)}
