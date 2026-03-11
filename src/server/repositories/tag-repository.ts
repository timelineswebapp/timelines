import type { TagRecord } from "@/src/lib/types";
import { getSql, getWriteSql } from "@/src/server/db/client";
import { memoryStore } from "@/src/server/dev/memory-store";

export const tagRepository = {
  async list(): Promise<TagRecord[]> {
    const sql = getSql();
    if (!sql) {
      return memoryStore.getTags();
    }

    return sql<TagRecord[]>`
      SELECT id, slug, name
      FROM tags
      ORDER BY name ASC
    `;
  },

  async getBySlug(slug: string): Promise<TagRecord | null> {
    const sql = getSql();
    if (!sql) {
      return memoryStore.getTags().find((tag) => tag.slug === slug) || null;
    }

    const [row] = await sql<TagRecord[]>`
      SELECT id, slug, name
      FROM tags
      WHERE slug = ${slug}
      LIMIT 1
    `;

    return row || null;
  },

  async create(input: Omit<TagRecord, "id">): Promise<TagRecord> {
    const sql = getWriteSql("tag create");

    const [row] = await sql<TagRecord[]>`
      INSERT INTO tags (slug, name)
      VALUES (${input.slug}, ${input.name})
      RETURNING id, slug, name
    `;

    if (!row) {
      throw new Error("Tag insert failed.");
    }

    return row;
  },

  async update(id: number, input: Omit<TagRecord, "id">): Promise<TagRecord | null> {
    const sql = getWriteSql("tag update");

    const [row] = await sql<TagRecord[]>`
      UPDATE tags
      SET slug = ${input.slug}, name = ${input.name}
      WHERE id = ${id}
      RETURNING id, slug, name
    `;

    return row || null;
  },

  async delete(id: number): Promise<boolean> {
    const sql = getWriteSql("tag delete");

    const result = await sql`DELETE FROM tags WHERE id = ${id}`;
    return result.count > 0;
  }
};
