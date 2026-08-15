/**
 * POST /api/auth/register
 *
 * Creates a new bakery + head baker user atomically.
 * Production mode only — returns 403 in demo mode.
 *
 * Body:
 *   { name, email, password, bakeryName, timezone?, currency? }
 *
 * On success:
 *   - Creates Bakery (isOnboarded: false — wizard must be completed)
 *   - Creates User with bcrypt-hashed password and HEAD_BAKER role
 *   - Enqueues a MONITOR_BAKERY task so the agent starts watching immediately
 *   - Returns { userId, bakeryId } — caller signs in via NextAuth credentials
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { created, error, serverError, validationError } from "@/lib/api-helpers";

const IS_DEMO = process.env.NEXT_PUBLIC_APP_MODE === "demo";

const RegisterSchema = z.object({
  name:       z.string().min(1,  "Your name is required"),
  email:      z.string().email("Enter a valid email address"),
  password:   z.string().min(8,  "Password must be at least 8 characters"),
  bakeryName: z.string().min(1,  "Bakery name is required"),
  timezone:   z.string().default("Europe/London"),
  currency:   z.string().length(3).default("GBP"),
});

export async function POST(req: NextRequest) {
  if (IS_DEMO) {
    return error("Registration is disabled in demo mode.", 403);
  }

  try {
    const body   = await req.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { name, email, password, bakeryName, timezone, currency } = parsed.data;

    // Check email not already taken
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return error("An account with this email already exists.", 409);
    }

    // Hash password
    const bcrypt       = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 12);

    // Create bakery + user + first monitor task atomically
    const { bakery, user } = await db.$transaction(async (tx) => {
      const bakery = await tx.bakery.create({
        data: {
          name:        bakeryName,
          timezone,
          currency,
          isOnboarded: false,
          plan:        "FREE",
        },
      });

      const user = await tx.user.create({
        data: {
          name,
          email,
          password: passwordHash,
          role:     "HEAD_BAKER",
          bakeryId: bakery.id,
        },
      });

      // Seed an initial monitor task so the agent starts on first cron tick
      await tx.taskQueue.create({
        data: {
          bakeryId:     bakery.id,
          type:         "MONITOR_BAKERY",
          priority:     3,
          scheduledFor: new Date(),
          payload:      { reason: "initial_setup" },
        },
      });

      return { bakery, user };
    });

    return created({
      userId:   user.id,
      bakeryId: bakery.id,
      message:  "Account created. Please sign in to complete your bakery setup.",
    });

  } catch (err) {
    return serverError(err);
  }
}
