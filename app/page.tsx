import Link from "next/link";
import { ContactButton, Eyebrow } from "@/components/ui";
import Reveal from "@/components/reveal";
import { getPublicPackages } from "@/lib/packages";
import { getApplicationSettings } from "@/lib/application-settings";

const services = [
  { no: "01", title: "Strategi campaign digital", text: "Tentukan tujuan, audiens, dan kanal agar setiap aktivitas digital punya arah yang jelas." },
  { no: "02", title: "Buzzer & kreator", text: "Perluas distribusi cerita brand lewat suara digital yang selaras dengan campaign-mu." },
  { no: "03", title: "Community marketing", text: "Bangun kedekatan dengan komunitas yang punya minat dan percakapan relevan." },
];

export default async function HomePage() {
  const [packages, settings] = await Promise.all([getPublicPackages(), getApplicationSettings()]);
  return (
    <>
      <section className="hero" id="home">
        <div className="hero-grid wrap">
          <div className="hero-copy-block">
            <Eyebrow>Agency digital marketing</Eyebrow>
            <h1>Bawa brand lebih dekat ke audiens yang <em>tepat.</em></h1>
            <p className="hero-copy">{settings.site_tagline}</p>
            <div className="hero-actions"><Link className="button" href="/paket">Lihat paket <span>↓</span></Link><ContactButton /></div>
            <div className="micro-note"><span>✳</span> Dari strategi sampai campaign berjalan, satu tim yang sejalan.</div>
          </div>
          <div className="hero-art" aria-label="Ilustrasi hubungan brand, kreator, dan komunitas">
            <div className="orbit" /><div className="art-blob" />
            <div className="float-note one"><span>↗</span> strategi punya arah</div>
            <div className="float-note two"><span>✳</span> audiens ikut terhubung</div>
            <article className="art-card"><div className="card-top"><span>Digital campaign, satu arah</span><b>s.</b></div><h2>Temukan<br /><em>cara</em> brand-mu<br />terhubung.</h2><div className="scribble" /><div className="people"><span className="person">S</span><span className="person">A</span><span className="person">R</span><small>strategi · distribusi · komunitas</small></div></article>
            <span className="scribble-star">✳</span>
          </div>
        </div>
      </section>
      <div className="strip"><div className="strip-inner wrap"><span className="strip-label">Satu strategi, banyak titik temu</span><div className="strip-items"><span>Strategi</span><i>✳</i><span>Konten</span><i>✳</i><span>Kreator</span><i>✳</i><span>Komunitas</span></div></div></div>
      <section className="content"><div className="wrap">
        <div className="section-head"><div><Eyebrow>Layanan digital marketing</Eyebrow><h2>Lebih dari sekadar <em>tayang.</em></h2></div><p>Kami menyatukan strategi, distribusi konten, kreator, dan komunitas agar brand hadir relevan di ruang digital.</p></div>
        <div className="service-grid">{services.map((service) => <Reveal key={service.no} className="service-card"><span className="service-num">{service.no}</span><span className="corner">↗</span><h3>{service.title}</h3><p>{service.text}</p></Reveal>)}</div>
        <div className="center-link"><Link className="text-link" href="/layanan">Kenali layanan kami <span>↗</span></Link></div>
      </div></section>
      <section className="content packages-preview"><div className="wrap">
        <div className="section-head"><div><Eyebrow>Paket digital campaign</Eyebrow><h2>Pilih dukungan yang<br /><em>kamu butuhkan.</em></h2></div><p>Temukan paket awal untuk campaign-mu. Strategi dan cakupan bisa disesuaikan dengan kebutuhan brand.</p></div>
        <div className="home-package-grid">{packages.map((item) => <article className={`home-package-card${item.highlighted ? " featured" : ""}`} key={item.id}>
          <div className="home-package-top"><span>{String(item.sort_order).padStart(2, "0")}</span><small>{item.tagline}</small></div>
          <h3>{item.name}</h3><p className="home-package-description">{item.description}</p>
          <div className="home-package-price"><small>Mulai dari</small><b>Rp {item.price.toLocaleString("id-ID")}</b></div>
          <div className="home-package-benefits"><span>Yang termasuk</span><ul>{item.features.map((benefit) => <li key={benefit}><i>✓</i>{benefit}</li>)}</ul></div>
          <Link href="/paket" className="home-package-link">Lihat detail paket <span>↗</span></Link>
        </article>)}</div>
        <div className="home-package-more"><Link className="text-link" href="/paket">Lihat semua paket <span>↗</span></Link></div>
      </div></section>
      <section className="home-cta"><div className="wrap partner-panel"><div><Eyebrow>Punya kanal digital atau komunitas?</Eyebrow><h2>Jadi bagian dari campaign <em>berikutnya.</em></h2></div><Link className="button" href="/partner">Kenalan sebagai partner <span>↗</span></Link></div></section>
    </>
  );
}
