import { NextResponse } from "next/server";
import { buildXlsx } from "@/lib/xlsx-export";
import { verifyAdminAnyScope } from "@/lib/admin-auth";
import { agencyClientTypes } from "@/lib/client-types";

export const runtime = "nodejs";

export async function GET() {
  if (!(await verifyAdminAnyScope(["dm", "dae"]))) return new NextResponse("Unauthorized", { status: 401 });
  const clientTypeLabels=agencyClientTypes.map(([,label])=>label);
  const rows=[
    ["Nama Client","Jenis Client","","Jenis Client tersedia · salin bila perlu"],
    ...Array.from({length:clientTypeLabels.length},(_,index)=>["","","",clientTypeLabels[index]]),
  ];
  const bytes=buildXlsx([
    {name:"Data Client",rows,autoFilterRange:"A1:B2001",listValidations:[{column:2,fromRow:2,toRow:2001,formula:`$D$2:$D$${clientTypeLabels.length+1}`,prompt:"Pilih jenis client dari daftar di sebelah kanan."}]},
  ]);
  return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":"attachment; filename=template-data-client.xlsx","Cache-Control":"no-store"}});
}
