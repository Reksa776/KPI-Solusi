import { inflateRawSync } from "node:zlib";
import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminScope } from "@/lib/admin-auth";

export const runtime = "nodejs";
const maxUpload = 12 * 1024 * 1024;
const maxExpandedEntry = 24 * 1024 * 1024;
const encoder = new TextDecoder();
const monthNumbers: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function zipEntry(bytes: Buffer, wanted: string) {
  let end = -1;
  for (let offset = Math.max(0, bytes.length - 65_557); offset <= bytes.length - 22; offset++) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) end = offset;
  }
  if (end < 0) throw new Error("File Excel tidak valid.");
  const count = bytes.readUInt16LE(end + 10);
  let cursor = bytes.readUInt32LE(end + 16);
  for (let index = 0; index < count; index++) {
    if (bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Struktur Excel tidak valid.");
    const method = bytes.readUInt16LE(cursor + 10);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const expandedSize = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const name = encoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (name === wanted) {
      if (expandedSize > maxExpandedEntry) throw new Error("Isi file Excel terlalu besar untuk dibaca.");
      const localNameLength = bytes.readUInt16LE(localOffset + 26);
      const localExtraLength = bytes.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.subarray(start, start + compressedSize);
      if (method === 0) return compressed;
      if (method === 8) return inflateRawSync(compressed, { maxOutputLength: maxExpandedEntry });
      throw new Error("Metode kompresi Excel tidak didukung.");
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return undefined;
}

function decodeXml(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code: string) => {
    if (code[0] === "#") {
      const numeric = code[1]?.toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : entity;
    }
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[code.toLowerCase()] ?? entity;
  });
}

function attribute(tag: string, name: string) {
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    if (match[1] === name) return decodeXml(match[2] ?? match[3] ?? "");
  }
  return "";
}

function xmlText(xml: string) {
  return decodeXml(xml.replace(/<[^>]*>/g, ""));
}

function columnIndex(reference: string) {
  let result = 0;
  for (const char of reference.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "") result = result * 26 + char.charCodeAt(0) - 64;
  return result - 1;
}

function parseViewRows(bytes: Buffer) {
  const workbook = zipEntry(bytes, "xl/workbook.xml");
  const rels = zipEntry(bytes, "xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new Error("Struktur workbook Excel tidak ditemukan.");
  const sheetTag = workbook.toString("utf8").match(/<sheet\b[^>]*\bname\s*=\s*(["'])Viewers\1[^>]*>/i)?.[0];
  if (!sheetTag) throw new Error("Sheet Viewers tidak ditemukan di file.");
  const relationshipId = attribute(sheetTag, "r:id");
  const relationTag = Array.from(rels.toString("utf8").matchAll(/<Relationship\b[^>]*>/g), match => match[0]).find(tag => attribute(tag, "Id") === relationshipId);
  if (!relationTag) throw new Error("Relasi sheet Viewers tidak ditemukan.");
  const target = attribute(relationTag, "Target");
  const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  const normalizedPath = path.split("/").reduce<string[]>((parts, part) => part === ".." ? parts.slice(0, -1) : part === "." || !part ? parts : [...parts, part], []).join("/");
  const sheet = zipEntry(bytes, normalizedPath);
  if (!sheet) throw new Error("Data sheet Viewers tidak dapat dibaca.");

  const sharedXml = zipEntry(bytes, "xl/sharedStrings.xml")?.toString("utf8") ?? "";
  const shared = Array.from(sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g), match => xmlText(match[1]));
  const sheetXml = sheet.toString("utf8");
  const rows = Array.from(sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g), rowMatch => {
    const values: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const ref = attribute(cellMatch[1], "r");
      const index = columnIndex(ref);
      if (index < 0) continue;
      const type = attribute(cellMatch[1], "t");
      const value = cellMatch[2].match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "";
      values[index] = type === "s" ? shared[Number(value)] ?? "" : type === "inlineStr" ? xmlText(cellMatch[2]) : decodeXml(value);
    }
    return values;
  });
  const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const headerIndex = rows.findIndex(row => row.some(value => normalize(value).includes("date")) && row.some(value => normalize(value).includes("total viewers")));
  if (headerIndex < 0) throw new Error("Kolom Date dan Total Viewers tidak ditemukan.");
  const dateIndex = rows[headerIndex].findIndex(value => normalize(value).includes("date"));
  const viewersIndex = rows[headerIndex].findIndex(value => normalize(value).includes("total viewers"));
  return rows.slice(headerIndex + 1).flatMap(row => {
    const date = row[dateIndex]?.trim() ?? "";
    const rawValue = row[viewersIndex]?.replace(/,/g, "").trim() ?? "";
    if (!date) return [];
    return [{ date, value: /^\d+$/.test(rawValue) ? Number(rawValue) : 0 }];
  });
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdminScope("dm"))) return NextResponse.json({ error: "Sesi admin DM tidak valid." }, { status: 401 });
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Upload file tidak terbaca." }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > maxUpload || !file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "Pilih file Excel .xlsx maksimal 12 MB." }, { status: 400 });
  }
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const year = new Date().getUTCFullYear();
    const results = parseViewRows(bytes).flatMap(({ date, value }) => {
      const match = date.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b/i);
      if (!match) return [];
      const month = monthNumbers[match[1].toLowerCase()];
      const day = Number(match[2]);
      const formatted = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const parsed = new Date(`${formatted}T00:00:00Z`);
      return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === formatted ? [{ date: formatted, value }] : [];
    });
    if (!results.length) return NextResponse.json({ error: "Tidak ada tanggal dan Total Viewers yang valid di sheet Viewers." }, { status: 422 });
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "File Excel tidak dapat dibaca.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
