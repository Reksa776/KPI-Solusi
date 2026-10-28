import { NextResponse } from "next/server";
import { buildXlsx } from "@/lib/xlsx-export";
import { verifyAdminAnyScope } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET() {
  if (!(await verifyAdminAnyScope(["dm", "dae"]))) return new NextResponse("Unauthorized", { status: 401 });
  const bytes=buildXlsx([
    {name:"Data Client",rows:[["Nama Client","Jenis Client"]],listValidations:[{column:2,fromRow:2,toRow:2001,options:["Client Existing","Calon Client","Ex Client","Community","Media","Instansi","Agency / PH","Etc."],prompt:"Pilih jenis client dari daftar ini."}]},
    {name:"Petunjuk",rows:[["Kolom","Wajib","Keterangan"],["Nama Client","Ya","Nama client harus unik; yang sudah ada akan dilewati."],["Jenis Client","Ya","Pilih dari dropdown di kolom Jenis Client pada sheet Data Client."]]}
  ]);
  return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":"attachment; filename=template-data-client.xlsx","Cache-Control":"no-store"}});
}
