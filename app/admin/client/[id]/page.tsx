import { notFound, redirect } from "next/navigation";
import type { RowDataPacket } from "@/lib/db-types";
import { verifyAdminAnyScope, verifyAdminSession } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import AdminClientForm, { type AgencyClient } from "@/components/admin-client-form";
export default async function EditClientPage({params}:{params:Promise<{id:string}>}){if(!(await verifyAdminSession()))redirect("/admin/login");if(!(await verifyAdminAnyScope(["dm","dae"])))redirect("/admin");const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<1)notFound();const[rows]=await getDb().execute<(RowDataPacket&AgencyClient)[]>("SELECT id,client_name,client_type FROM agency_clients WHERE id=? LIMIT 1",[id]);if(!rows[0])notFound();return <AdminClientForm client={rows[0]}/>}
