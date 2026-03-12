import { revalidatePath } from "next/cache";
import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { importService } from "@/src/server/services/import-service";

export const POST = withAdminAuth(async (request: Request) => {
  const result = await importService.execute(await request.json());

  try {
    revalidatePath("/");
    revalidatePath("/search");
    for (const slug of result.affectedTimelineSlugs) {
      revalidatePath(`/timeline/${slug}`);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        component: "import_execute_route",
        message: "Import succeeded but revalidation failed.",
        affectedTimelineSlugs: result.affectedTimelineSlugs,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
      })
    );
  }

  return ok(result);
});
