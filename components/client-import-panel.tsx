"use client";

import { useState } from "react";
import { importAgencyClients } from "@/app/admin/client/actions";
import { agencyClientTypes } from "@/lib/client-types";

export default function ClientImportPanel() {
  const [copied,setCopied]=useState(false);
  const labels=agencyClientTypes.map(([,label])=>label);
  async function copyTypes(){
    try{await navigator.clipboard.writeText(labels.join("\n"));setCopied(true);window.setTimeout(()=>setCopied(false),1800)}catch{setCopied(false)}
  }
  return <details className="client-import-panel">
    <summary className="button light">⇧ Import Excel</summary>
    <div className="client-import-content">
      <p>Masukkan banyak client sekaligus memakai template Excel. Baris dengan nama yang sudah terdaftar atau berulang di file akan dilewati.</p>
      <a className="client-template-link" href="/api/admin/client/template">↓ Unduh template Excel</a>
      <div className="client-import-types"><div><b>Jenis client yang tersedia</b><button type="button" onClick={()=>void copyTypes()}>{copied?"Tersalin":"Salin jenis"}</button></div><textarea aria-label="Daftar jenis client yang tersedia" readOnly value={labels.join("\n")} onFocus={event=>event.currentTarget.select()}/></div>
      <form action={importAgencyClients}>
        <label>File Excel (.xlsx)<input type="file" name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required /></label>
        <button className="button">Import Client</button>
      </form>
      <small>Isi Nama Client, lalu pilih Jenis Client dari dropdown Excel. Hanya dua kolom tersebut yang diperlukan.</small>
    </div>
  </details>;
}
