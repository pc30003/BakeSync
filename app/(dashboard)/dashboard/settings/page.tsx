import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsForm } from "@/components/settings/settings-form";

export const metadata: Metadata = { title: "Bakery Settings" };

export default async function SettingsPage() {
  const session = await auth();

  // Only HEAD_BAKER can access this page
  if (session?.user.role !== "HEAD_BAKER") {
    redirect("/dashboard");
  }

  const bakery = await db.bakery.findUnique({
    where:  { id: session.user.bakeryId },
    select: {
      id:                 true,
      name:               true,
      timezone:           true,
      currency:           true,
      openingTime:        true,
      closingTime:        true,
      ovenCount:          true,
      plan:               true,
      subscriptionStatus: true,
    },
  });

  if (!bakery) redirect("/dashboard");

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Bakery Settings"
        description="Update your bakery profile, operating hours, and production capacity."
      />
      <SettingsForm bakery={bakery} />
    </div>
  );
}
