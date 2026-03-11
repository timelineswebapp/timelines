import { revalidatePath } from "next/cache";
import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { importService } from "@/src/server/services/import-service";

export const POST = withAdminAuth(async (request: Request) => {
  const result = await importService.execute(await request.json());
  const timeline = await adminService.getTimelineById(result.timelineId);

  revalidatePath("/");
  revalidatePath("/search");
  if (timeline?.slug) {
    revalidatePath(`/timeline/${timeline.slug}`);
  }

  return ok(result);
});
