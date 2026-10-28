import { importAgencyClients } from "@/app/admin/client/actions";

export default function ClientImportPanel() {
  return <details className="client-import-panel">
    <summary className="button light">⇧ Import Excel</summary>
    <div className="client-import-content">
      <p>Masukkan banyak client sekaligus memakai template Excel. Baris dengan nama yang sudah terdaftar atau berulang di file akan dilewati.</p>
      <a className="client-template-link" href="/api/admin/client/template">↓ Unduh template Excel</a>
      <form action={importAgencyClients}>
        <label>File Excel (.xlsx)<input type="file" name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required /></label>
        <button className="button">Import Client</button>
      </form>
      <small>Kolom wajib: Nama Client dan Jenis Client. Kolom kontak, email, telepon, dan catatan boleh dikosongkan.</small>
    </div>
  </details>;
}
