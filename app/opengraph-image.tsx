import { ImageResponse } from "next/og";
import { getApplicationSettings } from "@/lib/application-settings";

export const alt = "Solusi Sejalan — Digital Marketing yang Sejalan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const settings = await getApplicationSettings();
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#f8f7f1", color: "#243b32", fontFamily: "Arial, sans-serif" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}><div style={{ width: 54, height: 54, borderRadius: 18, background: "#d2fb07", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800 }}>↗</div><div style={{ fontSize: 24, fontWeight: 700 }}>{settings.site_name}</div></div>
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 980 }}><div style={{ fontSize: 68, lineHeight: 1.08, fontWeight: 700, letterSpacing: -3 }}>{settings.seo_title}</div><div style={{ fontSize: 28, lineHeight: 1.35, color: "#647260" }}>{settings.seo_description.slice(0, 130)}</div></div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 18, color: "#66745d" }}><span>Digital marketing · Kreator · Komunitas</span><span style={{ width: 100, height: 8, borderRadius: 9, background: "#d2fb07" }} /></div>
  </div>, size);
}
