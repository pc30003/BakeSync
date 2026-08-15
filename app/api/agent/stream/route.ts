/**
 * POST /api/agent/stream
 *
 * Server-Sent Events (SSE) endpoint that runs the full agent pipeline
 * and streams each step as it happens so the UI can display a live
 * reasoning log to the judge / head baker.
 *
 * Steps streamed:
 *   1. context_start  — querying the database
 *   2. context_done   — summary of what was found
 *   3. planner_start  — calling OpenAI
 *   4. planner_done   — plan received, batch count
 *   5. write_start    — persisting to database
 *   6. write_progress — per-batch progress
 *   7. write_done     — schedule written, shortfalls
 *   8. complete       — final result with scheduleId
 *   9. error          — if anything fails
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildAgentContext } from "@/lib/agent/context-builder";
import { runPlanner }        from "@/lib/agent/planner";
import { writeSchedule }     from "@/lib/agent/schedule-writer";
import type { AgentShiftType } from "@/lib/agent/types";
import { z } from "zod";

export const maxDuration = 60;

const RequestSchema = z.object({
  scheduleDate:    z.string(),
  shiftType:       z.enum(["MORNING", "AFTERNOON", "EVENING", "OVERNIGHT"]),
  forceRegenerate: z.boolean().default(false),
});

// Helper: encode an SSE event
function sseEvent(type: string, payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ type, ...payload, ts: Date.now() })}\n\n`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user)                       return new Response("Unauthorized", { status: 401 });
  if (session.user.role !== "HEAD_BAKER")   return new Response("Forbidden",    { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return new Response("Bad request", { status: 400 });

  const { scheduleDate, shiftType, forceRegenerate } = parsed.data;
  const bakeryId   = session.user.bakeryId;
  const targetDate = new Date(scheduleDate);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function emit(type: string, payload: Record<string, unknown> = {}) {
        controller.enqueue(encoder.encode(sseEvent(type, payload)));
      }

      try {
        // ── Guard: return existing approved schedule ──────────────────────
        if (!forceRegenerate) {
          const existing = await db.productionSchedule.findFirst({
            where: { bakeryId, scheduleDate: targetDate, shiftType, isApproved: true },
          });
          if (existing) {
            emit("already_approved", {
              message: "This shift already has an approved schedule.",
              scheduleId: existing.id,
            });
            controller.close();
            return;
          }
        }

        // ── Create AgentAction record ────────────────────────────────────
        const action = await db.agentAction.create({
          data: {
            bakeryId,
            type:    "GENERATE_SCHEDULE",
            status:  "RUNNING",
            summary: `Generate ${shiftType} schedule for ${targetDate.toDateString()}`,
            details: { scheduleDate, shiftType },
            requiresApproval: false,
          },
        });

        // ── Step 1: Build context ────────────────────────────────────────
        emit("context_start", { message: "🔍 Reading bakery state from database…" });
        const startedAt = new Date();
        const context   = await buildAgentContext(bakeryId, targetDate, shiftType as AgentShiftType);

        emit("context_done", {
          message: `📋 Context ready`,
          detail: `${context.pendingOrders.length} orders · ${context.recipes.length} recipes · ${context.stockLevels.length} ingredients`,
          orders:      context.pendingOrders.length,
          recipes:     context.recipes.length,
          ingredients: context.stockLevels.length,
          lowStock:    context.stockLevels.filter(s => s.alertLevel !== "OK").length,
        });

        // ── Step 2: Call OpenAI planner ──────────────────────────────────
        emit("planner_start", {
          message: "🤖 Calling AI planner (OpenAI function calling)…",
          detail:  `Reasoning over orders, stock levels, oven capacity, and stage timings`,
        });

        const plan = await runPlanner(context);

        emit("planner_done", {
          message: `✅ Plan received from AI`,
          detail:  `${plan.batches.length} batch${plan.batches.length !== 1 ? "es" : ""} scheduled · Oven utilisation: ${plan.ovenUtilizationPercent.toFixed(0)}%`,
          batches:             plan.batches.length,
          ovenUtilization:     plan.ovenUtilizationPercent,
          warnings:            plan.warnings.length,
          aiNotes:             plan.aiNotes,
        });

        // Stream each planned batch so judges can see the reasoning
        for (const batch of plan.batches) {
          const shortfalls = batch.ingredientRequirements.filter(r => r.shortfallGrams > 0);
          emit("batch_planned", {
            message: `📦 Batch: ${batch.recipeName}`,
            detail:  `${batch.quantity} units · ×${batch.scaleFactor} scale · ${batch.checklistSteps.length} steps`,
            recipeName:  batch.recipeName,
            quantity:    batch.quantity,
            scaleFactor: batch.scaleFactor,
            startTime:   batch.plannedStartTime,
            endTime:     batch.plannedEndTime,
            ovenSlots:   batch.ovenSlots,
            shortfalls:  shortfalls.map(s => ({ name: s.name, shortfallGrams: s.shortfallGrams })),
          });
        }

        // ── Step 3: Write to database ────────────────────────────────────
        emit("write_start", {
          message: "💾 Writing schedule, checklists, and procurement recommendations…",
        });

        const result = await writeSchedule(context, plan, action.id, startedAt);

        emit("write_done", {
          message: `📅 Schedule saved to database`,
          detail:  `${result.shortfalls.length} shortfall${result.shortfalls.length !== 1 ? "s" : ""} flagged · ${result.processingMs}ms total`,
          scheduleId:   result.scheduleId,
          shortfalls:   result.shortfalls,
          processingMs: result.processingMs,
        });

        // ── Complete ─────────────────────────────────────────────────────
        emit("complete", {
          message:      "🎉 Schedule generation complete",
          scheduleId:   result.scheduleId,
          aiNotes:      result.aiNotes,
          warnings:     result.warnings,
          shortfalls:   result.shortfalls,
          processingMs: result.processingMs,
        });

      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        emit("error", { message: `❌ Agent failed: ${message}` });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
