import type { PublishedMemoryCertificationPersistence } from "@/src/server/published-memory-certification/contracts";
import { publishedMemoryCertificationService } from "@/src/server/services/published-memory-certification-service";

export async function runPublishedMemoryCertificationCommand(input: {
  actor: string;
  scope?: "end-to-end";
  persistence?: PublishedMemoryCertificationPersistence;
  write: (line: string) => void;
}): Promise<number> {
  try {
    if (input.scope !== "end-to-end") {
      input.write(JSON.stringify({
        ok: false,
        component: "published_memory_certification",
        error: "Unsupported Published Memory certification scope."
      }));
      return 1;
    }
    const report = await publishedMemoryCertificationService.certify({
      actor: input.actor,
      persistence: input.persistence
    });
    input.write(JSON.stringify({
      ok: report.status === "passed",
      component: "published_memory_certification",
      report
    }));
    return report.status === "passed" ? 0 : 1;
  } catch (error) {
    input.write(JSON.stringify({
      ok: false,
      component: "published_memory_certification",
      error: error instanceof Error ? error.message : String(error)
    }));
    return 1;
  }
}
