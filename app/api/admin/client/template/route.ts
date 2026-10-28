import { NextResponse } from "next/server";
import { buildXlsx } from "@/lib/xlsx-export";
import { verifyAdminAnyScope } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET() {
  if (!(await verifyAdminAnyScope(["dm", "dae"]))) return new NextResponse("Unauthorized", { status: 401 });
  const bytes=buildXlsx([
    {name:"Data Client",rows:[["Nama Client","Jenis Client","Nama Kontak","Email","No. Telepon","Catatan"]]},
    {name:"Petunjuk",rows:[["Kolom","Wajib","Keterangan"],["Nama Client","Ya","Nama client harus unik; yang sudah ada akan dilewati."],["Jenis Client","Ya","Pilih salah satu kode: existing, prospect, ex_client, community, media, institution, agency_ph, etc."],["Nama Kontak","Tidak","Nama PIC / kontak client."],["Email","Tidak","Email kontak client."],["No. Telepon","Tidak","Nomor telepon kontak client."],["Catatan","Tidak","Catatan tambahan."]]}
  ]);
  return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":"attachment; filename=template-data-client.xlsx","Cache-Control":"no-store"}});
}
