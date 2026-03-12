import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseHistoricalDateInput } from "@/src/lib/historical-date";
import { closeSql, getSql } from "@/src/server/db/client";
import { sampleTimelines } from "@/src/server/dev/sample-data";

async function seed() {
  const sql = getSql();
  if (!sql) {
    throw new Error("DATABASE_URL must be configured to run the seed script.");
  }

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
  const schema = await readFile(schemaPath, "utf8");

  await sql.unsafe(schema);
  await sql`
    TRUNCATE TABLE event_tags, event_sources, timeline_events, timeline_requests, tags, sources, events, timelines
    RESTART IDENTITY CASCADE
  `;

  for (const timeline of sampleTimelines) {
    const [timelineRow] = await sql<{ id: number }[]>`
      INSERT INTO timelines (title, slug, description, category)
      VALUES (${timeline.title}, ${timeline.slug}, ${timeline.description}, ${timeline.category})
      RETURNING id
    `;

    if (!timelineRow) {
      throw new Error(`Failed to upsert timeline ${timeline.slug}.`);
    }

    for (const [index, event] of timeline.events.entries()) {
      const chronology = parseHistoricalDateInput(event.displayDate || event.legacyDate || event.date, event.datePrecision);
      const [eventRow] = await sql<{ id: number }[]>`
        INSERT INTO events (date, date_precision, sort_year, sort_month, sort_day, display_date, title, description, importance, location, image_url)
        VALUES (
          CAST(CAST(${chronology.legacyDate} AS TEXT) AS DATE),
          ${chronology.datePrecision},
          ${chronology.sortYear},
          ${chronology.sortMonth},
          ${chronology.sortDay},
          ${chronology.displayDate},
          ${event.title},
          ${event.description},
          ${event.importance},
          ${event.location},
          ${event.imageUrl}
        )
        RETURNING id
      `;

      if (!eventRow) {
        throw new Error(`Failed to insert event ${event.title}.`);
      }

      await sql`
        INSERT INTO timeline_events (timeline_id, event_id, event_order)
        VALUES (${timelineRow.id}, ${eventRow.id}, ${index + 1})
      `;

      for (const source of event.sources) {
        const [sourceRow] = await sql<{ id: number }[]>`
          INSERT INTO sources (publisher, url, credibility_score)
          VALUES (${source.publisher}, ${source.url}, ${source.credibilityScore})
          ON CONFLICT (url)
          DO UPDATE SET
            publisher = EXCLUDED.publisher,
            credibility_score = EXCLUDED.credibility_score
          RETURNING id
        `;

        if (sourceRow) {
          await sql`
            INSERT INTO event_sources (event_id, source_id)
            VALUES (${eventRow.id}, ${sourceRow.id})
            ON CONFLICT DO NOTHING
          `;
        }
      }

      for (const tag of event.tags) {
        const [tagRow] = await sql<{ id: number }[]>`
          INSERT INTO tags (slug, name)
          VALUES (${tag.slug}, ${tag.name})
          ON CONFLICT (slug)
          DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `;

        if (tagRow) {
          await sql`
            INSERT INTO event_tags (event_id, tag_id)
            VALUES (${eventRow.id}, ${tagRow.id})
            ON CONFLICT DO NOTHING
          `;
        }
      }
    }
  }
}

seed()
  .then(async () => {
    console.log("Seed completed.");
    await closeSql();
  })
  .catch(async (error) => {
    console.error(error);
    await closeSql();
    process.exitCode = 1;
  });
