import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2";
import { verifyPortalSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { logoutAction } from "@/app/admin/actions";

type Stats=RowDataPacket&{campaigns:number;active_campaigns:number;clips:number;approved_clips:number;reach:number;impressions:number;engagements:number};
type C=RowDataPacket&{title:string;status:string;campaign_type:string;deliverables:number;reach:number;engagements:number};
export default async function ViewerPage(){
  const user=await verifyPortalSession("viewer");if(!user)redirect("/admin/login");
  const db=getDb();
  const[[stats],[campaigns]] = await Promise.all([
    db.execute<Stats[]>("SELECT (SELECT COUNT(*) FROM campaigns) campaigns,(SELECT COUNT(*) FROM campaigns WHERE status='active') active_campaigns,(SELECT COUNT(*) FROM campaign_clips) clips,(SELECT COUNT(*) FROM campaign_clips WHERE status='approved') approved_clips,(SELECT COALESCE(SUM(reach),0) FROM campaign_deliverables) reach,(SELECT COALESCE(SUM(impressions),0) FROM campaign_deliverables) impressions,(SELECT COALESCE(SUM(engagements),0) FROM campaign_deliverables) engagements"),
    db.execute<C[]>("SELECT c.title,c.status,c.campaign_type,COUNT(d.id) deliverables,COALESCE(SUM(d.reach),0) reach,COALESCE(SUM(d.engagements),0) engagements FROM campaigns c LEFT JOIN campaign_deliverables d ON d.campaign_id=c.id GROUP BY c.id ORDER BY c.created_at DESC LIMIT 100"),
  ]);
  const s=stats[0];
  return <main className="content"><div className="wrap workflow-wrap"><span className="eyebrow">Viewer · hanya melihat</span><h1 className="workflow-title">Halo, {user.full_name}</h1><p className="body-copy">Ringkasan data campaign. Akun viewer tidak dapat mengubah atau menghapus data.</p><div className="admin-stats"><div><span>Total campaign</span><b>{Number(s?.campaigns??0)}</b></div><div><span>Campaign aktif</span><b>{Number(s?.active_campaigns??0)}</b></div><div><span>Kiriman klip</span><b>{Number(s?.clips??0)}</b></div><div><span>Klip disetujui</span><b>{Number(s?.approved_clips??0)}</b></div><div><span>Reach tercatat</span><b>{Number(s?.reach??0).toLocaleString("id-ID")}</b></div><div><span>Impressions</span><b>{Number(s?.impressions??0).toLocaleString("id-ID")}</b></div><div><span>Interaksi</span><b>{Number(s?.engagements??0).toLocaleString("id-ID")}</b></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Campaign</th><th>Jenis</th><th>Status</th><th>Deliverables</th><th>Reach / Interaksi</th></tr></thead><tbody>{campaigns.map((c)=><tr key={c.title}><td><b>{c.title}</b></td><td>{c.campaign_type==="kol_clipping"?"KOL Clipping":"Standar"}</td><td>{c.status}</td><td>{c.deliverables}</td><td>{Number(c.reach).toLocaleString("id-ID")} / {Number(c.engagements).toLocaleString("id-ID")}</td></tr>)}</tbody></table></div><form action={logoutAction}><button className="button light">Keluar</button></form></div></main>;
}
