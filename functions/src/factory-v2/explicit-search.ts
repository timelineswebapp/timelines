import { z } from "zod";
import type { QueryCriticality, QueryRole, SearchQueryLedgerEntry } from "./contracts";
import type { QueryPlan, ResearchMap } from "./contracts";
import { contentAddressedId, sha256 } from "./hashing";

export const EXPLICIT_QUERY_BUDGET = 25;
export const BRAVE_SEARCH_PROVIDER = "BRAVE_SEARCH_API" as const;

export type SearchQueryCandidate = {
  queryId: string;
  researchQuestionIds: string[];
  gapIds: string[];
  phaseIds: string[];
  dimensionIds: string[];
  language: string;
  geography: string[];
  proposedText: string;
  normalizedText: string;
  role: QueryRole;
  intendedSourceClass: QueryPlan["queries"][number]["intendedSourceClass"];
  criticality: QueryCriticality;
};

export type QueryAuthorizationDecision = SearchQueryCandidate & {
  authorizationStatus: "AUTHORIZED" | "REJECTED";
  rejectionReason: "DUPLICATE_NORMALIZED_QUERY" | "BUDGET_PRIORITY_EXCLUDED" | null;
};

export type ExplicitSearchAcquisition = {
  queryId: string;
  body: string;
  webSearchQueries: string[];
  chunks: Array<{ chunkIndex: number; url: string; title: string; domain: string | null }>;
  supports: Array<{ supportIndex: number; startIndex: number | null; endIndex: number | null; attributedText: string; chunkIndices: number[] }>;
  searchEntryPointPresent: false;
  providerCallId: string;
  latencyMs: number;
  transportAttempts: number;
  quotaUnits: number;
  monetaryCostUsd: number | null;
};

export function normalizeSearchQuery(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

const criticalityRank: Record<QueryCriticality, number> = { CRITICAL: 0, IMPORTANT: 1, SUPPORTING: 2 };
const roleRank: Record<QueryRole, number> = { ORIENTATION: 0, PHASE_DIMENSION: 1, AUTHORITY_TARGETED: 2 };

export function authorizeSearchQueries(input: {
  candidates: readonly SearchQueryCandidate[];
  researchMap: ResearchMap;
  maximumAuthorizedQueries?: number;
  requiredCriticalQuestionIds?: readonly string[];
}): QueryAuthorizationDecision[] {
  const maximum = input.maximumAuthorizedQueries ?? EXPLICIT_QUERY_BUDGET;
  if (!Number.isInteger(maximum) || maximum < 0 || maximum > EXPLICIT_QUERY_BUDGET) throw new Error("Explicit-query authorization requires a budget from 0 through 25.");
  const seen = new Set<string>();
  const uniqueCandidates: Array<{ candidate: SearchQueryCandidate; index: number }> = [];
  const duplicateIds = new Set<string>();
  input.candidates.forEach((candidate, index) => {
    if (candidate.normalizedText !== normalizeSearchQuery(candidate.proposedText)) throw new Error(`QUERY_NORMALIZATION_MISMATCH:${candidate.queryId}`);
    if (seen.has(candidate.normalizedText)) duplicateIds.add(candidate.queryId);
    else {
      seen.add(candidate.normalizedText);
      uniqueCandidates.push({ candidate, index });
    }
  });

  const criticalQuestionIds = new Set(input.requiredCriticalQuestionIds || input.researchMap.questions.filter((question) => question.priority === "CRITICAL").map((question) => question.questionId));
  const knownQuestionIds = new Set(input.researchMap.questions.map((question) => question.questionId));
  if ([...criticalQuestionIds].some((id) => !knownQuestionIds.has(id))) throw new Error("QUERY_COVERAGE_CONTRACT_INVALID: required critical question is outside the locked Research Map.");
  const missing = [...criticalQuestionIds].filter((questionId) => !uniqueCandidates.some(({ candidate }) => candidate.researchQuestionIds.includes(questionId)));
  if (missing.length > 0) throw new Error(`QUERY_BUDGET_INSUFFICIENT_FOR_REQUIRED_COVERAGE: no provider-authored query covers critical Research Map questions ${missing.join(",")}`);

  const selected = new Set<string>();
  const uncovered = new Set(criticalQuestionIds);
  while (uncovered.size > 0) {
    if (selected.size >= maximum) throw new Error("QUERY_BUDGET_INSUFFICIENT_FOR_REQUIRED_COVERAGE: critical coverage cannot fit within the authorized query budget.");
    const ranked = uniqueCandidates
      .filter(({ candidate }) => !selected.has(candidate.queryId))
      .map((item) => ({ ...item, gain: item.candidate.researchQuestionIds.filter((id) => uncovered.has(id)).length }))
      .filter((item) => item.gain > 0)
      .sort((left, right) => right.gain - left.gain || criticalityRank[left.candidate.criticality] - criticalityRank[right.candidate.criticality] || roleRank[left.candidate.role] - roleRank[right.candidate.role] || left.index - right.index);
    const next = ranked[0];
    if (!next) throw new Error("QUERY_BUDGET_INSUFFICIENT_FOR_REQUIRED_COVERAGE: provider-authored candidates do not preserve critical coverage.");
    selected.add(next.candidate.queryId);
    for (const id of next.candidate.researchQuestionIds) uncovered.delete(id);
  }

  const remainingByRole = new Map<QueryRole, Array<{ candidate: SearchQueryCandidate; index: number }>>();
  for (const role of ["ORIENTATION", "PHASE_DIMENSION", "AUTHORITY_TARGETED"] as const) remainingByRole.set(role, []);
  for (const item of uniqueCandidates.filter(({ candidate }) => !selected.has(candidate.queryId)).sort((left, right) => criticalityRank[left.candidate.criticality] - criticalityRank[right.candidate.criticality] || left.index - right.index)) remainingByRole.get(item.candidate.role)!.push(item);
  while (selected.size < maximum && [...remainingByRole.values()].some((items) => items.length > 0)) {
    for (const role of ["ORIENTATION", "PHASE_DIMENSION", "AUTHORITY_TARGETED"] as const) {
      if (selected.size >= maximum) break;
      const next = remainingByRole.get(role)!.shift();
      if (next) selected.add(next.candidate.queryId);
    }
  }

  return input.candidates.map((candidate) => ({
    ...candidate,
    authorizationStatus: duplicateIds.has(candidate.queryId) || !selected.has(candidate.queryId) ? "REJECTED" : "AUTHORIZED",
    rejectionReason: duplicateIds.has(candidate.queryId) ? "DUPLICATE_NORMALIZED_QUERY" : selected.has(candidate.queryId) ? null : "BUDGET_PRIORITY_EXCLUDED"
  }));
}

const braveResultSchema = z.object({ title: z.string().trim().min(1).max(500), url: z.string().url().max(4096), description: z.string().trim().max(4000).optional() }).passthrough();
const braveResponseSchema = z.object({ web: z.object({ results: z.array(braveResultSchema).max(20) }).passthrough().optional() }).passthrough();

export type ExplicitSearchTransport = (url: string, init: RequestInit) => Promise<Response>;

export class ExplicitSearchProviderError extends Error {
  constructor(
    message: string,
    readonly transportAttempts: number,
    readonly quotaUnits: number,
    readonly latencyMs: number,
    readonly providerCallId: string | null,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ExplicitSearchProviderError";
  }
}

export class BraveExplicitSearchClient {
  constructor(
    private readonly apiKey: string = process.env.BRAVE_SEARCH_API_KEY || "",
    private readonly transport: ExplicitSearchTransport = fetch,
    private readonly costPerRequestUsd: number | null = (() => {
      const value = Number(process.env.BRAVE_SEARCH_COST_PER_1000_USD);
      return Number.isFinite(value) && value >= 0 ? value / 1000 : null;
    })(),
    private readonly storageRightsConfirmed: boolean = process.env.BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED === "true"
  ) {}

  assertReady(): void {
    if (!this.apiKey.trim()) throw new ExplicitSearchProviderError("EXPLICIT_SEARCH_CREDENTIAL_MISSING: BRAVE_SEARCH_API_KEY is required before search execution.", 0, 0, 0, null);
    if (!this.storageRightsConfirmed) throw new ExplicitSearchProviderError("EXPLICIT_SEARCH_STORAGE_RIGHTS_UNCONFIRMED: the configured Brave plan must explicitly permit persistent Search Result lineage.", 0, 0, 0, null);
  }

  async search(candidate: SearchQueryCandidate, signal?: AbortSignal): Promise<ExplicitSearchAcquisition> {
    this.assertReady();
    const endpoint = new URL("https://api.search.brave.com/res/v1/web/search");
    endpoint.searchParams.set("q", candidate.proposedText);
    endpoint.searchParams.set("count", "20");
    endpoint.searchParams.set("safesearch", "strict");
    endpoint.searchParams.set("spellcheck", "false");
    endpoint.searchParams.set("result_filter", "web");
    if (/^[a-z]{2}$/u.test(candidate.language)) endpoint.searchParams.set("search_lang", candidate.language);
    const country = candidate.geography.find((value) => /^[A-Z]{2}$/u.test(value));
    if (country) endpoint.searchParams.set("country", country);
    const startedAt = Date.now();
    let attempts = 0;
    let response: Response | null = null;
    for (attempts = 1; attempts <= 2; attempts += 1) {
      try {
        response = await this.transport(endpoint.toString(), { method: "GET", headers: { Accept: "application/json", "X-Subscription-Token": this.apiKey }, signal });
      } catch (error) {
        if (attempts === 2) throw new ExplicitSearchProviderError(`SEARCH_PROVIDER_FAILED:${error instanceof Error ? error.message : String(error)}`, attempts, attempts, Date.now() - startedAt, null, { cause: error });
        continue;
      }
      const providerCallId = response.headers.get("x-request-id");
      if (response.status === 429) throw new ExplicitSearchProviderError("SEARCH_PROVIDER_QUOTA_EXHAUSTED", attempts, attempts, Date.now() - startedAt, providerCallId);
      if (response.ok) break;
      if (response.status < 500 || attempts === 2) throw new ExplicitSearchProviderError(`SEARCH_PROVIDER_HTTP_${response.status}`, attempts, attempts, Date.now() - startedAt, providerCallId);
    }
    if (!response?.ok) throw new ExplicitSearchProviderError("SEARCH_PROVIDER_FAILED:no successful response", attempts, attempts, Date.now() - startedAt, null);
    let parsed: z.infer<typeof braveResponseSchema>;
    try { parsed = braveResponseSchema.parse(await response.json()); }
    catch (error) { throw new ExplicitSearchProviderError("SEARCH_PROVIDER_MALFORMED_RESPONSE", attempts, attempts, Date.now() - startedAt, response.headers.get("x-request-id"), { cause: error }); }
    const results = (parsed.web?.results || []).flatMap((result) => {
      try {
        const url = new URL(result.url);
        if (url.protocol !== "https:" || url.username || url.password) return [];
        return [{ ...result, url: url.toString(), domain: url.hostname.toLocaleLowerCase("en-US").replace(/^www\./u, "") }];
      } catch { return []; }
    });
    const chunks = results.map((result, chunkIndex) => ({ chunkIndex, url: result.url, title: result.title, domain: result.domain }));
    const supports = results.flatMap((result, supportIndex) => result.description ? [{ supportIndex, startIndex: null, endIndex: null, attributedText: result.description, chunkIndices: [supportIndex] }] : []);
    const body = JSON.stringify({ query: candidate.proposedText, results: results.map(({ title, url, description }) => ({ title, url, description: description || "" })) });
    return {
      queryId: candidate.queryId,
      body,
      webSearchQueries: [candidate.proposedText],
      chunks,
      supports,
      searchEntryPointPresent: false,
      providerCallId: response.headers.get("x-request-id") || contentAddressedId("brave-call", { queryId: candidate.queryId, responseHash: sha256(body) }),
      latencyMs: Date.now() - startedAt,
      transportAttempts: attempts,
      quotaUnits: attempts,
      monetaryCostUsd: this.costPerRequestUsd === null ? null : attempts * this.costPerRequestUsd
    };
  }
}

export async function executeAuthorizedQueries(input: {
  decisions: readonly QueryAuthorizationDecision[];
  client: BraveExplicitSearchClient;
  maximumConcurrency: number;
  signal?: AbortSignal;
}): Promise<{ acquisitions: ExplicitSearchAcquisition[]; ledgerEntries: SearchQueryLedgerEntry[]; failure: Error | null }> {
  const authorized = input.decisions.filter((decision) => decision.authorizationStatus === "AUTHORIZED");
  if (authorized.length > EXPLICIT_QUERY_BUDGET) throw new Error("QUERY_AUTHORIZATION_INVARIANT_VIOLATION");
  const results = new Map<string, ExplicitSearchAcquisition>();
  const failures = new Map<string, ExplicitSearchProviderError>();
  let firstFailure: ExplicitSearchProviderError | null = null;
  let cursor = 0;
  try {
    input.client.assertReady();
  } catch (error) {
    firstFailure = error instanceof ExplicitSearchProviderError ? error : new ExplicitSearchProviderError(String(error), 0, 0, 0, null, { cause: error });
  }
  const workers = Array.from({ length: firstFailure ? 0 : Math.min(Math.max(1, input.maximumConcurrency), authorized.length) }, async () => {
    while (!firstFailure && cursor < authorized.length) {
      const candidate = authorized[cursor++]!;
      try {
        const acquisition = await input.client.search(candidate, input.signal);
        if (results.has(candidate.queryId)) throw new Error(`DUPLICATE_QUERY_EXECUTION:${candidate.queryId}`);
        results.set(candidate.queryId, acquisition);
      } catch (error) {
        const failure = error instanceof ExplicitSearchProviderError ? error : new ExplicitSearchProviderError(`SEARCH_PROVIDER_FAILED:${error instanceof Error ? error.message : String(error)}`, 0, 0, 0, null, { cause: error });
        failures.set(candidate.queryId, failure);
        firstFailure ||= failure;
      }
    }
  });
  await Promise.all(workers);
  const ledgerEntries = input.decisions.map((decision): SearchQueryLedgerEntry => {
    const acquisition = results.get(decision.queryId);
    const failure = failures.get(decision.queryId);
    return {
      queryId: decision.queryId,
      researchQuestionIds: decision.researchQuestionIds,
      gapIds: decision.gapIds,
      phaseIds: decision.phaseIds,
      dimensionIds: decision.dimensionIds,
      language: decision.language,
      geography: decision.geography,
      proposedText: decision.proposedText,
      normalizedText: decision.normalizedText,
      role: decision.role,
      intendedSourceClass: decision.intendedSourceClass,
      criticality: decision.criticality,
      authorizationStatus: decision.authorizationStatus,
      rejectionReason: decision.rejectionReason,
      executionStatus: acquisition ? "SUCCEEDED" : failure ? "FAILED" : decision.authorizationStatus === "AUTHORIZED" ? "PENDING" : "NOT_AUTHORIZED",
      searchProvider: BRAVE_SEARCH_PROVIDER,
      providerCallId: acquisition?.providerCallId || failure?.providerCallId || null,
      latencyMs: acquisition?.latencyMs ?? failure?.latencyMs ?? null,
      returnedResultCount: acquisition?.chunks.length ?? null,
      resultUrls: acquisition?.chunks.map((chunk) => chunk.url) || [],
      transportAttempts: acquisition?.transportAttempts || failure?.transportAttempts || 0,
      quotaUnits: acquisition?.quotaUnits || failure?.quotaUnits || 0,
      monetaryCostUsd: acquisition?.monetaryCostUsd ?? null
    };
  });
  return { acquisitions: authorized.flatMap((candidate) => results.get(candidate.queryId) || []), ledgerEntries, failure: firstFailure };
}
