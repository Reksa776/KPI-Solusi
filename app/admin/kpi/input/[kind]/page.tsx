import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";
import { getAdminSessionUser, verifyAdminAnyScope, verifyAdminScope } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { deleteTeamEntry, saveTeamEntry } from "../../actions";
import type { TeamNavActive } from "@/components/team-subnavigation";
import DaeTeamClientFields from "@/components/dae-team-client-fields";
import DmClientPerformanceForm from "@/components/dm-client-performance-form";

type Kind = "dm_client" | "dae_individual" | "dae_team" | "dae_strategy" | "dae_visit" | "dae_client";
type Entry = RowDataPacket & { id:number;title:string;client_name:string|null;client_type:string|null;dae_person:string|null;dm_person:string|null;dm_team_member_id:number|null;agency_client_id:number|null;agency_client_ids:unknown;activity_date:string|Date;week_start:string|Date;contents:number;video_views:number;tiktok_sales:number;shopee_sales:number;new_clients:number;strategies:number;visits:number;notes:string|null;assigned_user_id:number|null };
type User = RowDataPacket & { id:number;full_name:string };
type DmMember = RowDataPacket & { id:number;full_name:string };
type AgencyClient = RowDataPacket & { id:number;client_name:string;client_type:string };
const names:Record<Kind,string>={dm_client:"Input data client untuk DM",dae_individual:"Input data per DAE",dae_team:"Input data tim DAE",dae_strategy:"Input data strategi DAE",dae_visit:"Input data kunjungan DAE",dae_client:"Input data client DAE"};
const validKinds:Kind[]=["dm_client","dae_individual","dae_team","dae_strategy","dae_visit","dae_client"];
const fields=[{key:"contents",label:"Konten terbit"},{key:"video_views",label:"Views video"},{key:"tiktok_sales",label:"Omset TikTok (Rp)"},{key:"shopee_sales",label:"Omset Shopee (Rp)"},{key:"new_clients",label:"Client baru"},{key:"strategies",label:"Strategi disusun"},{key:"visits",label:"Kunjungan"}] as const;
function readClientIds(value: unknown): number[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.map(Number).filter(id => Number.isSafeInteger(id) && id > 0) : [];
  } catch { return []; }
}
function todayJakarta() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function dateInputValue(value: string | Date) { return typeof value === "string" ? value.slice(0, 10) : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(value); }
export default async function KpiEntryPage({params,searchParams}:{params:Promise<{kind:string}>;searchParams:Promise<{id?:string;new?:string;select?:string;client_id?:string;saved?:string;deleted?:string;error?:string}>}){
  const {kind:raw}=await params, query=await searchParams;
  if(!validKinds.includes(raw as Kind))notFound();
  const kind=raw as Kind,scope=kind.startsWith("dm_")?"dm":"dae";
  const actor=await getAdminSessionUser();
  const canDM=actor?.role==="superadmin"||actor?.admin_scope==="dm"||actor?.admin_scope==="both";
  const canDAE=actor?.role==="superadmin"||actor?.admin_scope==="dae"||actor?.admin_scope==="both";
  const sharedDaeEntry=["dae_team","dae_strategy","dae_visit"].includes(kind);
  if(sharedDaeEntry?!(await verifyAdminAnyScope(["dm","dae"])):!(await verifyAdminScope(scope)))redirect("/admin/kpi");
  const id=query.id?Number(query.id):null;
  if(id!==null&&(!Number.isSafeInteger(id)||id<1))notFound();
  const db=getDb();
  const showTeamTable=kind==="dae_team"&&!id&&query.new!=="1";
  const showDmClientTable=kind==="dm_client"&&!id&&!query.select&&!query.client_id;
  const [rows,users,clients,teamEntries,dmEntries,dmMembers]=await Promise.all([
    id?db.execute<Entry[]>("SELECT * FROM team_activity_entries WHERE id=? AND entry_type=? LIMIT 1",[id,kind]):Promise.resolve([[] as Entry[],[]] as const),
    kind==="dm_client"?Promise.resolve([[] as User[],[]] as const):db.execute<User[]>("SELECT id,full_name FROM users WHERE role IN ('admin','superadmin') AND status='active' AND admin_scope IN (?, 'both') ORDER BY full_name",[scope]),
    kind==="dae_team"||kind==="dm_client"?db.execute<AgencyClient[]>("SELECT id,client_name,client_type FROM agency_clients ORDER BY client_name"):Promise.resolve([[] as AgencyClient[],[]] as const),
    showTeamTable?db.execute<Entry[]>("SELECT e.id,e.title,e.client_name,e.client_type,e.dae_person,e.agency_client_ids,e.activity_date,e.week_start,e.contents,e.video_views,e.tiktok_sales,e.shopee_sales,e.new_clients,e.strategies,e.visits,e.notes,e.assigned_user_id FROM team_activity_entries e WHERE e.entry_type='dae_team' AND e.id=(SELECT latest.id FROM team_activity_entries latest WHERE latest.entry_type='dae_team' AND latest.dae_person=e.dae_person ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1) ORDER BY e.dae_person LIMIT 500"):Promise.resolve([[] as Entry[],[]] as const),
    showDmClientTable?db.execute<(Entry&{full_name:string|null})[]>("SELECT e.id,e.title,e.client_name,e.client_type,e.agency_client_id,e.dm_team_member_id,e.dm_person,e.activity_date,e.contents,e.video_views,e.tiktok_sales,e.shopee_sales,e.assigned_user_id,COALESCE(m.full_name,e.dm_person,u.full_name) AS full_name FROM team_activity_entries e LEFT JOIN dm_team_members m ON m.id=e.dm_team_member_id LEFT JOIN users u ON u.id=e.assigned_user_id WHERE e.entry_type='dm_client' ORDER BY e.activity_date DESC,e.id DESC LIMIT 500"):Promise.resolve([[] as (Entry&{full_name:string|null})[],[]] as const),
    kind==="dm_client"?db.execute<DmMember[]>("SELECT id,full_name FROM dm_team_members ORDER BY full_name"):Promise.resolve([[] as DmMember[],[]] as const)
  ]);
  const entry=rows[0][0];if(id&&!entry)notFound();
  const showDmClientPicker=kind==="dm_client"&&!query.client_id&&(query.select==="1"||Boolean(id&&entry&&!entry.agency_client_id));
  const title=names[kind],isEdit=Boolean(entry);
  const requestedClientId=query.client_id?Number(query.client_id):null;
  if(requestedClientId!==null&&(!Number.isSafeInteger(requestedClientId)||requestedClientId<1))notFound();
  const selectedDmClient=entry?.agency_client_id?clients[0].find(client=>client.id===entry.agency_client_id):requestedClientId?clients[0].find(client=>client.id===requestedClientId):entry?.client_name?clients[0].find(client=>client.client_name===entry.client_name):undefined;
  if(kind==="dm_client"&&!showDmClientTable&&!showDmClientPicker&&!selectedDmClient)notFound();
  const activeNav:Record<Kind,TeamNavActive>={dm_client:"dm-client",dae_individual:"dae-individual",dae_team:"dae-team",dae_strategy:"dae-strategy",dae_visit:"dae-visit",dae_client:"dae-client"};
  const showFields=kind==="dm_client"?["contents","video_views","tiktok_sales","shopee_sales"]:kind==="dae_strategy"?["strategies"]:kind==="dae_visit"?["visits"]:kind==="dae_client"?["new_clients","contents"]:kind==="dae_individual"?["new_clients","contents","visits"]:fields.map(field=>field.key);
  const shortcuts:Kind[]=validKinds.filter(value=>value==="dm_client"?canDM:value==="dae_individual"||value==="dae_client"?canDAE:true);
  return <div className="admin-page"><AdminNavigation active="kpi" teamActive={activeNav[kind]}/><main className="admin-main admin-section-main"><AdminTopbar section="Tim" page={title}/><div className="admin-shell admin-form-shell team-kpi-form-shell"><section className="admin-heading"><div><span className="eyebrow">KPI {scope.toUpperCase()} / INPUT DATA</span><h1>{showTeamTable?"Data Tim DAE":isEdit?"Edit aktivitas":title}</h1><p>{showTeamTable?"Daftar orang DAE dan client yang sedang dipegang.":"Catat hasil aktivitas tim agar terlihat di ringkasan KPI."}</p></div>{showTeamTable&&<Link className="button" href="/admin/kpi/input/dae_team?new=1">＋ Tambah Data</Link>}</section>
    {query.error&&<div className="admin-error">Data belum tersimpan. Periksa isian yang dimasukkan.</div>}{query.saved&&<div className="admin-success">Data berhasil disimpan.</div>}{query.deleted&&<div className="admin-success">Data berhasil dihapus.</div>}
    {showDmClientTable?<><div className="analytics-panel-heading"><div><h2>Performa per client</h2><p>Setiap catatan terhubung ke client dan anggota DM yang dipilih.</p></div><Link className="button" href="/admin/kpi/input/dm_client?select=1">＋ Tambah Data</Link></div><div className="admin-table-wrap"><table className="admin-table dm-team-table"><thead><tr><th>Client</th><th>Nama DM</th><th>Konten</th><th>Views</th><th>Omset TikTok</th><th>Omset Shopee</th><th>Aksi</th></tr></thead><tbody>{dmEntries[0].map(row=><tr key={row.id}><td><b>{row.client_name??"Client belum dipilih"}</b>{row.client_type&&<small>{row.client_type}</small>}</td><td>{row.full_name??"—"}</td><td>{row.contents}</td><td>{row.video_views.toLocaleString("id-ID")}</td><td>Rp {row.tiktok_sales.toLocaleString("id-ID")}</td><td>Rp {row.shopee_sales.toLocaleString("id-ID")}</td><td><div className="table-actions"><Link href={`/admin/kpi/input/dm_client?id=${row.id}`}>Edit</Link><form action={deleteTeamEntry}><input type="hidden" name="id" value={row.id}/><input type="hidden" name="entry_type" value="dm_client"/><button className="table-delete">Hapus</button></form></div></td></tr>)}{!dmEntries[0].length&&<tr><td colSpan={7} className="empty-state">Belum ada data client DM. Tekan “Tambah Data” untuk mulai mengisi.</td></tr>}</tbody></table></div></>:showDmClientPicker?<section className="analytics-panel"><div className="analytics-panel-heading"><div><h2>Pilih client</h2><p>Pilih client yang akan dicatat performanya. Form KPI akan dibuka setelah client dipilih.</p></div></div><form action="/admin/kpi/input/dm_client" method="get" className="package-edit-form"><input type="hidden" name="new" value="1"/>{entry&&<input type="hidden" name="id" value={entry.id}/>}<label>Client<select name="client_id" required defaultValue=""><option value="" disabled>Pilih client</option>{clients[0].map(client=><option key={client.id} value={client.id}>{client.client_name} · {client.client_type}</option>)}</select></label><div className="form-actions"><Link className="button light" href="/admin/kpi/input/dm_client">Kembali</Link><button className="button">Lanjut input <span>↗</span></button></div></form></section>:kind==="dm_client"&&!entry?<DmClientPerformanceForm clients={clients[0]} dms={dmMembers[0]} initialClientId={selectedDmClient!.id} activityDate={todayJakarta()}/>:<form action={saveTeamEntry} className="package-edit-form"><input type="hidden" name="entry_type" value={kind}/>{entry&&<input type="hidden" name="id" value={entry.id}/>}{kind==="dae_team"?<><input type="hidden" name="title" value={entry?.title??"Data Tim DAE"}/><input type="hidden" name="activity_date" value={entry?.activity_date?dateInputValue(entry.activity_date):todayJakarta()}/></>:kind==="dm_client"?<><input type="hidden" name="title" value={`Performa ${selectedDmClient?.client_name??"client"}`}/><input type="hidden" name="activity_date" value={entry?.activity_date?dateInputValue(entry.activity_date):todayJakarta()}/><input type="hidden" name="agency_client_id" value={selectedDmClient?.id??""}/></>:<div className="form-grid"><label>Nama aktivitas<input name="title" defaultValue={entry?.title} required maxLength={180} placeholder="Contoh: Optimasi konten campaign"/></label><label>Tanggal<input name="activity_date" type="date" defaultValue={entry?.activity_date?dateInputValue(entry.activity_date):todayJakarta()} required/></label></div>}
    <div className="form-grid">{kind==="dae_team"?<label>Nama orang DAE<input name="dae_person" defaultValue={entry?.dae_person??""} required maxLength={160} placeholder="Ketik nama orang DAE"/></label>:kind==="dm_client"?<label>Nama DM<select name="dm_team_member_id" defaultValue={entry?.dm_team_member_id??""} required><option value="">Pilih anggota DM</option>{dmMembers[0].map(person=><option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>:<label>Penanggung jawab (opsional)<select name="assigned_user_id" defaultValue={entry?.assigned_user_id??""}><option value="">Pilih anggota tim</option>{users[0].map(person=><option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>}{kind!=="dae_team"&&kind!=="dm_client"&&<label>Nama client / brand<input name="client_name" defaultValue={entry?.client_name??""} maxLength={160} placeholder="Opsional"/></label>}</div>
    {kind==="dae_team"&&<DaeTeamClientFields clients={clients[0]} selectedIds={readClientIds(entry?.agency_client_ids)}/>}
    {kind!=="dae_team"&&<><div className="form-grid">{fields.filter(field=>showFields.includes(field.key)).map(field=><label key={field.key}>{field.label}<input name={field.key} type="number" min="0" step="1" defaultValue={entry?.[field.key]??0}/></label>)}</div>
    <label>Catatan<textarea name="notes" defaultValue={entry?.notes??""} maxLength={4000} rows={4} placeholder="Konteks atau tindak lanjut"/></label></>}<div className="form-actions"><Link className="button light" href="/admin/kpi">Kembali</Link><button className="button">{isEdit?"Simpan perubahan":"Simpan data"} <span>↗</span></button></div></form>}
    {!showTeamTable&&<section className="settings-section team-kpi-shortcuts"><h2>Input lainnya</h2><div>{shortcuts.map(value=><Link key={value} href={`/admin/kpi/input/${value}`}>{names[value]}</Link>)}</div></section>}
  </div></main></div>;
}
