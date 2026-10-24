"use client";

import { useState } from "react";
import { saveAgencyClient } from "@/app/admin/client/actions";
import { agencyClientTypes } from "@/lib/client-types";

export default function ClientAddPanel(){
  const [open,setOpen]=useState(false);
  return <details className="client-add-panel" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary className="button">＋ Tambah Client</summary>
    <form action={saveAgencyClient} className="client-add-form">
      <label>Nama Client<input name="client_name" required maxLength={180} placeholder="Masukkan nama client"/></label>
      <label>Jenis Client<select name="client_type" defaultValue="prospect" required>{agencyClientTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <button className="button">Simpan Client</button>
    </form>
  </details>;
}
