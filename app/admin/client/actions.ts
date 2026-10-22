"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { getAdminSessionUser, verifyAdminAnyScope } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";

const kinds = ["existing", "prospect", "ex_client", "community", "media", "institution", "agency_ph", "etc"];
const read = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

export async function saveAgencyClient(form: FormData) {
  if (!(await verifyAdminAnyScope(["dm", "dae"]))) redirect("/admin/login");
  const idRaw = read(form, "id", 20), id = idRaw ? Number(idRaw) : null;
  const name = read(form, "client_name", 180), kind = read(form, "client_type", 30);
  if (!name || !kinds.includes(kind) || (id !== null && (!Number.isSafeInteger(id) || id < 1))) redirect(id ? `/admin/client/${id}?error=invalid` : "/admin/client?error=invalid");
  const db = getDb();
  if (id !== null) {
    const [rows] = await db.execute<(RowDataPacket & { id: number })[]>("SELECT id FROM agency_clients WHERE id=? LIMIT 1", [id]);
    if (!rows.length) redirect("/admin/client?error=notfound");
    await db.execute("UPDATE agency_clients SET client_name=?,client_type=? WHERE id=?", [name, kind, id]);
    revalidatePath(`/admin/client/${id}`);
  } else {
    const user = await getAdminSessionUser();
    await db.execute("INSERT INTO agency_clients (client_name,client_type,created_by) VALUES (?,?,?)", [name, kind, user?.id ?? null]);
  }
  revalidatePath("/admin/client");
  redirect(id ? "/admin/client?saved=1" : "/admin/client?saved=1");
}

export async function deleteAgencyClient(form: FormData) {
  if (!(await verifyAdminAnyScope(["dm", "dae"]))) redirect("/admin/login");
  const id = Number(read(form, "id", 20));
  if (!Number.isSafeInteger(id) || id < 1) redirect("/admin/client?error=invalid");
  await getDb().execute("DELETE FROM agency_clients WHERE id=?", [id]);
  revalidatePath("/admin/client");
  redirect("/admin/client?deleted=1");
}
