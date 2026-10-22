import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";
import DaeVisitForm from "@/components/dae-visit-form";
import { deleteDaeVisits } from "./actions";
import { getDb } from "@/lib/db";
import { verifyAdminAnyScope, verifyAdminSession } from "@/lib/admin-auth";

export const metadata = { title: "Kunjungan DAE | Solusi Sejalan" };
type AssignmentRow = RowDataPacket & { dae_person: string; week_start: string | Date; agency_client_ids: unknown };
type Client = RowDataPacket & { id: number; client_name: string; client_type: string };
type Visit = RowDataPacket & { id: number; dae_person: string; week_start: string | Date; client_name: string; client_type: string; agency_client_id: number; visit_count: number; created_at: Date | string };
const typeNames: Record<string,string> = { existing:"Client Existing",prospect:"Calon Client",ex_client:"Ex Client",community:"Community",media:"Media",institution:"Instansi",agency_ph:"Agency / PH",etc:"Etc." };
const path = "/admin/kpi/input/dae_visit";
const dateValue=(value:string|Date)=>typeof value==="string"?value.slice(0,10):new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(value);
function readIds(value: unknown): number[] { try { const parsed=typeof value==="string"?JSON.parse(value):value; return Array.isArray(parsed)?parsed.map(Number).filter(id=>Number.isSafeInteger(id)&&id>0):[]; } catch { return []; } }
const keyOf=(person:string,week:string)=>`${person}\u0000${week}`;

export default async function DaeVisitPage({ searchParams }: { searchParams: Promise<{ new?:string;view?:string;edit?:string;week?:string;saved?:string;deleted?:string;error?:string }> }) {
  if (!(await verifyAdminSession())) redirect("/admin/login");
  if (!(await verifyAdminAnyScope(["dm","dae"]))) redirect("/admin");
  const query=await searchParams, adding=query.new==="1", viewPerson=query.view??"", editPerson=query.edit??"", activePerson=viewPerson||editPerson, activeWeek=query.week??"";
  const [assignmentRows,clientRows,visitRows]=await Promise.all([
    getDb().execute<AssignmentRow[]>("SELECT e.dae_person,e.week_start,e.agency_client_ids FROM team_activity_entries e WHERE e.entry_type='dae_team' AND e.dae_person IS NOT NULL AND TRIM(e.dae_person)<>'' AND e.id=(SELECT latest.id FROM team_activity_entries latest WHERE latest.entry_type='dae_team' AND latest.dae_person=e.dae_person ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1) ORDER BY e.dae_person"),
    getDb().execute<Client[]>("SELECT id,client_name,client_type FROM agency_clients ORDER BY client_name"),
    getDb().execute<Visit[]>("SELECT v.id,v.dae_person,v.week_start,v.agency_client_id,v.visit_count,c.client_name,c.client_type,v.created_at FROM dae_visit_details v JOIN agency_clients c ON c.id=v.agency_client_id ORDER BY v.week_start DESC,v.dae_person,c.client_name"),
  ]);
  const clientsById=new Map(clientRows[0].map(client=>[client.id,client]));
  const assignmentMap=new Map<string,Set<number>>();
  for(const row of assignmentRows[0]){const ids=assignmentMap.get(row.dae_person)??new Set<number>();for(const id of readIds(row.agency_client_ids))ids.add(id);assignmentMap.set(row.dae_person,ids)}
  const assignments=[...assignmentMap].map(([dae_person,ids])=>({dae_person,clients:[...ids].map(id=>clientsById.get(id)).filter((client):client is Client=>Boolean(client))}));
  const people=new Set(assignments.map(item=>item.dae_person));
  if(activePerson&&(!activeWeek||!people.has(activePerson)))notFound();
  const grouped=new Map<string,Visit[]>();
  for(const visit of visitRows[0]){const key=keyOf(visit.dae_person,dateValue(visit.week_start));grouped.set(key,[...(grouped.get(key)??[]),visit])}
  const activeVisits=activePerson?grouped.get(keyOf(activePerson,activeWeek))??[]:[];
  const summaryKeys=[...grouped.keys()].sort((a,b)=>{const[pa,wa]=a.split("\u0000"),[pb,wb]=b.split("\u0000");return wb.localeCompare(wa)||pa.localeCompare(pb,"id")});
  const addingMode=adding||Boolean(editPerson);
  return <div className="admin-page"><AdminNavigation active="kpi" teamActive="dae-visit"/><main className="admin-main admin-section-main"><AdminTopbar section="Tim" page="Kunjungan DAE"/><div className="admin-shell admin-form-shell team-kpi-form-shell">
    <section className="admin-heading"><div><span className="eyebrow">KPI DAE / KUNJUNGAN</span><h1>{editPerson?"Edit Kunjungan DAE":viewPerson?`Client kunjungan ${viewPerson}`:adding?"Tambah Data Kunjungan":"Kunjungan DAE"}</h1><p>{addingMode?"Pilih minggu, DAE, dan client yang akan dikunjungi.":viewPerson?"Client yang dijadwalkan pada minggu yang dipilih.":"Pantau jumlah client yang akan dikunjungi per DAE dan per minggu."}</p></div>{!addingMode&&!viewPerson&&<Link className="button" href={`${path}?new=1`}>＋ Tambah Data</Link>}</section>
    {query.saved&&<div className="admin-success">Data kunjungan berhasil disimpan.</div>}{query.deleted&&<div className="admin-success">Data kunjungan DAE berhasil dihapus.</div>}{query.error&&<div className="admin-error">{query.error==="person"?"Nama DAE harus dipilih dari Data Tim DAE untuk minggu tersebut.":query.error==="client"?"Pilih hanya client yang dipegang DAE pada minggu tersebut.":"Pilih minggu, DAE, dan minimal satu client kunjungan."}</div>}
    {addingMode?<><div className="dae-strategy-back"><Link href={path}>← Kembali ke daftar DAE</Link></div><DaeVisitForm assignments={assignments} initialDaePerson={editPerson||undefined} initialWeekStart={editPerson?activeWeek:undefined} initialClientIds={editPerson?activeVisits.map(visit=>visit.agency_client_id):[]} initialVisits={editPerson?activeVisits.map(visit=>({agency_client_id:visit.agency_client_id,visit_count:Number(visit.visit_count)})):[]}/></>:viewPerson?<><div className="dae-strategy-back"><Link href={path}>← Kembali ke daftar DAE</Link><Link href={`${path}?edit=${encodeURIComponent(viewPerson)}&week=${activeWeek}`}>Edit daftar kunjungan</Link></div><p className="admin-footnote">Minggu dimulai {activeWeek}</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Client</th><th>Jenis Client</th><th>Jumlah Kunjungan</th></tr></thead><tbody>{activeVisits.map(visit=><tr key={visit.id}><td><b>{visit.client_name}</b></td><td>{typeNames[visit.client_type]??visit.client_type}</td><td>{visit.visit_count} kali</td></tr>)}{!activeVisits.length&&<tr><td colSpan={3} className="empty-state">Belum ada client kunjungan untuk DAE ini pada minggu tersebut.</td></tr>}</tbody></table></div></>:<section className="analytics-panel dae-strategy-summary"><div className="analytics-panel-heading"><div><h2>Daftar Kunjungan DAE per Minggu</h2><p>Nama DAE dan daftar client berasal dari Data Tim DAE. Periode dipilih terpisah untuk setiap kunjungan.</p></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Minggu</th><th>Nama DAE</th><th>Client yang Dikunjungi</th><th>Total Kunjungan</th><th>Aksi</th></tr></thead><tbody>{summaryKeys.map(key=>{const[person,week]=key.split("\u0000"),visits=grouped.get(key)??[];return<tr key={key}><td>{week}</td><td><b>{person}</b></td><td>{visits.length} client</td><td>{visits.reduce((total,visit)=>total+Number(visit.visit_count),0)} kali</td><td><div className="table-actions"><Link href={`${path}?view=${encodeURIComponent(person)}&week=${week}`}>Detail</Link><Link href={`${path}?edit=${encodeURIComponent(person)}&week=${week}`}>Edit</Link><form action={deleteDaeVisits}><input type="hidden" name="dae_person" value={person}/><input type="hidden" name="week_start" value={week}/><button className="table-delete">Hapus</button></form></div></td></tr>})}{!summaryKeys.length&&<tr><td colSpan={5} className="empty-state">Belum ada data kunjungan yang ditambahkan.</td></tr>}</tbody></table></div></section>}
  </div></main></div>;
}
