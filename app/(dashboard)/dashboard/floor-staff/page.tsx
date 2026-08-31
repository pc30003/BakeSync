import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatDate, formatTime, getBatchStatusColor } from "@/lib/utils";
import { getCurrentShift } from "@/lib/shifts";
import { startOfDay, endOfDay } from "date-fns";
import { FloorShiftChecklist } from "@/components/floor/shift-checklist";
import { ScheduleWatcher } from "@/components/floor/schedule-watcher";
import { ShiftBanner } from "@/components/floor/shift-banner";
import { CheckCircle2, Clock } from "lucide-react";

export const metadata: Metadata = { title: "My Shift" };

export default async function FloorStaffDashboard() {
  const session = await auth();
  const bakeryId = session!.user.bakeryId;
  const now = new Date();

  // Use the bakery's timezone so the active shift matches the bakery's local
  // clock, not the UTC server clock (Vercel runs in UTC).
  const bakeryTz = (await db.bakery.findUnique({
    where: { id: bakeryId }, select: { timezone: true },
  }))?.timezone ?? undefined;

  // Determine which shift is currently active
  const currentShift = getCurrentShift(now, bakeryTz);

  // Only load the approved schedule for the CURRENTLY ACTIVE shift
  const todaySchedule = await db.productionSchedule.findFirst({
    where: {
      bakeryId,
      isApproved: true,
      shiftType: currentShift.type,
      scheduleDate: { gte: startOfDay(now), lte: endOfDay(now) },
    },
    include: {
      batches: {
        where: { status: { in: ["SCHEDULED", "IN_PROGRESS", "COMPLETED"] } },
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

  const hasSchedule = !!todaySchedule && todaySchedule.batches.length > 0;

  // Compute overall shift completion
  let totalSteps = 0;
  let doneSteps  = 0;
  if (todaySchedule) {
    for (const batch of todaySchedule.batches) {
      totalSteps += batch.checklist.length;
      doneSteps  += batch.checklist.filter((c) => c.status === "DONE").length;
    }
  }
  const shiftComplete = hasSchedule && totalSteps > 0 && doneSteps === totalSteps;

  return (
    <div className="space-y-6">
      <ScheduleWatcher hasSchedule={hasSchedule} timezone={bakeryTz} />
      <PageHeader
        title={`${greeting}, ${session!.user.name?.split(" ")[0] ?? "Chef"}`}
        description={`${formatDate(now)} — your shift overview`}
      />

      {/* Live shift banner */}
      <ShiftBanner timezone={bakeryTz} />

      {/* Shift complete celebration */}
      {shiftComplete && (
        <Card className="border-green-200 bg-green-50/60">
          <CardContent className="py-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <p className="text-lg font-bold text-green-800">Shift complete! 🎉</p>
            <p className="text-sm text-green-700">
              All {totalSteps} steps done across {todaySchedule!.batches.length} batch{todaySchedule!.batches.length !== 1 ? "es" : ""}. Great work.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Batch cards / empty state */}
      {!hasSchedule ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <Clock className="w-10 h-10 mx-auto text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              No active batches for the {currentShift.label.toLowerCase()}
            </p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Either no schedule has been approved for this shift yet, or you're between shifts. Check back when your shift begins.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {todaySchedule!.batches.map((batch) => {
            const done = batch.checklist.filter((c) => c.status === "DONE").length;
            const total = batch.checklist.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const batchComplete = total > 0 && done === total;

            return (
              <Card key={batch.id} className={batchComplete ? "border-green-200" : undefined}>
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
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${batchComplete ? "bg-green-500" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </CardHeader>

                <FloorShiftChecklist
                  batchId={batch.id}
                  scheduleId={todaySchedule!.id}
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
