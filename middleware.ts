import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(_request: NextRequest) {
  return new NextResponse("Not Found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": "noindex, nofollow"
    }
  });
}

export const config = {
  matcher: ["/admin/:path*", "/editor/:path*", "/dashboard/:path*"]
};
