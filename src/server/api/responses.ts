import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(status: number, message: string, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        message,
        details
      }
    },
    { status }
  );
}

export function fromError(error: unknown) {
  if (error instanceof ZodError) {
    return fail(400, "Validation failed.", error.flatten());
  }

  console.error(
    JSON.stringify({
      level: "error",
      component: "api",
      message: error instanceof Error ? error.message : "Unexpected error",
      stack: error instanceof Error ? error.stack : undefined
    })
  );

  return fail(500, "Internal server error.");
}
