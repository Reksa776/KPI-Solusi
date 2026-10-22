import Link from "next/link";
import type { PackageItem } from "@/lib/package-data";
import { savePackageAction } from "@/app/admin/actions";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";

export default function AdminPackageForm({ item }: { item?: PackageItem }) {
  return <div className="admin-page"><AdminNavigation active={item ? "packages" : "new"} /><main className="admin-main admin-section-main"><AdminTopbar section="Paket" page={item ? "Ubah paket" : "Tambah paket"} /><div className="admin-shell admin-form-shell">
    <div className="admin-heading"><div><span className="eyebrow">Dashboard admin</span><h1>{item ? "Ubah paket" : "Tambah paket"}</h1><p>Isi informasi yang akan dibaca calon client di halaman paket.</p></div></div>
    <form action={savePackageAction} className="package-edit-form">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <div className="form-grid"><label>Nama paket<input name="name" defaultValue={item?.name} placeholder="Contoh: Buzzer Starter" required /></label><label>Label singkat<input name="tagline" defaultValue={item?.tagline} placeholder="Contoh: Mulai percakapan" required /></label></div>
      <label>Deskripsi<textarea name="description" defaultValue={item?.description} rows={4} required /></label>
      <div className="form-grid"><label>Harga mulai (rupiah)<input name="price" type="number" min="0" step="1000" defaultValue={item?.price} required /></label><label>Urutan tampilan<input name="sort_order" type="number" min="0" defaultValue={item?.sort_order ?? 0} /></label></div>
      <label>Benefit paket <span className="label-hint">Satu benefit per baris</span><textarea name="features" defaultValue={item?.features.join("\n")} rows={5} placeholder={"5 buzzer terkurasi\nKoordinasi jadwal publikasi\nRekap tautan konten"} required /></label>
      <div className="check-options"><label><input type="checkbox" name="is_published" defaultChecked={item?.is_published ?? true} /> Tampilkan di website</label><label><input type="checkbox" name="highlighted" defaultChecked={item?.highlighted ?? false} /> Tandai sebagai paket unggulan</label></div>
      <div className="form-actions"><Link className="button light" href="/admin/paket">Batal</Link><button className="button" type="submit">Simpan paket <span>↗</span></button></div>
    </form>
  </div></main></div>;
}
