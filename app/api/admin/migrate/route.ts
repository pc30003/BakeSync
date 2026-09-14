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
    await db.$executeRawUnsafe(
      `ALTER TABLE "production_schedules" ADD COLUMN IF NOT EXISTS "isClosed" BOOLEAN NOT NULL DEFAULT false;`
    );
    applied.push('production_schedules.isClosed');

    await db.$executeRawUnsafe(
      `ALTER TABLE "production_schedules" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);`
    );
    applied.push('production_schedules.closedAt');

    return ok({ message: "Migration applied (idempotent).", applied });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Migration failed";
    return error(message, 500);
  }
}

export async function GET(req: NextRequest)  { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
