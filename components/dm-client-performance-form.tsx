"use client";

import Link from "next/link";
import { saveDmClientBatch } from "@/app/admin/kpi/actions";
import DmInputPeriod from "@/components/dm-input-period";
import DmClientMetricsFields from "@/components/dm-client-metrics-fields";

type Assignment = { dm_team_member_id:number; agency_client_id:number; dm_name:string; client_name:string; client_type:string };

export default function DmClientPerformanceForm({ assignments, initialWeekStart, initialDate }: { assignments:Assignment[]; initialWeekStart:string; initialDate:string }) {
  return <form action={saveDmClientBatch} className="package-edit-form dm-client-batch-form">
    <section className="dm-client-performance-rows">
      <div className="dae-strategy-section-heading"><div><h2>Input Performa Client</h2><p>Daftar DM dan client terisi otomatis dari Data Tim DM. Pilih periode, lalu masukkan angka performanya.</p></div><span className="dae-period-pill">{assignments.length} pasangan</span></div>
      <DmInputPeriod initialWeekStart={initialWeekStart} initialDate={initialDate}/>
      {assignments.map((assignment,index)=><article className="dm-client-performance-row" key={`${assignment.dm_team_member_id}-${assignment.agency_client_id}`}>
        <input type="hidden" name="agency_client_ids" value={assignment.agency_client_id}/>
        <input type="hidden" name="dm_team_member_ids" value={assignment.dm_team_member_id}/>
        <div className="dm-client-row-heading"><b>{index+1}. {assignment.client_name}</b><span>{assignment.client_type}</span></div>
        <p className="dm-assigned-person">DM: <strong>{assignment.dm_name}</strong></p>
        <DmClientMetricsFields/>
      </article>)}
      {!assignments.length&&<div className="dae-client-empty">Belum ada client yang ditugaskan ke DM. Atur nama DM dan client di <Link href="/admin/kpi/input/dm_team">Data Tim DM</Link> terlebih dahulu.</div>}
    </section>
    <div className="form-actions"><Link className="button light" href="/admin/kpi/input/dm_client">Kembali</Link><button className="button" disabled={!assignments.length}>Simpan Semua Performa <span>↗</span></button></div>
  </form>;
}
