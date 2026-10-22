export default function ClippingCampaignFields({ values }: { values?: { campaign_type?: string; clipping_source_url?: string | null; clipping_rules?: string | null; clipping_rights_confirmed?: number | boolean; clipping_rate_per_1000?: number | null; clipping_budget_cap?: number | null; clipping_min_views?: number | null } }) {
  return <section className="settings-form-group clip-campaign-fields">
    <h3>Mode aktivasi</h3>
    <p>Campaign standar berjalan seperti biasa. Pilih KOL Clipping untuk membuka tugas potong dan distribusi video pendek kepada talent.</p>
    <div className="form-grid">
      <label>Jenis campaign<select name="campaign_type" defaultValue={values?.campaign_type ?? "standard"}><option value="standard">Campaign standar</option><option value="kol_clipping">KOL Clipping</option></select></label>
      <label>URL video sumber<input name="clipping_source_url" type="url" defaultValue={values?.clipping_source_url ?? ""} placeholder="https://…" /></label>
      <label className="settings-full">Brief dan aturan klip<textarea name="clipping_rules" defaultValue={values?.clipping_rules ?? ""} maxLength={4000} rows={3} placeholder="Tujuan, angle, CTA, disclosure, durasi, dan aturan penggunaan materi…" /></label>
      <label className="settings-full clip-rights-consent"><input type="checkbox" name="clipping_rights_confirmed" defaultChecked={Boolean(values?.clipping_rights_confirmed)} /> Saya memastikan Solusi Sejalan/klien memiliki izin untuk mengolah dan mendistribusikan video sumber ini.</label>
      <label>Rate per 1.000 views (Rp)<input name="clipping_rate_per_1000" type="number" min="1" step="100" defaultValue={values?.clipping_rate_per_1000 ?? ""} /></label>
      <label>Batas budget clipping (Rp)<input name="clipping_budget_cap" type="number" min="1" step="1000" defaultValue={values?.clipping_budget_cap ?? ""} /></label>
      <label>Minimum views per klip<input name="clipping_min_views" type="number" min="0" step="100" defaultValue={values?.clipping_min_views ?? 0} /></label>
    </div>
    <small>Rate dan views dicatat manual. Reward adalah estimasi berdasarkan klip yang disetujui dan tidak melebihi batas budget.</small>
  </section>;
}
