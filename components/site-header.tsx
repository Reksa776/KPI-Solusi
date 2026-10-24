"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import BrandIcon from "@/components/brand-icon";
import type { ApplicationSettings } from "@/lib/application-settings";

const navItems = [
  ["Layanan", "/layanan"],
  ["Paket", "/paket"],
  ["Cara kerja", "/cara-kerja"],
  ["Jadi partner", "/partner"],
  ["Studi kasus", "/studi-kasus"],
  ["Performa", "/performa"],
] as const;

export default function SiteHeader({ settings }: { settings: ApplicationSettings }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  const closeMobileMenu = (event: MouseEvent<HTMLAnchorElement>) => {
    event.currentTarget.closest("details")?.removeAttribute("open");
  };

  return (
    <header className="topbar">
      <nav className="nav wrap" aria-label="Navigasi utama">
        <Link className="brand" href="/" aria-label="Solusi Sejalan, beranda">
          <BrandIcon /><span>solusi sejalan</span>
        </Link>
        <div className="navlinks navlinks-desktop">
          {navItems.map(([label, href]) => (
            <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>
          ))}
        </div>
        <Link className="nav-login nav-login-desktop" href="/admin/login">Masuk</Link>
        <a className="button nav-cta" href={settings.cta_url} target={isExternal(settings.cta_url) ? "_blank" : undefined} rel={isExternal(settings.cta_url) ? "noreferrer" : undefined}>{settings.cta_label} <span aria-hidden="true">↗</span></a>
        <Link className="nav-login nav-login-mobile" href="/admin/login">Masuk</Link>
        <details className="mobile-navigation">
          <summary aria-label="Buka atau tutup navigasi"><span aria-hidden="true" /></summary>
          <div className="mobile-nav-panel">
            {navItems.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={closeMobileMenu}>{label}</Link>)}
            <a className="button" href={settings.cta_url} target={isExternal(settings.cta_url) ? "_blank" : undefined} rel={isExternal(settings.cta_url) ? "noreferrer" : undefined} onClick={closeMobileMenu}>{settings.cta_label} <span aria-hidden="true">↗</span></a>
            <Link href="/admin/login" onClick={closeMobileMenu}>Masuk ke akun</Link>
          </div>
        </details>
      </nav>
    </header>
  );
}

function isExternal(href: string) {
  return href.startsWith("https://");
}
