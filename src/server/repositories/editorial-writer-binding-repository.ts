import { randomUUID } from "node:crypto";
import { getWriteSql, withIndependentWriteTransaction, withWriteTransaction } from "@/src/server/db/client";
import type {
  CreateEditorialWriterConfigurationBindingInput,
  CreateValidatedEditorialGenerationUnitInput,
  EditorialGenerationUnitPersistence,
  EditorialWriterConfigurationBinding,
  EditorialWriterConfigurationBindingRegistry,
  ValidatedEditorialGenerationUnit
} from "@/src/server/editorial-intelligence/editorial-writer-configuration-contracts";

const bindingColumns = `
  binding.id::text AS "bindingId",
  binding.title_prompt_version_id::text AS "titlePromptVersionId",
  binding.introduction_prompt_version_id::text AS "introductionPromptVersionId",
  binding.phase_prompt_version_id::text AS "phasePromptVersionId",
  binding.conclusion_prompt_version_id::text AS "conclusionPromptVersionId",
  binding.writing_policy_version_id::text AS "writingPolicyVersionId",
  binding.provider_configuration_id::text AS "providerConfigurationId",
  binding.locale, binding.narrative_mode AS "narrativeMode",
  binding.binding_fingerprint AS "bindingFingerprint",
  CASE WHEN supersession.superseded_binding_id IS NULL THEN 'active' ELSE 'superseded' END AS lifecycle,
  binding.created_by AS "createdBy", binding.created_at::text AS "createdAt"
`;

async function getBinding(id: string): Promise<EditorialWriterConfigurationBinding | null> {
  const sql = getWriteSql("loading Writer Configuration Binding by exact ID");
  const [row] = await sql<EditorialWriterConfigurationBinding[]>`
    SELECT ${sql.unsafe(bindingColumns)}
    FROM editorial_writer_configuration_bindings binding
    LEFT JOIN editorial_writer_configuration_binding_supersessions supersession
      ON supersession.superseded_binding_id = binding.id
    WHERE binding.id = ${id}
    LIMIT 1`;
  return row || null;
}

export const editorialWriterConfigurationBindingRepository: EditorialWriterConfigurationBindingRegistry = {
  getWriterConfigurationBindingById: getBinding,

  async getActiveWriterConfigurationBinding() {
    const sql = getWriteSql("loading active Writer Configuration Binding");
    const [row] = await sql<EditorialWriterConfigurationBinding[]>`
      SELECT ${sql.unsafe(bindingColumns)}
      FROM editorial_writer_configuration_bindings binding
      LEFT JOIN editorial_writer_configuration_binding_supersessions supersession
        ON supersession.superseded_binding_id = binding.id
      WHERE supersession.superseded_binding_id IS NULL
      LIMIT 1`;
    return row || null;
  },

  async createWriterConfigurationBinding(input: CreateEditorialWriterConfigurationBindingInput) {
    return withWriteTransaction("creating immutable Writer Configuration Binding", async () => {
      const sql = getWriteSql("creating immutable Writer Configuration Binding");
      await sql`SELECT pg_advisory_xact_lock(hashtextextended('editorial-writer-active-binding', 0))`;
      const [existing] = await sql<Array<{ bindingId: string }>>`
        SELECT id::text AS "bindingId" FROM editorial_writer_configuration_bindings
        WHERE binding_fingerprint = ${input.bindingFingerprint} LIMIT 1`;
      if (existing) return (await getBinding(existing.bindingId))!;
      const active = await editorialWriterConfigurationBindingRepository.getActiveWriterConfigurationBinding();
      if (active && input.supersedesBindingId !== active.bindingId) {
        throw new Error("Writer Configuration Binding must supersede the exact active binding.");
      }
      if (!active && input.supersedesBindingId) {
        throw new Error("Initial Writer Configuration Binding cannot supersede an unknown binding.");
      }
      const bindingId = randomUUID();
      await sql`INSERT INTO editorial_writer_configuration_bindings(
        id,title_prompt_version_id,introduction_prompt_version_id,phase_prompt_version_id,
        conclusion_prompt_version_id,writing_policy_version_id,provider_configuration_id,
        locale,narrative_mode,binding_fingerprint,created_by
      ) VALUES(${bindingId},${input.titlePromptVersionId},${input.introductionPromptVersionId},
        ${input.phasePromptVersionId},${input.conclusionPromptVersionId},${input.writingPolicyVersionId},
        ${input.providerConfigurationId},${input.locale},${input.narrativeMode},
        ${input.bindingFingerprint},${input.createdBy})`;
      if (input.supersedesBindingId) {
        await sql`INSERT INTO editorial_writer_configuration_binding_supersessions(
          superseded_binding_id,successor_binding_id
        ) VALUES(${input.supersedesBindingId},${bindingId})`;
      }
      return (await getBinding(bindingId))!;
    });
  }
};

const unitColumns = `
  id::text AS "generationUnitId", execution_key AS "executionKey", unit_type AS "unitType",
  unit_sequence AS "unitSequence", prompt_version_id::text AS "promptVersionId",
  input_fingerprint AS "inputFingerprint", output_fingerprint AS "outputFingerprint",
  validated_output AS "validatedOutput", grounding_validation_report AS "groundingValidationReport",
  diagnostics, status, created_by AS "createdBy", created_at::text AS "createdAt"
`;

export const editorialGenerationUnitRepository: EditorialGenerationUnitPersistence = {
  async createValidatedGenerationUnit(input: CreateValidatedEditorialGenerationUnitInput) {
    return withIndependentWriteTransaction("persisting validated Editorial Writer generation unit", async () => {
      const sql = getWriteSql("persisting validated Editorial Writer generation unit");
      const lockKey = `${input.executionKey}:${input.unitType}:${input.unitSequence}`;
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const existing = await editorialGenerationUnitRepository.getValidatedGenerationUnit(
        input.executionKey, input.unitType, input.unitSequence
      );
      if (existing) {
        if (existing.inputFingerprint !== input.inputFingerprint ||
            existing.outputFingerprint !== input.outputFingerprint) {
          throw new Error("Validated generation unit identity conflict.");
        }
        return existing;
      }
      const id = randomUUID();
      const [row] = await sql<ValidatedEditorialGenerationUnit[]>`
        INSERT INTO factory_editorial_generation_units(
          id,execution_key,unit_type,unit_sequence,prompt_version_id,input_fingerprint,
          output_fingerprint,validated_output,grounding_validation_report,diagnostics,status,created_by
        ) VALUES(${id},${input.executionKey},${input.unitType},${input.unitSequence},
          ${input.promptVersionId},${input.inputFingerprint},${input.outputFingerprint},
          ${sql.json(input.validatedOutput as any)},${sql.json(input.groundingValidationReport as any)},
          ${sql.json(input.diagnostics as any)},'validated',${input.createdBy})
        RETURNING ${sql.unsafe(unitColumns)}`;
      return row!;
    });
  },

  async getValidatedGenerationUnit(executionKey, unitType, unitSequence) {
    const sql = getWriteSql("loading validated generation unit by exact identity");
    const [row] = await sql<ValidatedEditorialGenerationUnit[]>`
      SELECT ${sql.unsafe(unitColumns)} FROM factory_editorial_generation_units
      WHERE execution_key=${executionKey} AND unit_type=${unitType} AND unit_sequence=${unitSequence}
      LIMIT 1`;
    return row || null;
  },

  async getValidatedGenerationUnitsByExecutionKey(executionKey) {
    const sql = getWriteSql("loading validated generation units by exact execution key");
    return sql<ValidatedEditorialGenerationUnit[]>`
      SELECT ${sql.unsafe(unitColumns)} FROM factory_editorial_generation_units
      WHERE execution_key=${executionKey}
      ORDER BY unit_sequence, unit_type
      LIMIT 1000`;
  }
};
