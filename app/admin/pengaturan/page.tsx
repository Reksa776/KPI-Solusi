import type { Metadata } from "next";
import { stat } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";
import { verifyOwnerSession } from "@/lib/admin-auth";
import { getApplicationSettings } from "@/lib/application-settings";
import { saveApplicationSettingsAction } from "@/app/admin/actions";
import { retryFailedNotificationsAction } from "@/app/admin/actions";
import { getDb } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const metadata: Metadata = { title: "Pengaturan identitas" };

async function imageVersion(name: string) {
  try {
    const info = await stat(path.join(process.cwd(), "data", "branding", `${name}.png`));
    return `?v=${Math.floor(info.mtimeMs)}`;
  } catch {
    return "";
  }
}

type NoticeRow = RowDataPacket & { id: number; channel: string; status: string; attempts: number; last_error: string | null; created_at: Date };
export default async function AdminBrandSettingsPage({ searchParams }: { searchParams: Promise<{ updated?: string; error?: string; settings_saved?: string; settings_error?: string; queue_retried?: string; queue_error?: string }> }) {
  if (!(await verifyOwnerSession())) redirect("/admin");
  const [params, logoVersion, faviconVersion, settings, notificationJobs] = await Promise.all([searchParams, imageVersion("logo"), imageVersion("favicon"), getApplicationSettings(), getNotificationJobs()]);
  const errorMessage = params.error === "invalid_file"
    ? "File harus berupa PNG yang valid, maksimal 2 MB, dan berukuran sampai 4096 × 4096 px."
    : params.error === "missing_file"
      ? "Pilih minimal satu ikon untuk diunggah."
      : params.error
        ? "Upload belum berhasil. Coba pilih file PNG lagi."
        : null;

  return <div className="admin-page"><AdminNavigation active="settings" /><main className="admin-main admin-section-main">
    <AdminTopbar section="Pengaturan" page="Identitas brand" />
    <div className="admin-shell">
      <section className="admin-heading"><div><span className="eyebrow">Tampilan website</span><h1>Identitas brand</h1><p>Kelola ikon logo dan favicon yang digunakan di seluruh halaman.</p></div></section>
      {params.updated ? <div className="admin-success">Ikon brand berhasil diperbarui.</div> : null}
      {errorMessage ? <div className="admin-error">{errorMessage}</div> : null}
      {params.settings_saved ? <div className="admin-success">Pengaturan website berhasil disimpan dan diterapkan.</div> : null}
      {params.settings_error ? <div className="admin-error">{settingsErrorMessage(params.settings_error)}</div> : null}
      {params.queue_retried ? <div className="admin-success">Notifikasi gagal dikembalikan ke antrean.</div> : null}
      {params.queue_error ? <div className="admin-error">Permintaan antrean tidak valid.</div> : null}
      <section className="settings-section">
        <div className="settings-section-heading"><div><span className="eyebrow">Kontrol website</span><h2>Pengaturan aplikasi</h2><p>Atur informasi yang tampil di website, hasil pencarian, dan jalur kontak calon klien.</p></div><span className="settings-status"><i /> Terhubung ke website</span></div>
        <form className="package-edit-form application-settings-form" action={saveApplicationSettingsAction}>
          <div className="settings-form-group"><h3>Identitas &amp; mesin pencari</h3><p>Nama dan deskripsi ini dipakai di metadata halaman dan hasil pencarian.</p>
            <div className="form-grid">
              <label>Nama website<input name="site_name" defaultValue={settings.site_name} maxLength={100} required /></label>
              <label>Kalimat pendamping<input name="site_tagline" defaultValue={settings.site_tagline} maxLength={180} required /></label>
              <label className="settings-full">Judul SEO<input name="seo_title" defaultValue={settings.seo_title} maxLength={160} required /></label>
              <label className="settings-full">Deskripsi SEO<textarea name="seo_description" defaultValue={settings.seo_description} rows={3} maxLength={320} required /></label>
            </div>
          </div>
          <div className="settings-form-group"><h3>Kontak &amp; tombol utama</h3><p>Kontak yang kosong tidak akan ditampilkan di footer.</p>
            <div className="form-grid">
              <label>URL Instagram<input name="instagram_url" type="url" defaultValue={settings.instagram_url} placeholder="https://instagram.com/akun" /></label>
              <label>Email kontak<input name="contact_email" type="email" defaultValue={settings.contact_email} placeholder="halo@brand.id" /></label>
              <label>Nomor WhatsApp<input name="whatsapp_number" inputMode="numeric" defaultValue={settings.whatsapp_number} placeholder="6281234567890" /><small>Gunakan kode negara, hanya angka. Contoh Indonesia: 62812…</small></label>
              <label>Nama tombol utama<input name="cta_label" defaultValue={settings.cta_label} maxLength={40} required /></label>
              <label className="settings-full">Tujuan tombol utama<input name="cta_url" defaultValue={settings.cta_url} maxLength={300} required /><small>Gunakan path internal seperti /brief atau URL https://…</small></label>
              <label className="settings-full">Catatan footer<input name="footer_note" defaultValue={settings.footer_note} maxLength={255} required /></label>
            </div>
          </div>
          <div className="settings-form-group"><h3>Pengukuran campaign</h3><p>Tracking aktif setelah pengunjung menyetujui analitik melalui banner privasi.</p>
            <div className="form-grid">
              <label>Google Analytics<input name="google_analytics_id" defaultValue={settings.google_analytics_id} placeholder="G-XXXXXXXXXX" maxLength={32} /><small>Measurement ID dari properti Google Analytics 4.</small></label>
              <label>Meta Pixel<input name="meta_pixel_id" inputMode="numeric" defaultValue={settings.meta_pixel_id} placeholder="123456789012345" maxLength={32} /><small>Pixel ID dari Events Manager.</small></label>
            </div>
          </div>
          <div className="form-actions"><button className="button" type="submit">Simpan pengaturan <span aria-hidden="true">↗</span></button></div>
        </form>
      </section>
      <section className="settings-section notification-settings"><div className="settings-section-heading"><div><span className="eyebrow">Operasional lead</span><h2>Antrean notifikasi</h2><p>Notifikasi dikirim worker terjadwal. Atur kredensial provider di environment server, bukan di kolom website.</p></div><form action={retryFailedNotificationsAction}><input type="hidden" name="id" value="0"/><button className="button light" type="submit" disabled={!notificationJobs.failed}>Coba ulang semua gagal</button></form></div>
        <div className="notification-counts"><div><b>{notificationJobs.pending}</b><span>Menunggu</span></div><div><b>{notificationJobs.sent}</b><span>Terkirim</span></div><div><b>{notificationJobs.failed}</b><span>Gagal</span></div></div>
        {notificationJobs.available ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Kanal</th><th>Status</th><th>Percobaan</th><th>Catatan terakhir</th><th>Aksi</th></tr></thead><tbody>{notificationJobs.recent.map((job)=><tr key={job.id}><td>{job.channel === "whatsapp" ? "WhatsApp" : "Email"}</td><td><span className={`status-pill ${job.status === "sent" ? "published" : job.status === "failed" ? "draft" : ""}`}>{job.status}</span></td><td>{job.attempts}/6</td><td>{job.last_error ?? "—"}</td><td>{job.status === "failed" ? <form action={retryFailedNotificationsAction}><input type="hidden" name="id" value={job.id}/><button className="table-action" type="submit">Coba ulang</button></form> : "—"}</td></tr>)}</tbody></table></div> : <p className="admin-footnote">Tabel antrean belum tersedia. Jalankan migration 004.</p>}
      </section>
      <form className="branding-form" action="/api/admin/branding" method="post" encType="multipart/form-data">
        <section className="branding-upload-card">
          <div className="branding-preview">{logoVersion ? <img src={`/api/branding/logo${logoVersion}`} alt="Pratinjau ikon logo" /> : <b>s.</b>}<span>Ikon logo</span></div>
          <div className="branding-upload-copy"><h2>Ikon logo</h2><p>Dipakai di navbar landing page, halaman login, dan sidebar dashboard.</p><label>Unggah logo PNG<input name="logo" type="file" accept="image/png,.png" /></label><small>Gunakan PNG transparan dan bentuk persegi. Maksimal 2 MB.</small></div>
        </section>
        <section className="branding-upload-card">
          <div className="branding-preview favicon-preview">{faviconVersion ? <img src={`/api/branding/favicon${faviconVersion}`} alt="Pratinjau favicon" /> : <b>s.</b>}<span>Favicon</span></div>
          <div className="branding-upload-copy"><h2>Favicon</h2><p>Ikon kecil yang tampil di tab browser dan bookmark website.</p><label>Unggah favicon PNG<input name="favicon" type="file" accept="image/png,.png" /></label><small>Gunakan gambar persegi 512 × 512 px dengan ruang tepi yang cukup. Maksimal 2 MB.</small></div>
        </section>
        <div className="branding-form-actions"><span>Upload salah satu atau keduanya sekaligus.</span><button className="button" type="submit">Simpan ikon <span>↗</span></button></div>
      </form>
    </div>
  </main></div>;
}

async function getNotificationJobs() {
  try {
    const db = getDb();
    const [[counts], [recent]] = await Promise.all([
      db.execute<(RowDataPacket & { status: string; total: number })[]>("SELECT status,COUNT(*) total FROM notification_outbox GROUP BY status"),
      db.execute<NoticeRow[]>("SELECT id,channel,status,attempts,last_error,created_at FROM notification_outbox ORDER BY id DESC LIMIT 8"),
    ]);
    const totals = Object.fromEntries(counts.map((row) => [row.status, Number(row.total)]));
    return { available: true, pending: totals.pending ?? 0, sent: totals.sent ?? 0, failed: totals.failed ?? 0, recent };
  } catch { return { available: false, pending: 0, sent: 0, failed: 0, recent: [] as NoticeRow[] }; }
}

function settingsErrorMessage(error: string) {
  const messages: Record<string, string> = {
    length: "Ada isian yang melebihi batas karakter.",
    required: "Lengkapi semua isian wajib sebelum menyimpan.",
    email: "Format email kontak belum valid.",
    whatsapp: "Nomor WhatsApp harus berisi 8–15 angka dengan kode negara.",
    analytics: "Format ID Google Analytics harus seperti G-XXXXXXXXXX.",
    pixel: "Meta Pixel ID harus berisi 5–20 angka.",
    url: "Instagram dan tujuan tombol harus memakai URL HTTPS atau path internal yang valid.",
    database: "Pengaturan belum tersimpan. Pastikan migration database 003 sudah dijalankan.",
  };
  return messages[error] ?? "Pengaturan belum berhasil disimpan. Periksa kembali isian Anda.";
}
