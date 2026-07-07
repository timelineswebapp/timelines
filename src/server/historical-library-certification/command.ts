import type { HistoricalLibraryCertificationPersistence } from "@/src/server/historical-library-certification/contracts";
import { historicalLibraryCertificationService } from "@/src/server/services/historical-library-certification-service";

export async function runHistoricalLibraryCertificationCommand(input: {
  actor: string;
  scope?: "end-to-end";
  persistence?: HistoricalLibraryCertificationPersistence;
  write: (line: string) => void;
}): Promise<number> {
  try {
    if (input.scope !== "end-to-end") {
      input.write(JSON.stringify({
        ok: false,
        component: "historical_library_certification",
        error: "Unsupported Historical Library certification scope."
      }));
      return 1;
    }
    const report = await historicalLibraryCertificationService.certify({
      actor: input.actor,
      persistence: input.persistence
    });
    input.write(JSON.stringify({
      ok: report.status === "passed",
      component: "historical_library_certification",
      report
    }));
    return report.status === "passed" ? 0 : 1;
  } catch (error) {
    input.write(JSON.stringify({
      ok: false,
      component: "historical_library_certification",
      error: error instanceof Error ? error.message : String(error)
    }));
    return 1;
  }
}
