import type { Metadata } from "next";
import { ContactButton, Eyebrow, PageHero } from "@/components/ui";
import Reveal from "@/components/reveal";
import { getApplicationSettings } from "@/lib/application-settings";

export const metadata: Metadata = { title: "Partner Digital Marketing" };

export default async function PartnerPage() {
  const settings = await getApplicationSettings();
  return <>
    <PageHero eyebrow="Jaringan digital partner" title={<>Punya kanal.<br /><em>Punya komunitas.</em> Yuk, terhubung.</>} description="Kami membuka kolaborasi untuk buzzer, kreator, dan komunitas yang ingin terlibat dalam campaign digital yang relevan." visual="partners"><ContactButton href={settings.instagram_url}>Tanyakan kolaborasi</ContactButton></PageHero>
    <section className="content"><div className="wrap partner-grid">
      <div><Eyebrow>Terbuka untuk partner</Eyebrow><h2>Ekosistem digital yang kuat tumbuh lewat <em>kolaborasi.</em></h2><p className="body-copy">Ceritakan kanal, profil audiens, dan topik yang paling dekat denganmu. Tim kami akan mencocokkan profil partner dengan kebutuhan campaign brand.</p><ContactButton href={settings.instagram_url}>Kenalan dengan tim</ContactButton></div>
      <Reveal className="partner-info-card"><span className="service-num">✳</span><h3>Yang bisa kamu siapkan</h3><ul><li>Nama dan kontak aktif</li><li>Tautan kanal atau profil komunitas</li><li>Gambaran audiens dan topik</li><li>Area atau kapasitas komunitas</li></ul><small>Pendaftaran akan ditinjau terlebih dahulu. Peluang campaign bergantung pada kecocokan kebutuhan brand.</small></Reveal>
    </div></section>
    <section className="content soft-section"><div className="wrap narrow-copy"><Eyebrow>Ruang bertumbuh bersama</Eyebrow><h2>Partner yang tepat bikin campaign lebih kuat.</h2><p>Kolaborasi digital yang baik berangkat dari kecocokan audiens, komunikasi yang jelas, dan ekspektasi yang terbuka.</p><ContactButton href={settings.instagram_url}>Hubungi Solusi Sejalan</ContactButton></div></section>
  </>;
}
