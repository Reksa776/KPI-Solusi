import { notFound, redirect } from "next/navigation";
import AdminPackageForm from "@/components/admin-package-form";
import { verifyAdminScope, verifyAdminAnyScope, verifyAdminSession } from "@/lib/admin-auth";
import { getPackageById } from "@/lib/packages";

export default async function EditAdminPackagePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAdminSession())) redirect("/admin/login");if(!(await verifyAdminScope("dm")))redirect("/admin");
  const { id } = await params;
  const item = await getPackageById(Number(id));
  if (!item) notFound();
  return <AdminPackageForm item={item} />;
}
