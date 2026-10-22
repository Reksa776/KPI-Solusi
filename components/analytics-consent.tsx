"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Consent = { analytics: boolean; marketing: boolean };
type WindowWithTracking = Window & { gtag?: (...args: unknown[]) => void; fbq?: (...args: unknown[]) => void };

export default function AnalyticsConsent({ analyticsId, pixelId }: { analyticsId: string; pixelId: string }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<Consent | null>(null);
  const [customize, setCustomize] = useState(false);
  const [draft, setDraft] = useState<Consent>({ analytics: false, marketing: false });
  const previousPath = useRef(pathname);
  const publicPage = !pathname.startsWith("/admin") && !pathname.startsWith("/portal");
  const validAnalyticsId = /^G-[A-Z0-9]{5,20}$/.test(analyticsId) ? analyticsId : "";
  const validPixelId = /^\d{5,20}$/.test(pixelId) ? pixelId : "";

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ss-privacy-consent");
      if (saved) {
        const value = JSON.parse(saved) as Consent;
        const next = { analytics: Boolean(value.analytics), marketing: Boolean(value.marketing) };
        setConsent(next);
        setDraft(next);
      }
    } catch {
      localStorage.removeItem("ss-privacy-consent");
    }
  }, []);

  useEffect(() => {
    if (!publicPage || !consent) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a.button, button.button, [data-track-cta]") : null;
      if (!target) return;
      const label = (target.textContent ?? "Tombol").replace(/\s+/g, " ").trim().slice(0, 80);
      const tracking = window as WindowWithTracking;
      if (consent.analytics && validAnalyticsId && tracking.gtag) tracking.gtag("event", "cta_click", { button_label: label, page_path: pathname });
      if (consent.marketing && validPixelId && tracking.fbq) tracking.fbq("trackCustom", "LeadCTA", { button_label: label, page_path: pathname });
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [consent, pathname, publicPage, validAnalyticsId, validPixelId]);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (!publicPage || !consent) return;
    const tracking = window as WindowWithTracking;
    if (consent.analytics && validAnalyticsId) tracking.gtag?.("event", "page_view", { page_path: pathname });
    if (consent.marketing && validPixelId) tracking.fbq?.("track", "PageView");
  }, [consent, pathname, publicPage, validAnalyticsId, validPixelId]);

  if (!publicPage) return null;
  const saveConsent = (next: Consent) => {
    setConsent(next);
    setDraft(next);
    setCustomize(false);
    localStorage.setItem("ss-privacy-consent", JSON.stringify(next));
  };

  return <>
    {consent?.analytics && validAnalyticsId ? <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${validAnalyticsId}`} strategy="afterInteractive" />
      <Script id="ss-google-analytics" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${validAnalyticsId}',{anonymize_ip:true});` }} />
    </> : null}
    {consent?.marketing && validPixelId ? <Script id="ss-meta-pixel" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${validPixelId}');fbq('track','PageView');` }} /> : null}
    {consent === null ? <aside className="privacy-banner" aria-label="Pilihan privasi">
      {customize ? <div className="privacy-preferences"><div><b>Atur preferensi</b><p>Pilih kategori pengukuran yang boleh berjalan di perangkat ini.</p></div><label><input type="checkbox" checked={draft.analytics} onChange={(event) => setDraft({ ...draft, analytics: event.target.checked })}/> Analitik website</label><label><input type="checkbox" checked={draft.marketing} onChange={(event) => setDraft({ ...draft, marketing: event.target.checked })}/> Pengukuran campaign</label><button type="button" className="button" onClick={() => saveConsent(draft)}>Simpan pilihan</button></div> : <><div><b>Privasi pilihanmu</b><p>Kami memakai analitik untuk memahami penggunaan website. Pengukuran hanya aktif setelah kamu menyetujuinya.</p></div><div className="privacy-actions"><button type="button" className="privacy-text-button" onClick={() => setCustomize(true)}>Atur pilihan</button><button type="button" className="button light" onClick={() => saveConsent({ analytics: false, marketing: false })}>Esensial saja</button><button type="button" className="button" onClick={() => saveConsent({ analytics: true, marketing: true })}>Terima semua</button></div></>}
    </aside> : <button type="button" className="privacy-manage" onClick={() => { setDraft(consent); setConsent(null); setCustomize(true); }}>Privasi</button>}
  </>;
}
