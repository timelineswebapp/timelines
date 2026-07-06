import type { EditorialCertificationPersistence } from "@/src/server/editorial-certification/contracts";
import { editorialCertificationService } from "@/src/server/services/editorial-certification-service";
import { ei003CertificationService } from "@/src/server/services/ei003-certification-service";

export async function runEditorialCertificationCommand(input: {
  actor: string;
  epic?: "EI-002" | "EI-003";
  persistence?: EditorialCertificationPersistence;
  write: (line: string) => void;
}): Promise<number> {
  try {
    const report = input.epic === "EI-003"
      ? await ei003CertificationService.certify({
        actor: input.actor,
        persistence: input.persistence
      })
      : await editorialCertificationService.certifyEi002({
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

export const runEi002CertificationCommand = runEditorialCertificationCommand;
