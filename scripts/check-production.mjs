import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
const errors = [];
const warnings = [];
const strict = process.argv.includes("--strict");
const ok = (message) => console.log(`✓ ${message}`);
const fail = (message) => { errors.push(message); console.error(`✗ ${message}`); };
const warn = (message) => { warnings.push(message); console.warn(`! ${message}`); };

if (!process.env.DATABASE_URL) fail("DATABASE_URL belum diatur.");
else {
  try { const url = new URL(process.env.DATABASE_URL); if (!url.hostname || !url.username || !url.pathname.slice(1)) fail("DATABASE_URL tidak lengkap."); else ok("DATABASE_URL memiliki format yang benar."); }
  catch { fail("DATABASE_URL bukan URL MySQL yang valid."); }
}
if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32 || /ganti|change-me|secret/i.test(process.env.ADMIN_SESSION_SECRET)) fail("ADMIN_SESSION_SECRET harus berupa secret acak minimal 32 karakter."); else ok("ADMIN_SESSION_SECRET tersedia.");
if (!process.env.APP_URL || !/^https:\/\//i.test(process.env.APP_URL) || /domain-website-anda/i.test(process.env.APP_URL)) fail("APP_URL production harus berisi alamat HTTPS publik yang sebenarnya."); else ok("APP_URL HTTPS tersedia.");
if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32 || /ganti|change-me/i.test(process.env.CRON_SECRET)) fail("CRON_SECRET minimal 32 karakter dan harus diganti dari nilai contoh."); else ok("CRON_SECRET tersedia.");

const emailReady = Boolean(process.env.LEAD_NOTIFY_EMAIL && process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
const whatsappReady = Boolean(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_RECIPIENT_NUMBER && process.env.WHATSAPP_TEMPLATE_NAME);
if (emailReady) ok("Notifikasi email Resend sudah dikonfigurasi."); else warn("Notifikasi email belum lengkap (LEAD_NOTIFY_EMAIL, RESEND_API_KEY, RESEND_FROM_EMAIL).");
if (whatsappReady) ok("Notifikasi WhatsApp Cloud API sudah dikonfigurasi."); else warn("Notifikasi WhatsApp belum lengkap (token, phone number ID, recipient, template yang disetujui).");
if (!emailReady && !whatsappReady) fail("Konfigurasikan minimal satu kanal notifikasi lead sebelum production.");
if (process.env.GOOGLE_ANALYTICS_ID && !/^G-[A-Z0-9]{5,20}$/.test(process.env.GOOGLE_ANALYTICS_ID)) warn("GOOGLE_ANALYTICS_ID formatnya tidak sesuai GA4.");
if (process.env.META_PIXEL_ID && !/^\d{5,20}$/.test(process.env.META_PIXEL_ID)) warn("META_PIXEL_ID harus berupa 5–20 angka.");

if (process.env.DATABASE_URL) {
  let db;
  try {
    const url = new URL(process.env.DATABASE_URL);
    db = new PrismaClient();
    await Promise.race([db.$connect(), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout koneksi")), 7000))]);
    const tables = await db.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE()");
    const tableNames = new Set(tables.map((row) => row.TABLE_NAME ?? row.table_name));
    const required = ["users", "packages", "leads", "campaigns", "partners", "campaign_deliverables", "campaign_clips", "case_studies", "application_settings", "lead_activities", "login_attempt_buckets", "notification_outbox", "team_activity_entries", "agency_clients", "dm_team_members", "dae_strategy_details", "dae_visit_details", "dae_weekly_reports"];
    const missing = required.filter((table) => !tableNames.has(table));
    if (missing.length) fail(`Tabel database belum lengkap: ${missing.join(", ")}. Jalankan migration yang tercantum pada README.`); else ok("Koneksi Prisma dan seluruh tabel aplikasi tersedia.");
    if (tableNames.has("application_settings")) {
      const settings = await db.$queryRawUnsafe("SELECT setting_key,setting_value FROM application_settings WHERE setting_key IN ('google_analytics_id','meta_pixel_id')");
      for (const setting of settings) {
        const valid = setting.setting_key === "google_analytics_id" ? !setting.setting_value || /^G-[A-Z0-9]{5,20}$/.test(setting.setting_value) : !setting.setting_value || /^\d{5,20}$/.test(setting.setting_value);
        if (!valid) warn(`Format ${setting.setting_key} di pengaturan aplikasi tidak sesuai.`);
      }
    }
    const columns = await db.$queryRawUnsafe("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND ((table_name='users' AND column_name IN ('session_version','admin_scope')) OR (table_name='leads' AND column_name IN ('assigned_user_id','follow_up_at','internal_notes','converted_at')) OR (table_name='campaigns' AND column_name='assigned_dm_user_id') OR (table_name='campaign_deliverables' AND column_name IN ('video_views','tiktok_sales','shopee_sales')) OR (table_name='team_activity_entries' AND column_name IN ('dae_person','agency_client_ids','week_start','dm_team_member_id','dm_person')) OR (table_name='dae_strategy_details' AND column_name='week_start') OR (table_name='dae_visit_details' AND column_name IN ('week_start','visit_count')) OR (table_name='dae_weekly_reports' AND column_name IN ('week_start','client_retention_count','strategy_idea_count','visit_count','achievement_client_count','achievement_rank','team_coordination','daily_report')))");
    const columnNames = new Set(columns.map((row) => `${row.TABLE_NAME ?? row.table_name}.${row.COLUMN_NAME ?? row.column_name}`));
    const requiredColumns = ["users.session_version", "users.admin_scope", "leads.converted_at", "campaigns.assigned_dm_user_id", "campaign_deliverables.video_views", "campaign_deliverables.tiktok_sales", "campaign_deliverables.shopee_sales", "leads.assigned_user_id", "leads.follow_up_at", "leads.internal_notes", "team_activity_entries.dae_person", "team_activity_entries.agency_client_ids", "team_activity_entries.week_start", "team_activity_entries.dm_team_member_id", "team_activity_entries.dm_person", "dae_strategy_details.week_start", "dae_visit_details.week_start", "dae_visit_details.visit_count", "dae_weekly_reports.week_start", "dae_weekly_reports.client_retention_count", "dae_weekly_reports.strategy_idea_count", "dae_weekly_reports.visit_count", "dae_weekly_reports.achievement_client_count", "dae_weekly_reports.achievement_rank", "dae_weekly_reports.team_coordination", "dae_weekly_reports.daily_report"];
    const missingColumns = requiredColumns.filter((column) => !columnNames.has(column));
    if (missingColumns.length) fail(`Kolom database belum lengkap: ${missingColumns.join(", ")}. Periksa migration yang tercantum pada README.`);
    const clipColumns = await db.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='campaigns' AND column_name IN ('campaign_type','clipping_source_url','clipping_rules','clipping_rights_confirmed','clipping_rate_per_1000','clipping_budget_cap','clipping_min_views')");
    const clipNames = new Set(clipColumns.map((row) => row.COLUMN_NAME ?? row.column_name));
    const requiredClipColumns = ["campaign_type", "clipping_source_url", "clipping_rules", "clipping_rights_confirmed", "clipping_rate_per_1000", "clipping_budget_cap", "clipping_min_views"];
    const missingClipColumns = requiredClipColumns.filter((column) => !clipNames.has(column));
    if (missingClipColumns.length) fail(`Migration 005 KOL Clipping belum lengkap: ${missingClipColumns.join(", ")}.`);
  } catch (error) { fail(`Pemeriksaan koneksi/schema MySQL gagal: ${error.code ?? error.message ?? "kesalahan koneksi"}.`); }
  finally { await db?.$disconnect(); }
}

try {
  const branding = path.join(process.cwd(), "data", "branding");
  await mkdir(branding, { recursive: true });
  await access(branding, constants.W_OK);
  const probe = path.join(branding, `.write-check-${process.pid}`);
  await writeFile(probe, "ok", { flag: "wx" });
  await rm(probe);
  ok("Folder branding dapat ditulis untuk upload logo dan favicon.");
} catch (error) { fail(`Folder data/branding tidak dapat ditulis: ${error.message}`); }

if (process.argv.includes("--http")) {
  for (const route of ["/", "/paket", "/robots.txt", "/sitemap.xml"]) {
    try { const response = await fetch(new URL(route, process.env.APP_URL)); if (!response.ok) fail(`${route} merespons HTTP ${response.status}.`); else ok(`${route} merespons HTTP ${response.status}.`); }
    catch (error) { fail(`${route} tidak bisa diakses: ${error.message}`); }
  }
}

if (warnings.length && strict) fail(`Ada ${warnings.length} konfigurasi opsional yang belum lengkap.`);
console.log(`\nHasil pemeriksaan: ${errors.length} masalah, ${warnings.length} catatan.`);
if (errors.length) process.exitCode = 1;
