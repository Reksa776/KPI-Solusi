"use client";

import { useState } from "react";

export default function BrandIcon({ className = "" }: { className?: string }) {
  const [available, setAvailable] = useState(true);
  return <span className={`brand-mark brand-image${available ? " has-image" : ""}${className ? ` ${className}` : ""}`} aria-hidden="true">
    {available ? <img src="/api/branding/logo" alt="" onError={() => setAvailable(false)} /> : <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 18.5C10 13.8 13.8 10 18.5 10h10.8c4.8 0 8.7 3.9 8.7 8.7 0 4.8-3.9 8.7-8.7 8.7H20" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"/><path d="M38 29.5c0 4.7-3.8 8.5-8.5 8.5H18.7C13.9 38 10 34.1 10 29.3c0-4.8 3.9-8.7 8.7-8.7H28" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"/><circle cx="18.5" cy="19" r="2.1" fill="currentColor"/><circle cx="29.5" cy="29" r="2.1" fill="currentColor"/></svg>}
  </span>;
}
