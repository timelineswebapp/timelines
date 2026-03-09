import type { TagRecord } from "@/src/lib/types";
import { getSql } from "@/src/server/db/client";
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
    const sql = getSql();
    if (!sql) {
      const tag = { id: memoryStore.nextTagId(), ...input };
      memoryStore.setTags([...memoryStore.getTags(), tag]);
      return tag;
    }

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
    const sql = getSql();
    if (!sql) {
      const tags = memoryStore.getTags();
      const tag = tags.find((item) => item.id === id);
      if (!tag) {
        return null;
      }
      Object.assign(tag, input);
      return tag;
    }

    const [row] = await sql<TagRecord[]>`
      UPDATE tags
      SET slug = ${input.slug}, name = ${input.name}
      WHERE id = ${id}
      RETURNING id, slug, name
    `;

    return row || null;
  },

  async delete(id: number): Promise<boolean> {
    const sql = getSql();
    if (!sql) {
      const tags = memoryStore.getTags();
      const next = tags.filter((item) => item.id !== id);
      if (next.length === tags.length) {
        return false;
      }
      memoryStore.setTags(next);
      return true;
    }

    const result = await sql`DELETE FROM tags WHERE id = ${id}`;
    return result.count > 0;
  }
};
