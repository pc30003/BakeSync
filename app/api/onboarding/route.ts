/**
 * POST /api/onboarding
 *
 * Saves onboarding wizard data and marks the bakery as onboarded.
 * Called by the onboarding wizard after the user completes all steps.
 *
 * Idempotent — safe to call multiple times.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, serverError, validationError, requireAuth } from "@/lib/api-helpers";

const OnboardingSchema = z.object({
  // Step 1 — bakery profile
  bakeryName:  z.string().min(1).optional(),
  timezone:    z.string().optional(),
  currency:    z.string().length(3).optional(),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  ovenCount:   z.number().int().min(1).max(50).optional(),

  // Step 3 — mark complete
  complete: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const { session, response } = await requireAuth(["HEAD_BAKER"]);
  if (response) return response;

  try {
    const body   = await req.json();
    const parsed = OnboardingSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { complete, bakeryName, ...settings } = parsed.data;

    const updated = await db.bakery.update({
      where: { id: session!.user.bakeryId },
      data: {
        ...(bakeryName && { name: bakeryName }),
        ...(settings.timezone    && { timezone:    settings.timezone }),
        ...(settings.currency    && { currency:    settings.currency }),
        ...(settings.openingTime && { openingTime: settings.openingTime }),
        ...(settings.closingTime && { closingTime: settings.closingTime }),
        ...(settings.ovenCount   && { ovenCount:   settings.ovenCount }),
        ...(complete             && { isOnboarded: true }),
      },
    });

    // On completion: seed the initial agent tasks
    if (complete) {
      await db.taskQueue.createMany({
        data: [
          // Immediate monitor run
          {
            bakeryId:     session!.user.bakeryId,
            type:         "MONITOR_BAKERY",
            priority:     1,
            scheduledFor: new Date(),
            payload:      { reason: "onboarding_complete" },
          },
          // Stock alert recompute
          {
            bakeryId:     session!.user.bakeryId,
            type:         "RECOMPUTE_STOCK_ALERTS",
            priority:     2,
            scheduledFor: new Date(),
            payload:      {},
          },
        ],
        skipDuplicates: true,
      });
    }

    return ok({ bakery: updated, isOnboarded: updated.isOnboarded });
  } catch (err) {
    return serverError(err);
  }
}
