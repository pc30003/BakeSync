import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatDate, formatTime, getBatchStatusColor } from "@/lib/utils";
import { startOfDay, endOfDay } from "date-fns";
import { FloorShiftChecklist } from "@/components/floor/shift-checklist";
import { ScheduleWatcher } from "@/components/floor/schedule-watcher";
import { CheckCircle2, Clock } from "lucide-react";

export const metadata: Metadata = { title: "My Shift" };

export default async function FloorStaffDashboard() {
  const session = await auth();
  const bakeryId = session!.user.bakeryId;
  const now = new Date();

  // Load today's approved, still-active schedule (by date).
  // isClosed:false — once a run is completed & archived it must drop off the
  // floor view (its batches are force-marked COMPLETED on close, which would
  // otherwise show staff a "COMPLETED" batch with unfinished steps).
  const todaySchedule = await db.productionSchedule.findFirst({
    where: {
      bakeryId,
      isApproved: true,
      isClosed:   false,
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

  // Compute overall completion across all of today's batches
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
      <ScheduleWatcher hasSchedule={hasSchedule} />
      <PageHeader
        title={`${greeting}, ${session!.user.name?.split(" ")[0] ?? "Chef"}`}
        description={`${formatDate(now)} — your shift overview`}
      />

      {/* Shift complete celebration */}
      {shiftComplete && (
        <Card className="border-green-200 bg-green-50/60 dark:border-green-900/50 dark:bg-green-950/20">
          <CardContent className="py-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto dark:bg-green-900/40">
              <CheckCircle2 className="w-7 h-7 text-green-600 dark:text-green-300" />
            </div>
            <p className="text-lg font-bold text-green-800 dark:text-green-200">Shift complete! 🎉</p>
            <p className="text-sm text-green-700 dark:text-green-300">
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
              No active batches today
            </p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Once your head baker approves today's production schedule, your batch checklists will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {todaySchedule!.batches.map((batch) => {
            const done = batch.checklist.filter((c) => c.status === "DONE").length;
            const total = batch.checklist.length;
            const batchComplete = total > 0 && done === total;

            return (
              <Card key={batch.id} className={batchComplete ? "border-green-200 dark:border-green-900/50" : undefined}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>{batch.recipe.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatTime(batch.plannedStartTime)} — {formatTime(batch.plannedEndTime)}
                        &nbsp;·&nbsp;{batch.quantity} units
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${getBatchStatusColor(batch.status)}`}>
                      {batch.status.replace("_", " ")}
                    </span>
                  </div>
                  {/* Live progress bar + count are rendered inside the checklist
                      component below so they update instantly as steps are ticked. */}
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
