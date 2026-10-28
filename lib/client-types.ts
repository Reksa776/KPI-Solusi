export const agencyClientTypes = [
  ["existing", "Client Existing"],
  ["prospect", "Calon Client"],
  ["ex_client", "Ex Client"],
  ["community", "Community"],
  ["media", "Media"],
  ["institution", "Instansi"],
  ["agency_ph", "Agency / PH"],
  ["etc", "Etc."],
] as const;

const normalizeLabel = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, " ");

export function normalizeAgencyClientName(value: unknown) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

export function normalizeAgencyClientType(value: unknown) {
  const normalized = normalizeLabel(value);
  return agencyClientTypes.find(([key, label]) => normalizeLabel(key) === normalized || normalizeLabel(label) === normalized)?.[0] ?? String(value ?? "").trim().toLowerCase();
}

export function isExistingAgencyClientType(value: unknown) {
  return normalizeAgencyClientType(value) === "existing";
}
