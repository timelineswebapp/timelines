import { config } from "@/src/lib/config";
import { platformReadModelService } from "@/src/server/services/platform-read-model-service";

type ContinuationResult = {
  outcomes?: Array<{
    nextState?: {
      stage?: string;
    };
  }>;
};

export function continuationPublished(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const outcomes = (result as ContinuationResult).outcomes;
  return Array.isArray(outcomes) && outcomes.some((outcome) =>
    outcome.nextState?.stage === "completed"
  );
}

export const platformRevalidationService = {
  async revalidateAfterContinuation(result: unknown) {
    if (!continuationPublished(result)) {
      return { executed: false, reason: "no_publication_completed", paths: [] as string[] };
    }
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret) {
      throw new Error("CRON_SECRET is required to invalidate the deployed Platform cache after publication.");
    }
    const timelineSlugs = await platformReadModelService.listStaticSlugs(50);
    const paths = [
      "/",
      "/search",
      "/sitemap.xml",
      ...timelineSlugs.map((slug) => `/timeline/${slug}`)
    ];
    const response = await fetch(new URL("/api/cron/revalidate", config.siteUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ timelineSlugs })
    });
    if (!response.ok) {
      throw new Error(`Platform cache invalidation failed with HTTP ${response.status}.`);
    }
    return { executed: true, reason: "publication_completed", paths };
  }
};
