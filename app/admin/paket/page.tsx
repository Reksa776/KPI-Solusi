import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { deletePackageAction } from "@/app/admin/actions";
import AdminNavigation from "@/components/admin-navigation";
import AdminTopbar from "@/components/admin-topbar";
import { verifyAdminScope, verifyAdminAnyScope, verifyAdminSession } from "@/lib/admin-auth";
import { getAdminPackages } from "@/lib/packages";

export const metadata: Metadata = { title: "Paket | Dashboard admin" };

export default async function AdminPackagesPage({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string }> }) {
  if (!(await verifyAdminSession())) redirect("/admin/login");if(!(await verifyAdminScope("dm")))redirect("/admin");
  const [packages, params] = await Promise.all([getAdminPackages(), searchParams]);
  return <div className="admin-page"><AdminNavigation active="packages" /><main className="admin-main admin-section-main"><AdminTopbar section="Paket" page="Daftar paket" /><div className="admin-shell">
    <section className="admin-heading"><div><span className="eyebrow">Konten website</span><h1>Daftar paket</h1><p>Kelola penawaran yang tampil untuk calon client.</p></div><Link className="button" href="/admin/paket/baru">+ Tambah paket</Link></section>
    {params.saved ? <div className="admin-success">Paket berhasil disimpan.</div> : null}{params.deleted ? <div className="admin-success">Paket berhasil dihapus.</div> : null}
    <div className="admin-section-label"><div><h2>{packages.length} paket</h2><p>Perubahan langsung diperbarui di halaman publik.</p></div></div>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Paket</th><th>Harga mulai</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
      {packages.map((item) => <tr key={item.id}><td><b>{item.name}</b><small>{item.tagline}</small></td><td>Rp {item.price.toLocaleString("id-ID")}</td><td><span className={`status-pill ${item.is_published ? "published" : "draft"}`}>{item.is_published ? "Tayang" : "Draft"}</span>{item.highlighted ? <span className="status-pill featured">Unggulan</span> : null}</td><td><div className="table-actions"><Link href={`/admin/paket/${item.id}`}>Edit</Link><form action={deletePackageAction}><input type="hidden" name="id" value={item.id} /><button type="submit">Hapus</button></form></div></td></tr>)}
      {!packages.length ? <tr><td colSpan={4} className="empty-state">Belum ada paket. Tambahkan paket pertamamu.</td></tr> : null}
    </tbody></table></div>
  </div></main></div>;
}
