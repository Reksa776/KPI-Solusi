import { createHash } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { getDb } from "@/lib/db";

type Bucket = RowDataPacket & { failure_count: number; locked_until: Date | string | null };

export function loginBucketKey(email: string, clientIp: string) {
  return createHash("sha256").update(`${email.toLowerCase()}\0${clientIp}`).digest("hex");
}

export async function isLoginLocked(key: string) {
  const [rows] = await getDb().execute<Bucket[]>("SELECT failure_count,locked_until FROM login_attempt_buckets WHERE bucket_key=? LIMIT 1", [key]);
  const row = rows[0];
  if (!row?.locked_until) return false;
  return new Date(row.locked_until).getTime() > Date.now();
}

export async function recordLoginFailure(key: string) {
  await getDb().execute(
    "INSERT INTO login_attempt_buckets (bucket_key,window_started_at,failure_count) VALUES (?,NOW(),1) ON DUPLICATE KEY UPDATE locked_until=CASE WHEN window_started_at < NOW()-INTERVAL 15 MINUTE THEN NULL WHEN failure_count>=4 THEN DATE_ADD(NOW(),INTERVAL 15 MINUTE) ELSE locked_until END,failure_count=CASE WHEN window_started_at < NOW()-INTERVAL 15 MINUTE THEN 1 ELSE LEAST(failure_count+1,255) END,window_started_at=CASE WHEN window_started_at < NOW()-INTERVAL 15 MINUTE THEN NOW() ELSE window_started_at END",
    [key],
  );
}

export async function clearLoginFailures(key: string) {
  await getDb().execute("DELETE FROM login_attempt_buckets WHERE bucket_key=?", [key]);
}
