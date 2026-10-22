import type { Metadata } from "next";
import { ContactButton, Eyebrow, PageHero } from "@/components/ui";
import Reveal from "@/components/reveal";

export const metadata: Metadata = { title: "Layanan Digital Marketing" };

const items = [
  ["01", "Strategi digital campaign", "Susun arah campaign berdasarkan tujuan brand, audiens, pesan, dan kanal digital yang sesuai.", "Pembahasan brief", "Pemetaan audiens", "Rencana distribusi"],
  ["02", "Buzzer & creator marketing", "Perluas jangkauan konten bersama buzzer dan kreator dengan profil serta kanal yang relevan.", "Kurasi partner", "Koordinasi konten", "Rekap publikasi"],
  ["03", "Community marketing", "Bangun keterlibatan brand lewat komunitas yang dekat dengan topik dan minat audiens.", "Pemetaan komunitas", "Rancangan aktivasi", "Rangkuman campaign"],
];

export default function LayananPage() {
  return <>
    <PageHero eyebrow="Digital marketing services" title={<>Bikin brand hadir<br /><em>lebih relevan.</em></>} description="Dari merancang strategi digital sampai menghubungkan konten dengan buzzer, kreator, dan komunitas yang sesuai." visual="services"><ContactButton>Diskusikan campaign</ContactButton></PageHero>
    <section className="content"><div className="wrap"><div className="section-head"><div><Eyebrow>Layanan kami</Eyebrow><h2>Aktivitas digital dengan <em>arah.</em></h2></div><p>Setiap campaign dimulai dengan memahami tujuan brand, audiens, kanal, dan hasil yang ingin dituju.</p></div>
      <div className="service-detail-list">{items.map(([no,title,copy,...features]) => <Reveal key={no} className="service-detail"><div className="service-detail-no">{no}</div><div className="service-detail-main"><h3>{title}</h3><p>{copy}</p><ul>{features.map((feature) => <li key={feature}>{feature}</li>)}</ul></div><span className="detail-arrow">↗</span></Reveal>)}</div>
    </div></section>
    <section className="content soft-section"><div className="wrap narrow-copy"><Eyebrow>Fleksibel sesuai kebutuhan</Eyebrow><h2>Belum yakin mulai dari mana?</h2><p>Ceritakan tujuan campaign dan hal yang sedang kamu cari. Kita bisa mulai dari obrolan ringan, lalu menentukan bentuk kolaborasi yang masuk akal.</p><ContactButton>Mulai obrolan</ContactButton></div></section>
  </>;
}
