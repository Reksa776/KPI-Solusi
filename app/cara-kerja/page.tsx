import type { Metadata } from "next";
import { ContactButton, Eyebrow, PageHero } from "@/components/ui";
import Reveal from "@/components/reveal";

export const metadata: Metadata = { title: "Cara Kerja Digital Campaign" };

const steps = [
  ["01", "Tentukan tujuan", "Bagikan target brand, audiens, kanal, jadwal, dan hal yang ingin dicapai."],
  ["02", "Susun strategi", "Kami rancang pendekatan digital dan rekomendasi partner yang sesuai brief."],
  ["03", "Aktifkan campaign", "Konten didistribusikan melalui kanal dan partner yang telah disepakati."],
  ["04", "Tinjau hasil", "Publikasi dan rangkuman campaign dibahas untuk melihat langkah berikutnya."],
];

export default function CaraKerjaPage() {
  return <>
    <PageHero eyebrow="Cara kerja campaign" title={<>Strategi jelas,<br /><em>eksekusi sejalan.</em></>} description="Proses digital marketing yang dimulai dari tujuan, dirancang bersama, lalu dijalankan dengan komunikasi terbuka." visual="process"><ContactButton>Mulai konsultasi</ContactButton></PageHero>
    <section className="content"><div className="wrap"><div className="section-head"><div><Eyebrow>Empat tahap digital campaign</Eyebrow><h2>Dari strategi sampai <em>aktivasi.</em></h2></div><p>Kamu selalu tahu kanal, partner, dan tahapan campaign yang sedang berjalan.</p></div>
      <div className="process-list">{steps.map(([no,title,text],index) => <Reveal className="process-step" key={no}><span className="process-no">{no}</span><div><h3>{title}</h3><p>{text}</p></div><span className="process-icon">{["✳","↗","◌","✓"][index]}</span></Reveal>)}</div>
    </div></section>
    <section className="content soft-section"><div className="wrap split-callout"><div><Eyebrow>Siap ngobrol?</Eyebrow><h2>Kita mulai dari ceritamu.</h2></div><div><p>Belum punya brief lengkap juga tidak apa-apa. Bawa ide awalnya, kami bantu rapikan bersama.</p><ContactButton>Ceritakan kebutuhanmu</ContactButton></div></div></section>
  </>;
}
