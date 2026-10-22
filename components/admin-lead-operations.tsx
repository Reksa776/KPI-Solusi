import { updateLeadOperations } from "@/app/admin/lead-operations-actions";
import type { LeadActivity, LeadAssignee } from "@/lib/lead-types";

export default function AdminLeadOperations({ leadId, assignedUserId, followUpValue, internalNotes, assignees, activities, saved, error }: {
  leadId: number; assignedUserId: number | null; followUpValue: string; internalNotes: string | null;
  assignees: LeadAssignee[]; activities: LeadActivity[]; saved?: boolean; error?: string;
}) {
  return <div className="lead-operations">
    <section className="settings-section"><div className="settings-section-heading"><div><span className="eyebrow">Tindak lanjut</span><h2>PIC &amp; follow-up</h2><p>Tentukan siapa yang menangani prospek dan kapan tim perlu menghubungi kembali.</p></div></div>
      {saved ? <div className="admin-success">Informasi follow-up berhasil disimpan.</div> : null}{error ? <div className="admin-error">Informasi follow-up tidak valid atau lead sudah dikonversi.</div> : null}
      <form className="package-edit-form application-settings-form" action={updateLeadOperations}>
        <input type="hidden" name="id" value={leadId}/>
        <div className="settings-form-group"><div className="form-grid">
          <label>Penanggung jawab<select name="assigned_user_id" defaultValue={assignedUserId ?? ""}><option value="">Belum ditentukan</option>{assignees.map((user)=><option key={user.id} value={user.id}>{user.full_name}</option>)}</select></label>
          <label>Jadwal follow-up<input name="follow_up_at" type="datetime-local" defaultValue={followUpValue}/></label>
          <label className="settings-full">Catatan internal baru<textarea name="internal_note" rows={3} maxLength={2000} placeholder="Catat hasil percakapan atau langkah berikutnya…"/><small>Catatan baru ditambahkan ke riwayat dan hanya terlihat oleh tim admin.</small></label>
        </div></div>
        {internalNotes ? <div className="lead-internal-notes"><b>Catatan internal tersimpan</b><pre>{internalNotes}</pre></div> : null}
        <div className="form-actions"><button className="button" type="submit">Simpan tindak lanjut <span aria-hidden="true">↗</span></button></div>
      </form>
    </section>
    <section className="settings-section"><div className="settings-section-heading"><div><span className="eyebrow">Jejak kerja tim</span><h2>Riwayat aktivitas</h2><p>Perubahan status, PIC, jadwal, dan catatan tersimpan untuk audit internal.</p></div></div>
      {activities.length ? <ol className="lead-activity-list">{activities.map((activity)=><li key={activity.id}><i/><div><b>{activity.label}</b><p>{activity.description}</p><small>{activity.actor_name ?? "Sistem"} · {new Date(activity.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })}</small></div></li>)}</ol> : <p className="analytics-empty">Belum ada aktivitas.</p>}
    </section>
  </div>;
}
