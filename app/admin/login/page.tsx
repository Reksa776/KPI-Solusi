import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import AdminLoginForm from "@/components/admin-login-form";
import BrandIcon from "@/components/brand-icon";

export const metadata: Metadata = { title: "Masuk admin" };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await verifyAdminSession()) redirect("/admin");
  const { error } = await searchParams;
  const message = error === "locked"
    ? "Terlalu banyak percobaan masuk. Coba lagi setelah 15 menit."
    : error === "database"
    ? "Database belum tersambung. Periksa pengaturan MySQL dan coba lagi."
    : error
      ? "Email atau password belum cocok. Periksa kembali lalu coba lagi."
      : undefined;
  return <div className="admin-login-page">
    <div className="login-shell">
      <aside className="login-aside">
        <a className="brand" href="/"><BrandIcon /><span>solusi sejalan</span></a>
        <div className="login-aside-copy"><span className="eyebrow">Ruang kerja digital</span><h1>Campaign,<br />partner, dan<br /><em>hasilnya.</em></h1><p>Satu ruang untuk mengelola strategi dan kolaborasi Solusi Sejalan.</p></div>
        <div className="login-orbit" aria-hidden="true"><span>↗</span><i>✳</i></div>
        <a className="login-back" href="/">← Kembali ke website</a>
      </aside>
      <AdminLoginForm message={message} />
    </div>
  </div>;
}
