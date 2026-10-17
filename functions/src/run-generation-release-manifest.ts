import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { ACTIVE_CORPUS_ID, COMPUTE_REGION, PROJECT_ID, VERTEX_LOCATION, VERTEX_MODEL } from "./config";
import { buildGenerationReleaseManifest } from "./generation-release";
import { AUTHORITY_FIRST_POLICY_VERSION, AUTHORITY_REGISTRY_VERSION, SPECIALIST_COLLECTION_PROFILE_POLICY_VERSION } from "./factory-v2/contracts/authority-first";

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sourceTreeSha256(repositoryRoot: string): string {
  const paths = execFileSync("git", ["ls-files", "--cached"], { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 })
    .split("\n").filter(Boolean).filter((path) => !path.includes("node_modules/")).sort();
  const digest = createHash("sha256");
  for (const path of paths) {
    const absolute = resolve(repositoryRoot, path);
    digest.update(path).update("\0").update(existsSync(absolute) ? sha256File(absolute) : "<deleted>").update("\n");
  }
  return digest.digest("hex");
}

function main() {
  const executionRoot = process.cwd();
  const repositoryRoot = basename(executionRoot) === "functions" ? resolve(executionRoot, "..") : executionRoot;
  const hasUnstagedTrackedChanges = spawnSync("git", ["diff", "--quiet"], { cwd: repositoryRoot }).status !== 0;
  const hasStagedChanges = spawnSync("git", ["diff", "--cached", "--quiet"], { cwd: repositoryRoot }).status !== 0;
  if ((hasUnstagedTrackedChanges || hasStagedChanges) && process.env.ALLOW_DIRTY_GENERATION_RELEASE !== "true") throw new Error("Generation releases require no tracked changes so sourceRevision identifies the exact deployed source.");
  const sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
  const release = buildGenerationReleaseManifest({
    sourceRevision,
    sourceTreeSha256: sourceTreeSha256(repositoryRoot),
    rootDependencyLockSha256: sha256File(resolve(repositoryRoot, "package-lock.json")),
    functionsDependencyLockSha256: sha256File(resolve(repositoryRoot, "functions/package-lock.json")),
    configurationBundle: {
      projectId: PROJECT_ID,
      computeRegion: COMPUTE_REGION,
      vertexLocation: VERTEX_LOCATION,
      vertexModel: VERTEX_MODEL,
      activeCorpusId: ACTIVE_CORPUS_ID,
      mode: process.env.EVIDENCE_FIRST_MODE || "SHADOW",
      acquisitionStrategy: "AUTHORITY_FIRST",
      authorityFirstPolicyVersion: AUTHORITY_FIRST_POLICY_VERSION,
      authorityRegistryVersion: AUTHORITY_REGISTRY_VERSION,
      specialistCollectionProfilePolicyVersion: SPECIALIST_COLLECTION_PROFILE_POLICY_VERSION,
      controlledResearchBudgetVersion: "controlled-research-budget.1",
      groundingMode: "BOUNDED_ESCALATION_ONLY"
    }
  });
  process.stdout.write(`${JSON.stringify(release)}\n`);
}

main();
