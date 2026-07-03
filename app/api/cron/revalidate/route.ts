import { revalidatePath } from "next/cache";
import { fail, fromError, ok } from "@/src/server/api/responses";
import { isAuthorizedCronRequest } from "@/src/server/api/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validTimelineSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((slug): slug is string =>
    typeof slug === "string" &&
    slug.length > 0 &&
    slug.length <= 200 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  ))].slice(0, 50);
}

export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return fail(401, "Platform revalidation authentication failed.");
  }
  try {
    const body = await request.json() as { timelineSlugs?: unknown };
    const timelineSlugs = validTimelineSlugs(body.timelineSlugs);
    const paths = [
      "/",
      "/search",
      "/sitemap.xml",
      ...timelineSlugs.map((slug) => `/timeline/${slug}`)
    ];
    for (const path of paths) {
      revalidatePath(path);
    }
    return ok({ revalidated: paths });
  } catch (error) {
    return fromError(error);
  }
}
