import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatTime, formatDateTime } from "@/lib/utils";
import { History, Clock, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = { title: "Production History" };

// Keep it fresh so a just-closed run shows up here promptly.
export const revalidate = 2;

export default async function ProductionHistoryPage() {
  const session = await auth();
  // Head Baker only — mirrors the nav-config role restriction.
  if (session!.user.role !== "HEAD_BAKER") {
    redirect("/dashboard/schedule");
  }
  const bakeryId = session!.user.bakeryId;

  // Read from the immutable run-history archive. These are snapshots created
  // when a run is completed & archived — they stack (no one-per-slot limit) and
  // survive schedule/recipe deletion because the fields are denormalised copies.
  const runs = await db.productionRunHistory.findMany({
    where: { bakeryId },
    include: {
      batches: { orderBy: { plannedStartTime: "asc" } },
    },
    orderBy: { closedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production History"
        description="Completed and archived production runs. Ingredients used remain deducted from stock."
      />

      {runs.length === 0 ? (
        <EmptyState
          icon={<History className="w-6 h-6" />}
          title="No completed runs yet"
          description="When a Head Baker completes and archives a production run from the schedule, it appears here."
        />
      ) : (
        runs.map((run) => (
          <Card key={run.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle>
                    {formatDate(run.scheduleDate)} — {run.shiftType} Shift
                  </CardTitle>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span>{run.batchCount} batch{run.batchCount !== 1 ? "es" : ""}</span>
                    {run.approvedByName && (
                      <>
                        <span>·</span>
                        <span>Approved by {run.approvedByName}</span>
                      </>
                    )}
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      Completed {formatDateTime(run.closedAt)}
                    </span>
                  </div>
                </div>
                <Badge variant="success" className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Completed
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {run.batches.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted-foreground">No batches recorded.</p>
              ) : (
                <ul className="divide-y divide-border" role="list">
                  {run.batches.map((batch) => (
                    <li key={batch.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{batch.recipeName}</p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {batch.recipeCategory}
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
                          </div>
                        </div>
                        <span className="text-xs font-medium px-2 py-1 rounded-full shrink-0 bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                          Completed
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
