import { randomUUID } from "node:crypto";
import { getWriteSql, withWriteTransaction } from "@/src/server/db/client";
import type {
  CreateEditorialPromptInput,
  CreateEditorialProviderConfigurationInput,
  CreateEditorialWritingPolicyInput,
  EditorialPromptRegistry,
  EditorialPromptRegistryRecord,
  EditorialProviderConfiguration,
  EditorialProviderConfigurationRegistry,
  EditorialWritingPolicyRegistry,
  EditorialWritingPolicyRegistryRecord
} from "@/src/server/editorial-intelligence/editorial-writer-configuration-contracts";

const promptColumns = `
  version_record.id::text AS "promptVersionId", prompt.id::text AS "promptId",
  prompt.prompt_key AS "promptKey", version_record.version, version_record.content,
  version_record.content_fingerprint AS "contentFingerprint",
  version_record.input_schema_version AS "inputSchemaVersion",
  version_record.output_schema_version AS "outputSchemaVersion",
  version_record.policy_id AS "policyId", version_record.policy_version AS "policyVersion",
  CASE WHEN supersession.superseded_prompt_version_id IS NULL THEN 'active' ELSE 'superseded' END AS lifecycle,
  version_record.created_by AS "createdBy", version_record.created_at::text AS "createdAt"
`;

async function getPrompt(where: "id" | "version", value: string, version?: number) {
  const sql = getWriteSql("loading Editorial Prompt by exact identity");
  const [row] = where === "id"
    ? await sql<EditorialPromptRegistryRecord[]>`
      SELECT ${sql.unsafe(promptColumns)}
      FROM editorial_prompt_versions version_record
      JOIN editorial_prompts prompt ON prompt.id = version_record.prompt_id
      LEFT JOIN editorial_prompt_supersessions supersession
        ON supersession.superseded_prompt_version_id = version_record.id
      WHERE version_record.id = ${value} LIMIT 1`
    : await sql<EditorialPromptRegistryRecord[]>`
      SELECT ${sql.unsafe(promptColumns)}
      FROM editorial_prompt_versions version_record
      JOIN editorial_prompts prompt ON prompt.id = version_record.prompt_id
      LEFT JOIN editorial_prompt_supersessions supersession
        ON supersession.superseded_prompt_version_id = version_record.id
      WHERE version_record.prompt_id = ${value} AND version_record.version = ${version!} LIMIT 1`;
  return row || null;
}

export const editorialPromptRepository: EditorialPromptRegistry = {
  getPromptById: (promptVersionId) => getPrompt("id", promptVersionId),
  getPromptVersion: (promptId, version) => getPrompt("version", promptId, version),

  async getActivePrompt(promptKey) {
    const sql = getWriteSql("loading active Editorial Prompt");
    const [row] = await sql<EditorialPromptRegistryRecord[]>`
      SELECT ${sql.unsafe(promptColumns)}
      FROM editorial_prompt_versions version_record
      JOIN editorial_prompts prompt ON prompt.id = version_record.prompt_id
      LEFT JOIN editorial_prompt_supersessions supersession
        ON supersession.superseded_prompt_version_id = version_record.id
      WHERE prompt.prompt_key = ${promptKey}
        AND supersession.superseded_prompt_version_id IS NULL
      LIMIT 1`;
    return row || null;
  },

  async createPrompt(input: CreateEditorialPromptInput) {
    return withWriteTransaction("creating immutable Editorial Prompt version", async () => {
      const sql = getWriteSql("creating immutable Editorial Prompt version");
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`editorial-prompt:${input.promptId}`}, 0))`;
      const existing = await getPrompt("version", input.promptId, input.version);
      if (existing) {
        if (existing.contentFingerprint !== input.contentFingerprint) {
          throw new Error("Editorial Prompt version identity conflict.");
        }
        return existing;
      }
      const [prompt] = await sql<Array<{ promptId: string; promptKey: string }>>`
        SELECT id::text AS "promptId", prompt_key AS "promptKey"
        FROM editorial_prompts WHERE id = ${input.promptId} LIMIT 1`;
      if (prompt && prompt.promptKey !== input.promptKey) {
        throw new Error("Editorial Prompt ID belongs to a different prompt key.");
      }
      if (!prompt) {
        await sql`INSERT INTO editorial_prompts(id,prompt_key,created_by)
          VALUES(${input.promptId},${input.promptKey},${input.createdBy})`;
      }
      if (input.version > 1 && !input.supersedesPromptVersionId) {
        throw new Error("A later Editorial Prompt version must identify the exact superseded version.");
      }
      if (input.supersedesPromptVersionId) {
        const [superseded, active] = await Promise.all([
          getPrompt("id", input.supersedesPromptVersionId),
          editorialPromptRepository.getActivePrompt(input.promptKey)
        ]);
        if (!superseded || !active || superseded.promptVersionId !== active.promptVersionId ||
            superseded.promptId !== input.promptId || input.version <= superseded.version) {
          throw new Error("Editorial Prompt supersession must target the exact active prior version.");
        }
      }
      const promptVersionId = randomUUID();
      await sql`INSERT INTO editorial_prompt_versions(
        id,prompt_id,version,content,content_fingerprint,input_schema_version,output_schema_version,
        policy_id,policy_version,created_by
      ) VALUES(${promptVersionId},${input.promptId},${input.version},${input.content},${input.contentFingerprint},
        ${input.inputSchemaVersion},${input.outputSchemaVersion},${input.policyId},${input.policyVersion},${input.createdBy})`;
      if (input.supersedesPromptVersionId) {
        await sql`INSERT INTO editorial_prompt_supersessions(superseded_prompt_version_id,successor_prompt_version_id)
          VALUES(${input.supersedesPromptVersionId},${promptVersionId})`;
      }
      return (await getPrompt("id", promptVersionId))!;
    });
  }
};

const policyColumns = `
  id::text AS "policyVersionId", policy_id AS "policyId", version, schema_version AS "schemaVersion",
  locale, tone, audience,
  reading_level AS "readingLevel", section_limits AS "sectionLimits",
  target_length AS "targetLength",
  quotation_policy AS "quotationPolicy", chronology_policy AS "chronologyPolicy",
  causality_policy AS "causalityPolicy", citation_policy AS "citationPolicy",
  narrative_mode AS "narrativeMode", fingerprint,
  created_by AS "createdBy", created_at::text AS "createdAt"
`;

async function getPolicy(where: "id" | "version", value: string, version?: string) {
  const sql = getWriteSql("loading Editorial Writing Policy by exact identity");
  const [row] = where === "id"
    ? await sql<EditorialWritingPolicyRegistryRecord[]>`
      SELECT ${sql.unsafe(policyColumns)} FROM editorial_writing_policies WHERE id=${value} LIMIT 1`
    : await sql<EditorialWritingPolicyRegistryRecord[]>`
      SELECT ${sql.unsafe(policyColumns)} FROM editorial_writing_policies
      WHERE policy_id=${value} AND version=${version!} LIMIT 1`;
  return row || null;
}

export const editorialWritingPolicyRepository: EditorialWritingPolicyRegistry = {
  getPolicyById: (id) => getPolicy("id", id),
  getPolicyVersion: (id, version) => getPolicy("version", id, version),
  async createPolicy(input: CreateEditorialWritingPolicyInput) {
    return withWriteTransaction("creating immutable Editorial Writing Policy", async () => {
      const sql = getWriteSql("creating immutable Editorial Writing Policy");
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`editorial-policy:${input.policyId}:${input.version}`}, 0))`;
      const existing = await getPolicy("version", input.policyId, input.version);
      if (existing) {
        if (existing.fingerprint !== input.fingerprint) throw new Error("Editorial Writing Policy identity conflict.");
        return existing;
      }
      const id = randomUUID();
      await sql`INSERT INTO editorial_writing_policies(
        id,policy_id,version,schema_version,locale,tone,audience,reading_level,section_limits,target_length,
        quotation_policy,chronology_policy,causality_policy,citation_policy,narrative_mode,fingerprint,created_by
      ) VALUES(${id},${input.policyId},${input.version},${input.schemaVersion},${input.locale},${input.tone},${input.audience},
        ${input.readingLevel},${sql.json(input.sectionLimits as any)},${sql.json(input.targetLength as any)},${input.quotationPolicy},
        ${input.chronologyPolicy},${input.causalityPolicy},${input.citationPolicy},${input.narrativeMode},
        ${input.fingerprint},${input.createdBy})`;
      return (await getPolicy("id", id))!;
    });
  }
};

const providerColumns = `
  id::text AS "providerConfigurationId", provider_id AS "providerId", provider_key AS "providerKey",
  schema_version AS "schemaVersion", provider_version AS "providerVersion",
  model, model_version AS "modelVersion", provider_type AS "providerType", runtime_version AS "runtimeVersion",
  structured_output_version AS "structuredOutputVersion", timeout_ms AS "timeoutMs",
  retry_limit AS "retryLimit", temperature, seed, provenance_fingerprint AS "provenanceFingerprint",
  created_by AS "createdBy", created_at::text AS "createdAt"
`;

async function getProvider(where: "id" | "version", value: string, runtimeVersion?: string) {
  const sql = getWriteSql("loading Editorial Provider Configuration by exact identity");
  const [row] = where === "id"
    ? await sql<EditorialProviderConfiguration[]>`
      SELECT ${sql.unsafe(providerColumns)} FROM editorial_provider_configurations WHERE id=${value} LIMIT 1`
    : await sql<EditorialProviderConfiguration[]>`
      SELECT ${sql.unsafe(providerColumns)} FROM editorial_provider_configurations
      WHERE provider_key=${value} AND runtime_version=${runtimeVersion!} LIMIT 1`;
  return row || null;
}

export const editorialProviderConfigurationRepository: EditorialProviderConfigurationRegistry = {
  getProviderConfiguration: (key, version) => getProvider("version", key, version),
  getProviderConfigurationById: (id) => getProvider("id", id),
  async createProviderConfiguration(input: CreateEditorialProviderConfigurationInput) {
    return withWriteTransaction("creating immutable Editorial Provider Configuration", async () => {
      const sql = getWriteSql("creating immutable Editorial Provider Configuration");
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`editorial-provider:${input.providerKey}:${input.runtimeVersion}`}, 0))`;
      const existing = await getProvider("version", input.providerKey, input.runtimeVersion);
      if (existing) {
        if (existing.provenanceFingerprint !== input.provenanceFingerprint) {
          throw new Error("Editorial Provider Configuration identity conflict.");
        }
        return existing;
      }
      const id = randomUUID();
      await sql`INSERT INTO editorial_provider_configurations(
        id,provider_id,provider_key,schema_version,provider_version,model,model_version,provider_type,
        runtime_version,structured_output_version,timeout_ms,retry_limit,temperature,seed,provenance_fingerprint,created_by
      ) VALUES(${id},${input.providerId},${input.providerKey},${input.schemaVersion},${input.providerVersion},
        ${input.model},${input.modelVersion},${input.providerType},
        ${input.runtimeVersion},${input.structuredOutputVersion},${input.timeoutMs},${input.retryLimit},
        ${input.temperature},${input.seed},
        ${input.provenanceFingerprint},${input.createdBy})`;
      return (await getProvider("id", id))!;
    });
  }
};
