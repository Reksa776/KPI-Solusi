"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import { getAdminSessionUser, verifyAdminScope } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { getMonthWeekStart } from "@/lib/dae-weeks";

const path = "/admin/kpi/input/dm_targets";
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function saveDmContentTargets(form: FormData) {
  if (!(await verifyAdminScope("dm"))) redirect("/admin/kpi");
  const month = value(form, "period_month");
  const dmId = Number(value(form, "dm_team_member_id"));
  const clientId = Number(value(form, "agency_client_id"));
  const monthlyTarget = Number(value(form, "monthly_target"));
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isSafeInteger(dmId) || dmId < 1 || !Number.isSafeInteger(clientId) || clientId < 1 || !Number.isSafeInteger(monthlyTarget) || monthlyTarget < 0 || monthlyTarget > 4_294_967_295) {
    redirect(`${path}?month=${encodeURIComponent(month)}&error=invalid`);
  }

  const db = getDb();
  const [assignments] = await db.execute<(RowDataPacket & { dm_team_member_id: number })[]>("SELECT dm_team_member_id FROM dm_client_assignments WHERE dm_team_member_id=? AND agency_client_id=? LIMIT 1", [dmId, clientId]);    if (!assignments.length) redirect(`${path}?month=${month}&error=assignment`);
  const user = await getAdminSessionUser();
  const starts = Array.from({ length: 5 }, (_, index) => getMonthWeekStart(month, index + 1)).filter((start): start is string => Boolean(start));
  const baseTarget = starts.length ? Math.floor(monthlyTarget / starts.length) : 0;
  const remainder = starts.length ? monthlyTarget % starts.length : 0;
  const weeks = starts.map((start, index) => ({ start, target: baseTarget + (index < remainder ? 1 : 0) }));

  await db.transaction(async tx => {
    for (const week of weeks) {
      await tx.execute(
        "INSERT INTO dm_content_targets (dm_team_member_id,agency_client_id,week_start,target_contents,created_by) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE target_contents=VALUES(target_contents),created_by=VALUES(created_by)",
        [dmId, clientId, week.start, week.target, user?.id ?? null],
      );
    }
  });
  revalidatePath(path);
  revalidatePath("/admin/kpi");
  revalidatePath("/admin");
  revalidatePath("/admin/kpi/input/dm_client");
  redirect(`${path}?month=${month}&dm_id=${dmId}&client_id=${dmId}:${clientId}&saved=1`);
}
