import type { Metadata } from "next";
import type { ReactNode } from "react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import PageEntrance from "@/components/page-entrance";
import { getApplicationSettings } from "@/lib/application-settings";
import AnalyticsConsent from "@/components/analytics-consent";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getApplicationSettings();
  return {
    metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
    title: { default: settings.seo_title, template: `%s — ${settings.site_name}` },
    description: settings.seo_description,
    icons: { icon: "/api/branding/favicon" },
    openGraph: { title: settings.seo_title, description: settings.seo_description, siteName: settings.site_name, type: "website", url: "/", images: [{ url: "/opengraph-image" }] },
    twitter: { card: "summary_large_image", title: settings.seo_title, description: settings.seo_description, images: ["/opengraph-image"] },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const settings = await getApplicationSettings();
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <PageEntrance>
          <SiteHeader settings={settings} />
          <main>{children}</main>
          <SiteFooter settings={settings} />
        </PageEntrance>
        <AnalyticsConsent analyticsId={settings.google_analytics_id} pixelId={settings.meta_pixel_id} />
      </body>
    </html>
  );
}
