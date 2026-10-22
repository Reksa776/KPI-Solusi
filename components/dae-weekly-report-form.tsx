"use client";

import { useMemo, useState } from "react";
import { saveDaeWeeklyReport } from "@/app/admin/kpi/input/dae_individual/actions";
import DaeMonthWeekPicker from "@/components/dae-month-week-picker";

type Stat = { week_start: string; dae_person: string; clients: number; strategies: number; visits: number; rank: number; dae_count: number };
type Report = { id: number; dae_person: string; week_start: string; team_coordination: string | null; daily_report: string | null };
export default function DaeWeeklyReportForm({ stats, report }: { stats: Stat[]; report?: Report }) {
  const weeks=[...new Set(stats.map(row=>row.week_start))].sort().reverse();
  const [week,setWeek]=useState(report?.week_start??weeks[0]??"");
  const available=stats.filter(row=>row.week_start===week);
  const [person,setPerson]=useState(report?.dae_person??"");
  const current=useMemo(()=>stats.find(row=>row.week_start===week&&row.dae_person===person),[stats,week,person]);
  return <form action={saveDaeWeeklyReport} className="package-edit-form dae-weekly-report-form">
    {report&&<input type="hidden" name="id" value={report.id}/>}
    <DaeMonthWeekPicker initialWeekStart={week} periods={weeks} onChange={value=>{if(value!==week){setWeek(value);setPerson("")}}} />
    <label>Nama DAE<select name="dae_person" required value={person} onChange={event=>setPerson(event.target.value)}><option value="" disabled>Pilih nama DAE</option>{available.map(row=><option key={row.dae_person} value={row.dae_person}>{row.dae_person}</option>)}</select></label>
    <div className="dae-weekly-metrics"><label>Retensi Client Existing<input readOnly value={current?`${current.clients} client`:"—"}/></label><label>Strategi Ide Bisnis<input readOnly value={current?`${current.strategies} strategi`:"—"}/></label><label>Kunjungan<input readOnly value={current?`${current.visits} kali`:"—"}/></label><label>Pencapaian Client Existing<input readOnly value={current?`${current.clients} client · peringkat ${current.rank}/${current.dae_count}`:"—"}/></label></div>
    <p className="dae-weekly-note">Retensi dan pencapaian menghitung Client Existing yang dipegang tiap DAE. Peringkat dibandingkan berdasarkan jumlah Client Existing.</p>
    <label>Koordinasi dan komunikasi tim (manual)<textarea name="team_coordination" defaultValue={report?.team_coordination??""} maxLength={5000} rows={4} placeholder="Catat koordinasi, komunikasi, dan tindak lanjut tim"/></label>
    <label>Laporan Harian (manual)<textarea name="daily_report" defaultValue={report?.daily_report??""} maxLength={10000} rows={6} placeholder="Tulis ringkasan laporan harian DAE"/></label>
    <div className="form-actions"><a className="button light" href="/admin/kpi/input/dae_individual">Kembali</a><button className="button" disabled={!current}>{report?"Simpan Perubahan":"Simpan Laporan Mingguan"}</button></div>
  </form>;
}
