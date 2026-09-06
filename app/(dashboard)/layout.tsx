import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch bakery details for the shell (shift clock hours + bakery name)
  const bakery = await db.bakery.findUnique({
    where:  { id: session.user.bakeryId },
    select: { name: true, openingTime: true, closingTime: true },
  });

  return (
    <AppShell
      user={session.user}
      bakeryName={bakery?.name}
      openingTime={bakery?.openingTime ?? "05:00"}
      closingTime={bakery?.closingTime ?? "20:00"}
    >
      {children}
    </AppShell>
  );
}
