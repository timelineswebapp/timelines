import type { SourceRecord } from "@/src/lib/types";
import { getSql } from "@/src/server/db/client";
import { memoryStore } from "@/src/server/dev/memory-store";

export const sourceRepository = {
  async list(): Promise<SourceRecord[]> {
    const sql = getSql();
    if (!sql) {
      return memoryStore.getSources();
    }

    const rows = await sql<{
      id: number;
      publisher: string;
      url: string;
      credibility_score: string;
    }[]>`
      SELECT id, publisher, url, credibility_score::text
      FROM sources
      ORDER BY publisher ASC
    `;

    return rows.map((row) => ({
      id: row.id,
      publisher: row.publisher,
      url: row.url,
      credibilityScore: Number(row.credibility_score)
    }));
  },

  async create(input: Omit<SourceRecord, "id">): Promise<SourceRecord> {
    const sql = getSql();
    if (!sql) {
      const source = { id: memoryStore.nextSourceId(), ...input };
      memoryStore.setSources([...memoryStore.getSources(), source]);
      return source;
    }

    const [row] = await sql<{
      id: number;
      publisher: string;
      url: string;
      credibility_score: string;
    }[]>`
      INSERT INTO sources (publisher, url, credibility_score)
      VALUES (${input.publisher}, ${input.url}, ${input.credibilityScore})
      RETURNING id, publisher, url, credibility_score::text
    `;

    if (!row) {
      throw new Error("Source insert failed.");
    }

    return {
      id: row.id,
      publisher: row.publisher,
      url: row.url,
      credibilityScore: Number(row.credibility_score)
    };
  },

  async update(id: number, input: Omit<SourceRecord, "id">): Promise<SourceRecord | null> {
    const sql = getSql();
    if (!sql) {
      const sources = memoryStore.getSources();
      const source = sources.find((item) => item.id === id);
      if (!source) {
        return null;
      }

      Object.assign(source, input);
      return source;
    }

    const [row] = await sql<{
      id: number;
      publisher: string;
      url: string;
      credibility_score: string;
    }[]>`
      UPDATE sources
      SET publisher = ${input.publisher}, url = ${input.url}, credibility_score = ${input.credibilityScore}
      WHERE id = ${id}
      RETURNING id, publisher, url, credibility_score::text
    `;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      publisher: row.publisher,
      url: row.url,
      credibilityScore: Number(row.credibility_score)
    };
  },

  async delete(id: number): Promise<boolean> {
    const sql = getSql();
    if (!sql) {
      const sources = memoryStore.getSources();
      const next = sources.filter((item) => item.id !== id);
      if (next.length === sources.length) {
        return false;
      }
      memoryStore.setSources(next);
      return true;
    }

    const result = await sql`DELETE FROM sources WHERE id = ${id}`;
    return result.count > 0;
  }
};
