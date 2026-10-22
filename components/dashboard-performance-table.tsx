"use client";
import { useMemo, useState } from "react";
type Score={full_name:string;contents:number|string;video_views:number|string;tiktok_sales:number|string;shopee_sales:number|string;secondary?:number|string};
type Metric="contents"|"video_views"|"tiktok_sales"|"shopee_sales";
const options:{value:Metric;label:string}[]=[{value:"contents",label:"Konten"},{value:"video_views",label:"Views video"},{value:"tiktok_sales",label:"Omset TikTok"},{value:"shopee_sales",label:"Omset Shopee"}];
const n=(value:number|string|undefined)=>Number(value??0);
const display=(row:Score,key:Metric)=>key.includes("sales")?"Rp "+n(row[key]).toLocaleString("id-ID"):n(row[key]).toLocaleString("id-ID");
function RankingCard({title,label,rows,entity}:{title:string;label:string;rows:Score[];entity:"DM"|"DAE"|"Client"}){
 const[metric,setMetric]=useState<Metric>("contents");
 const sorted=useMemo(()=>[...rows].sort((a,b)=>n(b[metric])-n(a[metric])||a.full_name.localeCompare(b.full_name,"id")),[rows,metric]);
 const heading=options.find(option=>option.value===metric)?.label??"Performa";
 return <article className="dashboard-v2-panel dashboard-performance-card"><div className="dashboard-v2-panel-heading performance-card-heading"><div><span className="dashboard-kicker">{label}</span><h2>{title}</h2><p>Peringkat {entity} berdasarkan hasil yang tercatat.</p></div><span className="performance-row-count">{sorted.length} data</span></div><label className="ranking-sort"><span>Urutkan berdasarkan</span><select value={metric} onChange={event=>setMetric(event.target.value as Metric)} aria-label={"Urutkan peringkat "+entity}><option value="contents">Konten</option><option value="video_views">Views video</option><option value="tiktok_sales">Omset TikTok</option><option value="shopee_sales">Omset Shopee</option></select></label>{sorted.length?<div className="ranking-table-wrap"><table className="ranking-table"><thead><tr><th>Nama {entity}</th><th>{heading}</th></tr></thead><tbody>{sorted.slice(0,4).map((row,index)=><tr key={row.full_name}><td><span className="ranking-number">{String(index+1).padStart(2,"0")}</span><b>{row.full_name}</b></td><td>{display(row,metric)}</td></tr>)}</tbody></table></div>:<div className="dashboard-performance-empty">Data performa {entity} belum tersedia.</div>}{sorted.length>4&&<p className="performance-card-footnote">Top 4 dari {sorted.length} nama · ubah metrik untuk mengurutkan ulang.</p>}</article>
}
export default function DashboardPerformanceTable({dm,dae,clients}:{dm:Score[];dae:Score[];clients:Score[]}){
 return <section className="dashboard-performance-cards" aria-label="Peringkat performa tim dan client"><RankingCard title="Performa DM" label="DIGITAL MARKETING" entity="DM" rows={dm}/><RankingCard title="Performa DAE" label="DIGITAL ACCOUNT EXECUTIVE" entity="DAE" rows={dae}/><RankingCard title="Performa Client" label="CLIENT" entity="Client" rows={clients}/></section>
}
