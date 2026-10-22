"use client";

import { useState } from "react";
import { agencyClientTypes } from "@/lib/client-types";

type Client = { id: number; client_name: string; client_type: string };

export default function DaeTeamClientFields({ clients, selectedIds = [] }: { clients: Client[]; selectedIds?: number[] }) {
  const [selected, setSelected] = useState<number[]>(selectedIds);
  const [selectionByType, setSelectionByType] = useState<Record<string, string>>({});
  const labels: Record<string,string> = Object.fromEntries(agencyClientTypes);
  const groups = agencyClientTypes.map(([value]) => [value, clients.filter(client => client.client_type === value)] as const);

  function add(id: number) {
    setSelected(current => current.includes(id) ? current : [...current, id]);
  }

  return <fieldset className="dae-client-picker">
    <legend>Client yang dipegang <span>(opsional, pilih beberapa dari tiap jenis)</span></legend>
    {!clients.length&&<p className="dae-client-empty">Belum ada data client. Tambahkan client terlebih dahulu di menu Client.</p>}
    <div className="dae-client-groups">{groups.map(([type, items]) => {
      const picked = items.filter(client => selected.includes(client.id));
      const available = items.filter(client => !selected.includes(client.id));
      return <section key={type}><h3>{labels[type]}</h3><select aria-label={`Pilih ${labels[type]}`} value={selectionByType[type] ?? ""} disabled={!available.length} onChange={event => { const id = Number(event.target.value); if (id) add(id); setSelectionByType(current => ({ ...current, [type]: "" })); }}><option value="">{items.length ? "Pilih nama client..." : "Belum ada data client"}</option>{available.map(client => <option key={client.id} value={client.id}>{client.client_name}</option>)}</select><div className="dae-client-chips">{picked.map(client => <span className="dae-client-chip" key={client.id}>{client.client_name}<button type="button" aria-label={`Hapus ${client.client_name}`} onClick={() => setSelected(current => current.filter(id => id !== client.id))}>×</button><input type="hidden" name="agency_client_ids" value={client.id}/></span>)}</div></section>;
    })}</div>
    <small>{selected.length} client dipilih.</small>
  </fieldset>;
}
