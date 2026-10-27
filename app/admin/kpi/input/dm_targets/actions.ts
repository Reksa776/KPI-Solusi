"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import { getAdminSessionUser, verifyAdminScope } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { getMonthWeekStart, monthWeekFromStart } from "@/lib/dae-weeks";

const path = "/admin/kpi/input/dm_targets";
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function saveDmContentTargets(form: FormData) {
  if (!(await verifyAdminScope("dm"))) redirect("/admin/kpi");
  const month = value(form, "period_month");
  const dmId = Number(value(form, "dm_team_member_id"));
  const clientId = Number(value(form, "agency_client_id"));
  const weekStarts = form.getAll("week_start").map(item => String(item).trim());
  const weeklyTargets = form.getAll("weekly_target").map(item => Number(String(item)));
  const expectedWeeks = Array.from({ length: 5 }, (_, index) => getMonthWeekStart(month, index + 1)).filter((start): start is string => Boolean(start));
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isSafeInteger(dmId) || dmId < 1 || !Number.isSafeInteger(clientId) || clientId < 1 || weekStarts.length !== expectedWeeks.length || weeklyTargets.length !== expectedWeeks.length || weekStarts.some((start, index) => start !== expectedWeeks[index] || monthWeekFromStart(start)?.month !== month) || weeklyTargets.some(target => !Number.isSafeInteger(target) || target < 0 || target > 4_294_967_295)) {
    redirect(`${path}?month=${encodeURIComponent(month)}&error=invalid`);
  }

  const db = getDb();
  const [assignments] = await db.execute<(RowDataPacket & { dm_team_member_id: number })[]>("SELECT dm_team_member_id FROM dm_client_assignments WHERE dm_team_member_id=? AND agency_client_id=? LIMIT 1", [dmId, clientId]);    if (!assignments.length) redirect(`${path}?month=${month}&error=assignment`);
  const user = await getAdminSessionUser();
  await db.transaction(async tx => {
    for (let index = 0; index < expectedWeeks.length; index++) {
      await tx.execute(
        "INSERT INTO dm_content_targets (dm_team_member_id,agency_client_id,week_start,target_contents,created_by) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE target_contents=VALUES(target_contents),created_by=VALUES(created_by)",
        [dmId, clientId, expectedWeeks[index], weeklyTargets[index], user?.id ?? null],
      );
    }
  });
  revalidatePath(path);
  revalidatePath("/admin/kpi");
  revalidatePath("/admin");
  revalidatePath("/admin/kpi/input/dm_client");
  redirect(`${path}?month=${month}&dm_id=${dmId}&client_id=${dmId}:${clientId}&saved=1`);
}
