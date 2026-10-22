import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";
import DaeStrategyForm from "@/components/dae-strategy-form";
import { deleteDaeStrategiesByPerson } from "./actions";
import { getDb } from "@/lib/db";
import { verifyAdminAnyScope, verifyAdminSession } from "@/lib/admin-auth";

export const metadata = { title: "Strategi DAE | Solusi Sejalan" };
type AssignmentRow = RowDataPacket & { dae_person: string; week_start: string | Date; agency_client_ids: unknown };
type Client = RowDataPacket & { id: number; client_name: string; client_type: string };
type Strategy = RowDataPacket & { id: number; dae_person: string; week_start: string | Date; strategy_text: string; agency_client_id: number; client_name: string; client_type: string; created_at: Date | string };
const clientTypeNames: Record<string, string> = { existing: "Client Existing", prospect: "Calon Client", ex_client: "Ex Client", community: "Community", media: "Media", institution: "Instansi", agency_ph: "Agency / PH", etc: "Etc." };
const path = "/admin/kpi/input/dae_strategy";
const dateValue=(value:string|Date)=>typeof value==="string"?value.slice(0,10):new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(value);
function readIds(value:unknown):number[]{try{const parsed=typeof value==="string"?JSON.parse(value):value;return Array.isArray(parsed)?parsed.map(Number).filter(id=>Number.isSafeInteger(id)&&id>0):[]}catch{return[]}}
const keyOf=(person:string,week:string)=>`${person}\u0000${week}`;

export default async function DaeStrategyPage({ searchParams }: { searchParams: Promise<{ new?: string; view?: string; edit?: string; week?:string; saved?: string; deleted?: string; error?: string }> }) {
  if (!(await verifyAdminSession())) redirect("/admin/login");
  if (!(await verifyAdminAnyScope(["dm", "dae"]))) redirect("/admin");
  const query = await searchParams, adding = query.new === "1", viewPerson = query.view ?? "", editPerson = query.edit ?? "", activePerson = viewPerson || editPerson, activeWeek=query.week??"";
  const [assignmentRows, clients, strategies] = await Promise.all([
    getDb().execute<AssignmentRow[]>("SELECT e.dae_person,e.week_start,e.agency_client_ids FROM team_activity_entries e WHERE e.entry_type='dae_team' AND e.dae_person IS NOT NULL AND TRIM(e.dae_person)<>'' AND e.id=(SELECT latest.id FROM team_activity_entries latest WHERE latest.entry_type='dae_team' AND latest.dae_person=e.dae_person ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1) ORDER BY e.dae_person"),
    getDb().execute<Client[]>("SELECT id,client_name,client_type FROM agency_clients ORDER BY client_name"),
    getDb().execute<Strategy[]>("SELECT s.id,s.dae_person,s.week_start,s.strategy_text,s.agency_client_id,c.client_name,c.client_type,s.created_at FROM dae_strategy_details s JOIN agency_clients c ON c.id=s.agency_client_id ORDER BY s.week_start DESC,s.dae_person,s.created_at DESC,s.id DESC"),
  ]);
  const serializableClients=clients[0].map(client=>({...client,id:Number(client.id)}));
  const clientsById=new Map(serializableClients.map(client=>[client.id,client]));
  const assignmentMap=new Map<string,Set<number>>();
  for(const row of assignmentRows[0]){const ids=assignmentMap.get(row.dae_person)??new Set<number>();for(const id of readIds(row.agency_client_ids))ids.add(id);assignmentMap.set(row.dae_person,ids)}
  const assignments=[...assignmentMap].map(([dae_person,ids])=>({dae_person,clients:[...ids].map(id=>clientsById.get(id)).filter((client):client is Client=>Boolean(client))}));
  const people=new Set(assignments.map(item=>item.dae_person));
  if(activePerson&&(!activeWeek||!people.has(activePerson)))notFound();
  const activeStrategies=activePerson?strategies[0].filter(row=>row.dae_person===activePerson&&dateValue(row.week_start)===activeWeek):[];
  const summaries=new Map<string,number>();for(const strategy of strategies[0]){const key=keyOf(strategy.dae_person,dateValue(strategy.week_start));summaries.set(key,(summaries.get(key)??0)+1)}
  const summaryKeys=[...summaries.keys()].sort((a,b)=>{const[pa,wa]=a.split("\u0000"),[pb,wb]=b.split("\u0000");return wb.localeCompare(wa)||pa.localeCompare(pb,"id")});
  const addingMode=adding||Boolean(editPerson);
  return <div className="admin-page"><AdminNavigation active="kpi" teamActive="dae-strategy"/><main className="admin-main admin-section-main"><AdminTopbar section="Tim" page="Strategi DAE"/><div className="admin-shell admin-form-shell team-kpi-form-shell">
    <section className="admin-heading"><div><span className="eyebrow">KPI DAE / STRATEGI</span><h1>{editPerson?"Edit Strategi DAE":viewPerson?`Strategi ${viewPerson}`:adding?"Tambah Strategi DAE":"Strategi DAE"}</h1><p>{addingMode?"Pilih periode minggu, nama DAE, dan strategi beserta client terkait.":viewPerson?"Daftar strategi dan client yang dituju pada minggu tersebut.":"Pantau jumlah strategi per DAE dan per minggu."}</p></div>{!addingMode&&!viewPerson&&<Link className="button" href={`${path}?new=1`}>＋ Tambah Data</Link>}</section>
    {query.saved&&<div className="admin-success">Strategi berhasil disimpan.</div>}{query.deleted&&<div className="admin-success">Strategi DAE berhasil dihapus.</div>}{query.error&&<div className="admin-error">{query.error==="person"?"Pilih nama DAE yang tersedia di Data Tim DAE.":query.error==="client"?"Pilih client yang dipegang DAE.":"Periksa kembali minggu, nama DAE, strategi, dan client."}</div>}
    {addingMode?<><div className="dae-strategy-back"><Link href={path}>← Kembali ke daftar DAE</Link></div><DaeStrategyForm assignments={assignments} initialDaePerson={editPerson||undefined} initialWeekStart={editPerson?activeWeek:undefined} existingStrategies={editPerson?activeStrategies.map(strategy=>({...strategy,agency_client_id:Number(strategy.agency_client_id)})):[]}/></>:viewPerson?<><div className="dae-strategy-back"><Link href={path}>← Kembali ke daftar DAE</Link><Link href={`${path}?edit=${encodeURIComponent(viewPerson)}&week=${activeWeek}`}>Edit daftar strategi</Link></div><p className="admin-footnote">Minggu dimulai {activeWeek}</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Strategi</th><th>Client</th><th>Jenis Client</th></tr></thead><tbody>{activeStrategies.map(strategy=><tr key={strategy.id}><td>{strategy.strategy_text}</td><td>{strategy.client_name}</td><td>{clientTypeNames[strategy.client_type]??strategy.client_type}</td></tr>)}{!activeStrategies.length&&<tr><td colSpan={3} className="empty-state">Belum ada strategi untuk DAE ini pada minggu tersebut.</td></tr>}</tbody></table></div></>:<section className="analytics-panel dae-strategy-summary"><div className="analytics-panel-heading"><div><h2>Daftar DAE per Minggu</h2><p>Nama DAE dan daftar client berasal dari Data Tim DAE. Periode dipilih terpisah untuk setiap strategi.</p></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Minggu</th><th>Nama DAE</th><th>Jumlah Strategi</th><th>Aksi</th></tr></thead><tbody>{summaryKeys.map(key=>{const[person,week]=key.split("\u0000");return<tr key={key}><td>{week}</td><td><b>{person}</b></td><td>{summaries.get(key)} strategi</td><td><div className="table-actions"><Link href={`${path}?view=${encodeURIComponent(person)}&week=${week}`}>Lihat</Link><Link href={`${path}?edit=${encodeURIComponent(person)}&week=${week}`}>Edit</Link><form action={deleteDaeStrategiesByPerson}><input type="hidden" name="dae_person" value={person}/><input type="hidden" name="week_start" value={week}/><button className="table-delete">Hapus</button></form></div></td></tr>})}{!summaryKeys.length&&<tr><td colSpan={4} className="empty-state">Belum ada strategi yang ditambahkan.</td></tr>}</tbody></table></div></section>}
  </div></main></div>;
}
