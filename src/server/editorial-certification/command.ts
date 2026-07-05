import type { EditorialCertificationPersistence } from "@/src/server/editorial-certification/contracts";
import { editorialCertificationService } from "@/src/server/services/editorial-certification-service";

export async function runEi002CertificationCommand(input: {
  actor: string;
  persistence?: EditorialCertificationPersistence;
  write: (line: string) => void;
}): Promise<number> {
  try {
    const report = await editorialCertificationService.certifyEi002({
      actor: input.actor,
      persistence: input.persistence
    });
    input.write(JSON.stringify({
      ok: report.status === "passed",
      component: "editorial_intelligence_certification",
      report
    }));
    return report.status === "passed" ? 0 : 1;
  } catch (error) {
    input.write(JSON.stringify({
      ok: false,
      component: "editorial_intelligence_certification",
      error: error instanceof Error ? error.message : String(error)
    }));
    return 1;
  }
}

