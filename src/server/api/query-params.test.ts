import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DELETE as deleteCampaign } from "@/app/api/admin/ads/[id]/route";
import { DELETE as deleteEvent } from "@/app/api/admin/events/[id]/route";
import { DELETE as deleteTag } from "@/app/api/admin/tags/[id]/route";
import { DELETE as deleteTimeline } from "@/app/api/admin/timelines/[id]/route";
import { config } from "@/src/lib/config";
import { trustedClientIp } from "@/src/server/api/client-ip";
import { ApiError } from "@/src/server/api/responses";
import { parseCanonicalPositiveIntegerPathParameter, parseOptionalEnumQueryParameter, parseOptionalSingleQueryParameter } from "@/src/server/api/query-params";
import { adminService } from "@/src/server/services/admin-service";
import { factoryV2AdminService } from "@/src/server/services/factory-v2-admin-service";
import { requestService } from "@/src/server/services/request-service";
import { serverlessBackendClient } from "@/src/server/serverless/backend-client";
import { setAdminSecurityAuditStoreForTests } from "@/src/server/security/admin-identity";

test("operational enum filters accept only one declared value", () => {
  const options = ["queued", "running", "completed"] as const;
  assert.equal(parseOptionalEnumQueryParameter(new URLSearchParams(), "status", options), undefined);
  assert.equal(parseOptionalEnumQueryParameter(new URLSearchParams("status=queued"), "status", options), "queued");
  assert.throws(() => parseOptionalEnumQueryParameter(new URLSearchParams("status=unknown"), "status", options), ApiError);
  assert.throws(() => parseOptionalEnumQueryParameter(new URLSearchParams("status=queued&status=running"), "status", options), ApiError);
  assert.throws(() => parseOptionalEnumQueryParameter(new URLSearchParams("status=&status=queued"), "status", options), ApiError);
});

test("single operational controls reject parameter pollution without coercion", () => {
  assert.equal(parseOptionalSingleQueryParameter(new URLSearchParams("jobId=abc"), "jobId"), "abc");
  assert.equal(parseOptionalSingleQueryParameter(new URLSearchParams(), "jobId"), undefined);
  assert.throws(() => parseOptionalSingleQueryParameter(new URLSearchParams("jobId=a&jobId=b"), "jobId"), ApiError);
});

test("numeric operational path identifiers remain canonical and bounded", () => {
  assert.equal(parseCanonicalPositiveIntegerPathParameter("42", "report id"), 42);
  for (const value of ["", "0", "01", "1.0", "1e2", "-1", "9007199254740992"]) {
    assert.throws(() => parseCanonicalPositiveIntegerPathParameter(value, "report id"), ApiError);
  }
});

test("production rate identities use only the platform-trusted forwarding header", () => {
  const previousIsProduction = config.isProduction;
  try {
    config.isProduction = true;
    assert.equal(trustedClientIp(new Request("https://timelines.example", { headers: { "x-forwarded-for": "198.51.100.9", "x-vercel-forwarded-for": "203.0.113.4" } })), "203.0.113.4");
    assert.equal(trustedClientIp(new Request("https://timelines.example", { headers: { "x-forwarded-for": "198.51.100.9" } })), "unknown");
    config.isProduction = false;
    assert.equal(trustedClientIp(new Request("https://timelines.example", { headers: { "x-forwarded-for": "198.51.100.9, 10.0.0.1" } })), "198.51.100.9");
    assert.equal(trustedClientIp(new Request("https://timelines.example", { headers: { "x-forwarded-for": "not-an-ip" } })), "127.0.0.1");
  } finally {
    config.isProduction = previousIsProduction;
  }
});

test("unavailable serverless Factory reads do not masquerade as empty operational queues", async () => {
  const previousBaseUrl = process.env.SERVERLESS_API_BASE_URL;
  const previousVercelEnvironment = process.env.VERCEL_ENV;
  const previousSharedSecret = process.env.BACKEND_SHARED_SECRET;
  delete process.env.SERVERLESS_API_BASE_URL;
  delete process.env.VERCEL_ENV;
  process.env.BACKEND_SHARED_SECRET = "a".repeat(32);
  try {
    await assert.rejects(factoryV2AdminService.listDeferredTopics(), (error: unknown) => error instanceof ApiError && error.status === 503 && error.code === "SERVERLESS_BACKEND_UNAVAILABLE");
    await assert.rejects(factoryV2AdminService.getGenerationRetryQueueHealth(), (error: unknown) => error instanceof ApiError && error.status === 503 && error.code === "SERVERLESS_BACKEND_UNAVAILABLE");
    await assert.rejects(factoryV2AdminService.getSourceSubmissionInspection("candidate-001"), (error: unknown) => error instanceof ApiError && error.status === 503 && error.code === "SERVERLESS_BACKEND_UNAVAILABLE");
    await assert.rejects(factoryV2AdminService.createDeferredReentry({ operationId: "operation-001", trigger: "AUTHORIZED_RETRY", relevantChangeArtifactId: null, authorizedBy: "operator-001", authorizationReason: "A bounded authorized retry is required." }), (error: unknown) => error instanceof ApiError && error.status === 503 && error.code === "SERVERLESS_BACKEND_UNAVAILABLE");
    await assert.rejects(factoryV2AdminService.createSourceSubmission({ operationId: "operation-001", submittedUrl: "https://example.org/source", rationale: "A governed public source may address the unresolved obligation.", submittedBy: "operator-001" }), (error: unknown) => error instanceof ApiError && error.status === 503 && error.code === "SERVERLESS_BACKEND_UNAVAILABLE");
    process.env.VERCEL_ENV = "production";
    await assert.rejects(factoryV2AdminService.listDeferredTopics(), (error: unknown) => error instanceof ApiError && error.status === 503 && error.code === "SERVERLESS_BACKEND_UNAVAILABLE");
  } finally {
    if (previousBaseUrl === undefined) delete process.env.SERVERLESS_API_BASE_URL;
    else process.env.SERVERLESS_API_BASE_URL = previousBaseUrl;
    if (previousVercelEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercelEnvironment;
    if (previousSharedSecret === undefined) delete process.env.BACKEND_SHARED_SECRET;
    else process.env.BACKEND_SHARED_SECRET = previousSharedSecret;
  }
});

test("malformed serverless responses surface a typed backend failure", async () => {
  const previousBaseUrl = process.env.SERVERLESS_API_BASE_URL;
  const originalFetch = globalThis.fetch;
  process.env.SERVERLESS_API_BASE_URL = "https://serverless.invalid";
  globalThis.fetch = async () => new Response("not-json", { status: 502, headers: { "content-type": "text/plain" } });
  try {
    await assert.rejects(serverlessBackendClient.listReadModels("timeline", 1), (error: unknown) => error instanceof ApiError && error.status === 502 && error.code === "SERVERLESS_BACKEND_INVALID_RESPONSE");
    globalThis.fetch = async () => Response.json({ unexpected: true }, { status: 200 });
    await assert.rejects(serverlessBackendClient.listReadModels("timeline", 1), (error: unknown) => error instanceof ApiError && error.status === 502 && error.code === "SERVERLESS_BACKEND_INVALID_RESPONSE");
    globalThis.fetch = async () => Response.json({ ok: false, error: { code: 42, message: ["untrusted"] } }, { status: 500 });
    await assert.rejects(serverlessBackendClient.listReadModels("timeline", 1), (error: unknown) => error instanceof ApiError && error.status === 502 && error.code === "SERVERLESS_BACKEND_INVALID_RESPONSE");
    globalThis.fetch = async () => Response.json({ ok: true }, { status: 200 });
    await assert.rejects(serverlessBackendClient.listReadModels("timeline", 1), (error: unknown) => error instanceof ApiError && error.status === 502 && error.code === "SERVERLESS_BACKEND_INVALID_RESPONSE");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousBaseUrl === undefined) delete process.env.SERVERLESS_API_BASE_URL;
    else process.env.SERVERLESS_API_BASE_URL = previousBaseUrl;
  }
});

test("serverless transport failures fail closed for public intake and Factory operations without logging query data", async () => {
  const previousBaseUrl = process.env.SERVERLESS_API_BASE_URL;
  const previousSharedSecret = process.env.BACKEND_SHARED_SECRET;
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const diagnostics: string[] = [];
  process.env.SERVERLESS_API_BASE_URL = "https://serverless.invalid";
  process.env.BACKEND_SHARED_SECRET = "a".repeat(32);
  globalThis.fetch = async () => { throw new TypeError("network connection refused"); };
  console.error = (message?: unknown) => { diagnostics.push(String(message)); };
  try {
    await assert.rejects(factoryV2AdminService.listDeferredTopics(), (error: unknown) => error instanceof ApiError && error.status === 503 && error.code === "SERVERLESS_BACKEND_UNAVAILABLE");
    await assert.rejects(requestService.createTimelineRequest({ query: "A bounded public request", language: "en", ip: "203.0.113.10" }), (error: unknown) => error instanceof ApiError && error.status === 503 && error.code === "SERVERLESS_BACKEND_UNAVAILABLE");
    await assert.rejects(serverlessBackendClient.search("sensitive reader query", 1, 0), (error: unknown) => error instanceof ApiError && error.status === 503 && error.code === "SERVERLESS_BACKEND_UNAVAILABLE");
    assert.equal(diagnostics.length, 3);
    for (const diagnostic of diagnostics) {
      const parsed = JSON.parse(diagnostic) as { level?: string; component?: string; event?: string; method?: string; path?: string; errorName?: string };
      assert.equal(parsed.level, "error");
      assert.equal(parsed.component, "serverless-backend-client");
      assert.equal(parsed.event, "serverless_backend_transport_unavailable");
      assert.equal(parsed.errorName, "TypeError");
      assert.ok(typeof parsed.method === "string");
      assert.ok(typeof parsed.path === "string");
      assert.doesNotMatch(diagnostic, /network connection refused/);
      assert.doesNotMatch(diagnostic, /sensitive reader query/);
    }
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    if (previousBaseUrl === undefined) delete process.env.SERVERLESS_API_BASE_URL;
    else process.env.SERVERLESS_API_BASE_URL = previousBaseUrl;
    if (previousSharedSecret === undefined) delete process.env.BACKEND_SHARED_SECRET;
    else process.env.BACKEND_SHARED_SECRET = previousSharedSecret;
  }
});

test("unavailable public topic intake surfaces a typed availability error", async () => {
  const previousBaseUrl = process.env.SERVERLESS_API_BASE_URL;
  const previousVercelEnvironment = process.env.VERCEL_ENV;
  const previousSharedSecret = process.env.BACKEND_SHARED_SECRET;
  delete process.env.SERVERLESS_API_BASE_URL;
  delete process.env.VERCEL_ENV;
  process.env.BACKEND_SHARED_SECRET = "a".repeat(32);
  try {
    await assert.rejects(requestService.createTimelineRequest({ query: "A bounded public request", language: "en", ip: "203.0.113.10" }), (error: unknown) => error instanceof ApiError && error.status === 503 && error.code === "SERVERLESS_BACKEND_UNAVAILABLE");
  } finally {
    if (previousBaseUrl === undefined) delete process.env.SERVERLESS_API_BASE_URL;
    else process.env.SERVERLESS_API_BASE_URL = previousBaseUrl;
    if (previousVercelEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercelEnvironment;
    if (previousSharedSecret === undefined) delete process.env.BACKEND_SHARED_SECRET;
    else process.env.BACKEND_SHARED_SECRET = previousSharedSecret;
  }
});

test("mutable numeric Admin resources reject noncanonical path identities before service calls", async () => {
  const previousToken = config.adminApiToken;
  const originalCampaign = adminService.deleteAdCampaign;
  const originalEvent = adminService.deleteEvent;
  const originalTag = adminService.deleteTag;
  const originalTimeline = adminService.deleteTimeline;
  const calls: string[] = [];
  config.adminApiToken = "admin-secret";
  adminService.deleteAdCampaign = async () => { calls.push("campaign"); return false; };
  adminService.deleteEvent = async () => { calls.push("event"); return false; };
  adminService.deleteTag = async () => { calls.push("tag"); return false; };
  adminService.deleteTimeline = async () => { calls.push("timeline"); return false; };
  setAdminSecurityAuditStoreForTests({ async append() {} });

  const request = new Request("https://timelines.example/api/admin/resource/1e2", { method: "DELETE", headers: { authorization: "Bearer admin-secret" } });
  try {
    for (const remove of [deleteCampaign, deleteEvent, deleteTag, deleteTimeline]) {
      const response = await remove(request, { params: Promise.resolve({ id: "1e2" }) });
      assert.equal(response.status, 400);
    }
    assert.deepEqual(calls, []);
  } finally {
    config.adminApiToken = previousToken;
    adminService.deleteAdCampaign = originalCampaign;
    adminService.deleteEvent = originalEvent;
    adminService.deleteTag = originalTag;
    adminService.deleteTimeline = originalTimeline;
    setAdminSecurityAuditStoreForTests(null);
  }
});

test("deferred source-candidate UI remains provenance-only", () => {
  const ui = readFileSync("components/admin/AdminFactoryOperations.tsx", "utf8");
  assert.match(ui, /Recorded rationale: \{candidate\.rationale\}/);
  assert.match(ui, /This is provenance only; it is not evidence, authority, a retrieval instruction, or a re-entry authorization\./);
  const candidateStart = ui.indexOf("Candidate awaiting Factory validation:");
  const candidateSection = ui.slice(candidateStart, ui.indexOf("</article>)", candidateStart));
  assert.doesNotMatch(candidateSection, /dispatchSourceSubmissionRetrieval|createDeferredFactoryV2Reentry|Submit Source Candidate/);
});

test("candidate outcome inspection remains read-only", () => {
  const ui = readFileSync("components/admin/AdminFactoryOperations.tsx", "utf8");
  const candidateStart = ui.indexOf("Candidate awaiting Factory validation:");
  const candidateSection = ui.slice(candidateStart, ui.indexOf("</article>)", candidateStart));
  assert.match(candidateSection, /View recorded Factory status/u);
  assert.match(candidateSection, /does not expose source content, create qualifying evidence, authorize re-entry, or dispatch retrieval/u);
  assert.doesNotMatch(candidateSection, /dispatchSourceSubmissionRetrieval|createDeferredFactoryV2Reentry|Submit Source Candidate/);
});

test("deferred budget retries remain explicit request-only Factory operations", () => {
  const ui = readFileSync("components/admin/AdminFactoryOperations.tsx", "utf8");
  const deferredStart = ui.indexOf("Deferred Evidence Work");
  const deferredSection = ui.slice(deferredStart, ui.indexOf("{detail ?", deferredStart));
  assert.match(deferredSection, /Record bounded retry authorization/);
  assert.match(ui, /trigger: "AUTHORIZED_RETRY"/);
  assert.match(deferredSection, /creates an immutable, attributable re-entry request/);
  assert.match(deferredSection, /does not consume the request, dispatch a worker, or start research/);
  assert.match(deferredSection, /Bounded re-entry history/);
  assert.match(deferredSection, /This view cannot consume, dispatch, or start research/);
  assert.doesNotMatch(deferredSection, /deferred-reentry\/(?:consume|dispatch)/);
});

test("Factory operations explains typed backend unavailability without implying a state change", () => {
  const ui = readFileSync("components/admin/AdminFactoryOperations.tsx", "utf8");
  const availability = readFileSync("components/admin/factory-operational-availability.ts", "utf8");
  assert.match(availability, /SERVERLESS_BACKEND_UNAVAILABLE/);
  assert.match(availability, /Factory operational data is temporarily unavailable\. Existing work has not been changed;/);
  assert.match(ui, /Promise\.allSettled/);
  assert.match(ui, /if \(briefingResult\.status === "rejected"\) throw briefingResult\.reason;/);
  assert.match(ui, /Operational record temporarily unavailable\./);
  assert.match(ui, /Retry operational read/);
});

test("Factory core operations remain visible during typed V2 operational-read unavailability", () => {
  const ui = readFileSync("components/admin/AdminFactoryOperations.tsx", "utf8");
  assert.match(ui, /fetchAdmin<OperationsSnapshot>\("\/api\/admin\/factory\/operations"\)/);
  assert.match(ui, /fetchAdmin<OperationalNotification\[]>\("\/api\/admin\/factory\/operations\/inbox"\)/);
  assert.match(ui, /Factory V2 operational records are temporarily unavailable/);
  assert.match(ui, /Core Factory controls and their current state remain available\. No V2 work was changed\./);
  assert.match(ui, /setDeferredV2Topics\(null\)/);
  assert.match(ui, /Deferred-work records are temporarily unavailable/);
  assert.match(ui, /Generation retry records are temporarily unavailable/);
  assert.doesNotMatch(ui, /deferred-reentry\/(?:consume|dispatch)/);
});

test("public request entry points use a sanitized envelope parser", () => {
  const form = readFileSync("components/ui/RequestTimelineForm.tsx", "utf8");
  const navigation = readFileSync("components/layout/SiteNavigationMenu.tsx", "utf8");
  const parser = readFileSync("src/lib/public-request-client.ts", "utf8");
  assert.match(form, /readPublicRequestResponse/);
  assert.match(navigation, /readPublicRequestResponse/);
  assert.match(parser, /response\.json\(\)/);
  assert.match(parser, /status === 502 \|\| status === 503/);
  assert.match(parser, /Topic intake is temporarily unavailable/);
  assert.doesNotMatch(parser, /payload\?\.error\?\.message/);
});

test("Factory V2 Admin service validates signed bridge DTOs before UI routes consume them", () => {
  const service = readFileSync("src/server/services/factory-v2-admin-service.ts", "utf8");
  assert.match(service, /function parseBridgeDto/);
  assert.match(service, /SERVERLESS_BACKEND_INVALID_RESPONSE/);
  assert.match(service, /z\.array\(deferredTopicSchema\)\.max\(100\)/);
  assert.match(service, /sourceSubmissionInspectionSchema/);
  assert.match(service, /generationRetryQueueHealthSchema/);
});
