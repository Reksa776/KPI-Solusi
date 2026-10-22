"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandIcon from "@/components/brand-icon";
import type { ApplicationSettings } from "@/lib/application-settings";

export default function SiteFooter({ settings }: { settings: ApplicationSettings }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-main">
          <Link className="brand" href="/"><BrandIcon /><span>{settings.site_name.toLowerCase()}</span></Link>
          <p className="footer-note">{settings.footer_note}</p>
          <div className="footer-links">
            <Link href="/layanan">Layanan</Link><Link href="/paket">Paket</Link>
            {settings.instagram_url ? <a href={settings.instagram_url} target="_blank" rel="noreferrer">Instagram ↗</a> : null}
            {settings.contact_email ? <a href={`mailto:${settings.contact_email}`}>Email ↗</a> : null}
            {settings.whatsapp_number ? <a href={`https://wa.me/${settings.whatsapp_number}`} target="_blank" rel="noreferrer">WhatsApp ↗</a> : null}
            <Link href="/admin/login">Login admin</Link>
          </div>
        </div>
        <div className="copyright">© {new Date().getFullYear()} {settings.site_name}. Dibuat dengan niat baik.</div>
      </div>
    </footer>
  );
}
