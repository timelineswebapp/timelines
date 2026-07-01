import { closeSql, getSql } from "@/src/server/db/client";
import { factoryOperationsService } from "@/src/server/services/factory-operations-service";
import { assertNonProductionEnvironment } from "./factory-reset-core";

const canonicalDevelopmentTopics = [
  "Telephone",
  "Steam Engine",
  "Printing Press",
  "Apollo Program",
  "Internet"
] as const;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL || "";
  assertNonProductionEnvironment(process.env, databaseUrl);
  if (!getSql()) throw new Error("DATABASE_URL must be configured for Factory Seed.");

  for (const [index, title] of canonicalDevelopmentTopics.entries()) {
    await factoryOperationsService.addTopic({
      title,
      source: "founder",
      sourceReference: `factory-seed:${title.toLowerCase().replaceAll(" ", "-")}`,
      priority: 100 - index,
      maxRetries: 3,
      actor: "factory-seed"
    });
    console.log(`Queued ${title}.`);
  }
  console.log("Factory seed completed through the normal Factory queue workflow.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeSql);
