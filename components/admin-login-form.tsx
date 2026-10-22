"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "@/app/admin/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="button login-submit" type="submit" disabled={pending}>{pending ? "Sedang masuk…" : "Masuk ke dashboard"}<span aria-hidden="true">↗</span></button>;
}

export default function AdminLoginForm({ message }: { message?: string }) {
  const [showPassword, setShowPassword] = useState(false);

  return <section className="login-form-side">
    <form className="admin-login-card" action={loginAction}>
      <div className="login-card-heading"><span className="eyebrow">Akun Solusi Sejalan</span><h2>Selamat datang<br />kembali.</h2><p>Masuk sebagai brand, buzzer, kliper, viewer, atau admin.</p></div>
      {message ? <div className={`form-error${message.startsWith("Database") ? " database-error" : ""}`} role="alert">{message}</div> : null}
      <label>Email<input type="email" name="email" placeholder="nama@perusahaan.com" autoComplete="username" required /></label>
      <label>Password<div className="password-field"><input type={showPassword ? "text" : "password"} name="password" placeholder="Masukkan password 8 karakter" autoComplete="current-password" minLength={8} maxLength={8} required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}>{showPassword ? "Sembunyikan" : "Lihat"}</button></div><small className="password-hint">Gunakan password tepat 8 karakter.</small></label>
      <SubmitButton />
      <p className="login-help">Client dan partner akan diarahkan ke ruang kerja masing-masing setelah masuk.</p>
    </form>
  </section>;
}
