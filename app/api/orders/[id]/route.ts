import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, noContent, notFound, serverError, validationError, requireAuth } from "@/lib/api-helpers";

const UpdateOrderSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "IN_PRODUCTION", "READY", "FULFILLED", "CANCELLED"]).optional(),
  fulfilmentDate: z.string().datetime().optional(),
  notes: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  customerEmail: z.string().email().nullable().optional(),
});

// GET /api/orders/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const order = await db.order.findFirst({
      where: { id: params.id, bakeryId: session!.user.bakeryId },
      include: { lineItems: true },
    });

    if (!order) return notFound("Order");
    return ok(order);
  } catch (err) {
    return serverError(err);
  }
}

// PATCH /api/orders/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, response } = await requireAuth(["HEAD_BAKER", "PURCHASING_MANAGER"]);
  if (response) return response;

  try {
    const body = await req.json();
    const parsed = UpdateOrderSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const existing = await db.order.findFirst({
      where: { id: params.id, bakeryId: session!.user.bakeryId },
    });
    if (!existing) return notFound("Order");

    const updated = await db.order.update({
      where: { id: params.id },
      data: {
        ...parsed.data,
        ...(parsed.data.fulfilmentDate && {
          fulfilmentDate: new Date(parsed.data.fulfilmentDate),
        }),
      },
      include: { lineItems: true },
    });

    return ok(updated);
  } catch (err) {
    return serverError(err);
  }
}

// DELETE /api/orders/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, response } = await requireAuth(["HEAD_BAKER"]);
  if (response) return response;

  try {
    const existing = await db.order.findFirst({
      where: { id: params.id, bakeryId: session!.user.bakeryId },
    });
    if (!existing) return notFound("Order");

    await db.order.delete({ where: { id: params.id } });
    return noContent();
  } catch (err) {
    return serverError(err);
  }
}
