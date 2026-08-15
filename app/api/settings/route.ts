/**
 * PATCH /api/settings
 *
 * Updates bakery settings for the authenticated HEAD_BAKER.
 * All fields are optional — only provided fields are updated.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, serverError, validationError, requireAuth } from "@/lib/api-helpers";

const SettingsSchema = z.object({
  name:        z.string().min(1, "Bakery name is required").max(100).optional(),
  timezone:    z.string().min(1).optional(),
  currency:    z.string().length(3, "Currency must be a 3-letter ISO code").optional(),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm format").optional(),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm format").optional(),
  ovenCount:   z.number().int().min(1).max(50).optional(),
});

export async function GET() {
  const { session, response } = await requireAuth(["HEAD_BAKER"]);
  if (response) return response;

  try {
    const bakery = await db.bakery.findUnique({
      where:  { id: session!.user.bakeryId },
      select: {
        id:          true,
        name:        true,
        timezone:    true,
        currency:    true,
        openingTime: true,
        closingTime: true,
        ovenCount:   true,
        plan:        true,
        subscriptionStatus: true,
        createdAt:   true,
      },
    });

    return ok(bakery);
  } catch (err) {
    return serverError(err);
  }
}

export async function PATCH(req: NextRequest) {
  const { session, response } = await requireAuth(["HEAD_BAKER"]);
  if (response) return response;

  try {
    const body   = await req.json();
    const parsed = SettingsSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const updated = await db.bakery.update({
      where: { id: session!.user.bakeryId },
      data:  parsed.data,
      select: {
        id:          true,
        name:        true,
        timezone:    true,
        currency:    true,
        openingTime: true,
        closingTime: true,
        ovenCount:   true,
      },
    });

    return ok(updated);
  } catch (err) {
    return serverError(err);
  }
}
