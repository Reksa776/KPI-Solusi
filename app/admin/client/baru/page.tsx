import { redirect } from "next/navigation";
import { verifyAdminAnyScope, verifyAdminSession } from "@/lib/admin-auth";
import AdminClientForm from "@/components/admin-client-form";
export default async function NewClientPage(){if(!(await verifyAdminSession()))redirect("/admin/login");if(!(await verifyAdminAnyScope(["dm","dae"])))redirect("/admin");return <AdminClientForm/>}
