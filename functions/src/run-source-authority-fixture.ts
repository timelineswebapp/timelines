import { executeNonPublicSourceAuthorityClaimFixture } from "./pipeline";
import type { GeneratedTimeline } from "./schemas";

type Fixture = {
  displayTitle: string;
  fixtureClass: string;
  event: GeneratedTimeline["events"][number];
};

function event(input: { date: string; year: number; title: string; description: string; location: string }): GeneratedTimeline["events"][number] {
  return {
    date: input.date,
    datePrecision: "day",
    sortYear: input.year,
    sortMonth: null,
    sortDay: null,
    title: input.title,
    description: input.description,
    evidenceSummary: "Live Google Search grounding is evaluated by deterministic Source Authority V2 policy.",
    importance: 5,
    location: input.location,
    sourceRefs: ["pending-source"],
    evidenceRefs: ["pending-evidence"],
    tags: ["source authority"]
  };
}

const FIXTURES: Readonly<Record<string, Fixture>> = {
  scientific: {
    displayTitle: "Apollo 11 Launch",
    fixtureClass: "scientific_technical",
    event: event({
      date: "July 16, 1969", year: 1969, title: "NASA Launches Apollo 11",
      description: "NASA launched Apollo 11 from Kennedy Space Center on July 16, 1969, beginning the first crewed lunar landing mission.",
      location: "Florida, United States"
    })
  },
  political: {
    displayTitle: "German Reunification",
    fixtureClass: "political_historical",
    event: event({
      date: "October 3, 1990", year: 1990, title: "Germany Is Reunified",
      description: "The German Democratic Republic acceded to the Federal Republic of Germany on October 3, 1990, completing German reunification.",
      location: "Germany"
    })
  },
  cultural: {
    displayTitle: "UNESCO World Heritage Convention",
    fixtureClass: "cultural_social",
    event: event({
      date: "November 16, 1972", year: 1972, title: "UNESCO Adopts the World Heritage Convention",
      description: "UNESCO's General Conference adopted the Convention Concerning the Protection of the World Cultural and Natural Heritage on November 16, 1972.",
      location: "Paris, France"
    })
  }
};

const fixtureName = process.argv[process.argv.indexOf("--fixture") + 1];
const fixture = fixtureName ? FIXTURES[fixtureName] : undefined;
if (!fixture) throw new Error("--fixture must be one of: scientific, political, cultural.");

executeNonPublicSourceAuthorityClaimFixture(fixture)
  .then((result) => {
    console.log(JSON.stringify({ ok: result.sourceAuthorityVerdict === "passed", result }, null, 2));
    if (result.sourceAuthorityVerdict !== "passed") process.exitCode = 1;
  })
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  });
