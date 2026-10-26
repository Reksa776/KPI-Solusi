"use client";

import { useId, useState, type ChangeEvent } from "react";

type Metrics={contents:number;video_views:number;tiktok_sales:number;shopee_sales:number};
type Report={name:string;headers:string[];rows:string[][];notice?:string};
type Sheet={name:string;rows:string[][]};
const headerScore=(header:string,terms:string[])=>{const value=header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");return terms.reduce((score,term)=>score+(value.includes(term)?term.length:0),0)};
function parseCsv(content:string):string[][]{
  const source=content.replace(/^\uFEFF/,"").replace(/\r\n?/g,"\n"),first=source.split("\n",1)[0]??"";
  const commas=(first.match(/,/g)??[]).length,semicolons=(first.match(/;/g)??[]).length,tabs=(first.match(/\t/g)??[]).length,delimiter=semicolons>commas&&semicolons>=tabs?";":tabs>commas?"\t":",";
  const rows:string[][]=[];let row:string[]=[],cell="",quoted=false;
  for(let i=0;i<source.length;i++){const char=source[i];if(char==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(char===delimiter&&!quoted){row.push(cell.trim());cell=""}else if(char==="\n"&&!quoted){row.push(cell.trim());if(row.some(value=>value!==""))rows.push(row);row=[];cell=""}else cell+=char}
  row.push(cell.trim());if(row.some(value=>value!==""))rows.push(row);return rows;
}
async function unzipEntry(file:Uint8Array,name:string){
  const view=new DataView(file.buffer,file.byteOffset,file.byteLength);let end=-1;
  for(let i=Math.max(0,file.byteLength-65557);i<=file.byteLength-22;i++)if(view.getUint32(i,true)===0x06054b50)end=i;
  if(end<0)throw new Error("File Excel tidak valid");
  const count=view.getUint16(end+10,true),directoryOffset=view.getUint32(end+16,true),decoder=new TextDecoder();let cursor=directoryOffset;
  for(let i=0;i<count;i++){
    if(view.getUint32(cursor,true)!==0x02014b50)throw new Error("Daftar isi Excel tidak valid");
    const method=view.getUint16(cursor+10,true),compressedSize=view.getUint32(cursor+20,true),nameLength=view.getUint16(cursor+28,true),extraLength=view.getUint16(cursor+30,true),commentLength=view.getUint16(cursor+32,true),localOffset=view.getUint32(cursor+42,true),entryName=decoder.decode(file.subarray(cursor+46,cursor+46+nameLength));
    if(entryName===name){const localNameLength=view.getUint16(localOffset+26,true),localExtraLength=view.getUint16(localOffset+28,true),start=localOffset+30+localNameLength+localExtraLength,compressed=file.slice(start,start+compressedSize);if(method===0)return compressed;if(method===8){const stream=new Blob([compressed.buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));return new Uint8Array(await new Response(stream).arrayBuffer())}throw new Error("Metode kompresi Excel tidak didukung")}
    cursor+=46+nameLength+extraLength+commentLength;
  }
  return undefined;
}
const xmlText=(element:Element)=>Array.from(element.getElementsByTagNameNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main","t")).map(node=>node.textContent??"").join("");
function columnIndex(ref:string){let index=0;for(const char of ref.match(/^[A-Z]+/i)?.[0].toUpperCase()??"")index=index*26+char.charCodeAt(0)-64;return index-1}
async function parseXlsx(file:File):Promise<Sheet[]>{
  const bytes=new Uint8Array(await file.arrayBuffer()),decoder=new TextDecoder(),readXml=async(name:string)=>{const data=await unzipEntry(bytes,name);return data?new DOMParser().parseFromString(decoder.decode(data),"application/xml"):undefined};
  const workbook=await readXml("xl/workbook.xml"),relationships=await readXml("xl/_rels/workbook.xml.rels");if(!workbook||!relationships)throw new Error("Tidak menemukan struktur workbook Excel");
  const rels=new Map(Array.from(relationships.getElementsByTagNameNS("http://schemas.openxmlformats.org/package/2006/relationships","Relationship")).map(rel=>[rel.getAttribute("Id")??"",rel.getAttribute("Target")??""]));
  const sharedXml=await readXml("xl/sharedStrings.xml"),shared=sharedXml?Array.from(sharedXml.getElementsByTagNameNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main","si")).map(xmlText):[];
  const sheetNodes=Array.from(workbook.getElementsByTagNameNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main","sheet"));
  return Promise.all(sheetNodes.map(async sheet=>{const id=sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id")??"",target=rels.get(id)??"",parts=["xl",target.replace(/^\//,"")].join("/").split("/");for(let i=0;i<parts.length;i++)if(parts[i]==="..")parts.splice(i-1,2),i-=2;const path=target.startsWith("/")?target.slice(1):parts.join("/");const xml=await readXml(path);if(!xml)throw new Error(`Sheet ${sheet.getAttribute("name")} tidak dapat dibaca`);const rows=Array.from(xml.getElementsByTagNameNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main","row")).map(rowNode=>{const cells=Array.from(rowNode.getElementsByTagNameNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main","c"));const values:string[]=[];for(const cell of cells){const index=columnIndex(cell.getAttribute("r")??"");if(index<0)continue;const type=cell.getAttribute("t"),value=cell.getElementsByTagNameNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main","v")[0]?.textContent??"";values[index]=type==="s"?shared[Number(value)]??"":type==="inlineStr"?xmlText(cell):value}return values});return{name:sheet.getAttribute("name")??"Sheet",rows}}));
}
function reportFromWorkbook(fileName:string,sheets:Sheet[],kind:"views"|"tiktok"|"shopee"):Report{
  const normalize=(value:string)=>value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();let sheet:Sheet|undefined,headerIndex=-1;
  if(kind==="views"){
    const hasViewHeaders=(rows:string[][])=>rows.some(row=>row.some(value=>normalize(value)==="date")&&row.some(value=>/^(video\s*views|total\s*viewers|viewers|views)$/i.test(normalize(value))));
    sheet=sheets.find(item=>normalize(item.name)==="overview"&&hasViewHeaders(item.rows))??sheets.find(item=>normalize(item.name)==="viewers"&&hasViewHeaders(item.rows))??sheets.find(item=>hasViewHeaders(item.rows));
    headerIndex=sheet?.rows.findIndex(row=>row.some(value=>normalize(value)==="date")&&row.some(value=>/^(video\s*views|total\s*viewers|viewers|views)$/i.test(normalize(value))))??-1;
  }
  if(kind==="tiktok"){sheet=sheets.find(item=>normalize(item.name)==="sheet1")??sheets[0];headerIndex=sheet?.rows.findIndex(row=>row.some(value=>normalize(value)==="gmv"))??-1}
  if(kind==="shopee"){sheet=sheets.find(item=>normalize(item.name).includes("pesanan dibayar"));headerIndex=sheet?.rows.findIndex(row=>row.some(value=>normalize(value).includes("total penjualan")))??-1}
  if(!sheet||headerIndex<0)throw new Error("Format laporan tidak cocok. Pastikan memakai file laporan yang sesuai.");
  const headers=sheet.rows[headerIndex];let rows=sheet.rows.slice(headerIndex+1).filter(row=>row.some(value=>value!==undefined&&value!==""));
  if(kind==="tiktok")rows=rows.filter(row=>normalize(row[0]??"")==="total nilai").slice(0,1);
  if(kind==="shopee")rows=rows.slice(0,1);
  if(!rows.length)throw new Error("Nilai ringkasan tidak ditemukan pada laporan.");
  const notice=kind==="views"?"Menggunakan Video Views per tanggal; untuk ringkasan satu angka, nilainya dijumlahkan.":kind==="tiktok"?"Mengambil GMV dari baris Total nilai pada ringkasan.":"Mengambil Total Penjualan dari ringkasan Pesanan Dibayar.";
  return{name:fileName,headers,rows,notice};
}
function reportDate(value:string,fallbackYear=new Date().getFullYear()):string{
  const iso=value.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/);if(iso)return`${iso[1]}-${iso[2].padStart(2,"0")}-${iso[3].padStart(2,"0")}`;
  const local=value.match(/\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](20\d{2})\b/);if(local)return`${local[3]}-${local[2].padStart(2,"0")}-${local[1].padStart(2,"0")}`;
  const named=value.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b/i);if(named){const month=new Date(`${named[1]} 1, 2000`).getMonth()+1;return`${fallbackYear}-${String(month).padStart(2,"0")}-${named[2].padStart(2,"0")}`}
  return"";
}
export async function parseDatedReport(file:File,kind:"views"|"tiktok"|"shopee"):Promise<{date:string;value:number}[]>{
  if(!file.name.toLowerCase().endsWith(".xlsx"))throw new Error("Input banyak tanggal memerlukan file Excel .xlsx.");
  const sheets=await parseXlsx(file),normalize=(value:string)=>value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
  if(kind==="views"){
    const hasViewHeaders=(rows:string[][])=>rows.some(row=>row.some(value=>normalize(value)==="date")&&row.some(value=>/^(video\s*views|total\s*viewers|viewers|views)$/i.test(normalize(value))));
    const sheet=sheets.find(item=>normalize(item.name)==="overview"&&hasViewHeaders(item.rows))??sheets.find(item=>normalize(item.name)==="viewers"&&hasViewHeaders(item.rows))??sheets.find(item=>hasViewHeaders(item.rows));
    if(!sheet)throw new Error("Sheet Overview atau Viewers tidak ditemukan.");
    const header=sheet.rows.findIndex(row=>row.some(value=>normalize(value)==="date")&&row.some(value=>/^(video\s*views|total\s*viewers|viewers|views)$/i.test(normalize(value))));if(header<0)throw new Error("Kolom Date / Video Views tidak ditemukan.");
    const dateColumn=sheet.rows[header].findIndex(value=>normalize(value)==="date"),videoViewsColumn=sheet.rows[header].findIndex(value=>normalize(value)==="video views"),valueColumn=videoViewsColumn>=0?videoViewsColumn:sheet.rows[header].findIndex(value=>/^(total viewers|viewers|views)$/i.test(normalize(value)));
    return sheet.rows.slice(header+1).flatMap(row=>{const date=reportDate(row[dateColumn]??"");return date?[{date,value:numeric(row[valueColumn]??"")}]:[]});
  }
  const report=reportFromWorkbook(file.name,sheets,kind),valueColumn=matchColumn(report.headers,kind==="tiktok"?["gmv"]:revenueTerms),value=total(report,valueColumn);
  if(valueColumn<0)throw new Error("Kolom nilai omset tidak ditemukan.");
  if(kind==="tiktok"){
    const sheet=sheets.find(item=>normalize(item.name)==="sheet1")??sheets[0],rawDate=sheet.rows.flat().find(value=>normalize(value).includes("tanggal analisis"))??"";const date=reportDate(rawDate);if(!date)throw new Error("Tanggal analisis TikTok tidak terbaca.");return[{date,value}];
  }
  const sheet=sheets.find(item=>normalize(item.name).includes("pesanan dibayar"))!,header=sheet.rows.findIndex(row=>row.some(value=>normalize(value).includes("total penjualan"))),date=reportDate(sheet.rows[header+1]?.[0]??"");if(!date)throw new Error("Tanggal pada ringkasan Pesanan Dibayar tidak terbaca.");return[{date,value}];
}
function numeric(value:string){const digits=value.replace(/[^\d-]/g,"");const parsed=Number(digits);return Number.isSafeInteger(parsed)&&parsed>=0?parsed:0}
function total(report:Report|undefined,index:number){return report&&index>=0?report.rows.reduce((sum,row)=>sum+numeric(row[index]??""),0):0}
function matchColumn(headers:string[],terms:string[]){let best=-1,score=0;headers.forEach((header,index)=>{const current=headerScore(header,terms);if(current>score){best=index;score=current}});return best}
const viewsTerms=["video views","total viewers","viewer","views","tayangan","ditonton"];
const revenueTerms=["gross revenue","total revenue","revenue","omset","omzet","gmv","penjualan","sales","income"];
function ReportSource({title,description,report,onUpload,fields}:{title:string;description:string;report:Report|undefined;onUpload:(event:ChangeEvent<HTMLInputElement>)=>void;fields:{label:string;terms:string[];value:number;onChange:(value:number)=>void}[]}){
  const id=useId();
  return <div className="dm-report-source"><div><b>{title}</b><small>{description}</small></div><label className="dm-report-file">Pilih CSV / Excel<input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onUpload}/></label>{report&&<><small className="dm-report-filename">{report.name} · {report.rows.length.toLocaleString("id-ID")} baris terbaca</small>{report.notice&&<small className="dm-report-notice">{report.notice}</small>}<div className="dm-report-mappers">{fields.map((field,index)=>{const selectId=`${id}-${index}`,suggested=matchColumn(report.headers,field.terms);return <label key={field.label} htmlFor={selectId}>{field.label}<select id={selectId} value={field.value>=0?field.value:""} onChange={event=>field.onChange(event.target.value===""?-1:Number(event.target.value))}><option value="">Pilih kolom laporan</option>{report.headers.map((header,column)=><option key={`${column}-${header}`} value={column}>{header||`Kolom ${column+1}`}{column===suggested?" · cocok":""}</option>)}</select><small>Total terbaca: {total(report,field.value).toLocaleString("id-ID")}</small></label>})}</div></>}</div>
}

export default function DmClientMetricsFields({initial={contents:0,video_views:0,tiktok_sales:0,shopee_sales:0}}:{initial?:Metrics}){
  const [values,setValues]=useState<Metrics>(initial),[viewsReport,setViewsReport]=useState<Report>(),[tiktokReport,setTiktokReport]=useState<Report>(),[shopeeReport,setShopeeReport]=useState<Report>(),[viewsColumn,setViewsColumn]=useState(-1),[tiktokSalesColumn,setTiktokSalesColumn]=useState(-1),[shopeeSalesColumn,setShopeeSalesColumn]=useState(-1),[importError,setImportError]=useState("");
  const readReport=(event:ChangeEvent<HTMLInputElement>,setReport:(report:Report|undefined)=>void,onParsed:(report:Report)=>void,kind:"views"|"tiktok"|"shopee")=>{const file=event.target.files?.[0];if(!file)return;setImportError("");void (async()=>{try{const isExcel=file.name.toLowerCase().endsWith(".xlsx");let report:Report;if(isExcel)report=reportFromWorkbook(file.name,await parseXlsx(file),kind);else{const table=parseCsv(await file.text());if(table.length<2)throw new Error("CSV tidak memiliki baris data.");report={name:file.name,headers:table[0],rows:table.slice(1)}}if(kind==="views"&&report.rows.length>1)throw new Error("Laporan Views ini memuat beberapa tanggal. Gunakan “Input beberapa tanggal” agar tiap angka masuk ke tanggal yang benar.");setReport(report);onParsed(report)}catch(error){setReport(undefined);setImportError(error instanceof Error?error.message:"Laporan tidak dapat dibaca")}})()};
  const update=(key:keyof Metrics,value:number)=>setValues(current=>({...current,[key]:value}));
  const apply=(key:"video_views"|"tiktok_sales"|"shopee_sales",report:Report|undefined,column:number)=>{if(!report||column<0)return;update(key,total(report,column))};
  return <>
    <div className="form-grid dm-client-metrics"><label>Konten<input name="contents" type="number" min="0" step="1" required value={values.contents} onChange={event=>update("contents",Number(event.target.value)||0)}/></label><label>Views Video<input name="video_views" type="number" min="0" step="1" required value={values.video_views} onChange={event=>update("video_views",Number(event.target.value)||0)}/></label><label>Omset TikTok (Rp)<input name="tiktok_sales" type="number" min="0" step="1" required value={values.tiktok_sales} onChange={event=>update("tiktok_sales",Number(event.target.value)||0)}/></label><label>Omset Shopee (Rp)<input name="shopee_sales" type="number" min="0" step="1" required value={values.shopee_sales} onChange={event=>update("shopee_sales",Number(event.target.value)||0)}/></label></div>
    <details className="dm-report-import"><summary>Isi otomatis dari dokumen laporan</summary><p>Unggah masing-masing laporan Excel. Nilai yang cocok langsung mengisi kolomnya; konten tetap diisi manual dan angka hasil impor dapat diedit.</p>{importError&&<p className="dm-report-error">{importError}</p>}<ReportSource title="Laporan Views TikTok" description="Jumlah viewers dijumlahkan dari semua tanggal di file." report={viewsReport} onUpload={event=>readReport(event,setViewsReport,report=>{const column=matchColumn(report.headers,viewsTerms);setViewsColumn(column);if(column>=0)apply("video_views",report,column)},"views")} fields={[{label:"Kolom viewers",terms:viewsTerms,value:viewsColumn,onChange:value=>{setViewsColumn(value);if(value>=0)apply("video_views",viewsReport,value)}}]}/><ReportSource title="Laporan Omset TikTok" description="Mengambil angka GMV pada baris Total nilai." report={tiktokReport} onUpload={event=>readReport(event,setTiktokReport,report=>{const column=matchColumn(report.headers,revenueTerms);setTiktokSalesColumn(column);if(column>=0)apply("tiktok_sales",report,column)},"tiktok")} fields={[{label:"Kolom GMV / omset",terms:revenueTerms,value:tiktokSalesColumn,onChange:value=>{setTiktokSalesColumn(value);if(value>=0)apply("tiktok_sales",tiktokReport,value)}}]}/><ReportSource title="Laporan Omset Shopee" description="Mengambil Total Penjualan dari sheet Pesanan Dibayar." report={shopeeReport} onUpload={event=>readReport(event,setShopeeReport,report=>{const column=matchColumn(report.headers,revenueTerms);setShopeeSalesColumn(column);if(column>=0)apply("shopee_sales",report,column)},"shopee")} fields={[{label:"Kolom Total Penjualan",terms:revenueTerms,value:shopeeSalesColumn,onChange:value=>{setShopeeSalesColumn(value);if(value>=0)apply("shopee_sales",shopeeReport,value)}}]}/></details>
  </>;
}
