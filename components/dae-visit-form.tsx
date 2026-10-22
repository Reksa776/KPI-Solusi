"use client";

import { useMemo, useState } from "react";
import { saveDaeVisits } from "@/app/admin/kpi/input/dae_visit/actions";
import DaeMonthWeekPicker from "@/components/dae-month-week-picker";
import { getMonthWeekStart } from "@/lib/dae-weeks";

type Client = { id: number; client_name: string; client_type: string };
type Assignment = { dae_person: string; clients: Client[] };
type InitialVisit = { agency_client_id: number; visit_count: number };
const clientTypeNames: Record<string, string> = { existing: "Client Existing", prospect: "Calon Client", ex_client: "Ex Client", community: "Community", media: "Media", institution: "Instansi", agency_ph: "Agency / PH", etc: "Etc." };

export default function DaeVisitForm({ assignments, initialDaePerson, initialWeekStart, initialClientIds = [], initialVisits = [] }: { assignments: Assignment[]; initialDaePerson?: string; initialWeekStart?: string; initialClientIds?: number[]; initialVisits?: InitialVisit[] }) {
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date());
  const [weekStart,setWeekStart]=useState(initialWeekStart??getMonthWeekStart(month,1)??"");
  const [daePerson, setDaePerson] = useState(initialDaePerson ?? "");
  const [selectedIds, setSelectedIds] = useState<number[]>(initialClientIds);
  const [visitCounts, setVisitCounts] = useState<Record<number, string>>(() => Object.fromEntries(initialVisits.map(item => [item.agency_client_id, String(item.visit_count)])));
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const people=assignments;
  const assignment = people.find(item => item.dae_person === daePerson);
  const clients = assignment?.clients ?? [];
  const selected = clients.filter(client => selectedIds.includes(client.id));
  const available = clients.filter(client => !selectedIds.includes(client.id));
  const results = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return available.filter(client => !query || client.client_name.toLocaleLowerCase("id-ID").includes(query));
  }, [available, search]);
  return <form action={saveDaeVisits} className="package-edit-form dae-strategy-form">
    <DaeMonthWeekPicker initialWeekStart={weekStart} onChange={setWeekStart} />
    <label>Nama DAE<select name="dae_person" required value={daePerson} onChange={event => { setDaePerson(event.target.value); setSelectedIds([]); setVisitCounts({}); setSearch(""); setOpen(false); }}><option value="" disabled>Pilih nama orang DAE</option>{people.map(item => <option key={item.dae_person} value={item.dae_person}>{item.dae_person}</option>)}</select></label>
    <label>Client yang akan dikunjungi (bisa pilih beberapa)<div className="dae-visit-client-picker"><input type="search" aria-label="Cari client yang dipegang DAE" aria-expanded={open} aria-controls="dae-visit-client-results" disabled={!available.length} value={search} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onChange={event => { setSearch(event.target.value); setOpen(true); }} placeholder={!daePerson ? "Pilih DAE terlebih dahulu" : available.length ? "Cari nama client..." : "Semua client sudah dipilih"}/>{open&&available.length>0&&<div id="dae-visit-client-results" className="dae-visit-client-results" role="listbox">{results.length?results.map(client=><button type="button" role="option" aria-selected="false" key={client.id} onMouseDown={event=>event.preventDefault()} onClick={()=>{setSelectedIds(current=>current.includes(client.id)?current:[...current,client.id]);setSearch("");setOpen(false)}}><span>{client.client_name}</span><small>{clientTypeNames[client.client_type]??client.client_type}</small></button>):<p>Client tidak ditemukan.</p>}</div>}</div></label>
    <div className="dae-visit-selected">{selected.map(client => <div className="dae-visit-count-row" key={client.id}><span><b>{client.client_name}</b><small>{clientTypeNames[client.client_type]??client.client_type}</small></span><label>Berapa kali<input type="number" name="visit_counts" min="1" max="1000" step="1" required value={visitCounts[client.id]??"1"} onChange={event=>setVisitCounts(current=>({...current,[client.id]:event.target.value}))}/><small>kali minggu ini</small></label><button type="button" aria-label={`Hapus ${client.client_name}`} onClick={() => setSelectedIds(current => current.filter(id => id !== client.id))}>×</button><input type="hidden" name="agency_client_ids" value={client.id}/></div>)}{!selected.length&&<p className="dae-client-empty">{daePerson ? "Belum memilih client." : "Pilih DAE untuk melihat client yang dipegang."}</p>}</div>
    {initialDaePerson&&<><input type="hidden" name="replace_dae_person" value={initialDaePerson}/><input type="hidden" name="replace_week_start" value={initialWeekStart}/></>}
    {!assignments.length&&<p className="dae-client-empty">Belum ada Data Tim DAE. Lengkapi daftar orang dan client terlebih dahulu.</p>}
    <div className="form-actions"><a className="button light" href="/admin/kpi/input/dae_visit">Kembali</a><button className="button" disabled={!assignments.length || !selectedIds.length}>Simpan Data Kunjungan</button></div>
  </form>;
}
