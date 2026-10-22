import { redirect } from "next/navigation";
import AdminPackageForm from "@/components/admin-package-form";
import { verifyAdminScope, verifyAdminAnyScope, verifyAdminSession } from "@/lib/admin-auth";

export default async function NewAdminPackagePage() {
  if (!(await verifyAdminSession())) redirect("/admin/login");if(!(await verifyAdminScope("dm")))redirect("/admin");
  return <AdminPackageForm />;
}
