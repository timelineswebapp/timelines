import { revalidatePath } from "next/cache";
import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { importService } from "@/src/server/services/import-service";

export const POST = withAdminAuth(async (request: Request) => {
  const result = await importService.execute(await request.json());

  revalidatePath("/");
  revalidatePath("/search");
  for (const slug of result.affectedTimelineSlugs) {
    revalidatePath(`/timeline/${slug}`);
  }

  return ok(result);
});
