import type { PlatformCertificationPersistence } from "@/src/server/platform-certification/contracts";
import { platformCertificationService } from "@/src/server/services/platform-certification-service";

export async function runPlatformCertificationCommand(input: {
  actor: string;
  scope?: "end-to-end";
  persistence?: PlatformCertificationPersistence;
  write: (line: string) => void;
}): Promise<number> {
  try {
    if (input.scope !== "end-to-end") {
      input.write(JSON.stringify({ ok: false, component: "platform_certification", error: "Unsupported Public Platform certification scope." }));
      return 1;
    }
    const report = await platformCertificationService.certify({ actor: input.actor, persistence: input.persistence });
    input.write(JSON.stringify({ ok: report.status === "passed", component: "platform_certification", report }));
    return report.status === "passed" ? 0 : 1;
  } catch (error) {
    input.write(JSON.stringify({ ok: false, component: "platform_certification", error: error instanceof Error ? error.message : String(error) }));
    return 1;
  }
}
