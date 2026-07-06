import "@/src/server/operations/environment";
import { closeSql } from "@/src/server/db/client";
import { runEditorialCertificationCommand } from "@/src/server/editorial-certification/command";

async function main(): Promise<void> {
  const epicIndex = process.argv.indexOf("--epic");
  const epic = epicIndex >= 0 ? process.argv[epicIndex + 1] : "EI-002";
  if (epic !== "EI-002" && epic !== "EI-003" && epic !== "EI-004") {
    console.log(JSON.stringify({ ok: false, component: "editorial_intelligence_certification", error: "Unsupported epic." }));
    process.exitCode = 1;
    return;
  }
  process.exitCode = await runEditorialCertificationCommand({
    actor: process.env.USER || "editorial-certification",
    epic,
    write: (line) => console.log(line)
  });
}

main().finally(closeSql);
