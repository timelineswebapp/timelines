import type { ProjectionEngineCertificationPersistence } from "@/src/server/projection-engine-certification/contracts";
import { projectionEngineCertificationService } from "@/src/server/services/projection-engine-certification-service";

export async function runProjectionEngineCertificationCommand(input: {
  actor: string;
  scope?: "end-to-end";
  persistence?: ProjectionEngineCertificationPersistence;
  write: (line: string) => void;
}): Promise<number> {
  try {
    if (input.scope !== "end-to-end") {
      input.write(JSON.stringify({ ok: false, component: "projection_engine_certification", error: "Unsupported Projection Engine certification scope." }));
      return 1;
    }
    const report = await projectionEngineCertificationService.certify({ actor: input.actor, persistence: input.persistence });
    input.write(JSON.stringify({ ok: report.status === "passed", component: "projection_engine_certification", report }));
    return report.status === "passed" ? 0 : 1;
  } catch (error) {
    input.write(JSON.stringify({ ok: false, component: "projection_engine_certification", error: error instanceof Error ? error.message : String(error) }));
    return 1;
  }
}
