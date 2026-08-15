import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRoleDashboardPath } from "@/components/layout/nav-config";

export default async function DashboardIndexPage() {
  const session = await auth();
  redirect(getRoleDashboardPath(session!.user.role));
}
