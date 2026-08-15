import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function RootPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Route to role-specific dashboard
  switch (session.user.role) {
    case "HEAD_BAKER":
      redirect("/dashboard/head-baker");
    case "FLOOR_STAFF":
      redirect("/dashboard/floor-staff");
    case "PURCHASING_MANAGER":
      redirect("/dashboard/purchasing");
    default:
      redirect("/dashboard/head-baker");
  }
}
