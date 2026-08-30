import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CreditCard, Zap } from "lucide-react";

export const metadata: Metadata = { title: "Billing" };

const PLAN_LABELS: Record<string, string> = {
  FREE:       "Free",
  STARTER:    "Starter",
  PRO:        "Pro",
  ENTERPRISE: "Enterprise",
};

const PLAN_DESCRIPTIONS: Record<string, string> = {
  FREE:       "Perfect for getting started. Includes core scheduling and inventory features.",
  STARTER:    "For small bakeries. Adds analytics, procurement recommendations, and push alerts.",
  PRO:        "For growing operations. Full AI scheduling, unlimited users, and priority support.",
  ENTERPRISE: "Custom solution for multi-site bakery groups. Contact us for pricing.",
};

export default async function BillingPage() {
  const session = await auth();

  if (session?.user.role !== "HEAD_BAKER") {
    redirect("/dashboard");
  }

  const bakery = await db.bakery.findUnique({
    where:  { id: session.user.bakeryId },
    select: { plan: true, subscriptionStatus: true, trialEndsAt: true },
  });

  if (!bakery) redirect("/dashboard");

  const planLabel  = PLAN_LABELS[bakery.plan] ?? bakery.plan;
  const planDesc   = PLAN_DESCRIPTIONS[bakery.plan] ?? "";

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Billing"
        description="Manage your BakeSync subscription and plan."
      />

      {/* Current plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{planLabel}</p>
              <p className="text-sm text-muted-foreground">{planDesc}</p>
            </div>
            <span className="ml-auto inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary uppercase tracking-wide">
              {bakery.subscriptionStatus ?? "active"}
            </span>
          </div>

          {bakery.trialEndsAt && (
            <p className="text-xs text-muted-foreground">
              Trial ends: {new Date(bakery.trialEndsAt).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Upgrade CTA */}
      {bakery.plan === "FREE" && (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade to Pro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Unlock the full BakeSync experience — AI-powered scheduling, unlimited users, advanced analytics, and priority support.
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {[
                "Autonomous AI production scheduling",
                "Unlimited staff accounts",
                "Advanced wastage analytics",
                "Push notifications & alerts",
                "Shopify & Square POS integration",
                "Priority support",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            <div className="pt-2 space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium">
                <CreditCard className="w-4 h-4" />
                Paid plans launching soon
              </div>
              <p className="text-xs text-muted-foreground">
                You're currently on the free plan with full access to core features.
                Secure online checkout and plan management will be available here when paid tiers go live.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
