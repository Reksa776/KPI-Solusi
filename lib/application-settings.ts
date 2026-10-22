import type { RowDataPacket } from "mysql2";
import { getDb } from "@/lib/db";

export type ApplicationSettings = {
  site_name: string;
  site_tagline: string;
  seo_title: string;
  seo_description: string;
  footer_note: string;
  instagram_url: string;
  contact_email: string;
  whatsapp_number: string;
  google_analytics_id: string;
  meta_pixel_id: string;
  cta_label: string;
  cta_url: string;
};

export const defaultApplicationSettings: ApplicationSettings = {
  site_name: "Solusi Sejalan",
  site_tagline: "Digital marketing yang sejalan dengan tujuan brand.",
  seo_title: "Solusi Sejalan — Digital Marketing yang Sejalan",
  seo_description: "Solusi Sejalan adalah agency digital marketing yang membantu brand merancang campaign bersama buzzer, kreator, dan komunitas yang relevan.",
  footer_note: "Digital marketing yang sejalan dengan tujuan brand.",
  instagram_url: "https://www.instagram.com/solusisejalanagency/",
  contact_email: "",
  whatsapp_number: "",
  google_analytics_id: "",
  meta_pixel_id: "",
  cta_label: "Kirim brief",
  cta_url: "/brief",
};

type SettingRow = RowDataPacket & { setting_key: keyof ApplicationSettings; setting_value: string };

export async function getApplicationSettings(): Promise<ApplicationSettings> {
  try {
    const [rows] = await getDb().query<SettingRow[]>("SELECT setting_key, setting_value FROM application_settings");
    const settings = { ...defaultApplicationSettings };
    for (const row of rows) {
      if (row.setting_key in settings) settings[row.setting_key] = row.setting_value;
    }
    return settings;
  } catch {
    // Keep the public site available before the settings migration is applied or
    // during a temporary database outage.
    return defaultApplicationSettings;
  }
}
