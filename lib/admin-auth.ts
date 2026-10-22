import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { promisify } from "node:util";
import { scrypt as scryptCallback } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { getDb } from "@/lib/db";

const COOKIE_NAME = "ss_admin_session";
const PORTAL_COOKIE_NAME = "ss_user_session";
const SESSION_SECONDS = 60 * 60 * 8;
const scrypt = promisify(scryptCallback);
export type UserRole = "superadmin" | "admin" | "kliper" | "buzzer" | "brand" | "viewer";
export type AdminScope = "dm" | "dae" | "both";
type UserRow = RowDataPacket & { id:number;password_hash?:string;role:UserRole;admin_scope?:AdminScope;full_name?:string;email?:string;session_version?:number };

function sign(payload: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET belum disetel.");
  return createHmac("sha256", secret).update(payload).digest("hex");
}
function safeEqual(left:string,right:string){const a=Buffer.from(left);const b=Buffer.from(right);return a.length===b.length&&timingSafeEqual(a,b)}

export async function getAdminSessionUser(): Promise<UserRow|null> { return readSession(COOKIE_NAME, ["superadmin","admin"]); }
export async function getViewerSessionUser(): Promise<UserRow|null> { return readSession(PORTAL_COOKIE_NAME, ["viewer"]); }
export async function verifyAdminSession(){return Boolean(await getAdminSessionUser())}
export async function verifyOwnerSession(){return (await getAdminSessionUser())?.role==="superadmin"}
export async function verifyAdminScope(scope:Exclude<AdminScope,"both">){const user=await getAdminSessionUser();return Boolean(user&&(user.role==="superadmin"||user.admin_scope==="both"||user.admin_scope===scope))}
export async function verifyAdminAnyScope(scopes:Exclude<AdminScope,"both">[]){const user=await getAdminSessionUser();return Boolean(user&&(user.role==="superadmin"||user.admin_scope==="both"||(user.admin_scope!==undefined&&(scopes as string[]).includes(user.admin_scope))))}

async function readSession(cookieName:string, roles:UserRole[]){
  const store=await cookies(),value=store.get(cookieName)?.value;
  if(!value||!process.env.ADMIN_SESSION_SECRET)return null;
  const[userId,versionPart,expiryPart,signaturePart]=value.split(".");
  const legacy=signaturePart===undefined,version=legacy?0:Number(versionPart),expiry=legacy?versionPart:expiryPart,signature=legacy?expiryPart:signaturePart;
  if(!userId||!/^\d+$/.test(userId)||!expiry||!signature||!Number.isSafeInteger(version)||Number(expiry)<=Math.floor(Date.now()/1000))return null;
  try{
    const payload=legacy?`${userId}.${expiry}`:`${userId}.${version}.${expiry}`;
    if(!safeEqual(signature,sign(payload)))return null;
    const[users]=await getDb().execute<UserRow[]>("SELECT id,full_name,email,role,admin_scope,session_version FROM users WHERE id=? AND status='active' LIMIT 1",[Number(userId)]);
    const user=users[0];if(!user||!roles.includes(user.role)||Number(user.session_version??0)!==version)return null;return user;
  }catch{return null}
}

async function createSession(cookieName:string,userId:number,roles:UserRole[]){
  const[rows]=await getDb().execute<UserRow[]>("SELECT session_version,role FROM users WHERE id=? AND status='active' LIMIT 1",[userId]);
  if(!rows[0]||!roles.includes(rows[0].role))throw new Error("Akun tidak tersedia untuk sesi ini.");
  const expiry=String(Math.floor(Date.now()/1000)+SESSION_SECONDS),payload=`${userId}.${Number(rows[0].session_version??0)}.${expiry}`,store=await cookies();
  store.set(cookieName,`${payload}.${sign(payload)}`,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:SESSION_SECONDS});
}
export async function createAdminSession(userId:number){return createSession(COOKIE_NAME,userId,["superadmin","admin"])}
export async function createPortalSession(userId:number){return createSession(PORTAL_COOKIE_NAME,userId,["kliper","buzzer","brand","viewer"])}
export async function clearAdminSession(){const store=await cookies();store.delete(COOKIE_NAME);store.delete(PORTAL_COOKIE_NAME)}
export async function verifyPortalSession(role:"brand"|"buzzer"|"kliper"|"viewer"){return readSession(PORTAL_COOKIE_NAME,[role])}
export async function verifyPartnerPortalSession(){return readSession(PORTAL_COOKIE_NAME,["buzzer","kliper"])}

export async function authenticateUser(email:string,password:string){
  const[users]=await getDb().execute<UserRow[]>("SELECT id,password_hash,role,admin_scope FROM users WHERE email=? AND status='active' LIMIT 1",[email.toLowerCase()]);
  const user=users[0];if(!user?.password_hash)return null;
  const[scheme,salt,expected]=user.password_hash.split("$");if(scheme!=="scrypt"||!salt||!expected)return null;
  const actual=await scrypt(password,salt,64) as Buffer;
  return safeEqual(actual.toString("hex"),expected)?{id:user.id,role:user.role,admin_scope:user.admin_scope??"both"}:null;
}
