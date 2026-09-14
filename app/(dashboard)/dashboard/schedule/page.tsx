import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgentLogPanel } from "@/components/schedule/agent-log-panel";
import { ScheduleApproveButton } from "@/components/schedule/schedule-approve-button";
import { ScheduleCloseButton } from "@/components/schedule/schedule-close-button";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { formatDate, formatTime, getBatchStatusColor } from "@/lib/utils";
import Link from "next/link";
import { startOfDay, endOfDay, format } from "date-fns";
import { CalendarDays, Clock, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = { title: "Production Schedule" };

// The agent panel generates for the morning shift by default.
const DEFAULT_SHIFT = "MORNING";

// Revalidate every 2 seconds so checklist progress updates for Head Baker
export const revalidate = 2;

export default async function SchedulePage() {
  const session  = await auth();
  const bakeryId = session!.user.bakeryId;
  const isHead   = session!.user.role === "HEAD_BAKER";
  const now      = new Date();

  // Load today's ACTIVE schedule only. Closed (completed & archived) schedules
  // drop out of this view — they live under History instead.
  const schedules = await db.productionSchedule.findMany({
    where: {
      bakeryId,
      isClosed: false,
      scheduleDate: {
        gte: startOfDay(now),
        lte: endOfDay(now),
      },
    },
    include: {
      batches: {
        include: {
          recipe:   { select: { name: true, category: true, shelfLifeHours: true } },
          checklist: { orderBy: { order: "asc" } },
        },
        orderBy: { plannedStartTime: "asc" },
      },
      approvedBy: { select: { id: true, name: true } },
    },
    orderBy: { scheduleDate: "asc" },
  });

  const todayStr = format(now, "yyyy-MM-dd") + "T00:00:00.000Z";
  const todaySchedule = schedules.find(
    (s) =>
      startOfDay(s.scheduleDate).getTime() === startOfDay(now).getTime() &&
      s.shiftType === DEFAULT_SHIFT
  );

  // Has today's default shift already been completed & archived? If so we show
  // a clear "completed" state instead of the generate panel, so the page never
  // contradicts itself ("already has a schedule" vs "no schedules yet").
  const todayClosed = await db.productionSchedule.findFirst({
    where: {
      bakeryId,
      isClosed:     true,
      shiftType:    DEFAULT_SHIFT,
      scheduleDate: { gte: startOfDay(now), lte: endOfDay(now) },
    },
    select: { id: true },
  });
  const shiftAlreadyClosed = !!todayClosed && !todaySchedule;

  return (
    <div className="space-y-6">
      {/* Keeps batch progress bars live for the Head Baker without a manual refresh */}
      <AutoRefresh interval={3000} />

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">
            Production Schedule
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {formatDate(now)} · Today's production plan
          </p>
        </div>
      </div>

      {/* ── Today's shift already completed & archived ──────────────────── */}
      {shiftAlreadyClosed ? (
        <Card className="border-green-200 bg-green-50/60 dark:border-green-900/50 dark:bg-green-950/20">
          <CardContent className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-9 h-9 mx-auto text-green-600 dark:text-green-300" />
            <p className="text-base font-bold text-green-800 dark:text-green-200">
              Today's {DEFAULT_SHIFT.toLowerCase()} shift is complete
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">
              The production run has been finished and archived. Ingredients used remain deducted.
            </p>
            {isHead && (
              <Link
                href="/dashboard/schedule/history"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-green-800 dark:text-green-200 underline underline-offset-2 mt-1"
              >
                View in Production History
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        /* ── Agent trigger panel (HEAD_BAKER only) ───────────────────────── */
        isHead && (
          <AgentLogPanel
            scheduleDate={todayStr}
            shiftType={DEFAULT_SHIFT}
            hasExisting={!!todaySchedule}
          />
        )
      )}

      {/* ── Schedule cards ───────────────────────────────────────────────── */}
      {/* Hide the "no schedules" card when the shift is already closed — the
          green "shift complete" banner above already explains the state. */}
      {schedules.length === 0 ? (
        shiftAlreadyClosed ? null : (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              No schedules yet
            </p>
            {isHead && (
              <p className="text-xs text-muted-foreground">
                Use the agent panel above to generate today's production schedule.
              </p>
            )}
          </CardContent>
        </Card>
        )
      ) : (
        schedules.map((schedule) => {
          // "All steps done" = there is at least one checklist item and every
          // item across every batch is DONE. Drives whether the Close button
          // is offered (Head Baker only, and only on an approved schedule).
          const allItems = schedule.batches.flatMap((b) => b.checklist);
          const allStepsDone =
            allItems.length > 0 && allItems.every((c) => c.status === "DONE" || c.status === "SKIPPED");

          return (
          <Card key={schedule.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle>
                    {formatDate(schedule.scheduleDate)} — {schedule.shiftType} Shift
                  </CardTitle>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span>{schedule.batches.length} batch{schedule.batches.length !== 1 ? "es" : ""}</span>
                    <span>·</span>
                    <span>Oven {Number(schedule.totalOvenUtilizationPercent).toFixed(0)}% utilised</span>
                    {schedule.isAutoGenerated && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-purple-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />
                          AI generated
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {isHead && (
                    <ScheduleApproveButton
                      scheduleId={schedule.id}
                      isApproved={schedule.isApproved}
                      approvedBy={schedule.approvedBy?.name}
                    />
                  )}
                  {isHead && schedule.isApproved && (
                    <ScheduleCloseButton scheduleId={schedule.id} allStepsDone={allStepsDone} />
                  )}
                  {!isHead && (
                    <Badge variant={schedule.isApproved ? "success" : "warning"}>
                      {schedule.isApproved
                        ? `Approved by ${schedule.approvedBy?.name ?? "manager"}`
                        : "Awaiting approval"}
                    </Badge>
                  )}
                </div>
              </div>

              {/* AI reasoning notes */}
              {schedule.aiNotes && (
                <div className="mt-3 px-4 py-3 rounded-xl bg-purple-50 border border-purple-100 text-xs text-purple-800 leading-relaxed dark:bg-purple-950/30 dark:border-purple-900/50 dark:text-purple-200">
                  <p className="font-semibold mb-0.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />
                    Agent reasoning
                  </p>
                  {schedule.aiNotes}
                </div>
              )}
            </CardHeader>

            <CardContent className="p-0">
              {!schedule.isApproved && !isHead ? (
                <p className="px-5 py-6 text-sm text-muted-foreground text-center">
                  This schedule is awaiting Head Baker approval. Checklists will appear once approved.
                </p>
              ) : schedule.batches.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted-foreground">
                  No batches in this schedule.
                </p>
              ) : (
                <ul className="divide-y divide-border" role="list">
                  {schedule.batches.map((batch) => {
                    const done  = batch.checklist.filter(c => c.status === "DONE").length;
                    const total = batch.checklist.length;

                    return (
                      <li key={batch.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm">{batch.recipe.name}</p>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                {batch.recipe.category}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" aria-hidden="true" />
                                {formatTime(batch.plannedStartTime)} — {formatTime(batch.plannedEndTime)}
                              </span>
                              <span>·</span>
                              <span>{batch.quantity} units</span>
                              <span>·</span>
                              <span>×{Number(batch.scaleFactor)} scale</span>
                              <span>·</span>
                              <span>{batch.ovenSlots} oven slot{batch.ovenSlots !== 1 ? "s" : ""}</span>
                              {total > 0 && (
                                <>
                                  <span>·</span>
                                  <span>{done}/{total} steps done</span>
                                </>
                              )}
                            </div>
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${getBatchStatusColor(batch.status)}`}>
                            {batch.status.replace("_", " ")}
                          </span>
                        </div>

                        {total > 0 && (
                          <div
                            className="mt-2.5 h-1.5 bg-muted rounded-full overflow-hidden"
                            role="progressbar"
                            aria-valuenow={Math.round((done / total) * 100)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-500"
                              style={{ width: `${Math.round((done / total) * 100)}%` }}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
          );
        })
      )}
    </div>
  );
}
