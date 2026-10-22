"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isIP } from "node:net";
import type { ResultSetHeader } from "@/lib/db-types";
import { getDb } from "@/lib/db";
import { authenticateUser, clearAdminSession, createAdminSession, createPortalSession, getAdminSessionUser, verifyAdminSession, verifyOwnerSession, verifyAdminScope } from "@/lib/admin-auth";
import { clearLoginFailures, isLoginLocked, loginBucketKey, recordLoginFailure } from "@/lib/login-rate-limit";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const requestHeaders = await headers();
  const realIp = requestHeaders.get("x-real-ip")?.trim() ?? "";
  const forwardedIps = requestHeaders.get("x-forwarded-for")?.split(",").map((ip) => ip.trim()).filter((ip) => isIP(ip)) ?? [];
  const clientIp = isIP(realIp) ? realIp : forwardedIps.at(-1) ?? "unknown";
  const bucketKey = loginBucketKey(email, clientIp);
  let locked: boolean;
  try { locked = await isLoginLocked(bucketKey); } catch {
    redirect("/admin/login?error=database");
  }
  if (locked) redirect("/admin/login?error=locked");
  let user: Awaited<ReturnType<typeof authenticateUser>> = null;
  try {
    user = password.length === 8 ? await authenticateUser(email, password) : null;
  } catch {
    redirect("/admin/login?error=database");
  }
  if (!user) {
    try { await recordLoginFailure(bucketKey); } catch { redirect("/admin/login?error=database"); }
    redirect("/admin/login?error=1");
  }
  try { await clearLoginFailures(bucketKey); } catch { redirect("/admin/login?error=database"); }
  await clearAdminSession();
  if (user.role === "superadmin" || user.role === "admin") {
    await createAdminSession(user.id);
    redirect("/admin");
  }
  if (user.role === "brand" || user.role === "buzzer" || user.role === "kliper" || user.role === "viewer") {
    await createPortalSession(user.id);
    redirect(user.role === "brand" ? "/portal/client" : user.role === "viewer" ? "/portal/viewer" : "/portal/partner");
  }
  redirect("/admin/login?error=role");
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/admin/login");
}

export async function changeOwnPasswordAction(formData: FormData) {
  const user = await getAdminSessionUser();
  if (!user) redirect("/admin/login");
  const current = String(formData.get("current_password") ?? "");
  const password = String(formData.get("new_password") ?? "");
  const confirmation = String(formData.get("confirm_password") ?? "");
  if (password.length !== 8 || password !== confirmation) redirect("/admin/keamanan?error=invalid");
  const db = getDb();
  const [[row]] = await db.execute<(import("@/lib/db-types").RowDataPacket & { password_hash: string })[]>("SELECT password_hash FROM users WHERE id=?", [user.id]);
  const [scheme, salt, expected] = row?.password_hash.split("$") ?? [];
  if (scheme !== "scrypt" || !salt || !expected) redirect("/admin/keamanan?error=current");
  const { scrypt: scryptCallback, randomBytes, timingSafeEqual } = await import("node:crypto");
  const { promisify } = await import("node:util");
  const actual = await promisify(scryptCallback)(current, salt, 64) as Buffer;
  const expectedBuffer = Buffer.from(expected, "hex");
  if (actual.length !== expectedBuffer.length || !timingSafeEqual(actual, expectedBuffer)) redirect("/admin/keamanan?error=current");
  const newSalt = randomBytes(16).toString("hex");
  const hash = await promisify(scryptCallback)(password, newSalt, 64) as Buffer;
  await db.execute("UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?", [`scrypt$${newSalt}$${hash.toString("hex")}`, user.id]);
  await createAdminSession(user.id);
  revalidatePath("/admin/keamanan");
  redirect("/admin/keamanan?saved=1");
}

function requiredText(formData: FormData, name: string, label: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) throw new Error(`${label} wajib diisi.`);
  return value;
}

function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function savePackageAction(formData: FormData) {
  if (!(await verifyAdminScope("dm"))) redirect("/admin/login");

  const id = Number(formData.get("id") ?? 0);
  const name = requiredText(formData, "name", "Nama paket");
  const tagline = requiredText(formData, "tagline", "Ringkasan");
  const description = requiredText(formData, "description", "Deskripsi");
  const price = Number(formData.get("price"));
  const sortOrder = Number(formData.get("sort_order") ?? 0);
  const features = String(formData.get("features") ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
  if (!Number.isSafeInteger(price) || price < 0) throw new Error("Harga harus berupa angka rupiah yang valid.");
  if (!features.length) throw new Error("Tambahkan minimal satu benefit paket.");

  const values = [name, slugify(name), tagline, description, price, JSON.stringify(features), formData.get("highlighted") === "on" ? 1 : 0, formData.get("is_published") === "on" ? 1 : 0, Number.isFinite(sortOrder) ? sortOrder : 0];
  const db = getDb();
  if (id > 0) {
    await db.execute<ResultSetHeader>("UPDATE packages SET name = ?, slug = ?, tagline = ?, description = ?, price = ?, features = ?, highlighted = ?, is_published = ?, sort_order = ? WHERE id = ?", [...values, id]);
  } else {
    await db.execute<ResultSetHeader>("INSERT INTO packages (name, slug, tagline, description, price, features, highlighted, is_published, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", values);
  }
  revalidatePath("/");
  revalidatePath("/paket");
  revalidatePath("/admin");
  revalidatePath("/admin/paket");
  redirect("/admin/paket?saved=1");
}

export async function deletePackageAction(formData: FormData) {
  if (!(await verifyAdminScope("dm"))) redirect("/admin/login");
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id) || id < 1) redirect("/admin");
  await getDb().execute("DELETE FROM packages WHERE id = ?", [id]);
  revalidatePath("/");
  revalidatePath("/paket");
  revalidatePath("/admin");
  revalidatePath("/admin/paket");
  redirect("/admin/paket?deleted=1");
}

export async function saveApplicationSettingsAction(formData: FormData) {
  if (!(await verifyOwnerSession())) redirect("/admin");

  const fields = [
    ["site_name", 100],
    ["site_tagline", 180],
    ["seo_title", 160],
    ["seo_description", 320],
    ["footer_note", 255],
    ["instagram_url", 300],
    ["contact_email", 254],
    ["whatsapp_number", 15],
    ["google_analytics_id", 32],
    ["meta_pixel_id", 32],
    ["cta_label", 40],
    ["cta_url", 300],
  ] as const;
  const values = Object.fromEntries(fields.map(([key]) => [key, String(formData.get(key) ?? "").trim()])) as Record<(typeof fields)[number][0], string>;

  if (fields.some(([key, max]) => values[key].length > max)) redirect("/admin/pengaturan?settings_error=length");
  if (["site_name", "site_tagline", "seo_title", "seo_description", "footer_note", "cta_label", "cta_url"].some((key) => !values[key as keyof typeof values])) {
    redirect("/admin/pengaturan?settings_error=required");
  }
  if (values.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contact_email)) redirect("/admin/pengaturan?settings_error=email");
  if (values.whatsapp_number && !/^\d{8,15}$/.test(values.whatsapp_number)) redirect("/admin/pengaturan?settings_error=whatsapp");
  if (values.google_analytics_id && !/^G-[A-Z0-9]{5,20}$/.test(values.google_analytics_id)) redirect("/admin/pengaturan?settings_error=analytics");
  if (values.meta_pixel_id && !/^\d{5,20}$/.test(values.meta_pixel_id)) redirect("/admin/pengaturan?settings_error=pixel");
  if (values.instagram_url && !isHttpsUrl(values.instagram_url)) redirect("/admin/pengaturan?settings_error=url");
  const ctaIsRelative = isSafeInternalPath(values.cta_url);
  if (!ctaIsRelative && !isHttpsUrl(values.cta_url)) redirect("/admin/pengaturan?settings_error=url");

  try {
    const entries = Object.entries(values);
    const placeholders = entries.map(() => "(?, ?)").join(", ");
    await getDb().execute(
      `INSERT INTO application_settings (setting_key, setting_value) VALUES ${placeholders} ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      entries.flatMap(([key, value]) => [key, value]),
    );
  } catch {
    redirect("/admin/pengaturan?settings_error=database");
  }

  for (const route of ["/", "/layanan", "/paket", "/cara-kerja", "/partner", "/brief", "/studi-kasus", "/opengraph-image", "/sitemap.xml", "/robots.txt", "/admin/pengaturan"]) revalidatePath(route);
  redirect("/admin/pengaturan?settings_saved=1");
}

export async function retryFailedNotificationsAction(formData: FormData) {
  if (!(await verifyOwnerSession())) redirect("/admin");
  const id = Number(formData.get("id") ?? 0);
  if (!Number.isSafeInteger(id) || id < 0) redirect("/admin/pengaturan?queue_error=1");
  if (id) await getDb().execute("UPDATE notification_outbox SET status='pending',attempts=0,available_at=NOW(),last_error=NULL WHERE id=? AND status='failed'", [id]);
  else await getDb().execute("UPDATE notification_outbox SET status='pending',attempts=0,available_at=NOW(),last_error=NULL WHERE status='failed'");
  revalidatePath("/admin/pengaturan");
  redirect("/admin/pengaturan?queue_retried=1");
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isSafeInternalPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return false;
  try {
    return new URL(value, "https://solusi-sejalan.invalid").origin === "https://solusi-sejalan.invalid";
  } catch {
    return false;
  }
}
