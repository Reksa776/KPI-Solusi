import { inflateRawSync } from "node:zlib";

const maxExpandedEntry = 16 * 1024 * 1024;
const decoder = new TextDecoder();

function zipEntry(bytes: Buffer, wanted: string): Buffer | undefined {
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
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (name === wanted) {
      if (expandedSize > maxExpandedEntry) throw new Error("Isi Excel terlalu besar untuk diproses.");
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

function xmlDecode(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code: string) => {
    if (code[0] === "#") {
      const number = code[1]?.toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
    }
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[code.toLowerCase()] ?? entity;
  });
}

function textNodes(xml: string) {
  return Array.from(xml.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/gi), match => xmlDecode(match[1].replace(/<[^>]*>/g, ""))).join("");
}

function attr(tag: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return tag.match(new RegExp(`(?:^|\\s)${escaped}="([^"]*)"`, "i"))?.[1] ?? "";
}

function columnIndex(reference: string) {
  let index = 0;
  for (const char of reference.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "") index = index * 26 + char.charCodeAt(0) - 64;
  return index - 1;
}

export function parseClientWorkbook(bytes: Buffer) {
  const workbook = zipEntry(bytes, "xl/workbook.xml")?.toString("utf8");
  const relationships = zipEntry(bytes, "xl/_rels/workbook.xml.rels")?.toString("utf8");
  if (!workbook || !relationships) throw new Error("Struktur workbook Excel tidak ditemukan.");
  const sheetTag = Array.from(workbook.matchAll(/<sheet\b[^>]*>/gi), match => match[0]).find(tag => attr(tag, "name").trim().toLowerCase() === "data client")
    ?? Array.from(workbook.matchAll(/<sheet\b[^>]*>/gi), match => match[0])[0];
  if (!sheetTag) throw new Error("Sheet data client tidak ditemukan.");
  const relationId = attr(sheetTag, "r:id");
  const relTag = Array.from(relationships.matchAll(/<Relationship\b[^>]*>/gi), match => match[0]).find(tag => attr(tag, "Id") === relationId);
  if (!relTag) throw new Error("Relasi sheet Excel tidak valid.");
  const target = attr(relTag, "Target").replace(/^\//, "");
  const parts = (target.startsWith("xl/") ? target : `xl/${target}`).split("/");
  for (let index = 0; index < parts.length; index++) if (parts[index] === "..") { parts.splice(index - 1, 2); index -= 2; }
  const sheetXml = zipEntry(bytes, parts.join("/"))?.toString("utf8");
  if (!sheetXml) throw new Error("Isi sheet Excel tidak dapat dibaca.");
  const sharedXml = zipEntry(bytes, "xl/sharedStrings.xml")?.toString("utf8") ?? "";
  const shared = Array.from(sharedXml.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/gi), match => textNodes(match[1]));
  const rows = Array.from(sheetXml.matchAll(/<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/gi), rowMatch => {
    const values: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<(?:\w+:)?c\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?c>/gi)) {
      const ref = attr(cellMatch[1], "r");
      const index = columnIndex(ref);
      if (index < 0 || index > 40) continue;
      const type = attr(cellMatch[1], "t");
      const content = cellMatch[2];
      const value = content.match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/i)?.[1] ?? "";
      values[index] = type === "s" ? shared[Number(value)] ?? "" : type === "inlineStr" ? textNodes(content) : xmlDecode(value);
    }
    return values;
  });
  return rows;
}
