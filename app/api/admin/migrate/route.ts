/**
 * GET/POST /api/admin/migrate
 *
 * One-time, self-contained schema migration the DEPLOYED app runs against its
 * OWN live database — so we don't need the production DATABASE_URL locally.
 *
 * It only runs additive, idempotent `ADD COLUMN IF NOT EXISTS` statements, so
 * it is safe to call more than once (re-running does nothing). Protected by
 * CRON_SECRET, same as the demo reset.
 *
 * After the columns exist, this route can be deleted — but leaving it is
 * harmless because the statements are idempotent.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, error } from "@/lib/api-helpers";

async function run(req: NextRequest) {
  // Authorise via Authorization: Bearer <secret> OR ?secret=<secret>
  const secret      = process.env.CRON_SECRET;
  const authHeader  = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const authorised =
    (!!secret && authHeader === `Bearer ${secret}`) ||
    (!!secret && querySecret === secret);
  if (!authorised) return error("Unauthorized", 401);

  try {
    const applied: string[] = [];

    // Add the production-schedule "closed" lifecycle columns if missing.
    // (Legacy — the close flow now snapshots to production_run_history and
    // deletes the live row, but these columns remain harmless.)
    await db.$executeRawUnsafe(
      `ALTER TABLE "production_schedules" ADD COLUMN IF NOT EXISTS "isClosed" BOOLEAN NOT NULL DEFAULT false;`
    );
    applied.push('production_schedules.isClosed');

    await db.$executeRawUnsafe(
      `ALTER TABLE "production_schedules" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);`
    );
    applied.push('production_schedules.closedAt');

    // Production run history archive (stacking completed runs). Snapshot tables
    // — denormalised, no FKs except bakery cascade. Idempotent creation.
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "production_run_history" (
        "id" TEXT NOT NULL,
        "bakeryId" TEXT NOT NULL,
        "scheduleDate" DATE NOT NULL,
        "shiftType" "ShiftType" NOT NULL,
        "aiNotes" TEXT,
        "approvedByName" TEXT,
        "closedByName" TEXT,
        "ovenUtilizationPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
        "batchCount" INTEGER NOT NULL DEFAULT 0,
        "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "production_run_history_pkey" PRIMARY KEY ("id")
      );
    `);
    applied.push('table production_run_history');

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "production_run_history_bakeryId_closedAt_idx"
      ON "production_run_history" ("bakeryId", "closedAt");
    `);
    applied.push('index production_run_history_bakeryId_closedAt');

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "production_run_history_batches" (
        "id" TEXT NOT NULL,
        "runHistoryId" TEXT NOT NULL,
        "recipeName" TEXT NOT NULL,
        "recipeCategory" TEXT NOT NULL,
        "quantity" INTEGER NOT NULL,
        "scaleFactor" DECIMAL(8,3) NOT NULL,
        "plannedStartTime" TIMESTAMP(3) NOT NULL,
        "plannedEndTime" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "production_run_history_batches_pkey" PRIMARY KEY ("id")
      );
    `);
    applied.push('table production_run_history_batches');

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "production_run_history_batches_runHistoryId_idx"
      ON "production_run_history_batches" ("runHistoryId");
    `);
    applied.push('index production_run_history_batches_runHistoryId');

    // Foreign keys (added separately so re-runs don't fail if they exist).
    await db.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "production_run_history"
          ADD CONSTRAINT "production_run_history_bakeryId_fkey"
          FOREIGN KEY ("bakeryId") REFERENCES "bakeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await db.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "production_run_history_batches"
          ADD CONSTRAINT "production_run_history_batches_runHistoryId_fkey"
          FOREIGN KEY ("runHistoryId") REFERENCES "production_run_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    applied.push('foreign keys');

    return ok({ message: "Migration applied (idempotent).", applied });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Migration failed";
    return error(message, 500);
  }
}

export async function GET(req: NextRequest)  { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
