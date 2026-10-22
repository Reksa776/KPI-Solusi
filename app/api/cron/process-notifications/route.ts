import { timingSafeEqual } from "node:crypto";
import { processLeadNotificationQueue } from "@/lib/lead-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !sameSecret(supplied, secret)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json(await processLeadNotificationQueue(10));
  } catch {
    return Response.json({ error: "Notification queue is unavailable." }, { status: 503 });
  }
}

function sameSecret(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
