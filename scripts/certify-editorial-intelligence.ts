import "@/src/server/operations/environment";
import { closeSql } from "@/src/server/db/client";
import { runEditorialCertificationCommand } from "@/src/server/editorial-certification/command";

async function main(): Promise<void> {
  const epicIndex = process.argv.indexOf("--epic");
  const scopeIndex = process.argv.indexOf("--scope");
  const scope = scopeIndex >= 0 ? process.argv[scopeIndex + 1] : undefined;
  if (scope !== undefined && scope !== "end-to-end") {
    console.log(JSON.stringify({ ok: false, component: "editorial_intelligence_certification", error: "Unsupported scope." }));
    process.exitCode = 1;
    return;
  }
  if (scope === "end-to-end" && epicIndex >= 0) {
    console.log(JSON.stringify({ ok: false, component: "editorial_intelligence_certification", error: "Use either --scope or --epic, not both." }));
    process.exitCode = 1;
    return;
  }
  const epic = epicIndex >= 0 ? process.argv[epicIndex + 1] : "EI-002";
  if (epic !== "EI-002" && epic !== "EI-003" && epic !== "EI-004") {
    console.log(JSON.stringify({ ok: false, component: "editorial_intelligence_certification", error: "Unsupported epic." }));
    process.exitCode = 1;
    return;
  }
  process.exitCode = await runEditorialCertificationCommand({
    actor: process.env.USER || "editorial-certification",
    scope,
    epic,
    write: (line) => console.log(line)
  });
}

main().finally(closeSql);
