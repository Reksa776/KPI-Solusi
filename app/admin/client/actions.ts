"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import { getAdminSessionUser, verifyAdminAnyScope } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { normalizeAgencyClientName, normalizeAgencyClientType } from "@/lib/client-types";
import { parseClientWorkbook } from "@/lib/client-xlsx-import";

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
    const [existing] = await db.execute<(RowDataPacket & { id:number;client_name:string })[]>("SELECT id,client_name FROM agency_clients WHERE id<>?",[id]);
    if(existing.some(row=>normalizeAgencyClientName(row.client_name)===normalizeAgencyClientName(name)))redirect(`/admin/client/${id}?error=duplicate`);
    await db.execute("UPDATE agency_clients SET client_name=?,client_type=? WHERE id=?", [name, kind, id]);
    revalidatePath(`/admin/client/${id}`);
    revalidatePath("/admin");
  } else {
    const [existing] = await db.execute<(RowDataPacket & { client_name:string })[]>("SELECT client_name FROM agency_clients");
    if(existing.some(row=>normalizeAgencyClientName(row.client_name)===normalizeAgencyClientName(name)))redirect("/admin/client?error=duplicate");
    const user = await getAdminSessionUser();
    await db.execute("INSERT INTO agency_clients (client_name,client_type,created_by) VALUES (?,?,?)", [name, kind, user?.id ?? null]);
  }
  revalidatePath("/admin/client");
  revalidatePath("/admin");
  redirect(id ? "/admin/client?saved=1" : "/admin/client?saved=1");
}

export async function importAgencyClients(form: FormData) {
  if (!(await verifyAdminAnyScope(["dm", "dae"]))) redirect("/admin/login");
  const file = form.get("file");
  if (!(file instanceof File) || !file.size || file.size > 8 * 1024 * 1024 || !file.name.toLowerCase().endsWith(".xlsx")) redirect("/admin/client?error=import-file");
  let rows: string[][];
  try { rows = parseClientWorkbook(Buffer.from(await file.arrayBuffer())); }
  catch { redirect("/admin/client?error=import-format"); }
  const normalizeHeader=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/[_-]+/g," ");
  const headers=rows[0]?.map(value=>normalizeHeader(value??""))??[];
  const column=(...names:string[])=>headers.findIndex(value=>names.includes(value));
  const nameColumn=column("nama client","nama klien","client","client name","nama");
  const typeColumn=column("jenis client","jenis klien","client type","jenis");
  if(nameColumn<0||typeColumn<0)redirect("/admin/client?error=import-columns");
  const validKinds=new Set(kinds);
  const prepared:{name:string;type:string;contact:string|null;email:string|null;phone:string|null;notes:string|null}[]=[];
  let invalid=0;
  for(const row of rows.slice(1)){
    const name=String(row[nameColumn]??"").trim().slice(0,180);
    if(!name)continue;
    const type=normalizeAgencyClientType(row[typeColumn]??"");
    if(!validKinds.has(type)){invalid++;continue}
    const value=(...names:string[])=>{const index=column(...names);return index>=0?String(row[index]??"").trim():""};
    prepared.push({name,type,contact:value("nama kontak","contact name","kontak").slice(0,160)||null,email:value("email","e mail").slice(0,191)||null,phone:value("no. telepon","no telepon","telepon","phone","nomor telepon").slice(0,40)||null,notes:value("catatan","notes").slice(0,5000)||null});
  }
  if(!prepared.length)redirect(`/admin/client?error=import-empty&invalid=${invalid}`);
  const db=getDb(),[existing]=await db.execute<(RowDataPacket & {client_name:string})[]>("SELECT client_name FROM agency_clients");
  const seen=new Set(existing.map(row=>normalizeAgencyClientName(row.client_name)));
  const accepted=prepared.filter(row=>{const key=normalizeAgencyClientName(row.name);if(seen.has(key))return false;seen.add(key);return true});
  const skipped=prepared.length-accepted.length;
  if(accepted.length){
    const user=await getAdminSessionUser();
    await db.transaction(async tx=>{for(const row of accepted)await tx.execute("INSERT INTO agency_clients (client_name,client_type,contact_name,email,phone,notes,created_by) VALUES (?,?,?,?,?,?,?)",[row.name,row.type,row.contact,row.email,row.phone,row.notes,user?.id??null])});
  }
  revalidatePath("/admin/client");
  revalidatePath("/admin");
  redirect(`/admin/client?imported=${accepted.length}&skipped=${skipped}&invalid=${invalid}`);
}

export async function deleteAgencyClient(form: FormData) {
  if (!(await verifyAdminAnyScope(["dm", "dae"]))) redirect("/admin/login");
  const id = Number(read(form, "id", 20));
  if (!Number.isSafeInteger(id) || id < 1) redirect("/admin/client?error=invalid");
  await getDb().execute("DELETE FROM agency_clients WHERE id=?", [id]);
  revalidatePath("/admin/client");
  revalidatePath("/admin");
  redirect("/admin/client?deleted=1");
}
