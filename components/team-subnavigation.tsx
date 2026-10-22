import { getAdminSessionUser } from "@/lib/admin-auth";
import TeamSubnavigationMenu, { type TeamNavActive } from "@/components/team-subnavigation-menu";
export type { TeamNavActive } from "@/components/team-subnavigation-menu";

export default async function TeamSubnavigation({ active = "overview" }: { active?: TeamNavActive }) {
  const user = await getAdminSessionUser();
  const owner = user?.role === "superadmin";
  const canDM = owner || user?.admin_scope === "dm" || user?.admin_scope === "both";
  const canDAE = owner || user?.admin_scope === "dae" || user?.admin_scope === "both";
  return <TeamSubnavigationMenu canDM={canDM} canDAE={canDAE} owner={owner} scope={user?.admin_scope} active={active}/>;
}
