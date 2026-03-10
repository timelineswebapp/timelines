import { NextResponse } from "next/server";
import { ZodError } from "zod";

const DEFAULT_ERROR_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "RATE_LIMITED",
  500: "INTERNAL_ERROR"
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(
  status: number,
  message: string,
  details?: unknown,
  code = DEFAULT_ERROR_CODES[status] || "ERROR",
  init?: ResponseInit
) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        details
      }
    },
    {
      status,
      ...init
    }
  );
}

export function fromError(error: unknown) {
  if (error instanceof ApiError) {
    return fail(error.status, error.message, error.details, error.code);
  }

  if (error instanceof ZodError) {
    return fail(400, "Validation failed.", error.flatten(), "VALIDATION_FAILED");
  }

  console.error(
    JSON.stringify({
      level: "error",
      component: "api",
      message: error instanceof Error ? error.message : "Unexpected error",
      stack: error instanceof Error ? error.stack : undefined
    })
  );

  return fail(500, "Internal server error.", undefined, "INTERNAL_ERROR");
}
