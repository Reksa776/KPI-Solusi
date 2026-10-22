import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";
import { changeOwnPasswordAction } from "@/app/admin/actions";
import { verifyAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Keamanan akun" };

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  if (!(await verifyAdminSession())) redirect("/admin/login");
  const { error, saved } = await searchParams;
  const errorMessage = error === "current" ? "Password saat ini belum cocok." : error === "invalid" ? "Password baru harus tepat 8 karakter dan kedua isian harus sama." : null;
  return <div className="admin-page"><AdminNavigation active="security"/><main className="admin-main admin-section-main"><AdminTopbar section="Pengelolaan" page="Keamanan akun"/><div className="admin-shell admin-form-shell"><section className="admin-heading"><div><span className="eyebrow">Akses dashboard</span><h1>Keamanan akun</h1><p>Ganti password dan cabut sesi lama dari perangkat lain.</p></div></section>{saved?<div className="admin-success">Password diperbarui. Sesi lama sudah tidak berlaku.</div>:null}{errorMessage?<div className="admin-error">{errorMessage}</div>:null}<form className="package-edit-form" action={changeOwnPasswordAction}><label>Password saat ini<input name="current_password" type="password" autoComplete="current-password" minLength={8} maxLength={8} required/></label><div className="form-grid"><label>Password baru<input name="new_password" type="password" autoComplete="new-password" minLength={8} maxLength={8} required/><small>Gunakan tepat 8 karakter.</small></label><label>Ulangi password baru<input name="confirm_password" type="password" autoComplete="new-password" minLength={8} maxLength={8} required/></label></div><div className="form-actions"><button className="button" type="submit">Perbarui password <span aria-hidden="true">↗</span></button></div></form><section className="settings-section security-note"><h2>Perlindungan login</h2><p>Setelah 5 percobaan gagal dari kombinasi email dan alamat jaringan yang sama, akses masuk dikunci sementara selama 15 menit. Saat password diperbarui, sesi lama dicabut.</p></section></div></main></div>;
}
