import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime, getBatchStatusColor } from "@/lib/utils";
import { startOfDay, endOfDay } from "date-fns";
import { FloorShiftChecklist } from "@/components/floor/shift-checklist";
import { AutoRefresh } from "@/components/ui/auto-refresh";

export const metadata: Metadata = { title: "My Shift" };

export default async function FloorStaffDashboard() {
  const session = await auth();
  const bakeryId = session!.user.bakeryId;
  const now = new Date();

  const todaySchedule = await db.productionSchedule.findFirst({
    where: {
      bakeryId,
      isApproved: true,
      scheduleDate: { gte: startOfDay(now), lte: endOfDay(now) },
    },
    include: {
      batches: {
        where: { status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
        include: {
          recipe: { select: { name: true, category: true } },
          checklist: {
            orderBy: { order: "asc" },
            include: {
              ingredient: { select: { name: true } },
              deductions: { include: { ingredient: { select: { name: true } } } },
            },
          },
        },
        orderBy: { plannedStartTime: "asc" },
      },
    },
  });

  const greetingHour = now.getHours();
  const greeting =
    greetingHour < 12 ? "Good morning" :
    greetingHour < 17 ? "Good afternoon" :
    "Good evening";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}, ${session!.user.name?.split(" ")[0] ?? "Chef"}`}
        description={`${formatDate(now)} — your shift overview`}
      />

      {/* Batch overview cards */}
      {!todaySchedule || todaySchedule.batches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No active batches for your shift today. Check back later or ask your head baker.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {todaySchedule.batches.map((batch) => {
            const done = batch.checklist.filter((c) => c.status === "DONE").length;
            const total = batch.checklist.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <Card key={batch.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>{batch.recipe.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatTime(batch.plannedStartTime)} — {formatTime(batch.plannedEndTime)}
                        &nbsp;·&nbsp;{batch.quantity} units
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{pct}%</span>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${getBatchStatusColor(batch.status)}`}>
                        {batch.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </CardHeader>

                <FloorShiftChecklist
                  batchId={batch.id}
                  scheduleId={todaySchedule.id}
                  initialItems={batch.checklist as any}
                />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
