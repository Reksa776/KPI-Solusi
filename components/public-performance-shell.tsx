import Link from "next/link";
import type { ReactNode } from "react";
import BrandIcon from "@/components/brand-icon";

const items = [
  { id: "general", label: "Overview umum", href: "/performa", icon: "◫" },
  { id: "dm", label: "Overview DM", href: "/performa/dm", icon: "↗" },
  { id: "dae", label: "Overview DAE", href: "/performa/dae", icon: "⌁" },
  { id: "client", label: "Overview Client", href: "/performa/client", icon: "▤" },
] as const;

export default function PublicPerformanceShell({ active, eyebrow, title, description, children }: { active: "general" | "dm" | "dae" | "client"; eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <div className={`public-performance${active === "client" ? " client-performance" : ""}`}>
    <aside className="public-performance-sidebar">
      <Link className="public-performance-brand" href="/" aria-label="Solusi Sejalan">
        <BrandIcon /><span>solusi sejalan<small>PERFORMANCE</small></span>
      </Link>
      <div className="public-performance-nav-label">DASHBOARD</div>
      <nav className="public-performance-tabs" aria-label="Navigasi overview performa">
        {items.map((item) => <Link key={item.id} className={active === item.id ? "active" : ""} href={item.href}><i aria-hidden="true">{item.icon}</i><span>{item.label}</span>{active === item.id && <b aria-hidden="true">›</b>}</Link>)}
      </nav>
      <div className="public-performance-sidebar-bottom"><div className="public-performance-sidebar-note"><span>DATA TERBUKA</span><p>Ringkasan performa tim yang tercatat di Solusi Sejalan.</p></div><Link className="public-performance-login" href="/admin/login">Login</Link></div>
    </aside>
    <div className="public-performance-main">
      <header className="public-performance-topbar"><div><span>WORKSPACE</span><b>Overview publik</b></div><Link href="/">Kunjungi website <span aria-hidden="true">↗</span></Link></header>
      <div className="public-performance-content">
        <header className="public-performance-heading"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></header>
        {children}
        <footer className="public-performance-footnote">Overview performa Solusi Sejalan <span>·</span> Data diperbarui dari laporan yang tercatat.</footer>
      </div>
    </div>
  </div>;
}
