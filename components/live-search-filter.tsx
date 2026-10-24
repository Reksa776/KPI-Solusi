"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type FilterSelect={name:string;label:string;value:string;options:{value:string;label:string}[]};

export default function LiveSearchFilter({search,searchLabel,placeholder,select}:{search:string;searchLabel:string;placeholder:string;select?:FilterSelect}){
  const router=useRouter(),pathname=usePathname();
  const [value,setValue]=useState(search),[filterValue,setFilterValue]=useState(select?.value??"");

  useEffect(()=>setValue(search),[search]);
  useEffect(()=>setFilterValue(select?.value??""),[select?.value]);

  useEffect(()=>{
    if(value.trim()===search)return;
    const timer=setTimeout(()=>{
      const params=new URLSearchParams(window.location.search),next=value.trim();
      if(next)params.set("search",next);else params.delete("search");
      params.delete("page");
      const query=params.toString();
      router.replace(query?`${pathname}?${query}`:pathname,{scroll:false});
    },280);
    return ()=>clearTimeout(timer);
  },[value,search,pathname,router]);

  const changeFilter=(next:string)=>{
    setFilterValue(next);
    const params=new URLSearchParams(window.location.search);
    if(next)params.set(select!.name,next);else params.delete(select!.name);
    params.delete("page");
    const query=params.toString();
    router.replace(query?`${pathname}?${query}`:pathname,{scroll:false});
  };

  const reset=()=>{
    setValue("");setFilterValue("");router.replace(pathname,{scroll:false});
  };

  return <div className="record-list-tools"><label>{searchLabel}<input type="search" value={value} onChange={event=>setValue(event.target.value)} placeholder={placeholder}/></label>{select&&<label>{select.label}<select value={filterValue} onChange={event=>changeFilter(event.target.value)}>{select.options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}{(search||select?.value)&&<button className="record-list-reset" type="button" onClick={reset}>Reset</button>}</div>;
}
