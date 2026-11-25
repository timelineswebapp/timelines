import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { tier1SecurityGateBundle } from "../functions/src/security-gate";

type AuditAdvisory = { severity?: unknown; via?: unknown };
type AuditReport = { vulnerabilities?: Record<string, AuditAdvisory> };
type LockPackage = { version?: unknown; dev?: unknown };
type Lockfile = { packages?: Record<string, LockPackage> };

const repositoryRoot = resolve(__dirname, "..");
const approvedNames = new Set(["eslint-config-next", "@next/eslint-plugin-next", "fast-glob", "micromatch", "braces"]);

function audit(prefix: string[], omitDev: boolean): AuditReport {
  const arguments_ = [...prefix, "audit", "--json", "--audit-level=high", ...(omitDev ? ["--omit=dev"] : [])];
  try {
    return JSON.parse(execFileSync("npm", arguments_, { cwd: repositoryRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })) as AuditReport;
  } catch (error) {
    const stdout = (error as { stdout?: string | Buffer }).stdout;
    if (!stdout) throw error;
    return JSON.parse(stdout.toString()) as AuditReport;
  }
}

function highOrCritical(report: AuditReport): string[] {
  return Object.entries(report.vulnerabilities || {})
    .filter(([, advisory]) => advisory.severity === "high" || advisory.severity === "critical")
    .map(([name]) => name).sort();
}

function requireZeroProductionFindings(label: string, report: AuditReport): void {
  const findings = highOrCritical(report);
  if (findings.length > 0) throw new Error(`${label}_PRODUCTION_AUDIT_HIGH_CRITICAL:${findings.join(",")}`);
}

function assertApprovedRootTopology(): void {
  const bundle = tier1SecurityGateBundle();
  const risk = bundle.approvedToolingRisks[0];
  const rootLock = JSON.parse(readFileSync(resolve(repositoryRoot, "package-lock.json"), "utf8")) as Lockfile;
  const expected = risk.dependencyPath.map((entry) => {
    const divider = entry.lastIndexOf("@");
    return { name: entry.slice(0, divider), version: entry.slice(divider + 1) };
  });
  for (const { name, version } of expected) {
    const packagePath = `node_modules/${name}`;
    const entry = rootLock.packages?.[packagePath];
    if (!entry || entry.version !== version || entry.dev !== true) throw new Error(`APPROVED_TOOLING_TOPOLOGY_CHANGED:${packagePath}`);
  }
}

function assertOnlyApprovedHighFindings(report: AuditReport): void {
  const findings = highOrCritical(report);
  if (findings.length === 0) return;
  if (findings.length !== approvedNames.size || findings.some((name) => !approvedNames.has(name))) {
    throw new Error(`UNAPPROVED_ROOT_AUDIT_HIGH_CRITICAL:${findings.join(",")}`);
  }
  const braces = report.vulnerabilities?.braces;
  const advisoryIds = Array.isArray(braces?.via) ? braces.via.filter((item): item is { url?: unknown } => typeof item === "object" && item !== null) : [];
  if (!advisoryIds.some((item) => item.url === "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm")) {
    throw new Error("APPROVED_TOOLING_ADVISORY_CHANGED");
  }
}

function main(): void {
  assertApprovedRootTopology();
  const rootFull = audit([], false);
  assertOnlyApprovedHighFindings(rootFull);
  requireZeroProductionFindings("ROOT", audit([], true));
  requireZeroProductionFindings("FUNCTIONS", audit(["--prefix", "functions"], true));
  process.stdout.write(`${JSON.stringify({ ok: true, policy: tier1SecurityGateBundle(), rootToolingFindings: highOrCritical(rootFull), productionAudits: { root: "ZERO_HIGH_CRITICAL", functions: "ZERO_HIGH_CRITICAL" } }, null, 2)}\n`);
}

main();
