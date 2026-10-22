import type { RowDataPacket } from "@/lib/db-types";
import { getDb } from "@/lib/db";

export type LeadNotice = { id: number; contact_name: string; company_name: string; email: string; phone: string; campaign_goal: string };
type Job = RowDataPacket & { id: number; channel: "email" | "whatsapp"; payload: LeadNotice; attempts: number };

export async function queueLeadNotifications(lead: LeadNotice) {
  const jobs: Array<["email" | "whatsapp", string]> = [];
  if (process.env.LEAD_NOTIFY_EMAIL && process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) jobs.push(["email", JSON.stringify(lead)]);
  if (process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_RECIPIENT_NUMBER && process.env.WHATSAPP_TEMPLATE_NAME) jobs.push(["whatsapp", JSON.stringify(lead)]);
  if (!jobs.length) return;
  const values = jobs.flatMap(([channel, payload]) => [channel, payload]);
  await getDb().execute(`INSERT INTO notification_outbox (channel,payload) VALUES ${jobs.map(() => "(?,?)").join(",")}`, values);
}

export async function processLeadNotificationQueue(limit = 10) {
  const db = getDb();
  const claimed = await db.transaction(async tx => {
    const batch: Job[] = [];
    await tx.execute("UPDATE notification_outbox SET status='pending',processing_at=NULL WHERE status='processing' AND processing_at < NOW() - INTERVAL 10 MINUTE");
    const [jobs] = await tx.query<Job[]>("SELECT id,channel,payload,attempts FROM notification_outbox WHERE status='pending' AND available_at<=NOW() ORDER BY id LIMIT ? FOR UPDATE SKIP LOCKED", [Math.min(Math.max(limit, 1), 25)]);
    for (const job of jobs) {
      await tx.execute("UPDATE notification_outbox SET status='processing',processing_at=NOW(),attempts=attempts+1 WHERE id=?", [job.id]);
      batch.push({ ...job, attempts: Number(job.attempts) + 1 });
    }
    return batch;
  });

  let sent = 0;
  let failed = 0;
  for (const job of claimed) {
    try {
      const lead = typeof job.payload === "string" ? JSON.parse(job.payload) as LeadNotice : job.payload;
      if (job.channel === "email") await sendLeadEmail(job.id, lead);
      else await sendLeadWhatsApp(lead);
      await db.execute("UPDATE notification_outbox SET status='sent',processing_at=NULL,last_error=NULL WHERE id=?", [job.id]);
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 900) : "Provider notification failed.";
      const terminal = job.attempts >= 6;
      const retryMinutes = Math.min(60, 2 ** Math.min(job.attempts, 6));
      await db.execute("UPDATE notification_outbox SET status=?,processing_at=NULL,available_at=DATE_ADD(NOW(),INTERVAL ? MINUTE),last_error=? WHERE id=?", [terminal ? "failed" : "pending", retryMinutes, message, job.id]);
      failed++;
    }
  }
  return { claimed: claimed.length, sent, failed };
}

async function sendLeadEmail(jobId: number, lead: LeadNotice) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `lead-notification-${jobId}` },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [process.env.LEAD_NOTIFY_EMAIL],
      subject: `Brief campaign baru — ${lead.company_name}`,
      text: `Brief baru dari ${lead.contact_name} (${lead.company_name})\nEmail: ${lead.email}\nTelepon: ${lead.phone}\n\nTujuan campaign:\n${lead.campaign_goal}\n\nBuka dashboard: ${process.env.APP_URL ?? ""}/admin/brief/${lead.id}`,
    }),
  });
  if (!response.ok) throw new Error(`Resend HTTP ${response.status}: ${(await response.text()).slice(0, 700)}`);
}

async function sendLeadWhatsApp(lead: LeadNotice) {
  const version = process.env.WHATSAPP_GRAPH_API_VERSION ?? "v26.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_TOKEN}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: process.env.WHATSAPP_RECIPIENT_NUMBER,
      type: "template",
      template: {
        name: process.env.WHATSAPP_TEMPLATE_NAME,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "id" },
        components: [{ type: "body", parameters: [lead.contact_name, lead.company_name, lead.email].map((text) => ({ type: "text", text })) }],
      },
    }),
  });
  if (!response.ok) throw new Error(`WhatsApp Cloud API HTTP ${response.status}: ${(await response.text()).slice(0, 700)}`);
}
