import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/types";
import { ZodError } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function created<T>(data: T) {
  return ok(data, 201);
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function notFound(entity = "Resource") {
  return error(`${entity} not found`, 404);
}

export function forbidden() {
  return error("Forbidden", 403);
}

export function unauthorized() {
  return error("Unauthorized", 401);
}

export function serverError(err: unknown) {
  console.error("[API Error]", err);
  const message =
    err instanceof Error ? err.message : "Internal server error";
  return error(message, 500);
}

export function validationError(err: ZodError) {
  return NextResponse.json(
    { success: false, error: "Validation error", issues: err.issues },
    { status: 422 }
  );
}

/**
 * Get the authenticated session or return a 401 response.
 * Optionally restrict to specific roles.
 */
export async function requireAuth(allowedRoles?: UserRole[]) {
  const session = await auth();

  if (!session?.user) {
    return { session: null, response: unauthorized() };
  }

  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    return { session: null, response: forbidden() };
  }

  return { session, response: null };
}
