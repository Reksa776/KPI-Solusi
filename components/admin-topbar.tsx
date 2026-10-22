import Link from "next/link";

export default function AdminTopbar({ section, page }: { section: string; page: string }) {
  return <header className="dashboard-topbar admin-topbar">
    <span><Link href="/admin">Dashboard</Link><b>/</b>{section !== "Ringkasan" ? <>{section}<b>/</b></> : null}{page}</span>
    <div><span className="admin-online"><i /> Sistem aktif</span><Link href="/" aria-label="Lihat website">↗</Link></div>
  </header>;
}
