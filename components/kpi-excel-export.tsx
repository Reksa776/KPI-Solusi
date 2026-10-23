"use client";

import { useState, type FormEvent } from "react";

function jakartaToday(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function shiftDate(value:string,days:number){const date=new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10)}
function rangeStart(end:string,days:number){return shiftDate(end,-days+1)}

export default function KpiExcelExport({scope}:{scope:"dm"|"dae"}){
  const [today]=useState(jakartaToday),[range,setRange]=useState("30"),[customStart,setCustomStart]=useState(()=>rangeStart(jakartaToday(),30)),[customEnd,setCustomEnd]=useState(jakartaToday);
  const start=range==="custom"?customStart:range==="all"?"1000-01-01":rangeStart(today,Number(range)),end=range==="custom"?customEnd:today;
  const valid=Boolean(start&&end&&start<=end);
  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!valid)return;const params=new URLSearchParams({scope,end});if(range==="all")params.set("all","1");else params.set("start",start);window.location.assign(`/api/admin/kpi/export?${params.toString()}`)}
  return <form className="kpi-excel-export" onSubmit={submit}>
    <label>Rentang data<select value={range} onChange={event=>setRange(event.target.value)}><option value="7">7 hari terakhir</option><option value="30">30 hari terakhir</option><option value="90">90 hari terakhir</option><option value="custom">Tanggal custom</option><option value="all">Semua data</option></select></label>
    {range==="custom"&&<><label>Dari<input type="date" value={customStart} max={customEnd||today} onChange={event=>setCustomStart(event.target.value)}/></label><label>Sampai<input type="date" value={customEnd} min={customStart} max={today} onChange={event=>setCustomEnd(event.target.value)}/></label></>}
    <button className="button" type="submit" disabled={!valid}>↓ Download Excel</button>
  </form>
}
