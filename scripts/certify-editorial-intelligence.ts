import "@/src/server/operations/environment";
import { closeSql } from "@/src/server/db/client";
import { runEi002CertificationCommand } from "@/src/server/editorial-certification/command";

async function main(): Promise<void> {
  process.exitCode = await runEi002CertificationCommand({
    actor: process.env.USER || "editorial-certification",
    write: (line) => console.log(line)
  });
}

main().finally(closeSql);
