/**
 * GET   /api/schedules/[id]   — fetch a single schedule with full batch detail
 * PATCH /api/schedules/[id]   — approve or revoke a schedule
 *
 * When a schedule is APPROVED the agent automatically:
 *   1. Deducts ingredient stock for every batch (quantity × scaleFactor × wastageBuffer)
 *   2. Recomputes alert levels on all affected ingredients
 *   3. Creates ProcurementRecommendations for any ingredient that goes LOW/CRITICAL
 *   4. Fires AgentAlerts for CRITICAL shortfalls
 *   5. Logs an AgentAction recording every deduction made
 *
 * When a schedule is REVOKED the stock deductions are NOT reversed
 * (they are already consumed). A note is added to aiNotes.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ok, notFound, serverError, validationError, requireAuth, error,
} from "@/lib/api-helpers";
import { enqueue } from "@/lib/agent/enqueue";

const ApproveSchema = z.object({
  approved: z.boolean(),
});

// ─── GET /api/schedules/[id] ──────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const schedule = await db.productionSchedule.findFirst({
      where: { id: params.id, bakeryId: session!.user.bakeryId },
      include: {
        batches: {
          include: {
            recipe:        { include: { stages: { orderBy: { order: "asc" } } } },
            checklist:     { orderBy: { order: "asc" } },
            assignedStaff: true,
          },
          orderBy: { plannedStartTime: "asc" },
        },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    if (!schedule) return notFound("Schedule");
    return ok(schedule);
  } catch (err) {
    return serverError(err);
  }
}

// ─── PATCH /api/schedules/[id] ────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, response } = await requireAuth(["HEAD_BAKER"]);
  if (response) return response;

  try {
    const body   = await req.json();
    const parsed = ApproveSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const bakeryId = session!.user.bakeryId;

    const existing = await db.productionSchedule.findFirst({
      where: { id: params.id, bakeryId },
      include: {
        batches: {
          include: {
            recipe: {
              include: {
                ingredients: {
                  include: { ingredient: true },
                },
              },
            },
          },
        },
      },
    });
    if (!existing) return notFound("Schedule");

    // ── Approve ───────────────────────────────────────────────────────────
    if (parsed.data.approved) {
      if (existing.isApproved) {
        return error("Schedule is already approved.", 409);
      }

      // Track all deductions made in this approval for the AgentAction log
      const deductionLog: Array<{
        ingredientId:   string;
        name:           string;
        deductedGrams:  number;
        newStockGrams:  number;
        alertLevel:     string;
      }> = [];

      const newProcurements: string[] = [];

      // ── 1. Deduct stock for every batch ──────────────────────────────────
      for (const batch of existing.batches) {
        const scale      = Number(batch.scaleFactor);
        const buffer     = Number(batch.recipe.wastageBufferPercent) / 100;
        const multiplier = scale * (1 + buffer);

        for (const ri of batch.recipe.ingredients) {
          if (ri.isOptional) continue;

          const requiredGrams = Number(ri.quantityGrams) * multiplier;
          const ingredient    = ri.ingredient;
          const currentStock  = Number(ingredient.stockGrams);
          const newStock      = Math.max(0, currentStock - requiredGrams);

          // Recompute alert level
          const critical = Number(ingredient.criticalThresholdGrams);
          const reorder  = Number(ingredient.reorderThresholdGrams);
          const alertLevel =
            newStock <= 0        ? "OUT_OF_STOCK" :
            newStock <= critical ? "CRITICAL"     :
            newStock <= reorder  ? "LOW"           :
            "OK";

          // Update stock and alert level atomically
          await db.$transaction([
            db.stockDeduction.create({
              data: {
                bakeryId,
                ingredientId:  ingredient.id,
                quantityGrams: requiredGrams,
                reason:        "PRODUCTION",
                referenceId:   batch.id,
                loggedById:    session!.user.id,
              },
            }),
            db.ingredient.update({
              where: { id: ingredient.id },
              data:  { stockGrams: newStock, alertLevel },
            }),
          ]);

          deductionLog.push({
            ingredientId:  ingredient.id,
            name:          ingredient.name,
            deductedGrams: requiredGrams,
            newStockGrams: newStock,
            alertLevel,
          });

          // ── 2. Create procurement recs for newly critical ingredients ─────
          if (alertLevel === "CRITICAL" || alertLevel === "OUT_OF_STOCK") {
            const existingRec = await db.procurementRecommendation.findFirst({
              where: {
                bakeryId,
                ingredientId: ingredient.id,
                approvedAt:   null,
                dismissedAt:  null,
              },
            });

            if (!existingRec) {
              const shortfall    = reorder - newStock;
              const orderGrams   = shortfall * 1.25;  // 25% buffer
              const estimatedCost = ingredient.costPerKg > 0
                ? (orderGrams / 1000) * Number(ingredient.costPerKg)
                : null;

              await db.procurementRecommendation.create({
                data: {
                  bakeryId,
                  ingredientId:          ingredient.id,
                  currentStockGrams:     newStock,
                  requiredGrams:         reorder,
                  shortfallGrams:        Math.max(0, shortfall),
                  recommendedOrderGrams: orderGrams,
                  supplierId:            ingredient.supplierId,
                  estimatedCost,
                  urgency:               alertLevel === "OUT_OF_STOCK" ? "CRITICAL" : "HIGH",
                },
              });
              newProcurements.push(ingredient.name);
            }

            // ── 3. Fire an AgentAlert for critical drops ─────────────────────
            await db.agentAlert.create({
              data: {
                bakeryId,
                type:     "SHORTFALL",
                severity: alertLevel === "OUT_OF_STOCK" ? "CRITICAL" : "WARNING",
                title:    `Stock critical after approval: ${ingredient.name}`,
                message:  `Approving this schedule deducted ${requiredGrams.toFixed(0)}g of ${ingredient.name}. ` +
                          `Remaining stock: ${newStock.toFixed(0)}g (${alertLevel.replace("_", " ")}). ` +
                          `A procurement recommendation has been raised automatically.`,
                relatedEntityId:   ingredient.id,
                relatedEntityType: "Ingredient",
              },
            });
          }
        }
      }

      // ── 4. Approve the schedule ───────────────────────────────────────────
      const approved = await db.productionSchedule.update({
        where: { id: params.id },
        data: {
          isApproved:   true,
          approvedById: session!.user.id,
          approvedAt:   new Date(),
        },
        include: { approvedBy: { select: { id: true, name: true } } },
      });

      // ── 5. Log the approval + deductions as an AgentAction ───────────────
      await db.agentAction.create({
        data: {
          bakeryId,
          type:    "GENERATE_SCHEDULE",
          status:  "COMPLETED",
          summary: `Schedule approved by ${session!.user.name ?? session!.user.email}. ` +
                   `${deductionLog.length} stock deductions applied. ` +
                   (newProcurements.length > 0
                     ? `New procurement recs raised for: ${newProcurements.join(", ")}.`
                     : "All stock levels healthy post-deduction."),
          details: {
            scheduleId:    params.id,
            approvedBy:    session!.user.name,
            deductions:    deductionLog,
            newProcurements,
          },
          requiresApproval: false,
          completedAt:      new Date(),
        },
      });

      // ── 6. Queue immediate stock recompute so badges refresh in <5 min ───
      await enqueue.recomputeStock(bakeryId);

      return ok({
        schedule:       approved,
        deductions:     deductionLog.length,
        newProcurements,
        message:        `Schedule approved. ${deductionLog.length} stock deductions applied.` +
                        (newProcurements.length > 0
                          ? ` Procurement recs raised for: ${newProcurements.join(", ")}.`
                          : ""),
      });

    // ── Revoke ─────────────────────────────────────────────────────────────
    } else {
      const revoked = await db.productionSchedule.update({
        where: { id: params.id },
        data: {
          isApproved:   false,
          approvedById: null,
          approvedAt:   null,
        },
      });

      return ok({
        schedule: revoked,
        message:  "Schedule approval revoked. Stock deductions already applied are NOT reversed.",
      });
    }

  } catch (err) {
    return serverError(err);
  }
}
