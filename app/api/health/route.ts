import { NextResponse } from "next/server";
import { getSql } from "@/src/server/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HealthSuccessResponse = {
  ok: true;
  db: true;
  env: true;
  timestamp: string;
};

type HealthFailureResponse = {
  ok: false;
  db: false;
  env: boolean;
  error: "missing_environment" | "database_unavailable" | "healthcheck_failed";
  timestamp: string;
};

const REQUIRED_ENV_KEYS = ["DATABASE_URL"] as const;
const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate"
} as const;

function hasRequiredEnvironment(): boolean {
  return REQUIRED_ENV_KEYS.every((key) => Boolean(process.env[key]?.trim()));
}

function successResponse(timestamp: string) {
  const body: HealthSuccessResponse = {
    ok: true,
    db: true,
    env: true,
    timestamp
  };

  return NextResponse.json(body, {
    status: 200,
    headers: RESPONSE_HEADERS
  });
}

function failureResponse(
  timestamp: string,
  env: boolean,
  error: HealthFailureResponse["error"],
  status: number
) {
  const body: HealthFailureResponse = {
    ok: false,
    db: false,
    env,
    error,
    timestamp
  };

  return NextResponse.json(body, {
    status,
    headers: RESPONSE_HEADERS
  });
}

function logHealthError(message: string): void {
  console.error(
    JSON.stringify({
      level: "error",
      component: "health_endpoint",
      message
    })
  );
}

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const envReady = hasRequiredEnvironment();
    if (!envReady) {
      return failureResponse(timestamp, false, "missing_environment", 503);
    }

    const sql = getSql();
    if (!sql) {
      return failureResponse(timestamp, true, "database_unavailable", 503);
    }

    try {
      await sql`SELECT 1`;
    } catch (error) {
      logHealthError(error instanceof Error ? error.message : "Database probe failed.");
      return failureResponse(timestamp, true, "database_unavailable", 503);
    }

    return successResponse(timestamp);
  } catch (error) {
    logHealthError(error instanceof Error ? error.message : "Unexpected healthcheck failure.");
    return failureResponse(timestamp, hasRequiredEnvironment(), "healthcheck_failed", 500);
  }
}
