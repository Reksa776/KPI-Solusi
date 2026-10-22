"use server";

import { redirect } from "next/navigation";
import type { ResultSetHeader } from "@/lib/db-types";
import { getDb } from "@/lib/db";
import { queueLeadNotifications } from "@/lib/lead-notifications";

const text = (data: FormData, key: string, max: number) => String(data.get(key) ?? "").trim().slice(0, max);

export async function submitBriefAction(data: FormData) {
  const contact = text(data, "contact_name", 160);
  const company = text(data, "company_name", 160);
  const email = text(data, "email", 191).toLowerCase();
  const phone = text(data, "phone", 40);
  const goal = text(data, "campaign_goal", 4000);
  const audience = text(data, "target_audience", 255);
  const channels = text(data, "preferred_channels", 255);
  const website = text(data, "website_or_social", 255);
  const minRaw = text(data, "budget_min", 20);
  const maxRaw = text(data, "budget_max", 20);
  const targetDate = text(data, "target_date", 10);
  const min = minRaw ? Number(minRaw) : null;
  const max = maxRaw ? Number(maxRaw) : null;
  const date = targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate) ? targetDate : null;
  if (!contact || !company || !/^\S+@\S+\.\S+$/.test(email) || !phone || !goal || !audience || !channels || data.get("privacy") !== "on" || (min !== null && (!Number.isSafeInteger(min) || min < 0)) || (max !== null && (!Number.isSafeInteger(max) || max < 0)) || (min !== null && max !== null && max < min)) redirect("/brief?error=invalid");
  let leadId: number;
  try {
    const [result] = await getDb().execute<ResultSetHeader>("INSERT INTO leads (contact_name, company_name, email, phone, website_or_social, campaign_goal, target_audience, preferred_channels, budget_min, budget_max, target_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [contact, company, email, phone, website || null, goal, audience, channels, min, max, date]);
    leadId = result.insertId;
  } catch {
    redirect("/brief?error=save");
  }
  try {
    await getDb().execute("INSERT INTO lead_activities (lead_id,activity_type,description) VALUES (?,'created','Brief baru dikirim melalui website.')", [leadId!]);
    await queueLeadNotifications({ id: leadId!, contact_name: contact, company_name: company, email, phone, campaign_goal: goal });
  } catch (error) {
    console.error("Lead follow-up queue could not be recorded", error);
  }
  redirect("/brief?sent=1");
}
