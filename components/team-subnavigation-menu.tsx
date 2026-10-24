"use client";

import Link from "next/link";
import { useState } from "react";
export type TeamNavActive = "overview" | "dm-overview" | "dm-client" | "dm-team" | "dm-targets" | "dae-overview" | "dae-individual" | "dae-team" | "dae-strategy" | "dae-visit" | "dae-client";
type Item = { key: TeamNavActive; label: string; href: string };
type Props = { canDM: boolean; canDAE: boolean; owner: boolean; scope?: string; active: TeamNavActive };

const dmItems: Item[] = [
  { key: "dm-overview", label: "Overview", href: "/admin/kpi?scope=dm" },
  { key: "dm-client", label: "Data Client untuk DM", href: "/admin/kpi/input/dm_client" },
  { key: "dm-team", label: "Data Tim DM", href: "/admin/kpi/input/dm_team" },
  { key: "dm-targets", label: "Target Konten DM", href: "/admin/kpi/input/dm_targets" },
];
const daeItems: Item[] = [
  { key: "dae-overview", label: "Overview", href: "/admin/kpi?scope=dae" },
  { key: "dae-individual", label: "Input Data Per DAE", href: "/admin/kpi/input/dae_individual" },
  { key: "dae-team", label: "Input Data Tim DAE", href: "/admin/kpi/input/dae_team" },
  { key: "dae-strategy", label: "Input Data Strategi DAE", href: "/admin/kpi/input/dae_strategy" },
  { key: "dae-visit", label: "Input Data Kunjungan DAE", href: "/admin/kpi/input/dae_visit" },
];

function Dropdown({ label, icon, items, active, openByDefault }: { label: string; icon: string; items: Item[]; active: TeamNavActive; openByDefault: boolean }) {
  const [open, setOpen] = useState(openByDefault);
  return <div className={`team-nav-dropdown${open ? " is-open" : ""}`}>
    <button className="team-nav-trigger" type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span className="team-nav-icon" aria-hidden="true">{icon}</span><span>{label}</span><i className="team-nav-chevron" aria-hidden="true"/>
    </button>
    <div className="team-nav-collapse"><div className="team-nav-subitems">{items.map(item => <Link key={item.key} className={active === item.key ? "active" : ""} href={item.href}>{item.label}</Link>)}</div></div>
  </div>;
}

export default function TeamSubnavigationMenu({ canDM, canDAE, owner, scope, active }: Props) {
  const dmHasDropdown = canDM;
  const daeHasDropdown = canDAE;
  const dmOpen = active.startsWith("dm-") || (active === "overview" && (scope === "dm" || scope === "both"));
  const daeOpen = active.startsWith("dae-") || (active === "overview" && (scope === "dae" || scope === "both"));
  const visibleDaeItems = owner || scope === "both" || !canDM
    ? daeItems
    : daeItems.filter(item => item.key === "dae-overview" || item.key === "dae-individual");
  return <div className="team-sidebar-navigation" aria-label="Navigasi DM dan DAE">
    {dmHasDropdown ? <Dropdown label="DM" icon="◉" items={dmItems} active={active} openByDefault={dmOpen}/> : <Link className={`team-nav-direct${active === "dm-overview" ? " active" : ""}`} href="/admin/kpi?scope=dm"><span className="team-nav-icon">◉</span>DM (Overview)</Link>}
    {daeHasDropdown ? <Dropdown label="DAE" icon="◌" items={visibleDaeItems} active={active} openByDefault={daeOpen}/> : <Link className={`team-nav-direct${active === "dae-overview" ? " active" : ""}`} href="/admin/kpi?scope=dae"><span className="team-nav-icon">◌</span>DAE (Overview)</Link>}
  </div>;
}
