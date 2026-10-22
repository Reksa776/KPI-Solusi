import Link from "next/link";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";
import { saveAgencyClient } from "@/app/admin/client/actions";
import { agencyClientTypes } from "@/lib/client-types";

export type AgencyClient = { id:number;client_name:string;client_type:string };
export const clientTypes = agencyClientTypes;

export default function AdminClientForm({ client }: { client?: AgencyClient }) {
  return <div className="admin-page"><AdminNavigation active="client"/><main className="admin-main admin-section-main"><AdminTopbar section="Client" page="Edit client"/><div className="admin-shell admin-form-shell"><section className="admin-heading"><div><span className="eyebrow">DATA DM &amp; DAE</span><h1>Edit Client</h1><p>Perbarui nama dan jenis client.</p></div></section><form action={saveAgencyClient} className="package-edit-form">{client&&<input type="hidden" name="id" value={client.id}/>}<div className="form-grid"><label>Nama Client<input name="client_name" defaultValue={client?.client_name} required maxLength={180} placeholder="Masukkan nama client"/></label><label>Jenis Client<select name="client_type" defaultValue={client?.client_type??"prospect"} required>{clientTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div><div className="form-actions"><Link className="button light" href="/admin/client">Kembali</Link><button className="button">Simpan Perubahan</button></div></form></div></main></div>;
}
