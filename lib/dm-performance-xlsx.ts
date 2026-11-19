import { inflateRawSync } from "node:zlib";
import { parseReportDate } from "@/lib/report-date";

type Sheet = { name: string; rows: string[][] };
type Dm = { id: number; full_name: string };
type Assignment = { dm_team_member_id: number; agency_client_id: number; client_name: string; client_type: string };
export type DmExcelMetric = { dmId: number; dmName: string; clientId: number; clientName: string; clientType: string; date: string; contents: number; views: number };
export type DmExcelCoverage = { dmId: number; dmName: string; clientId: number; clientName: string; start: string; end: string };
const decoder = new TextDecoder();
const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

function zipEntry(bytes: Buffer, wanted: string) {
  let end = -1;
  for (let offset = Math.max(0, bytes.length - 65557); offset <= bytes.length - 22; offset++) if (bytes.readUInt32LE(offset) === 0x06054b50) end = offset;
  if (end < 0) throw new Error("File Excel tidak valid.");
  const count = bytes.readUInt16LE(end + 10);
  let cursor = bytes.readUInt32LE(end + 16);
  for (let index = 0; index < count; index++) {
    if (bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Struktur Excel tidak valid.");
    const method = bytes.readUInt16LE(cursor + 10), compressedSize = bytes.readUInt32LE(cursor + 20), expandedSize = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28), extraLength = bytes.readUInt16LE(cursor + 30), commentLength = bytes.readUInt16LE(cursor + 32);
    const localOffset = bytes.readUInt32LE(cursor + 42), name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (name === wanted) {
      if (expandedSize > 32 * 1024 * 1024) throw new Error("Isi file Excel terlalu besar untuk dibaca.");
      const localNameLength = bytes.readUInt16LE(localOffset + 26), localExtraLength = bytes.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength, compressed = bytes.subarray(start, start + compressedSize);
      if (method === 0) return compressed;
      if (method === 8) return inflateRawSync(compressed, { maxOutputLength: 32 * 1024 * 1024 });
      throw new Error("Metode kompresi Excel tidak didukung.");
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return undefined;
}
function decodeXml(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code: string) => {
    if (code[0] === "#") { const number = code[1]?.toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10); return Number.isFinite(number) ? String.fromCodePoint(number) : entity; }
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[code.toLowerCase()] ?? entity;
  });
}
function attribute(tag: string, name: string) {
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) if (match[1] === name) return decodeXml(match[2] ?? match[3] ?? "");
  return "";
}
function xmlText(xml: string) { return decodeXml(xml.replace(/<[^>]*>/g, "")); }
function columnIndex(reference: string) { let value = 0; for (const char of reference.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "") value = value * 26 + char.charCodeAt(0) - 64; return value - 1; }
function parseWorkbook(bytes: Buffer): Sheet[] {
  const workbook = zipEntry(bytes, "xl/workbook.xml"), relationships = zipEntry(bytes, "xl/_rels/workbook.xml.rels");
  if (!workbook || !relationships) throw new Error("Struktur workbook Excel tidak ditemukan.");
  const rels = new Map(Array.from(relationships.toString("utf8").matchAll(/<Relationship\b[^>]*>/g), match => [attribute(match[0], "Id"), attribute(match[0], "Target")]));
  const sharedXml = zipEntry(bytes, "xl/sharedStrings.xml")?.toString("utf8") ?? "";
  const shared = Array.from(sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g), match => xmlText(match[1]));
  return Array.from(workbook.toString("utf8").matchAll(/<sheet\b[^>]*>/g), match => match[0]).flatMap(tag => {
    const name = attribute(tag, "name"), target = rels.get(attribute(tag, "r:id"));
    if (!target) return [];
    const path = (target.startsWith("/") ? target.slice(1) : `xl/${target}`).split("/").reduce<string[]>((parts, part) => part === ".." ? parts.slice(0, -1) : part === "." || !part ? parts : [...parts, part], []).join("/");
    const xml = zipEntry(bytes, path); if (!xml) return [];
    const rows = Array.from(xml.toString("utf8").matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g), rowMatch => {
      const values: string[] = [];
      for (const cell of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const index = columnIndex(attribute(cell[1], "r")); if (index < 0) continue;
        const type = attribute(cell[1], "t"), raw = cell[2].match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "";
        values[index] = type === "s" ? shared[Number(raw)] ?? "" : type === "inlineStr" ? xmlText(cell[2]) : decodeXml(raw);
      }
      return values;
    });
    return [{ name, rows }];
  });
}
function dateValue(value: string, year: number) { return parseReportDate(value, year); }
function numberValue(value: string) {
  const direct = Number(value.trim());
  if (Number.isSafeInteger(direct) && direct >= 0) return direct;
  const digits = Number(value.replace(/[^\d-]/g, ""));
  return Number.isSafeInteger(digits) && digits >= 0 ? digits : 0;
}

export function parseDmPerformanceExcel(bytes: Buffer, dms: Dm[], assignments: Assignment[]) {
  const sheets = parseWorkbook(bytes), sheetByName = new Map(sheets.map(sheet => [normalize(sheet.name), sheet]));
  const year = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Jakarta", year: "numeric" }).format(new Date()));
  const warnings: string[] = [], records = new Map<string, DmExcelMetric>(), coverage = new Map<string, DmExcelCoverage>();
  const byDm = new Map<number, Assignment[]>();
  for (const assignment of assignments) { const items = byDm.get(Number(assignment.dm_team_member_id)) ?? []; items.push(assignment); byDm.set(Number(assignment.dm_team_member_id), items); }
  for (const dm of dms) {
    const sheet = sheetByName.get(normalize(dm.full_name));
    if (!sheet) { warnings.push(`Tab ${dm.full_name} tidak ada di file.`); continue; }
    const clients = byDm.get(Number(dm.id)) ?? [];
    if (!clients.length) { warnings.push(`${dm.full_name}: belum ada pasangan client yang ditugaskan di aplikasi.`); continue; }
    const resolve = (value: string) => {
      const candidate = normalize(value);
      if (!candidate || candidate.length > 32) return undefined;
      const exact = clients.filter(client => normalize(client.client_name) === candidate);
      if (exact.length === 1) return exact[0];
      const partial = clients.filter(client => { const name = normalize(client.client_name); return name.length >= 3 && (name.includes(candidate) || candidate.includes(name)); });
      return partial.length === 1 ? partial[0] : undefined;
    };
    // In this workbook each client is a separate section: its title is in column A,
    // followed by a header row for Tanggal and a nearby header row for Views/Upload.
    // Only accept these section titles; matching arbitrary cells can mistake weekly
    // summaries or monitoring panels for client boundaries and attach wrong dates.
    const blocks: { titleIndex: number; dataStart: number; title: string; client?: Assignment }[] = [];
    for (let index = 0; index < sheet.rows.length; index++) {
      const title = (sheet.rows[index]?.[0] ?? "").trim();
      if (!title) continue;
      const headerOffset = [1, 2, 3].find(offset => {
        const header = sheet.rows[index + offset] ?? [];
        const headers = sheet.rows.slice(index + offset, index + offset + 2).flat();
        return ["tanggal", "date"].includes(normalize(header[1] ?? "")) &&
          headers.some(value => ["views", "view", "tayangan"].includes(normalize(value ?? ""))) &&
          headers.some(value => ["jumlahupload", "jumlahkonten", "konten"].includes(normalize(value ?? "")));
      });
      if (headerOffset) blocks.push({ titleIndex: index, dataStart: index + headerOffset + 2, title, client: resolve(title) });
    }
    let tabRows = 0;
    for (let index = 0; index < blocks.length; index++) {
      const block = blocks[index], end = blocks[index + 1]?.titleIndex ?? sheet.rows.length;
      const sourceRows = sheet.rows.slice(block.dataStart, end).flatMap(row => {
        const date = dateValue(row[1] ?? "", year);
        return date ? [{ row, date }] : [];
      });
      const populated = sourceRows.filter(({ row }) => (row[2] ?? "").trim() !== "" || (row[5] ?? "").trim() !== "");
      if (!populated.length) continue;
      if (!block.client) { warnings.push(`${dm.full_name}: judul client "${block.title}" memiliki data, tetapi tidak cocok dengan pasangan client di aplikasi.`); continue; }
      // The workbook is organized by month, but its weekly template can carry
      // blank date rows into the following month. Scope replacement to the month
      // that actually contains this client's entered metrics.
      const monthCounts = new Map<string, number>();
      for (const item of populated) monthCounts.set(item.date.slice(0, 7), (monthCounts.get(item.date.slice(0, 7)) ?? 0) + 1);
      const sourceMonth = [...monthCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
      const [monthYear, monthNumber] = sourceMonth.split("-").map(Number);
      const monthStart = `${sourceMonth}-01`, monthEnd = `${sourceMonth}-${String(new Date(Date.UTC(monthYear, monthNumber, 0)).getUTCDate()).padStart(2, "0")}`;
      const coverageKey = `${dm.id}:${block.client.agency_client_id}`;
      const priorCoverage = coverage.get(coverageKey);
      coverage.set(coverageKey, { dmId: Number(dm.id), dmName: dm.full_name, clientId: Number(block.client.agency_client_id), clientName: block.client.client_name, start: priorCoverage && priorCoverage.start < monthStart ? priorCoverage.start : monthStart, end: priorCoverage && priorCoverage.end > monthEnd ? priorCoverage.end : monthEnd });
      for (const { row, date } of populated) {
        if (!date.startsWith(`${sourceMonth}-`)) continue;
        const metric: DmExcelMetric = { dmId: Number(dm.id), dmName: dm.full_name, clientId: Number(block.client.agency_client_id), clientName: block.client.client_name, clientType: block.client.client_type, date, contents: numberValue(row[5] ?? ""), views: numberValue(row[2] ?? "") };
        records.set(`${metric.dmId}:${metric.clientId}:${metric.date}`, metric); tabRows++;
      }
    }
    if (!tabRows) warnings.push(`${dm.full_name}: tidak ada judul client yang cocok dengan pasangan client di aplikasi atau tanggal valid di kolom B.`);
  }
  const values = [...records.values()].sort((a, b) => a.date.localeCompare(b.date) || a.dmName.localeCompare(b.dmName, "id") || a.clientName.localeCompare(b.clientName, "id"));
  if (values.length > 3000) throw new Error("File berisi lebih dari 3.000 baris performa. Pecah file per periode sebelum impor.");
  return { rows: values, coverage: [...coverage.values()], warnings, sheets: sheets.map(sheet => sheet.name) };
}
