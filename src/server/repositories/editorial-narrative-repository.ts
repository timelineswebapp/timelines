import { randomUUID } from "node:crypto";
import { getWriteSql, withWriteTransaction } from "@/src/server/db/client";
import {
  EDITORIAL_NARRATIVE_PERSISTENCE_VERSION,
  type EditorialNarrativePersistence,
  type PersistEditorialNarrativeInput,
  type PersistedEditorialNarrative
} from "@/src/server/editorial-intelligence/editorial-narrative-persistence-contracts";
import type { NarrativeSection } from "@/src/server/editorial-intelligence/editorial-narrative-contracts";

type NarrativeRow = Omit<PersistedEditorialNarrative,
  "prompts" | "writingPolicy" | "providerProvenance" | "introduction" | "phases" |
  "transitions" | "conclusion" | "sections" | "citations" | "narrativeClaimMap" | "revision"> & {
    titleText: string; titleClaimIds: string[]; titleMilestoneIds: string[];
    subtitleText: string | null; subtitleClaimIds: string[] | null; subtitleMilestoneIds: string[] | null;
  };

async function hydrate(row: NarrativeRow): Promise<PersistedEditorialNarrative> {
  const sql = getWriteSql("hydrating immutable EditorialNarrative");
  const [prompts, provenance, sectionRows, paragraphRows, sentenceRows, paragraphMilestones,
    sentenceClaims, sentenceMilestones, citationRows, citationSentences, citationEvidence, revisions] = await Promise.all([
    sql<any[]>`SELECT prompt_id AS "promptId", prompt_key AS "promptKey", prompt_version AS "promptVersion",
      template_fingerprint AS "templateFingerprint", schema_version AS "schemaVersion", policy_id AS "policyId",
      policy_version AS "policyVersion", lifecycle, prompt_fingerprint AS "promptFingerprint"
      FROM factory_editorial_narrative_prompt_refs WHERE narrative_id=${row.narrativeId} ORDER BY position LIMIT 20`,
    sql<any[]>`SELECT writing_policy AS "writingPolicy", provider_provenance AS "providerProvenance"
      FROM factory_editorial_narrative_provenance WHERE narrative_id=${row.narrativeId} LIMIT 1`,
    sql<any[]>`SELECT section_key AS "sectionId", sequence, section_type AS "sectionType",
      composition_ref AS "compositionRef" FROM factory_editorial_narrative_sections
      WHERE narrative_id=${row.narrativeId} ORDER BY sequence LIMIT 202`,
    sql<any[]>`SELECT section_key AS "sectionId", paragraph_key AS "paragraphId", sequence
      FROM factory_editorial_narrative_paragraphs WHERE narrative_id=${row.narrativeId}
      ORDER BY section_key, sequence LIMIT 202000`,
    sql<any[]>`SELECT paragraph_key AS "paragraphId", sentence_key AS "sentenceId", sequence, text, chronology_refs AS "chronologyRefs"
      FROM factory_editorial_narrative_sentences WHERE narrative_id=${row.narrativeId}
      ORDER BY paragraph_key, sequence LIMIT 1000000`,
    sql<any[]>`SELECT paragraph_key AS "paragraphId", milestone_object_id::text AS "milestoneId"
      FROM factory_editorial_narrative_paragraph_milestones WHERE narrative_id=${row.narrativeId}
      ORDER BY paragraph_key, position LIMIT 40400000`,
    sql<any[]>`SELECT sentence_key AS "sentenceId", claim_id AS "claimId", evidence_record_id::text AS "evidenceRecordId"
      FROM factory_editorial_narrative_sentence_claims WHERE narrative_id=${row.narrativeId}
      ORDER BY sentence_key, position LIMIT 1000000`,
    sql<any[]>`SELECT sentence_key AS "sentenceId", milestone_object_id::text AS "milestoneId"
      FROM factory_editorial_narrative_sentence_milestones WHERE narrative_id=${row.narrativeId}
      ORDER BY sentence_key, position LIMIT 200000000`,
    sql<any[]>`SELECT citation_key AS "citationReferenceId", source_record_id::text AS "sourceRecordId",
      source_snapshot_id::text AS "sourceSnapshotId" FROM factory_editorial_narrative_citations
      WHERE narrative_id=${row.narrativeId} ORDER BY position LIMIT 10000`,
    sql<any[]>`SELECT citation_key AS "citationReferenceId", sentence_key AS "sentenceId"
      FROM factory_editorial_narrative_citation_sentences WHERE narrative_id=${row.narrativeId}
      ORDER BY citation_key, position LIMIT 1000000`,
    sql<any[]>`SELECT citation_key AS "citationReferenceId", evidence_record_id::text AS "evidenceRecordId"
      FROM factory_editorial_narrative_citation_evidence WHERE narrative_id=${row.narrativeId}
      ORDER BY citation_key, position LIMIT 1000000`,
    sql<any[]>`SELECT revision, supersedes_narrative_id::text AS "supersedesNarrativeId", reason
      FROM factory_editorial_narrative_revisions WHERE narrative_id=${row.narrativeId} LIMIT 1`
  ]);
  if (!provenance[0] || !revisions[0]) throw new Error("EditorialNarrative lineage is incomplete.");
  const sections: NarrativeSection[] = sectionRows.map((section) => ({
    ...section,
    paragraphs: paragraphRows.filter((p) => p.sectionId === section.sectionId).map((paragraph) => ({
      paragraphId: paragraph.paragraphId, sequence: paragraph.sequence,
      milestoneIds: paragraphMilestones.filter((m) => m.paragraphId === paragraph.paragraphId).map((m) => m.milestoneId),
      sentences: sentenceRows.filter((s) => s.paragraphId === paragraph.paragraphId).map((sentence) => ({
        sentenceId: sentence.sentenceId, sequence: sentence.sequence, text: sentence.text,
        chronologyRefs: sentence.chronologyRefs,
        claimIds: sentenceClaims.filter((c) => c.sentenceId === sentence.sentenceId).map((c) => c.claimId),
        milestoneIds: sentenceMilestones.filter((m) => m.sentenceId === sentence.sentenceId).map((m) => m.milestoneId)
      }))
    }))
  }));
  const claimEntries = sentenceRows.map((sentence) => ({
    sentenceId: sentence.sentenceId,
    claimIds: sentenceClaims.filter((c) => c.sentenceId === sentence.sentenceId).map((c) => c.claimId),
    evidenceRecordIds: sentenceClaims.filter((c) => c.sentenceId === sentence.sentenceId).map((c) => c.evidenceRecordId),
    milestoneIds: sentenceMilestones.filter((m) => m.sentenceId === sentence.sentenceId).map((m) => m.milestoneId)
  }));
  const { titleText, titleClaimIds, titleMilestoneIds, subtitleText, subtitleClaimIds, subtitleMilestoneIds, ...base } = row;
  return {
    ...base, prompts, writingPolicy: provenance[0].writingPolicy, providerProvenance: provenance[0].providerProvenance,
    title: { text: titleText, claimIds: titleClaimIds, milestoneIds: titleMilestoneIds },
    subtitle: subtitleText === null ? null : { text: subtitleText, claimIds: subtitleClaimIds!, milestoneIds: subtitleMilestoneIds! },
    introduction: sections.find((s) => s.sectionType === "introduction")!,
    phases: sections.filter((s) => s.sectionType === "phase"), transitions: [],
    conclusion: sections.find((s) => s.sectionType === "conclusion")!, sections,
    citations: citationRows.map((citation) => ({
      ...citation,
      sentenceIds: citationSentences.filter((s) => s.citationReferenceId === citation.citationReferenceId).map((s) => s.sentenceId),
      evidenceRecordIds: citationEvidence.filter((e) => e.citationReferenceId === citation.citationReferenceId).map((e) => e.evidenceRecordId)
    })),
    narrativeClaimMap: { entries: claimEntries }, revision: revisions[0]
  };
}

async function findBy(column: "id" | "execution_key" | "output_fingerprint", value: string) {
  const sql = getWriteSql("loading immutable EditorialNarrative");
  const rows = await sql<NarrativeRow[]>`
    SELECT id::text AS "narrativeId", factory_object_id::text AS "factoryObjectId",
      canonical_subject AS "canonicalSubject", locale, contract_version AS "contractVersion",
      editorial_composition_id::text AS "editorialCompositionId", composition_fingerprint AS "editorialCompositionFingerprint",
      editorial_timeline_candidate_id::text AS "editorialTimelineCandidateId",
      candidate_fingerprint AS "editorialTimelineCandidateFingerprint", editorial_evidence_set_id::text AS "editorialEvidenceSetId",
      writer_input_fingerprint AS "writerInputFingerprint", output_fingerprint AS "narrativeOutputFingerprint",
      execution_key AS "executionKey", writer_version AS "writerVersion",
      generation_algorithm_version AS "generationAlgorithmVersion", persistence_version AS "persistenceVersion",
      title_text AS "titleText", title_claim_ids AS "titleClaimIds", title_milestone_ids::text[] AS "titleMilestoneIds",
      subtitle_text AS "subtitleText", subtitle_claim_ids AS "subtitleClaimIds", subtitle_milestone_ids::text[] AS "subtitleMilestoneIds",
      generation_metrics AS "generationMetrics", generation_metadata AS "generationMetadata",
      diagnostics, created_by AS "createdBy", created_at::text AS "createdAt"
    FROM factory_editorial_narratives
    WHERE ${sql(column)} = ${value} LIMIT 1`;
  return rows[0] ? hydrate(rows[0]) : null;
}

export const editorialNarrativeRepository: EditorialNarrativePersistence = {
  async create(input: PersistEditorialNarrativeInput) {
    return withWriteTransaction("persisting immutable EditorialNarrative", async () => {
      const sql = getWriteSql("persisting immutable EditorialNarrative");
      const n = input.narrative;
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.executionKey}:${n.narrativeOutputFingerprint}`}, 0))`;
      const byExecution = await findBy("execution_key", input.executionKey);
      const byOutput = await findBy("output_fingerprint", n.narrativeOutputFingerprint);
      if (byExecution || byOutput) {
        if (byExecution?.narrativeOutputFingerprint !== n.narrativeOutputFingerprint || byOutput?.executionKey !== input.executionKey)
          throw new Error("EditorialNarrative identity conflict.");
        return (byExecution || byOutput)!;
      }
      const narrativeId = randomUUID(), factoryObjectId = randomUUID();
      await sql`INSERT INTO factory_objects(id,object_type,title,payload,lifecycle,provenance,created_by,updated_by)
        VALUES(${factoryObjectId},'editorial_narrative','EditorialNarrative',${sql.json({ editorialNarrativeId: narrativeId })},
        'draft',${sql.json({ institution:"factory",authorityDecision:false,publicationReadinessDecision:false,outputFingerprint:n.narrativeOutputFingerprint })},
        ${input.actor},${input.actor})`;
      await sql`INSERT INTO factory_editorial_narratives(id,factory_object_id,editorial_composition_id,editorial_timeline_candidate_id,
        editorial_evidence_set_id,canonical_subject,locale,contract_version,composition_fingerprint,candidate_fingerprint,
        writer_input_fingerprint,output_fingerprint,execution_key,writer_version,generation_algorithm_version,persistence_version,
        title_text,title_claim_ids,title_milestone_ids,subtitle_text,subtitle_claim_ids,subtitle_milestone_ids,
        generation_metrics,generation_metadata,diagnostics,created_by) VALUES(
        ${narrativeId},${factoryObjectId},${n.editorialCompositionId},${n.editorialTimelineCandidateId},${n.editorialEvidenceSetId},
        ${n.canonicalSubject},${n.locale},${n.contractVersion},${n.editorialCompositionFingerprint},
        ${n.editorialTimelineCandidateFingerprint},${n.writerInputFingerprint},${n.narrativeOutputFingerprint},${input.executionKey},
        ${input.writerVersion},${input.generationAlgorithmVersion},${EDITORIAL_NARRATIVE_PERSISTENCE_VERSION},
        ${n.title.text},${n.title.claimIds as string[]},${n.title.milestoneIds as string[]},${n.subtitle?.text ?? null},
        ${n.subtitle?.claimIds as string[] | undefined ?? null},${n.subtitle?.milestoneIds as string[] | undefined ?? null},
        ${sql.json(n.generationMetrics as any)},${sql.json(n.generationMetadata as any)},${sql.json(input.diagnostics as any)},${input.actor})`;
      const promptRows=n.prompts.map((p,i)=>({...p,position:i+1}));
      await sql`INSERT INTO factory_editorial_narrative_prompt_refs(narrative_id,position,prompt_id,prompt_key,prompt_version,
        template_fingerprint,schema_version,policy_id,policy_version,lifecycle,prompt_fingerprint)
        SELECT ${narrativeId},position,prompt_id,prompt_key,prompt_version,template_fingerprint,schema_version,policy_id,policy_version,lifecycle,prompt_fingerprint
        FROM jsonb_to_recordset(${sql.json(promptRows as any)}) AS x(position int,prompt_id text,prompt_key text,prompt_version int,
        template_fingerprint text,schema_version text,policy_id text,policy_version text,lifecycle text,prompt_fingerprint text)`;
      await sql`INSERT INTO factory_editorial_narrative_provenance VALUES(${narrativeId},${sql.json(n.writingPolicy as any)},${sql.json(n.providerProvenance as any)})`;
      const sections=n.sections.map(s=>({section_key:s.sectionId,sequence:s.sequence,section_type:s.sectionType,composition_ref:s.compositionRef}));
      await sql`INSERT INTO factory_editorial_narrative_sections SELECT ${narrativeId},section_key,sequence,section_type,composition_ref
        FROM jsonb_to_recordset(${sql.json(sections as any)}) AS x(section_key text,sequence int,section_type text,composition_ref text)`;
      const paragraphs=n.sections.flatMap(s=>s.paragraphs.map(p=>({section_key:s.sectionId,paragraph_key:p.paragraphId,sequence:p.sequence})));
      await sql`INSERT INTO factory_editorial_narrative_paragraphs SELECT ${narrativeId},section_key,paragraph_key,sequence
        FROM jsonb_to_recordset(${sql.json(paragraphs as any)}) AS x(section_key text,paragraph_key text,sequence int)`;
      const pm=n.sections.flatMap(s=>s.paragraphs.flatMap(p=>p.milestoneIds.map((id,i)=>({paragraph_key:p.paragraphId,milestone_id:id,position:i+1}))));
      if(pm.length) await sql`INSERT INTO factory_editorial_narrative_paragraph_milestones SELECT ${narrativeId},paragraph_key,milestone_id::uuid,position
        FROM jsonb_to_recordset(${sql.json(pm as any)}) AS x(paragraph_key text,milestone_id text,position int)`;
      const sentences=n.sections.flatMap(s=>s.paragraphs.flatMap(p=>p.sentences.map(x=>({paragraph_key:p.paragraphId,sentence_key:x.sentenceId,sequence:x.sequence,text:x.text,chronology_refs:x.chronologyRefs}))));
      await sql`INSERT INTO factory_editorial_narrative_sentences SELECT ${narrativeId},paragraph_key,sentence_key,sequence,text,chronology_refs
        FROM jsonb_to_recordset(${sql.json(sentences as any)}) AS x(paragraph_key text,sentence_key text,sequence int,text text,chronology_refs text[])`;
      const entry=new Map(n.narrativeClaimMap.entries.map(x=>[x.sentenceId,x]));
      const claims=n.sections.flatMap(s=>s.paragraphs.flatMap(p=>p.sentences.flatMap(x=>x.claimIds.map((id,i)=>({sentence_key:x.sentenceId,claim_id:id,evidence_id:entry.get(x.sentenceId)!.evidenceRecordIds[i],position:i+1})))));
      if(claims.length) await sql`INSERT INTO factory_editorial_narrative_sentence_claims SELECT ${narrativeId},sentence_key,claim_id,evidence_id::uuid,position
        FROM jsonb_to_recordset(${sql.json(claims as any)}) AS x(sentence_key text,claim_id text,evidence_id text,position int)`;
      const sm=n.sections.flatMap(s=>s.paragraphs.flatMap(p=>p.sentences.flatMap(x=>x.milestoneIds.map((id,i)=>({sentence_key:x.sentenceId,milestone_id:id,position:i+1})))));
      if(sm.length) await sql`INSERT INTO factory_editorial_narrative_sentence_milestones SELECT ${narrativeId},sentence_key,milestone_id::uuid,position
        FROM jsonb_to_recordset(${sql.json(sm as any)}) AS x(sentence_key text,milestone_id text,position int)`;
      const citations=n.citations.map((c,i)=>({citation_key:c.citationReferenceId,source_record_id:c.sourceRecordId,source_snapshot_id:c.sourceSnapshotId,position:i+1}));
      if(citations.length) await sql`INSERT INTO factory_editorial_narrative_citations SELECT ${narrativeId},citation_key,source_record_id::uuid,source_snapshot_id::uuid,position
        FROM jsonb_to_recordset(${sql.json(citations as any)}) AS x(citation_key text,source_record_id text,source_snapshot_id text,position int)`;
      const cs=n.citations.flatMap(c=>c.sentenceIds.map((id,i)=>({citation_key:c.citationReferenceId,sentence_key:id,position:i+1})));
      if(cs.length) await sql`INSERT INTO factory_editorial_narrative_citation_sentences SELECT ${narrativeId},citation_key,sentence_key,position
        FROM jsonb_to_recordset(${sql.json(cs as any)}) AS x(citation_key text,sentence_key text,position int)`;
      const ce=n.citations.flatMap(c=>c.evidenceRecordIds.map((id,i)=>({citation_key:c.citationReferenceId,evidence_id:id,position:i+1})));
      if(ce.length) await sql`INSERT INTO factory_editorial_narrative_citation_evidence SELECT ${narrativeId},citation_key,evidence_id::uuid,position
        FROM jsonb_to_recordset(${sql.json(ce as any)}) AS x(citation_key text,evidence_id text,position int)`;
      await sql`INSERT INTO factory_editorial_narrative_revisions VALUES(${narrativeId},${input.revision.revision},${input.revision.supersedesNarrativeId},${input.revision.reason})`;
      return (await findBy("id",narrativeId))!;
    });
  },
  getById: id => findBy("id",id),
  getByExecutionKey: key => findBy("execution_key",key),
  getByOutputFingerprint: fingerprint => findBy("output_fingerprint",fingerprint)
};
