import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { applySecurityHeaders } from "@/src/server/security/security-headers";

const BLOCKED_ADMIN_PREFIXES = ["admin", "editor", "dashboard", "backend", "control"];

function isGuessedAdminPath(pathname: string): boolean {
  const firstSegment = pathname.toLowerCase().split("/").filter(Boolean)[0] || "";
  return BLOCKED_ADMIN_PREFIXES.some((prefix) => firstSegment === prefix || firstSegment.startsWith(`${prefix}-`));
}

export function proxy(request: NextRequest) {
  const response = isGuessedAdminPath(request.nextUrl.pathname)
    ? new NextResponse("Not Found", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "x-robots-tag": "noindex, nofollow"
        }
      })
    : NextResponse.next();

  applySecurityHeaders(response.headers);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
