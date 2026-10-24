"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type FilterSelect={name:string;label:string;value:string;options:{value:string;label:string}[]};

export default function LiveSearchFilter({search,searchLabel,placeholder,select}:{search:string;searchLabel:string;placeholder:string;select?:FilterSelect}){
  const router=useRouter(),pathname=usePathname();
  const [value,setValue]=useState(search),[filterValue,setFilterValue]=useState(select?.value??"");
  const valueRef=useRef(search),pendingSearch=useRef<string|null>(null);

  useEffect(()=>{
    if(pendingSearch.current!==null){
      const currentUrlSearch=new URLSearchParams(window.location.search).get("search")??"";
      if(search===pendingSearch.current){pendingSearch.current=null;return}
      if(currentUrlSearch===pendingSearch.current)return;
      pendingSearch.current=null;
    }
    valueRef.current=search;
    setValue(search);
  },[search]);
  useEffect(()=>setFilterValue(select?.value??""),[select?.value]);

  useEffect(()=>{
    if(value.trim()===search)return;
    const timer=setTimeout(()=>{
      const params=new URLSearchParams(window.location.search),next=value.trim();
      if(next)params.set("search",next);else params.delete("search");
      params.delete("page");
      pendingSearch.current=next;
      const query=params.toString();
      router.replace(query?`${pathname}?${query}`:pathname,{scroll:false});
    },280);
    return ()=>clearTimeout(timer);
  },[value,search,pathname,router]);

  const changeFilter=(next:string)=>{
    setFilterValue(next);
    const params=new URLSearchParams(window.location.search);
    if(next)params.set(select!.name,next);else params.delete(select!.name);
    const currentSearch=valueRef.current.trim();
    if(currentSearch)params.set("search",currentSearch);else params.delete("search");
    pendingSearch.current=currentSearch;
    params.delete("page");
    const query=params.toString();
    router.replace(query?`${pathname}?${query}`:pathname,{scroll:false});
  };

  const reset=()=>{
    valueRef.current="";pendingSearch.current="";setValue("");setFilterValue("");router.replace(pathname,{scroll:false});
  };

  return <div className="record-list-tools"><label>{searchLabel}<input type="search" value={value} onChange={event=>{valueRef.current=event.target.value;setValue(event.target.value)}} placeholder={placeholder}/></label>{select&&<label>{select.label}<select value={filterValue} onChange={event=>changeFilter(event.target.value)}>{select.options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}{(search||select?.value)&&<button className="record-list-reset" type="button" onClick={reset}>Reset</button>}</div>;
}
