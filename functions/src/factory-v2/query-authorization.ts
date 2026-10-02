import type { QueryCriticality, QueryPlan, QueryRole, ResearchMap } from "./contracts";

export const EXPLICIT_QUERY_BUDGET = 25;

export type SearchQueryCandidate = { queryId: string; researchQuestionIds: string[]; gapIds: string[]; phaseIds: string[]; dimensionIds: string[]; language: string; geography: string[]; proposedText: string; normalizedText: string; role: QueryRole; intendedSourceClass: QueryPlan["queries"][number]["intendedSourceClass"]; criticality: QueryCriticality };
export type QueryAuthorizationDecision = SearchQueryCandidate & { authorizationStatus: "AUTHORIZED" | "REJECTED"; rejectionReason: "DUPLICATE_NORMALIZED_QUERY" | "BUDGET_PRIORITY_EXCLUDED" | null };

export function normalizeSearchQuery(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

const criticalityRank: Record<QueryCriticality, number> = { CRITICAL: 0, IMPORTANT: 1, SUPPORTING: 2 };
const roleRank: Record<QueryRole, number> = { ORIENTATION: 0, PHASE_DIMENSION: 1, AUTHORITY_TARGETED: 2 };

export function authorizeSearchQueries(input: { candidates: readonly SearchQueryCandidate[]; researchMap: ResearchMap; maximumAuthorizedQueries?: number; requiredCriticalQuestionIds?: readonly string[] }): QueryAuthorizationDecision[] {
  const maximum = input.maximumAuthorizedQueries ?? EXPLICIT_QUERY_BUDGET;
  if (!Number.isInteger(maximum) || maximum < 0 || maximum > EXPLICIT_QUERY_BUDGET) throw new Error("Explicit-query authorization requires a budget from 0 through 25.");
  const seen = new Set<string>();
  const uniqueCandidates: Array<{ candidate: SearchQueryCandidate; index: number }> = [];
  const duplicateIds = new Set<string>();
  input.candidates.forEach((candidate, index) => {
    if (candidate.normalizedText !== normalizeSearchQuery(candidate.proposedText)) throw new Error(`QUERY_NORMALIZATION_MISMATCH:${candidate.queryId}`);
    if (seen.has(candidate.normalizedText)) duplicateIds.add(candidate.queryId);
    else { seen.add(candidate.normalizedText); uniqueCandidates.push({ candidate, index }); }
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
    const ranked = uniqueCandidates.filter(({ candidate }) => !selected.has(candidate.queryId)).map((item) => ({ ...item, gain: item.candidate.researchQuestionIds.filter((id) => uncovered.has(id)).length })).filter((item) => item.gain > 0).sort((left, right) => right.gain - left.gain || criticalityRank[left.candidate.criticality] - criticalityRank[right.candidate.criticality] || roleRank[left.candidate.role] - roleRank[right.candidate.role] || left.index - right.index);
    const next = ranked[0];
    if (!next) throw new Error("QUERY_BUDGET_INSUFFICIENT_FOR_REQUIRED_COVERAGE: provider-authored candidates do not preserve critical coverage.");
    selected.add(next.candidate.queryId);
    for (const id of next.candidate.researchQuestionIds) uncovered.delete(id);
  }
  const remainingByRole = new Map<QueryRole, Array<{ candidate: SearchQueryCandidate; index: number }>>();
  for (const role of ["ORIENTATION", "PHASE_DIMENSION", "AUTHORITY_TARGETED"] as const) remainingByRole.set(role, []);
  for (const item of uniqueCandidates.filter(({ candidate }) => !selected.has(candidate.queryId)).sort((left, right) => criticalityRank[left.candidate.criticality] - criticalityRank[right.candidate.criticality] || left.index - right.index)) remainingByRole.get(item.candidate.role)!.push(item);
  while (selected.size < maximum && [...remainingByRole.values()].some((items) => items.length > 0)) for (const role of ["ORIENTATION", "PHASE_DIMENSION", "AUTHORITY_TARGETED"] as const) { if (selected.size >= maximum) break; const next = remainingByRole.get(role)!.shift(); if (next) selected.add(next.candidate.queryId); }
  return input.candidates.map((candidate) => ({ ...candidate, authorizationStatus: duplicateIds.has(candidate.queryId) || !selected.has(candidate.queryId) ? "REJECTED" : "AUTHORIZED", rejectionReason: duplicateIds.has(candidate.queryId) ? "DUPLICATE_NORMALIZED_QUERY" : selected.has(candidate.queryId) ? null : "BUDGET_PRIORITY_EXCLUDED" }));
}
