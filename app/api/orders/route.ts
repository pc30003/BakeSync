import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, created, serverError, validationError, requireAuth } from "@/lib/api-helpers";

const CreateOrderSchema = z.object({
  channel: z.enum(["ECOMMERCE", "WHOLESALE", "EVENT_BOOKING", "SUBSCRIPTION", "POS", "MANUAL"]),
  status: z.enum(["PENDING", "CONFIRMED", "IN_PRODUCTION", "READY", "FULFILLED", "CANCELLED"]).optional(),
  customerName: z.string().nullable().optional(),
  customerEmail: z.string().email().nullable().optional(),
  fulfilmentDate: z.string().datetime(),
  totalValue: z.number().nonnegative(),
  notes: z.string().nullable().optional(),
  externalId: z.string().nullable().optional(),
  lineItems: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative(),
    notes: z.string().nullable().optional(),
  })).min(1),
});

// GET /api/orders — list orders for the bakery
export async function GET(req: NextRequest) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const { searchParams } = new URL(req.url);
    const status   = searchParams.get("status") ?? undefined;
    const channel  = searchParams.get("channel") ?? undefined;
    const from     = searchParams.get("from");
    const to       = searchParams.get("to");
    const page     = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");

    const orders = await db.order.findMany({
      where: {
        bakeryId: session!.user.bakeryId,
        ...(status  && { status:  status  as any }),
        ...(channel && { channel: channel as any }),
        ...(from || to ? {
          fulfilmentDate: {
            ...(from && { gte: new Date(from) }),
            ...(to   && { lte: new Date(to)   }),
          },
        } : {}),
      },
      include: { lineItems: true },
      orderBy: { fulfilmentDate: "asc" },
      skip:  (page - 1) * pageSize,
      take:  pageSize,
    });

    const total = await db.order.count({
      where: { bakeryId: session!.user.bakeryId },
    });

    return ok({ orders, total, page, pageSize });
  } catch (err) {
    return serverError(err);
  }
}

// POST /api/orders — create a new order
export async function POST(req: NextRequest) {
  const { session, response } = await requireAuth(["HEAD_BAKER", "PURCHASING_MANAGER"]);
  if (response) return response;

  try {
    const body = await req.json();
    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { lineItems, ...orderData } = parsed.data;

    const order = await db.order.create({
      data: {
        ...orderData,
        bakeryId: session!.user.bakeryId,
        fulfilmentDate: new Date(orderData.fulfilmentDate),
        status: orderData.status ?? "PENDING",
        lineItems: { create: lineItems },
      },
      include: { lineItems: true },
    });

    return created(order);
  } catch (err) {
    return serverError(err);
  }
}
