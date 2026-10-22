"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getDb } from "@/lib/db";
import { getAdminSessionUser, verifyAdminSession, verifyOwnerSession, verifyPortalSession, verifyAdminScope, verifyAdminAnyScope, verifyPartnerPortalSession } from "@/lib/admin-auth";
const val = (d: FormData, k: string, max = 255) => String(d.get(k) ?? "").trim().slice(0, max);
const allowed = (v: string, values: string[]) => values.includes(v);
export async function updateLeadStatus(d: FormData) { if (!(await verifyAdminScope("dae"))) redirect("/admin/login"); const id=Number(d.get("id")), status=val(d,"status"); if (!Number.isSafeInteger(id)||id<1||!allowed(status,["new","reviewing","proposal","closed"])) redirect("/admin/brief"); await getDb().execute("UPDATE leads SET status=? WHERE id=? AND status <> 'converted'",[status,id]); revalidatePath("/admin/brief"); }
export async function convertLead(d: FormData) { const actor=await getAdminSessionUser(); if(!actor || !(await verifyAdminScope("dae"))) redirect("/admin/login"); const id=Number(d.get("id")); if(!Number.isSafeInteger(id)||id<1) redirect("/admin/brief"); const db=getDb(); const conn=await db.getConnection(); try { await conn.beginTransaction(); const [rows]=await conn.execute<(RowDataPacket & {id:number;contact_name:string;company_name:string;email:string;campaign_goal:string;budget_max:number|null;target_date:string|null;status:string})[]>("SELECT * FROM leads WHERE id=? FOR UPDATE",[id]); const lead=rows[0]; if(!lead||lead.status==="converted") { await conn.rollback(); redirect("/admin/brief?error=converted"); } const [userRows]=await conn.execute<(RowDataPacket & {id:number})[]>("SELECT id FROM users WHERE email=? AND role='brand' LIMIT 1",[lead.email]); const [result]=await conn.execute<ResultSetHeader>("INSERT INTO campaigns (lead_id,client_user_id,title,client_name,client_email,objective,status,start_date,budget) VALUES (?,?,?,?,? ,?,'planning',?,?)",[id,userRows[0]?.id??null,`${lead.company_name} — campaign`,lead.contact_name,lead.email,lead.campaign_goal,lead.target_date,lead.budget_max]); await conn.execute("UPDATE leads SET status='converted',converted_at=NOW() WHERE id=?",[id]); await conn.execute("INSERT INTO lead_activities (lead_id,actor_user_id,activity_type,description) VALUES (?,? ,'converted',?)",[id,actor.id,"Brief dikonversi menjadi campaign."]); await conn.commit(); revalidatePath("/admin/campaign"); revalidatePath("/admin/brief"); redirect(`/admin/campaign/${result.insertId}`); } catch(e) { try { await conn.rollback(); } catch {} if(e && typeof e === "object" && "digest" in e) throw e; throw e; } finally { conn.release(); } }
export async function saveCampaign(d: FormData) {
  if (!(await verifyAdminAnyScope(["dm","dae"]))) redirect("/admin/login");
  const id=Number(d.get("id")), status=val(d,"status"), campaignType=val(d,"campaign_type")||"standard";
  const budgetRaw=val(d,"budget",20), budget=budgetRaw?Number(budgetRaw):null;
  const clientName=val(d,"client_name",160), clientEmail=val(d,"client_email",191).toLowerCase();
  const start=val(d,"start_date",10), end=val(d,"end_date",10), dmRaw=val(d,"assigned_dm_user_id",20), dmId=dmRaw?Number(dmRaw):null;
  const sourceUrl=val(d,"clipping_source_url",500), rules=val(d,"clipping_rules",4000);
  const rightsConfirmed=d.get("clipping_rights_confirmed")==="on";
  const rateRaw=val(d,"clipping_rate_per_1000",20), rate=rateRaw?Number(rateRaw):0;
  const capRaw=val(d,"clipping_budget_cap",20), cap=capRaw?Number(capRaw):null;
  const minViewsRaw=val(d,"clipping_min_views",20), minViews=minViewsRaw?Number(minViewsRaw):0;
  const validDate=(v:string)=>!v||/^\d{4}-\d{2}-\d{2}$/.test(v);
  const validSource=()=>{try{return new URL(sourceUrl).protocol==="https:"}catch{return false}};
  if(!Number.isSafeInteger(id)||id<1||(dmId!==null&&(!Number.isSafeInteger(dmId)||dmId<1))||!val(d,"title",180)||!clientName||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)||!allowed(status,["planning","active","paused","completed","cancelled"])||!allowed(campaignType,["standard","kol_clipping"])||(budget!==null&&(!Number.isSafeInteger(budget)||budget<0))||!validDate(start)||!validDate(end)||(start&&end&&end<start)) redirect("/admin/campaign?error=invalid");
  if(dmId!==null){const [managers]=await getDb().execute<(RowDataPacket&{id:number})[]>("SELECT id FROM users WHERE id=? AND role IN ('admin','superadmin') AND status='active' AND admin_scope IN ('dm','both') LIMIT 1",[dmId]);if(!managers.length)redirect(`/admin/campaign/${id}?error=manager`);}
  if(campaignType==="standard"){
    const[[used]]=await getDb().execute<(RowDataPacket&{total:number})[]>("SELECT COUNT(*) total FROM campaign_clips WHERE campaign_id=?",[id]);
    if(Number(used?.total)>0)redirect(`/admin/campaign/${id}?error=clip_in_use`);
  }
  if(campaignType==="kol_clipping"&&(!validSource()||!rules||!rightsConfirmed||!Number.isSafeInteger(rate)||rate<=0||cap===null||!Number.isSafeInteger(cap)||cap<=0||!Number.isSafeInteger(minViews)||minViews<0||(budget!==null&&cap>budget))) redirect(`/admin/campaign/${id}?error=clip_settings`);
  await getDb().execute("UPDATE campaigns SET title=?,client_name=?,client_email=?,objective=?,status=?,start_date=?,end_date=?,budget=?,assigned_dm_user_id=?,campaign_type=?,clipping_source_url=?,clipping_rules=?,clipping_rights_confirmed=?,clipping_rate_per_1000=?,clipping_budget_cap=?,clipping_min_views=? WHERE id=?",[val(d,"title",180),clientName,clientEmail,val(d,"objective",4000),status,start||null,end||null,budget,dmId,campaignType,campaignType==="kol_clipping"?sourceUrl:null,campaignType==="kol_clipping"?rules:null,campaignType==="kol_clipping"?1:0,campaignType==="kol_clipping"?rate:0,campaignType==="kol_clipping"?cap:null,campaignType==="kol_clipping"?minViews:0,id]);
  revalidatePath(`/admin/campaign/${id}`);revalidatePath("/admin/campaign");revalidatePath("/portal/partner");redirect(`/admin/campaign/${id}?saved=1`);
}
export async function savePartner(d:FormData) { if(!(await verifyAdminScope("dm"))) redirect("/admin/login"); const name=val(d,"display_name"),type=val(d,"partner_type"),platform=val(d,"platform",80),niche=val(d,"niche"),status=val(d,"status"),handle=val(d,"handle",191),url=val(d,"profile_url",255),aud=val(d,"audience_size",20),rateRaw=val(d,"rate",20),user=val(d,"user_id",20); const audience=aud?Number(aud):null,rate=rateRaw?Number(rateRaw):null,userId=user?Number(user):null; if(!name||!platform||!niche||!allowed(type,["creator","community","publisher","other"])||!allowed(status,["pending","active","inactive"])||[audience,rate,userId].some(n=>n!==null&&(!Number.isSafeInteger(n)||n<0))) redirect("/admin/partner?error=invalid"); if(userId){const [linked]=await getDb().execute<(RowDataPacket & {id:number})[]>("SELECT id FROM users WHERE id=? AND role IN (\'buzzer\',\'kliper\') AND status=\'active\' LIMIT 1",[userId]);if(!linked.length) redirect("/admin/partner?error=invalid");} await getDb().execute("INSERT INTO partners (display_name,partner_type,platform,handle,profile_url,niche,audience_size,rate,status,user_id) VALUES (?,?,?,?,?,?,?,?,?,?)",[name,type,platform,handle||null,url||null,niche,audience,rate,status,userId]); revalidatePath("/admin/partner"); redirect("/admin/partner?saved=1"); }
export async function saveDeliverable(d:FormData) {
  if(!(await verifyAdminAnyScope(["dm","dae"]))) redirect("/admin/login");
  const campaign=Number(d.get("campaign_id")), partnerRaw=val(d,"partner_id",20), partner=partnerRaw?Number(partnerRaw):null;
  const title=val(d,"title",180), platform=val(d,"platform",80), status=val(d,"status");
  const reach=Number(val(d,"reach",20)||0), impressions=Number(val(d,"impressions",20)||0), engagements=Number(val(d,"engagements",20)||0);
  const videoViews=Number(val(d,"video_views",20)||0), tiktokSales=Number(val(d,"tiktok_sales",20)||0), shopeeSales=Number(val(d,"shopee_sales",20)||0);
  const url=val(d,"published_url",500), scheduledRaw=val(d,"scheduled_at",25), scheduled=scheduledRaw&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduledRaw)?scheduledRaw.replace("T"," ")+":00":null, notes=val(d,"notes",4000);
  const metrics=[reach,impressions,engagements,videoViews,tiktokSales,shopeeSales];
  if(!Number.isSafeInteger(campaign)||campaign<1||!title||!platform||!allowed(status,["planned","in_progress","published","cancelled"])||metrics.some(n=>!Number.isSafeInteger(n)||n<0)) redirect(`/admin/campaign/${campaign}`);
  await getDb().execute("INSERT INTO campaign_deliverables (campaign_id,partner_id,title,platform,status,scheduled_at,published_url,reach,impressions,engagements,video_views,tiktok_sales,shopee_sales,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",[campaign,partner,title,platform,status,scheduled,url||null,reach,impressions,engagements,videoViews,tiktokSales,shopeeSales,notes||null]);
  revalidatePath(`/admin/campaign/${campaign}`);revalidatePath("/admin/analytics");revalidatePath("/admin");redirect(`/admin/campaign/${campaign}?deliverable=saved`);
}
export async function saveCaseStudy(d:FormData) { if(!(await verifyAdminScope("dm"))) redirect("/admin/login"); const title=val(d,"title",180),client=val(d,"client_label",160),summary=val(d,"summary",4000),strategy=val(d,"strategy",4000),outcomes=val(d,"outcomes",4000),slug=title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,180),campaignRaw=val(d,"campaign_id",20),campaign=campaignRaw?Number(campaignRaw):null; if(!title||!client||!summary||!strategy||!outcomes||(campaign!==null&&(!Number.isSafeInteger(campaign)||campaign<1))) redirect("/admin/studi-kasus?error=invalid"); const [metrics]=campaign?await getDb().execute<(RowDataPacket & {reach:number;impressions:number;engagements:number})[]>("SELECT COALESCE(SUM(reach),0) reach, COALESCE(SUM(impressions),0) impressions, COALESCE(SUM(engagements),0) engagements FROM campaign_deliverables WHERE campaign_id=?",[campaign]):[[{reach:0,impressions:0,engagements:0}] as (RowDataPacket & {reach:number;impressions:number;engagements:number})[],[]]; const [r]=await getDb().execute<ResultSetHeader>("INSERT INTO case_studies (campaign_id,slug,title,client_label,summary,strategy,outcomes,reach,impressions,engagements,is_published) VALUES (?,?,?,?,?,?,?,?,?,?,?)",[campaign,slug||`studi-kasus-${Date.now()}`,title,client,summary,strategy,outcomes,metrics[0]?.reach??0,metrics[0]?.impressions??0,metrics[0]?.engagements??0,d.get("is_published")==="on"?1:0]); revalidatePath("/studi-kasus"); revalidatePath("/admin/studi-kasus"); redirect(`/admin/studi-kasus?saved=${r.insertId}`); }

export async function updatePartnerStatus(d:FormData) { if(!(await verifyAdminScope("dm"))) redirect("/admin/login"); const id=Number(d.get("id")),status=val(d,"status"); if(!Number.isSafeInteger(id)||id<1||!allowed(status,["pending","active","inactive"])) redirect("/admin/partner"); await getDb().execute("UPDATE partners SET status=? WHERE id=?",[status,id]); revalidatePath("/admin/partner"); }
export async function updateCasePublication(d:FormData) { if(!(await verifyAdminScope("dm"))) redirect("/admin/login"); const id=Number(d.get("id")),published=d.get("published")==="1"?1:0; if(!Number.isSafeInteger(id)||id<1) redirect("/admin/studi-kasus"); await getDb().execute("UPDATE case_studies SET is_published=? WHERE id=?",[published,id]); revalidatePath("/admin/studi-kasus"); revalidatePath("/studi-kasus"); }

// Full CRUD actions for operational records. Every action is protected server-side.
export async function deleteLead(d:FormData){if(!(await verifyAdminScope("dae")))redirect("/admin");const id=Number(d.get("id"));if(!Number.isSafeInteger(id)||id<1)redirect("/admin/brief");await getDb().execute("DELETE FROM leads WHERE id=?",[id]);revalidatePath("/admin/brief");redirect("/admin/brief?saved=1");}
export async function saveLead(d:FormData){if(!(await verifyAdminScope("dae")))redirect("/admin/login");const id=Number(d.get("id")),contact=val(d,"contact_name",160),company=val(d,"company_name",160),email=val(d,"email",191).toLowerCase(),phone=val(d,"phone",40),goal=val(d,"campaign_goal",4000),audience=val(d,"target_audience",255),channels=val(d,"preferred_channels",255),website=val(d,"website_or_social",255),status=val(d,"status"),minRaw=val(d,"budget_min",20),maxRaw=val(d,"budget_max",20),min=minRaw?Number(minRaw):null,max=maxRaw?Number(maxRaw):null;if(!Number.isSafeInteger(id)||id<1||!contact||!company||!/^\S+@\S+\.\S+$/.test(email)||!phone||!goal||!audience||!channels||!allowed(status,["new","reviewing","proposal","closed"])||[min,max].some(n=>n!==null&&(!Number.isSafeInteger(n)||n<0))||(min!==null&&max!==null&&max<min))redirect("/admin/brief?error=invalid");await getDb().execute("UPDATE leads SET contact_name=?,company_name=?,email=?,phone=?,campaign_goal=?,target_audience=?,preferred_channels=?,website_or_social=?,budget_min=?,budget_max=?,status=? WHERE id=? AND status<>'converted'",[contact,company,email,phone,goal,audience,channels,website||null,min,max,status,id]);revalidatePath("/admin/brief");redirect("/admin/brief?saved=1");}
export async function deleteCampaign(d:FormData){if(!(await verifyAdminAnyScope(["dm","dae"])))redirect("/admin/login");const id=Number(d.get("id"));if(!Number.isSafeInteger(id)||id<1)redirect("/admin/campaign");await getDb().execute("DELETE FROM campaigns WHERE id=?",[id]);revalidatePath("/admin/campaign");revalidatePath("/admin/analytics");redirect("/admin/campaign?deleted=1");}
export async function createCampaign(d: FormData) {
  if (!(await verifyAdminAnyScope(["dm","dae"]))) redirect("/admin/login");
  const title=val(d,"title",180), name=val(d,"client_name",160), email=val(d,"client_email",191).toLowerCase(), dmRaw=val(d,"assigned_dm_user_id",20), dmId=dmRaw?Number(dmRaw):null;
  const objective=val(d,"objective",4000), budgetRaw=val(d,"budget",20), budget=budgetRaw?Number(budgetRaw):null;
  const campaignType=val(d,"campaign_type")||"standard", sourceUrl=val(d,"clipping_source_url",500), rules=val(d,"clipping_rules",4000);
  const rightsConfirmed=d.get("clipping_rights_confirmed")==="on";
  const rateRaw=val(d,"clipping_rate_per_1000",20), rate=rateRaw?Number(rateRaw):0, capRaw=val(d,"clipping_budget_cap",20), cap=capRaw?Number(capRaw):null;
  const minRaw=val(d,"clipping_min_views",20), minViews=minRaw?Number(minRaw):0;
  let validSource=false;try{validSource=new URL(sourceUrl).protocol==="https:"}catch{}
  if(!title||!name||(dmId!==null&&(!Number.isSafeInteger(dmId)||dmId<1))||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!objective||(budget!==null&&(!Number.isSafeInteger(budget)||budget<0))||!allowed(campaignType,["standard","kol_clipping"]))redirect("/admin/campaign?error=invalid");
  if(campaignType==="kol_clipping"&&(!validSource||!rules||!rightsConfirmed||!Number.isSafeInteger(rate)||rate<=0||cap===null||!Number.isSafeInteger(cap)||cap<=0||!Number.isSafeInteger(minViews)||minViews<0||(budget!==null&&cap>budget)))redirect("/admin/campaign/baru?error=clip_settings");
  if(dmId!==null){const [managers]=await getDb().execute<(RowDataPacket&{id:number})[]>("SELECT id FROM users WHERE id=? AND role IN ('admin','superadmin') AND status='active' AND admin_scope IN ('dm','both') LIMIT 1",[dmId]);if(!managers.length)redirect("/admin/campaign/baru?error=manager");}
  const[u]=await getDb().execute<(RowDataPacket&{id:number})[]>("SELECT id FROM users WHERE email=? AND role='brand' LIMIT 1",[email]);
  const[r]=await getDb().execute<ResultSetHeader>("INSERT INTO campaigns (client_user_id,assigned_dm_user_id,title,client_name,client_email,objective,budget,campaign_type,clipping_source_url,clipping_rules,clipping_rights_confirmed,clipping_rate_per_1000,clipping_budget_cap,clipping_min_views) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",[u[0]?.id??null,dmId,title,name,email,objective,budget,campaignType,campaignType==="kol_clipping"?sourceUrl:null,campaignType==="kol_clipping"?rules:null,campaignType==="kol_clipping"?1:0,campaignType==="kol_clipping"?rate:0,campaignType==="kol_clipping"?cap:null,campaignType==="kol_clipping"?minViews:0]);
  revalidatePath("/admin/campaign");revalidatePath("/portal/partner");redirect(`/admin/campaign/${r.insertId}`);
}
export async function updateDeliverable(d:FormData){
  if(!(await verifyAdminAnyScope(["dm","dae"])))redirect("/admin/login");
  const id=Number(d.get("id")),campaign=Number(d.get("campaign_id")),partnerRaw=val(d,"partner_id",20),partner=partnerRaw?Number(partnerRaw):null,title=val(d,"title",180),platform=val(d,"platform",80),status=val(d,"status");
  const reach=Number(val(d,"reach",20)||0),impressions=Number(val(d,"impressions",20)||0),engagements=Number(val(d,"engagements",20)||0),videoViews=Number(val(d,"video_views",20)||0),tiktokSales=Number(val(d,"tiktok_sales",20)||0),shopeeSales=Number(val(d,"shopee_sales",20)||0);
  const url=val(d,"published_url",500),scheduledRaw=val(d,"scheduled_at",25),scheduled=scheduledRaw&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduledRaw)?scheduledRaw.replace("T"," ")+":00":null,notes=val(d,"notes",4000),metrics=[reach,impressions,engagements,videoViews,tiktokSales,shopeeSales];
  if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(campaign)||campaign<1||!title||!platform||!allowed(status,["planned","in_progress","published","cancelled"])||metrics.some(n=>!Number.isSafeInteger(n)||n<0))redirect(`/admin/campaign/${campaign}`);
  await getDb().execute("UPDATE campaign_deliverables SET partner_id=?,title=?,platform=?,status=?,scheduled_at=?,published_url=?,reach=?,impressions=?,engagements=?,video_views=?,tiktok_sales=?,shopee_sales=?,notes=? WHERE id=? AND campaign_id=?",[partner,title,platform,status,scheduled,url||null,reach,impressions,engagements,videoViews,tiktokSales,shopeeSales,notes||null,id,campaign]);
  revalidatePath(`/admin/campaign/${campaign}`);revalidatePath("/admin/analytics");revalidatePath("/admin");redirect(`/admin/campaign/${campaign}?deliverable=saved`);
}
export async function deleteDeliverable(d:FormData){if(!(await verifyAdminAnyScope(["dm","dae"])))redirect("/admin/login");const id=Number(d.get("id")),campaign=Number(d.get("campaign_id"));if(!Number.isSafeInteger(id)||!Number.isSafeInteger(campaign)||id<1||campaign<1)redirect("/admin/campaign");await getDb().execute("DELETE FROM campaign_deliverables WHERE id=? AND campaign_id=?",[id,campaign]);revalidatePath(`/admin/campaign/${campaign}`);revalidatePath("/admin/analytics");}
export async function updatePartner(d:FormData){if(!(await verifyAdminScope("dm")))redirect("/admin/login");const id=Number(d.get("id")),name=val(d,"display_name",160),type=val(d,"partner_type"),platform=val(d,"platform",80),handle=val(d,"handle",191),url=val(d,"profile_url",255),niche=val(d,"niche"),status=val(d,"status"),audRaw=val(d,"audience_size",20),rateRaw=val(d,"rate",20),userRaw=val(d,"user_id",20),aud=audRaw?Number(audRaw):null,rate=rateRaw?Number(rateRaw):null,user=userRaw?Number(userRaw):null;if(!Number.isSafeInteger(id)||id<1||!name||!platform||!niche||!allowed(type,["creator","community","publisher","other"])||!allowed(status,["pending","active","inactive"])||[aud,rate,user].some(n=>n!==null&&(!Number.isSafeInteger(n)||n<0)))redirect("/admin/partner?error=invalid");if(user){const[u]=await getDb().execute<(RowDataPacket&{id:number})[]>("SELECT id FROM users WHERE id=? AND role IN ('buzzer','kliper') AND status='active' LIMIT 1",[user]);if(!u.length)redirect("/admin/partner?error=invalid");}await getDb().execute("UPDATE partners SET display_name=?,partner_type=?,platform=?,handle=?,profile_url=?,niche=?,audience_size=?,rate=?,status=?,user_id=? WHERE id=?",[name,type,platform,handle||null,url||null,niche,aud,rate,status,user,id]);revalidatePath("/admin/partner");redirect("/admin/partner?saved=1");}
export async function deletePartner(d:FormData){if(!(await verifyAdminScope("dm")))redirect("/admin/login");const id=Number(d.get("id"));if(!Number.isSafeInteger(id)||id<1)redirect("/admin/partner");await getDb().execute("DELETE FROM partners WHERE id=?",[id]);revalidatePath("/admin/partner");revalidatePath("/admin/campaign");}
export async function updateCaseStudy(d:FormData){if(!(await verifyAdminScope("dm")))redirect("/admin/login");const id=Number(d.get("id")),title=val(d,"title",180),client=val(d,"client_label",160),summary=val(d,"summary",4000),strategy=val(d,"strategy",4000),outcomes=val(d,"outcomes",4000),campaignRaw=val(d,"campaign_id",20),campaign=campaignRaw?Number(campaignRaw):null;if(!Number.isSafeInteger(id)||id<1||!title||!client||!summary||!strategy||!outcomes||(campaign!==null&&(!Number.isSafeInteger(campaign)||campaign<1)))redirect("/admin/studi-kasus?error=invalid");const slug=title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,160);await getDb().execute("UPDATE case_studies SET campaign_id=?,slug=?,title=?,client_label=?,summary=?,strategy=?,outcomes=?,is_published=? WHERE id=?",[campaign,`${slug||"studi-kasus"}-${id}`,title,client,summary,strategy,outcomes,d.get("is_published")==="on"?1:0,id]);revalidatePath("/admin/studi-kasus");revalidatePath("/studi-kasus");redirect("/admin/studi-kasus?saved=1");}
export async function deleteCaseStudy(d:FormData){if(!(await verifyAdminScope("dm")))redirect("/admin/login");const id=Number(d.get("id"));if(!Number.isSafeInteger(id)||id<1)redirect("/admin/studi-kasus");await getDb().execute("DELETE FROM case_studies WHERE id=?",[id]);revalidatePath("/admin/studi-kasus");revalidatePath("/studi-kasus");}
export async function saveUser(d:FormData){
  if(!(await verifyOwnerSession()))redirect("/admin");
  const idRaw=val(d,"id",20),id=idRaw?Number(idRaw):null,name=val(d,"full_name",160),email=val(d,"email",191).toLowerCase();
  let role=val(d,"role"),status=val(d,"status"),scope=val(d,"admin_scope")||"both";
  const password=String(d.get("password")??"");
  if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!allowed(role,["superadmin","admin","kliper","buzzer","brand","viewer"])||!allowed(status,["active","suspended"])||!allowed(scope,["dm","dae","both"])||(id!==null&&(!Number.isSafeInteger(id)||id<1))||(password&&password.length!==8)||(!id&&(!password||role==="superadmin")))redirect("/admin/pengguna?error=invalid");
  const db=getDb();
  if(id){
    const[[prior]]=await db.execute<(RowDataPacket&{role:string;status:string})[]>("SELECT role,status FROM users WHERE id=?",[id]);
    if(!prior)redirect("/admin/pengguna?error=invalid");
    if(role==="superadmin"&&prior.role!=="superadmin")redirect("/admin/pengguna?error=invalid");
    if(prior.role==="superadmin"){
      role="superadmin";scope="both";
      if(prior.status==="active"&&status==="suspended"){
        const[[active]]=await db.execute<(RowDataPacket&{total:number})[]>("SELECT COUNT(*) total FROM users WHERE role='superadmin' AND status='active'");
        if(Number(active?.total)<=1)redirect("/admin/pengguna?error=last_superadmin");
      }
    }
    if(password)await db.execute("UPDATE users SET full_name=?,email=?,role=?,admin_scope=?,status=?,password_hash=?,session_version=session_version+1 WHERE id=?",[name,email,role,scope,status,await makePasswordHash(password),id]);
    else await db.execute("UPDATE users SET full_name=?,email=?,role=?,admin_scope=?,status=?,session_version=session_version+1 WHERE id=?",[name,email,role,scope,status,id]);
  }else{
    await db.execute("INSERT INTO users (full_name,email,password_hash,role,admin_scope,status) VALUES (?,?,?,?,?,?)",[name,email,await makePasswordHash(password),role,scope,status]);
  }
  revalidatePath("/admin/pengguna");redirect("/admin/pengguna?saved=1");
}
async function makePasswordHash(password:string){const{randomBytes,scrypt:sc}=await import("node:crypto");const{promisify}=await import("node:util");const salt=randomBytes(16).toString("hex"),derived=await promisify(sc)(password,salt,64) as Buffer;return `scrypt$${salt}$${derived.toString("hex")}`}
export async function deleteUser(d:FormData){
  if(!(await verifyOwnerSession()))redirect("/admin");
  const id=Number(d.get("id"));if(!Number.isSafeInteger(id)||id<1)redirect("/admin/pengguna");
  const db=getDb(),[[target]]=await db.execute<(RowDataPacket&{role:string;status:string})[]>("SELECT role,status FROM users WHERE id=?",[id]);
  if(target?.role==="superadmin"&&target.status==="active"){
    const[[active]]=await db.execute<(RowDataPacket&{total:number})[]>("SELECT COUNT(*) total FROM users WHERE role='superadmin' AND status='active'");
    if(Number(active?.total)<=1)redirect("/admin/pengguna?error=last_superadmin");
  }
  await db.execute("DELETE FROM users WHERE id=?",[id]);revalidatePath("/admin/pengguna");revalidatePath("/portal/client");revalidatePath("/portal/partner");revalidatePath("/portal/viewer");
}

export async function createLead(d:FormData){if(!(await verifyAdminScope("dae")))redirect("/admin/login");const contact=val(d,"contact_name",160),company=val(d,"company_name",160),email=val(d,"email",191).toLowerCase(),phone=val(d,"phone",40),goal=val(d,"campaign_goal",4000),audience=val(d,"target_audience",255),channels=val(d,"preferred_channels",255),website=val(d,"website_or_social",255),minRaw=val(d,"budget_min",20),maxRaw=val(d,"budget_max",20),min=minRaw?Number(minRaw):null,max=maxRaw?Number(maxRaw):null;if(!contact||!company||!/^\S+@\S+\.\S+$/.test(email)||!phone||!goal||!audience||!channels||[min,max].some(n=>n!==null&&(!Number.isSafeInteger(n)||n<0))||(min!==null&&max!==null&&max<min))redirect("/admin/brief?error=invalid");await getDb().execute("INSERT INTO leads (contact_name,company_name,email,phone,campaign_goal,target_audience,preferred_channels,website_or_social,budget_min,budget_max) VALUES (?,?,?,?,?,?,?,?,?,?)",[contact,company,email,phone,goal,audience,channels,website||null,min,max]);revalidatePath("/admin/brief");redirect("/admin/brief?saved=1");}

export async function submitCampaignClip(d: FormData) {
  const user = await verifyPartnerPortalSession();
  if (!user) redirect("/admin/login");
  const campaignId = Number(d.get("campaign_id"));
  const title = val(d, "clip_title", 180);
  const platform = val(d, "platform");
  const url = val(d, "post_url", 500);
  const note = val(d, "clipper_note", 1000);
  const domains: Record<string, string[]> = { tiktok: ["tiktok.com"], instagram: ["instagram.com"], youtube: ["youtube.com", "youtu.be"], other: [] };
  let safeUrl = false;
  try {
    const parsed = new URL(url);
    safeUrl = parsed.protocol === "https:" && allowed(platform, Object.keys(domains)) && (platform === "other" || domains[platform].some((domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)));
  } catch { /* invalid URL */ }
  if (!Number.isSafeInteger(campaignId) || campaignId < 1 || !title || !safeUrl) redirect("/portal/partner?clip_error=invalid");
  const db = getDb();
  const [partners] = await db.execute<(RowDataPacket & { id: number })[]>("SELECT id FROM partners WHERE user_id=? AND status='active' ORDER BY id LIMIT 1", [user.id]);
  if (!partners[0]) redirect("/portal/partner?clip_error=profile");
  const [campaigns] = await db.execute<(RowDataPacket & { id: number })[]>("SELECT id FROM campaigns WHERE id=? AND campaign_type='kol_clipping' AND status='active' AND (end_date IS NULL OR end_date>=CURRENT_DATE()) LIMIT 1", [campaignId]);
  if (!campaigns[0]) redirect("/portal/partner?clip_error=closed");
  try {
    await db.execute("INSERT INTO campaign_clips (campaign_id,partner_id,clip_title,platform,post_url,clipper_note) VALUES (?,?,?,?,?,?)", [campaignId, partners[0].id, title, platform, url, note || null]);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") redirect("/portal/partner?clip_error=duplicate");
    throw error;
  }
  revalidatePath("/portal/partner");
  revalidatePath(`/admin/campaign/${campaignId}`);
  redirect("/portal/partner?clip_submitted=1");
}

export async function reviewCampaignClip(d: FormData) {
  if (!(await verifyAdminScope("dm"))) redirect("/admin/login");
  const id = Number(d.get("id"));
  const status = val(d, "status");
  const views = Number(val(d, "views", 20) || 0);
  const note = val(d, "reviewer_note", 1000);
  if (!Number.isSafeInteger(id) || id < 1 || !allowed(status, ["approved", "rejected"]) || !Number.isSafeInteger(views) || views < 0) redirect("/admin/campaign");
  const db = getDb();
  const conn = await db.getConnection();
  let campaignId = 0;
  try {
    await conn.beginTransaction();
    const [clips] = await conn.execute<(RowDataPacket & { campaign_id: number })[]>("SELECT campaign_id FROM campaign_clips WHERE id=? FOR UPDATE", [id]);
    if (!clips[0]) { await conn.rollback(); redirect("/admin/campaign"); }
    campaignId = Number(clips[0].campaign_id);
    const [campaigns] = await conn.execute<(RowDataPacket & { clipping_rate_per_1000: number | string; clipping_budget_cap: number | string | null; clipping_min_views: number })[]>("SELECT clipping_rate_per_1000,clipping_budget_cap,clipping_min_views FROM campaigns WHERE id=? FOR UPDATE", [campaignId]);
    const campaign = campaigns[0];
    if (!campaign) { await conn.rollback(); redirect("/admin/campaign"); }
    if (status === "approved") {
      const [approved] = await conn.execute<(RowDataPacket & { views: number | string })[]>("SELECT views FROM campaign_clips WHERE campaign_id=? AND status='approved' AND id<>?", [campaignId, id]);
      const rate = BigInt(campaign.clipping_rate_per_1000);
      const minViews = BigInt(campaign.clipping_min_views);
      const cap = BigInt(campaign.clipping_budget_cap ?? 0);
      const current = approved.reduce((sum, row) => { const count = BigInt(row.views); return sum + (count >= minViews ? count * rate / BigInt(1000) : BigInt(0)); }, BigInt(0));
      const proposedViews = BigInt(views);
      const proposedReward = proposedViews >= minViews ? proposedViews * rate / BigInt(1000) : BigInt(0);
      if (current + proposedReward > cap) { await conn.rollback(); redirect(`/admin/campaign/${campaignId}?clip_error=budget`); }
    }
    await conn.execute("UPDATE campaign_clips SET status=?,views=?,reviewer_note=?,reviewed_at=NOW() WHERE id=?", [status, views, note || null, id]);
    await conn.commit();
  } catch (error) {
    try { await conn.rollback(); } catch { /* transaction may already be closed */ }
    if (error && typeof error === "object" && "digest" in error) throw error;
    throw error;
  } finally { conn.release(); }
  revalidatePath(`/admin/campaign/${campaignId}`);
  revalidatePath("/admin/analytics");
  revalidatePath("/portal/partner");
  redirect(`/admin/campaign/${campaignId}?clip_reviewed=1`);
}
