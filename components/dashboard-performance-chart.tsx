"use client";
import { useMemo, useState, type PointerEvent } from "react";
type Point={day:string;dmContent:number;daeConversions:number;clientRevenue:number};
const money=(value:number)=>"Rp "+value.toLocaleString("id-ID");
const shortMoney=(value:number)=>new Intl.NumberFormat("id-ID",{notation:"compact",maximumFractionDigits:1}).format(value);
const lines=[{key:"dmContent",label:"Konten terbit · DM",color:"#d2fb07",format:(v:number)=>v.toLocaleString("id-ID")+" konten"},{key:"daeConversions",label:"Brief jadi campaign · DAE",color:"#8fd4b2",format:(v:number)=>v.toLocaleString("id-ID")+" konversi"},{key:"clientRevenue",label:"Omset client",color:"#f2b45c",format:(v:number)=>money(v)}] as const;
export default function DashboardPerformanceChart({points}:{points:Point[]}){
 const [selected,setSelected]=useState(Math.max(0,points.length-1));
 const geometry=useMemo(()=>lines.map(line=>{const vals=points.map(p=>p[line.key]),max=Math.max(1,...vals);const xy=vals.map((v,i)=>({x:40+i*(920/Math.max(1,points.length-1)),y:204-(v/max)*170}));return{...line,vals,xy,points:xy.map(p=>p.x+","+p.y).join(" ")}}),[points]);
 const point=points[selected];
 const formatDate=(day:string)=>new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short",year:"numeric"}).format(new Date(day+"T12:00:00"));
 const onMove=(event:PointerEvent<SVGSVGElement>)=>{const rect=event.currentTarget.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*1000;setSelected(Math.max(0,Math.min(points.length-1,Math.round((x-40)/920*Math.max(1,points.length-1))))) };
 return <div className="dashboard-performance-chart"><svg viewBox="0 0 1000 250" preserveAspectRatio="none" role="img" aria-label="Grafik garis performa DM, DAE, dan client selama 30 hari" onPointerMove={onMove}>
  {[34,90,146,204].map(y=><g key={y}><line className="performance-gridline" x1="40" x2="960" y1={y} y2={y}/><text className="performance-axis-label" x="8" y={y+3}>{y===34?"100%":y===204?"0%":""}</text></g>)}
  {geometry.map(line=><g key={line.key}><polyline points={line.points} fill="none" stroke={line.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/><circle cx={line.xy[selected]?.x??40} cy={line.xy[selected]?.y??204} r="5" fill={line.color} stroke="#171a16" strokeWidth="3" vectorEffect="non-scaling-stroke"/></g>)}
  <line x1={geometry[0]?.xy[selected]?.x??40} x2={geometry[0]?.xy[selected]?.x??40} y1="24" y2="204" className="performance-cursor"/>
  {[0,7,14,21,29].map(i=>points[i]&&<text key={i} x={40+i*(920/29)} y="234" textAnchor={i===0?"start":i===29?"end":"middle"} className="performance-axis-label">{new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short"}).format(new Date(points[i].day+"T12:00:00"))}</text>)}
 </svg>
 <input className="performance-chart-range" type="range" min="0" max={Math.max(0,points.length-1)} value={selected} onChange={e=>setSelected(Number(e.target.value))} aria-label="Pilih tanggal untuk melihat nilai grafik"/>
 <div className="performance-chart-readout"><b>{point?formatDate(point.day):"—"}</b>{geometry.map(line=><div key={line.key}><i style={{background:line.color}}/><span>{line.label}</span><strong>{line.format(Number(point?.[line.key]??0))}</strong></div>)}</div>
 <div className="performance-chart-legend">{geometry.map(line=><span key={line.key}><i style={{background:line.color}}/>{line.label}</span>)}</div>
 <p className="performance-chart-caption">Garis dinormalisasi terhadap nilai tertinggi tiap metrik selama periode ini. Pilih titik grafik atau geser kontrol tanggal untuk melihat angka aktual.</p>
 </div>
}
