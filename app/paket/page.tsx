import type { Metadata } from "next";
import Link from "next/link";
import { ContactButton, Eyebrow, PageHero } from "@/components/ui";
import Reveal from "@/components/reveal";
import { getPublicPackages } from "@/lib/packages";

export const metadata: Metadata = { title: "Paket Digital Marketing" };

export default async function PaketPage() {
  const packages = await getPublicPackages();
  return <>
    <PageHero eyebrow="Paket digital campaign" title={<>Pilih dukungan,<br /><em>kembangkan brand.</em></>} description="Paket awal untuk membantu campaign digital bergerak. Cakupan akhir disesuaikan dengan tujuan dan audiens brand-mu." visual="packages"><ContactButton>Tanya paket yang cocok</ContactButton></PageHero>
    <section className="content"><div className="wrap">
      {packages.length ? <div className="package-cards">{packages.map((item) => <Reveal key={item.id} className={`package-card${item.highlighted ? " package-featured" : ""}`}>
        <div className="package-card-top"><span>{String(item.sort_order).padStart(2, "0")}</span><small>{item.tagline}</small></div>
        <h2>{item.name}</h2><p>{item.description}</p>
        <div className="package-price"><small>Mulai dari</small><b>Rp {item.price.toLocaleString("id-ID")}</b></div>
        <ul>{item.features.map((point) => <li key={point}><span>✓</span>{point}</li>)}</ul>
        <Link className="text-link" href="/brief">Tanyakan detail <span>↗</span></Link>
      </Reveal>)}</div> : <div className="admin-success">Paket baru sedang disiapkan. Hubungi kami untuk konsultasi campaign.</div>}
      <div className="package-note"><span>✳</span><p>Harga merupakan harga awal. Cakupan final mengikuti kebutuhan, jumlah partner, kanal, dan durasi campaign.</p></div>
    </div></section>
    <section className="content soft-section"><div className="wrap faq-layout"><div><Eyebrow>Perencanaan campaign</Eyebrow><h2>Yang sering ditanyakan.</h2></div><div className="faq-list"><details><summary>Apakah paket bisa disesuaikan dengan strategi digital kami?</summary><p>Bisa. Kami bahas tujuan, audiens, kanal, dan kebutuhan campaign untuk menentukan cakupan yang sesuai.</p></details><details><summary>Bagaimana cara memulai campaign?</summary><p>Kirimkan brief atau ceritakan target digital brand-mu melalui Instagram. Tim Solusi Sejalan akan membantu membahas strategi dan langkah berikutnya.</p></details><details><summary>Apakah harga sudah mencakup semua aktivitas digital?</summary><p>Harga yang tertera adalah harga awal untuk cakupan paket tersebut. Rencana akhir menyesuaikan kebutuhan campaign dan partner yang dilibatkan.</p></details></div></div></section>
  </>;
}
