import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import type { RowDataPacket } from "@/lib/db-types";
import { verifyAdminScope } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { monthWeekStartForDate } from "@/lib/dae-weeks";
import { parseReportDate } from "@/lib/report-date";
import { parseDmPerformanceExcel, type DmExcelMetric } from "@/lib/dm-performance-xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const maxUpload = 20 * 1024 * 1024;
const maxRows = 3000;
type Member = RowDataPacket & { id: number | string | bigint; full_name: string };
type Assignment = RowDataPacket & { dm_team_member_id: number | string | bigint; agency_client_id: number | string | bigint; client_name: string; client_type: string };
type Existing = RowDataPacket & { activity_date: string | Date };

function validMetric(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function validDate(value: unknown): value is string { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && parseReportDate(value) === value; }

async function preview(file: File) {
  if (!file.size || file.size > maxUpload || !file.name.toLowerCase().endsWith(".xlsx")) return NextResponse.json({ error: "Pilih file Excel .xlsx maksimal 20 MB." }, { status: 400 });
  const db = getDb();
  const [[memberRows], [assignmentRows]] = await Promise.all([
    db.execute<Member[]>("SELECT id,full_name FROM dm_team_members ORDER BY full_name LIMIT 500"),
    db.execute<Assignment[]>("SELECT a.dm_team_member_id,a.agency_client_id,c.client_name,c.client_type FROM dm_client_assignments a JOIN agency_clients c ON c.id=a.agency_client_id ORDER BY c.client_name"),
  ]);
  const members = memberRows.map(row => ({ id: Number(row.id), full_name: row.full_name }));
  const assignments = assignmentRows.map(row => ({ dm_team_member_id: Number(row.dm_team_member_id), agency_client_id: Number(row.agency_client_id), client_name: row.client_name, client_type: row.client_type }));
  const parsed = parseDmPerformanceExcel(Buffer.from(await file.arrayBuffer()), members, assignments);
  if (!parsed.rows.length) return NextResponse.json({ error: "Tidak ada data per client dan tanggal yang cocok untuk diimpor.", warnings: parsed.warnings, sheets: parsed.sheets }, { status: 422 });
  const existingKeys = new Set<string>(), pairs = new Map<string, { dmId: number; clientId: number; dates: Set<string> }>();
  for (const row of parsed.rows) { const key = `${row.dmId}:${row.clientId}`, pair = pairs.get(key) ?? { dmId: row.dmId, clientId: row.clientId, dates: new Set<string>() }; pair.dates.add(row.date); pairs.set(key, pair); }
  for (const pair of pairs.values()) {
    const dates = [...pair.dates];
    for (let offset = 0; offset < dates.length; offset += 400) {
      const batch = dates.slice(offset, offset + 400), placeholders = batch.map(() => "?").join(",");
      const [found] = await db.execute<Existing[]>(`SELECT activity_date FROM team_activity_entries WHERE entry_type='dm_client' AND input_frequency='daily' AND dm_team_member_id=? AND agency_client_id=? AND activity_date IN (${placeholders})`, [pair.dmId, pair.clientId, ...batch]);
      for (const item of found) { const date = typeof item.activity_date === "string" ? item.activity_date.slice(0, 10) : item.activity_date.toISOString().slice(0, 10); existingKeys.add(`${pair.dmId}:${pair.clientId}:${date}`); }
    }
  }
  return NextResponse.json({ rows: parsed.rows.map(row => ({ ...row, willUpdate: existingKeys.has(`${row.dmId}:${row.clientId}:${row.date}`) })), warnings: parsed.warnings, sheets: parsed.sheets }, { headers: { "Cache-Control": "no-store" } });
}

async function commitRows(input: unknown) {
  const rows = (input as { rows?: unknown })?.rows;
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > maxRows) return NextResponse.json({ error: `Data pratinjau tidak valid. Batas impor ${maxRows.toLocaleString("id-ID")} baris.` }, { status: 400 });
  const safeRows: DmExcelMetric[] = [];
  for (const value of rows) {
    const row = value as Partial<DmExcelMetric>;
    if (!Number.isSafeInteger(row.dmId) || Number(row.dmId) < 1 || !Number.isSafeInteger(row.clientId) || Number(row.clientId) < 1 || !validDate(row.date) || !validMetric(row.contents) || !validMetric(row.views)) return NextResponse.json({ error: "Ada baris pratinjau yang berubah atau tidak valid. Unggah ulang file Excel." }, { status: 400 });
    safeRows.push({ dmId: Number(row.dmId), dmName: "", clientId: Number(row.clientId), clientName: "", clientType: "", date: row.date, contents: row.contents, views: row.views });
  }
  const unique = new Map<string, DmExcelMetric>();
  for (const row of safeRows) unique.set(`${row.dmId}:${row.clientId}:${row.date}`, row);
  const metrics = [...unique.values()], db = getDb();
  const dmIds = [...new Set(metrics.map(row => row.dmId))], placeholders = dmIds.map(() => "?").join(",");
  const [[members], [assignmentRows]] = await Promise.all([
    db.execute<Member[]>(`SELECT id,full_name FROM dm_team_members WHERE id IN (${placeholders})`, dmIds),
    db.execute<Assignment[]>(`SELECT a.dm_team_member_id,a.agency_client_id,c.client_name,c.client_type FROM dm_client_assignments a JOIN agency_clients c ON c.id=a.agency_client_id WHERE a.dm_team_member_id IN (${placeholders})`, dmIds),
  ]);
  const dmNames = new Map(members.map(member => [Number(member.id), member.full_name]));
  const assignments = new Map(assignmentRows.map(row => [`${Number(row.dm_team_member_id)}:${Number(row.agency_client_id)}`, { name: row.client_name, type: row.client_type }]));
  if (metrics.some(row => !dmNames.has(row.dmId) || !assignments.has(`${row.dmId}:${row.clientId}`))) return NextResponse.json({ error: "Pasangan DM-client sudah berubah. Unggah ulang file untuk membuat pratinjau terbaru." }, { status: 409 });
  let inserted = 0, overwritten = 0;
  await db.transaction(async tx => {
    for (const row of metrics) {
      const dmName = dmNames.get(row.dmId)!, client = assignments.get(`${row.dmId}:${row.clientId}`)!, weekStart = monthWeekStartForDate(row.date) ?? row.date;
      const title = `Performa Excel · ${dmName} · ${client.name}`;
      const [existing] = await tx.execute<(RowDataPacket & { id: number })[]>("SELECT id FROM team_activity_entries WHERE entry_type='dm_client' AND input_frequency='daily' AND dm_team_member_id=? AND agency_client_id=? AND activity_date=? ORDER BY id FOR UPDATE", [row.dmId, row.clientId, row.date]);
      if (existing[0]) {
        await tx.execute("UPDATE team_activity_entries SET title=?,client_name=?,client_type=?,contents=?,video_views=?,week_start=? WHERE id=?", [title, client.name, client.type, row.contents, row.views, weekStart, existing[0].id]);
        overwritten++;
        for (const duplicate of existing.slice(1)) { await tx.execute("UPDATE team_activity_entries SET contents=0,video_views=0 WHERE id=?", [duplicate.id]); overwritten++; }
      } else {
        await tx.execute("INSERT INTO team_activity_entries (scope,entry_type,title,client_name,client_type,agency_client_id,activity_date,week_start,input_frequency,contents,video_views,tiktok_sales,shopee_sales,new_clients,strategies,visits,dm_team_member_id,dm_person) VALUES ('dm','dm_client',?,?,?,?,?,?, 'daily', ?,?,0,0,0,0,0,?,?)", [title, client.name, client.type, row.clientId, row.date, weekStart, row.contents, row.views, row.dmId, dmName]);
        inserted++;
      }
    }
  });
  revalidatePath("/admin/kpi/input/dm_client"); revalidatePath("/admin/kpi/input/dm_team"); revalidatePath("/admin/kpi"); revalidatePath("/admin/kpi/client"); revalidatePath("/performa/dm"); revalidatePath("/admin");
  return NextResponse.json({ inserted, overwritten, total: metrics.length });
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdminScope("dm"))) return NextResponse.json({ error: "Sesi admin DM tidak valid." }, { status: 401 });
  if (request.headers.get("content-type")?.includes("application/json")) {
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > 1_000_000) return NextResponse.json({ error: "Data pratinjau terlalu besar. Pecah file sebelum impor." }, { status: 413 });
    try { return await commitRows(await request.json()); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Data belum dapat dimasukkan." }, { status: 400 }); }
  }
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Upload file tidak terbaca." }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Pilih file Excel terlebih dahulu." }, { status: 400 });
  try { return await preview(file); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "File Excel tidak dapat dibaca." }, { status: 400 }); }
}
