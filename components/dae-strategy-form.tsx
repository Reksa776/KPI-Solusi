"use client";

import { useState } from "react";
import { saveDaeStrategies } from "@/app/admin/kpi/input/dae_strategy/actions";
import { getMonthWeekStart } from "@/lib/dae-weeks";

type Client = { id: number; client_name: string; client_type: string };
type StrategyRow = { text: string; clientId: string };
type ExistingStrategy = { id: number; strategy_text: string; agency_client_id: number };
type Assignment = { dae_person: string; clients: Client[] };
const kinds: Record<string, string> = { existing: "Client Existing", prospect: "Calon Client", ex_client: "Ex Client", community: "Community", media: "Media", institution: "Instansi", agency_ph: "Agency / PH", etc: "Etc." };

export default function DaeStrategyForm({ assignments, initialDaePerson, initialWeekStart, existingStrategies = [] }: { assignments: Assignment[]; initialDaePerson?: string; initialWeekStart?: string; existingStrategies?: ExistingStrategy[] }) {
  const editing = Boolean(initialDaePerson);
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date());
  const initialMonth = initialWeekStart ? initialWeekStart.slice(0, 7) : month;
  const [periodMonth, setPeriodMonth] = useState(initialMonth);
  const [periodWeek, setPeriodWeek] = useState(initialWeekStart ?? getMonthWeekStart(initialMonth, 1) ?? `${initialMonth}-01`);
  const [daePerson, setDaePerson] = useState(initialDaePerson ?? "");
  const people = assignments;
  const currentAssignment = people.find(item => item.dae_person === daePerson);
  const clients = currentAssignment?.clients ?? [];
  const [rows, setRows] = useState<StrategyRow[]>(existingStrategies.length ? existingStrategies.map(row => ({ text: row.strategy_text, clientId: String(row.agency_client_id) })) : [{ text: "", clientId: "" }]);
  function update(index: number, field: keyof StrategyRow, value: string) {
    setRows(current => current.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }
  return <form action={saveDaeStrategies} className="package-edit-form dae-strategy-form">
    {editing&&<><input type="hidden" name="replace_dae_person" value={initialDaePerson}/><input type="hidden" name="replace_week_start" value={initialWeekStart}/></>}
    <div className="form-grid"><label>Bulan laporan<input type="month" value={periodMonth} onChange={event=>{const value=event.target.value;setPeriodMonth(value);setPeriodWeek(getMonthWeekStart(value,1)??`${value}-01`)}} required/></label><label>Minggu laporan<select value={periodWeek} onChange={event=>setPeriodWeek(event.target.value)} required>{Array.from({length:5},(_,index)=>getMonthWeekStart(periodMonth,index+1)).filter((value):value is string=>Boolean(value)).map((value,index)=><option key={value} value={value}>Minggu {index+1} · {new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`))}</option>)}</select><input type="hidden" name="week_start" value={periodWeek}/></label></div>
    <label>Nama DAE<select name="dae_person" required value={daePerson} onChange={event=>{setDaePerson(event.target.value);setRows(current=>current.map(row=>({...row,clientId:""})))}}><option value="" disabled>Pilih nama orang DAE</option>{people.map(item => <option key={item.dae_person} value={item.dae_person}>{item.dae_person}</option>)}</select></label>
    <section className="dae-strategy-rows"><div className="dae-strategy-section-heading"><div><h2>Daftar Strategi</h2><p>Tambahkan satu atau beberapa strategi dan pilih client untuk masing-masing.</p></div><button type="button" className="button light" onClick={() => setRows(current => [...current, { text: "", clientId: "" }])}>＋ Tambah Strategi</button></div>
      {rows.map((row, index) => <div className="dae-strategy-row" key={index}><span className="dae-strategy-number">{index + 1}</span><label>Strategi<input name="strategy_text" value={row.text} onChange={event => update(index, "text", event.target.value)} required maxLength={500} placeholder="Tulis strategi DAE"/></label><label>Untuk Client<select name="strategy_client_id" value={row.clientId} onChange={event => update(index, "clientId", event.target.value)} required><option value="" disabled>Pilih client</option>{Object.entries(kinds).map(([type, label]) => { const matches = clients.filter(client => client.client_type === type); return matches.length ? <optgroup key={type} label={label}>{matches.map(client => <option key={client.id} value={client.id}>{client.client_name}</option>)}</optgroup> : null; })}</select></label>{rows.length > 1 && <button type="button" className="dae-strategy-remove" aria-label={`Hapus strategi nomor ${index + 1}`} onClick={() => setRows(current => current.filter((_, i) => i !== index))}>×</button>}</div>)}
      {!assignments.length&&<p className="dae-client-empty">Belum ada Data Tim DAE. Tambahkan orang DAE dan daftar client terlebih dahulu.</p>}{people.length>0&&!clients.length&&<p className="dae-client-empty">DAE ini belum memiliki client di Data Tim DAE.</p>}
    </section>
    <div className="form-actions"><a className="button light" href="/admin/kpi/input/dae_strategy">Kembali</a><button className="button" disabled={!people.length || !clients.length}>Simpan Strategi</button></div>
  </form>;
}
