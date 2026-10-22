import Link from "next/link";
import { logoutAction } from "@/app/admin/actions";
import BrandIcon from "@/components/brand-icon";
import { getAdminSessionUser } from "@/lib/admin-auth";
import TeamSubnavigation, { type TeamNavActive } from "@/components/team-subnavigation";

type Active="dashboard"|"analytics"|"packages"|"users"|"settings"|"security"|"new"|"brief"|"campaign"|"partner"|"cases"|"kpi"|"client";

export default async function AdminNavigation({active,teamActive}:{active:Active;teamActive?:TeamNavActive}){
  const user=await getAdminSessionUser();
  const owner=user?.role==="superadmin";
  return <aside className="admin-sidebar">
    <Link className="admin-brand" href="/admin"><BrandIcon/><span>solusi sejalan<small>{owner?"SUPERADMIN":`ADMIN · ${(user?.admin_scope??"both").toUpperCase()}`}</small></span></Link>
    <div className="admin-nav-scroll">
      <section className="admin-nav-section"><div className="admin-nav-label">OPERASIONAL</div><nav className="admin-nav" aria-label="Operasional">
        <Link className={active==="dashboard"?"active":""} href="/admin"><span>▦</span> Overview</Link>
        {(owner||user?.role==="admin")&&<Link className={active==="client"?"active":""} href="/admin/client"><span>♧</span> Client</Link>}
        {owner&&<><Link className={active==="brief"?"active":""} href="/admin/brief"><span>✳</span> Brief masuk</Link><Link className={active==="campaign"?"active":""} href="/admin/campaign"><span>◉</span> Campaign</Link><Link className={active==="partner"?"active":""} href="/admin/partner"><span>♧</span> Partner</Link><Link className={active==="analytics"?"active":""} href="/admin/analytics"><span>⌁</span> Analytics</Link><Link className={active==="cases"?"active":""} href="/admin/studi-kasus"><span>▤</span> Studi kasus</Link></>}
      </nav>
      {(user?.role==="admin"||teamActive)&&<TeamSubnavigation active={teamActive??"overview"}/>}
      </section>
      {owner&&<section className="admin-nav-section"><div className="admin-nav-label">PENGELOLAAN</div><nav className="admin-nav" aria-label="Pengelolaan"><Link className={active==="packages"?"active":""} href="/admin/paket"><span>▤</span> Paket</Link><Link className={active==="users"?"active":""} href="/admin/pengguna"><span>♧</span> Pengguna</Link><Link className={active==="settings"?"active":""} href="/admin/pengaturan"><span>⚙</span> Pengaturan</Link><Link className={active==="security"?"active":""} href="/admin/keamanan"><span>⌑</span> Keamanan akun</Link></nav></section>}
    </div>
    <div className="admin-sidebar-bottom"><Link href="/" className="admin-public-link"><span>↗</span> Lihat website</Link><form action={logoutAction}><button type="submit"><span>⇥</span> Keluar</button></form></div>
  </aside>;
}
