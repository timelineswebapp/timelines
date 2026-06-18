import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const BLOCKED_ADMIN_PREFIXES = ["admin", "editor", "dashboard", "backend", "control"];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname.toLowerCase();
  const firstSegment = pathname.split("/").filter(Boolean)[0] || "";

  const shouldBlock = BLOCKED_ADMIN_PREFIXES.some(
    (prefix) => firstSegment === prefix || firstSegment.startsWith(`${prefix}-`)
  );

  if (shouldBlock) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-robots-tag": "noindex, nofollow"
      }
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)"
  ]
};
