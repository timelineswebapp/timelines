import "@/src/server/operations/environment";
import { closeSql } from "@/src/server/db/client";
import { runSearchCertificationCommand } from "@/src/server/search-certification/command";

async function main(): Promise<void> {
  const scopeIndexes = process.argv.map((arg, index) => arg === "--scope" ? index : -1).filter((index) => index >= 0);
  const epicIndex = process.argv.indexOf("--epic");
  if (scopeIndexes.length !== 1 || epicIndex >= 0) {
    console.log(JSON.stringify({ ok: false, component: "search_certification", error: "Use exactly one --scope end-to-end argument and do not mix --scope with --epic." }));
    process.exitCode = 1;
    return;
  }
  const scope = process.argv[scopeIndexes[0]! + 1];
  if (scope !== "end-to-end") {
    console.log(JSON.stringify({ ok: false, component: "search_certification", error: "Unsupported scope." }));
    process.exitCode = 1;
    return;
  }
  process.exitCode = await runSearchCertificationCommand({
    actor: process.env.USER || "search-certification",
    scope,
    write: (line) => console.log(line)
  });
}

main().finally(closeSql);
