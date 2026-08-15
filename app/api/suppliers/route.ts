import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, created, serverError, validationError, requireAuth } from "@/lib/api-helpers";

const CreateSupplierSchema = z.object({
  name: z.string().min(1),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  leadTimeDays: z.number().int().nonnegative().default(1),
  notes: z.string().nullable().optional(),
});

// GET /api/suppliers
export async function GET(_req: NextRequest) {
  const { session, response } = await requireAuth(["HEAD_BAKER", "PURCHASING_MANAGER"]);
  if (response) return response;

  try {
    const suppliers = await db.supplier.findMany({
      where: { bakeryId: session!.user.bakeryId, isActive: true },
      include: {
        _count: { select: { ingredients: true } },
      },
      orderBy: { name: "asc" },
    });

    return ok(suppliers);
  } catch (err) {
    return serverError(err);
  }
}

// POST /api/suppliers
export async function POST(req: NextRequest) {
  const { session, response } = await requireAuth(["HEAD_BAKER", "PURCHASING_MANAGER"]);
  if (response) return response;

  try {
    const body = await req.json();
    const parsed = CreateSupplierSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const supplier = await db.supplier.create({
      data: { ...parsed.data, bakeryId: session!.user.bakeryId },
    });

    return created(supplier);
  } catch (err) {
    return serverError(err);
  }
}
