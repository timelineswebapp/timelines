import type { SearchCertificationPersistence } from "@/src/server/search-certification/contracts";
import { searchCertificationService } from "@/src/server/services/search-certification-service";

export async function runSearchCertificationCommand(input: {
  actor: string;
  scope?: "end-to-end";
  persistence?: SearchCertificationPersistence;
  write: (line: string) => void;
}): Promise<number> {
  try {
    if (input.scope !== "end-to-end") {
      input.write(JSON.stringify({ ok: false, component: "search_certification", error: "Unsupported Search certification scope." }));
      return 1;
    }
    const report = await searchCertificationService.certify({ actor: input.actor, persistence: input.persistence });
    input.write(JSON.stringify({ ok: report.status === "passed", component: "search_certification", report }));
    return report.status === "passed" ? 0 : 1;
  } catch (error) {
    input.write(JSON.stringify({ ok: false, component: "search_certification", error: error instanceof Error ? error.message : String(error) }));
    return 1;
  }
}
