import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { verifyOwnerSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
const maxFileSize = 2 * 1024 * 1024;

function redirectToSettings(request: NextRequest, query: string) {
  return NextResponse.redirect(new URL(`/admin/pengaturan?${query}`, request.url), 303);
}

async function validatePng(file: File) {
  if (file.size < 24 || file.size > maxFileSize || file.type !== "image/png") return null;
  const bytes = Buffer.from(await file.arrayBuffer());
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!bytes.subarray(0, 8).equals(signature)) return null;
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (!width || !height || width > 4096 || height > 4096 || width * height > 16_000_000) return null;
  return bytes;
}

export async function POST(request: NextRequest) {
  if (!(await verifyOwnerSession())) return NextResponse.redirect(new URL("/admin", request.url), 303);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return redirectToSettings(request, "error=invalid");
  }

  const uploads: Array<{ name: "logo" | "favicon"; file: File; bytes: Buffer }> = [];
  for (const name of ["logo", "favicon"] as const) {
    const entry = formData.get(name);
    if (!(entry instanceof File) || entry.size === 0) continue;
    const bytes = await validatePng(entry);
    if (!bytes) return redirectToSettings(request, "error=invalid_file");
    uploads.push({ name, file: entry, bytes });
  }
  if (!uploads.length) return redirectToSettings(request, "error=missing_file");

  const directory = path.join(process.cwd(), "data", "branding");
  await mkdir(directory, { recursive: true });
  for (const upload of uploads) {
    const target = path.join(directory, `${upload.name}.png`);
    const temporary = `${target}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, upload.bytes, { flag: "wx" });
    await rename(temporary, target);
  }
  return redirectToSettings(request, "updated=1");
}
