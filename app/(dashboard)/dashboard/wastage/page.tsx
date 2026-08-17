import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatGrams } from "@/lib/utils";
import { WastageLogForm } from "@/components/floor/wastage-log-form";
import { subDays, startOfDay } from "date-fns";

export const metadata: Metadata = { title: "Log Wastage" };

export const revalidate = 2;

export default async function WastagePage() {
  const session   = await auth();
  const bakeryId  = session!.user.bakeryId;

  const [ingredients, recentLogs] = await Promise.all([
    db.ingredient.findMany({
      where:   { bakeryId, isTracked: true },
      select:  { id: true, name: true, unit: true },
      orderBy: { name: "asc" },
    }),
    db.wastageLog.findMany({
      where:   { bakeryId, shiftDate: { gte: subDays(startOfDay(new Date()), 7) } },
      include: {
        ingredient: { select: { name: true } },
        loggedBy:   { select: { name: true } },
      },
      orderBy: { shiftDate: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Log Wastage"
        description="Record ingredient and product wastage for your shift"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>New Wastage Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <WastageLogForm ingredients={ingredients} />
          </CardContent>
        </Card>

        {/* Recent logs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Logs (7 days)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentLogs.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground text-center">
                No wastage recorded this week.
              </p>
            ) : (
              <ul className="divide-y divide-border" role="list">
                {recentLogs.map((log) => (
                  <li key={log.id} className="flex items-start justify-between px-5 py-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {log.ingredient?.name ?? log.productName ?? "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.reason} · {formatDate(log.shiftDate)} · by {log.loggedBy.name}
                      </p>
                    </div>
                    <p className="text-sm font-medium shrink-0">
                      {formatGrams(Number(log.quantityGrams))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
