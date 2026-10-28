import { deflateRawSync } from "node:zlib";

export type ExcelCell = string | number | boolean | null | undefined;
export type ExcelSheet = { name: string; rows: ExcelCell[][]; autoFilterRange?:string; listValidations?: { column:number; fromRow:number; toRow:number; options?:string[]; formula?:string; prompt?:string }[] };

const xml = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
function columnName(value: number) { let name = ""; for (let current = value; current > 0; current = Math.floor((current - 1) / 26)) name = String.fromCharCode(65 + ((current - 1) % 26)) + name; return name; }
function worksheet(sheet: ExcelSheet) {
  const rows = sheet.rows.map((values, rowIndex) => `<row r="${rowIndex + 1}">${values.map((value, columnIndex) => {
    if (value === null || value === undefined || value === "") return "";
    const reference = `${columnName(columnIndex + 1)}${rowIndex + 1}`;
    if (typeof value === "number" && Number.isFinite(value)) return `<c r="${reference}"><v>${value}</v></c>`;
    if (typeof value === "boolean") return `<c r="${reference}" t="b"><v>${value ? 1 : 0}</v></c>`;
    return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xml(String(value))}</t></is></c>`;
  }).join("")}</row>`).join("");
  const validListValidations=sheet.listValidations?.filter(item=>item.column>0&&item.fromRow>0&&item.toRow>=item.fromRow&&Boolean(item.formula||item.options?.length))??[];
  const validations=validListValidations.map(item=>`<dataValidation type="list" allowBlank="1" showErrorMessage="1" showInputMessage="1"${item.prompt?` promptTitle="Pilih jenis client" prompt="${xml(item.prompt)}"`:""} sqref="${columnName(item.column)}${item.fromRow}:${columnName(item.column)}${item.toRow}"><formula1>${item.formula?xml(item.formula):`"${xml((item.options??[]).join(","))}"`}</formula1></dataValidation>`).join("");
  const dataValidations=validations?`<dataValidations count="${validListValidations.length}">${validations}</dataValidations>`:"";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><sheetData>${rows}</sheetData><autoFilter ref="${sheet.autoFilterRange??`A1:${columnName(Math.max(1, ...sheet.rows.map(row => row.length)))}${Math.max(1, sheet.rows.length)}`}"/>${dataValidations}</worksheet>`;
}
const crcTable = (() => { const table = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; } return table; })();
function crc32(value: Buffer) { let crc = 0xffffffff; for (const byte of value) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function zip(files: Array<{ name: string; data: Buffer }>) {
  const locals: Buffer[] = [], centrals: Buffer[] = []; let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name), compressed = deflateRawSync(file.data), checksum = crc32(file.data);
    const local = Buffer.alloc(30 + name.length); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8); local.writeUInt32LE(checksum, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(file.data.length, 22); local.writeUInt16LE(name.length, 26); name.copy(local, 30); locals.push(local, compressed);
    const central = Buffer.alloc(46 + name.length); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10); central.writeUInt32LE(checksum, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(file.data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42); name.copy(central, 46); centrals.push(central); offset += local.length + compressed.length;
  }
  const centralBytes = Buffer.concat(centrals), localBytes = Buffer.concat(locals), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(centralBytes.length, 12); end.writeUInt32LE(localBytes.length, 16);
  return Buffer.concat([localBytes, centralBytes, end]);
}

export function buildXlsx(sheets: ExcelSheet[]) {
  const safeSheets = sheets.slice(0, 20).map((sheet, index) => ({ ...sheet, name: (sheet.name.replace(/[\\/?*:[\]]/g, " ").trim().slice(0, 31) || `Sheet${index + 1}`) }));
  const sheetTags = safeSheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const relations = safeSheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const overrides = safeSheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const files = [
    { name: "[Content_Types].xml", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`) },
    { name: "_rels/.rels", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: "xl/workbook.xml", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetTags}</sheets></workbook>`) },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relations}</Relationships>`) },
    ...safeSheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: Buffer.from(worksheet(sheet)) })),
  ];
  return zip(files);
}
