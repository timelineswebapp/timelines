import type { EditorialEndToEndCase } from "@/src/server/editorial-certification/end-to-end-contracts";

export const editorialEndToEndTierACorpus: readonly EditorialEndToEndCase[] = [
  { caseId: "editorial-e2e-roman-republic", topic: "Roman Republic", ei002CaseId: "ei002-roman-republic-bce", ei003CaseId: "ei003-roman-republic-bce", ei004CaseId: "ei004-roman-republic" },
  { caseId: "editorial-e2e-printing-press", topic: "Printing Press", ei002CaseId: "ei002-printing-duplicate", ei003CaseId: "ei003-printing-exclusion", ei004CaseId: "ei004-printing-press" },
  { caseId: "editorial-e2e-meiji-restoration", topic: "Meiji Restoration", ei002CaseId: "ei002-meiji-same-day", ei003CaseId: "ei003-meiji-same-day-turning-points", ei004CaseId: "ei004-meiji-restoration" },
  { caseId: "editorial-e2e-internet", topic: "Internet", ei002CaseId: "ei002-internet-long-chronology", ei003CaseId: "ei003-internet-chronology-gap", ei004CaseId: "ei004-internet" }
] as const;
