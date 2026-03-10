import type { EventRecord, SourceRecord, TagRecord, TimelineDetail, TimelineSummary } from "@/src/lib/types";

type MockSeed = {
  title: string;
  slug: string;
  description: string;
  category: string;
  tags: TagRecord[];
  events: Array<{
    date: string;
    datePrecision: EventRecord["datePrecision"];
    title: string;
    description: string;
    importance: number;
    location: string | null;
    sources: SourceRecord[];
    tags: TagRecord[];
  }>;
};

const baseTimestamp = "2026-03-10T00:00:00.000Z";

const tagRegistry = {
  empire: { id: 1, slug: "empire", name: "Empire" },
  war: { id: 2, slug: "war", name: "War" },
  diplomacy: { id: 3, slug: "diplomacy", name: "Diplomacy" },
  medicine: { id: 4, slug: "medicine", name: "Medicine" },
  trade: { id: 5, slug: "trade", name: "Trade" },
  egypt: { id: 6, slug: "egypt", name: "Egypt" },
  archaeology: { id: 7, slug: "archaeology", name: "Archaeology" },
  technology: { id: 8, slug: "technology", name: "Technology" }
} satisfies Record<string, TagRecord>;

const sources = {
  historyDesk: { id: 1, publisher: "TiMELiNES History Desk", url: "https://example.com/history-desk", credibilityScore: 0.92 },
  archive: { id: 2, publisher: "Imperial Archive", url: "https://example.com/imperial-archive", credibilityScore: 0.89 },
  diplomacyDesk: { id: 3, publisher: "Global Affairs Desk", url: "https://example.com/global-affairs", credibilityScore: 0.91 },
  medicalReview: { id: 4, publisher: "Medical Review Archive", url: "https://example.com/medical-review", credibilityScore: 0.94 },
  tradeAtlas: { id: 5, publisher: "Trade Atlas", url: "https://example.com/trade-atlas", credibilityScore: 0.9 },
  egyptology: { id: 6, publisher: "Egyptology Journal", url: "https://example.com/egyptology", credibilityScore: 0.93 }
} satisfies Record<string, SourceRecord>;

const mockSeeds: MockSeed[] = [
  {
    title: "Roman Empire",
    slug: "roman-empire",
    description: "A timeline of the Roman Empire from imperial consolidation to western collapse.",
    category: "Ancient History",
    tags: [tagRegistry.empire, tagRegistry.trade],
    events: [
      {
        date: "0027-01-16",
        datePrecision: "day",
        title: "Augustus becomes first Roman emperor",
        description: "Octavian receives the title Augustus and consolidates the institutions that define the Roman imperial system.",
        importance: 5,
        location: "Rome",
        sources: [sources.historyDesk, sources.archive],
        tags: [tagRegistry.empire]
      },
      {
        date: "0043-01-01",
        datePrecision: "year",
        title: "Rome invades Britannia",
        description: "Claudius launches the invasion of Britain, extending Roman control deeper into northwestern Europe.",
        importance: 4,
        location: "Britannia",
        sources: [sources.archive],
        tags: [tagRegistry.empire, tagRegistry.trade]
      },
      {
        date: "0117-01-01",
        datePrecision: "year",
        title: "Empire reaches maximum territorial extent",
        description: "Under Trajan, Roman territory spans from Britain to Mesopotamia at its greatest formal size.",
        importance: 5,
        location: "Mediterranean world",
        sources: [sources.historyDesk],
        tags: [tagRegistry.empire]
      },
      {
        date: "0212-01-01",
        datePrecision: "year",
        title: "Citizenship expands across the empire",
        description: "The Constitutio Antoniniana grants Roman citizenship to most free inhabitants of the empire.",
        importance: 4,
        location: "Roman Empire",
        sources: [sources.archive],
        tags: [tagRegistry.empire]
      },
      {
        date: "0284-01-01",
        datePrecision: "year",
        title: "Diocletian begins imperial reforms",
        description: "Administrative, military, and fiscal reforms attempt to stabilize the empire after prolonged crisis.",
        importance: 5,
        location: "Nicomedia",
        sources: [sources.historyDesk],
        tags: [tagRegistry.empire]
      },
      {
        date: "0476-01-01",
        datePrecision: "year",
        title: "Western imperial rule collapses",
        description: "The deposition of Romulus Augustulus becomes the conventional marker for the fall of the Western Roman Empire.",
        importance: 5,
        location: "Ravenna",
        sources: [sources.archive],
        tags: [tagRegistry.empire]
      }
    ]
  },
  {
    title: "Cold War",
    slug: "cold-war",
    description: "The major escalations, crises, and settlements of the Cold War order.",
    category: "Modern History",
    tags: [tagRegistry.war, tagRegistry.diplomacy, tagRegistry.technology],
    events: [
      {
        date: "1947-03-12",
        datePrecision: "day",
        title: "Truman Doctrine announced",
        description: "The United States frames containment as a long-term geopolitical commitment against Soviet expansion.",
        importance: 5,
        location: "Washington, D.C.",
        sources: [sources.diplomacyDesk],
        tags: [tagRegistry.war, tagRegistry.diplomacy]
      },
      {
        date: "1948-06-24",
        datePrecision: "day",
        title: "Berlin Blockade begins",
        description: "The Soviet blockade of West Berlin triggers a major airlift and one of the first Cold War crises.",
        importance: 5,
        location: "Berlin",
        sources: [sources.diplomacyDesk],
        tags: [tagRegistry.war]
      },
      {
        date: "1962-10-16",
        datePrecision: "day",
        title: "Cuban Missile Crisis erupts",
        description: "Nuclear confrontation reaches its most dangerous point after the discovery of Soviet missiles in Cuba.",
        importance: 5,
        location: "Cuba",
        sources: [sources.diplomacyDesk],
        tags: [tagRegistry.war, tagRegistry.diplomacy]
      },
      {
        date: "1969-07-20",
        datePrecision: "day",
        title: "Moon landing reshapes prestige competition",
        description: "Apollo 11 becomes a technological and symbolic high point in the superpower contest.",
        importance: 4,
        location: "Moon",
        sources: [sources.historyDesk],
        tags: [tagRegistry.technology]
      },
      {
        date: "1989-11-09",
        datePrecision: "day",
        title: "Berlin Wall opens",
        description: "The opening of the Berlin Wall signals the breakdown of Soviet control in Eastern Europe.",
        importance: 5,
        location: "Berlin",
        sources: [sources.diplomacyDesk],
        tags: [tagRegistry.war, tagRegistry.diplomacy]
      },
      {
        date: "1991-12-26",
        datePrecision: "day",
        title: "Soviet Union dissolves",
        description: "The formal dissolution of the Soviet Union brings the Cold War era to its end.",
        importance: 5,
        location: "Moscow",
        sources: [sources.diplomacyDesk],
        tags: [tagRegistry.war]
      }
    ]
  },
  {
    title: "History of Medicine",
    slug: "history-of-medicine",
    description: "Major turning points in how medicine was practiced, tested, and scaled.",
    category: "Science",
    tags: [tagRegistry.medicine, tagRegistry.technology],
    events: [
      {
        date: "1543-01-01",
        datePrecision: "year",
        title: "Vesalius publishes modern anatomy",
        description: "Systematic anatomical observation begins to displace inherited medical authority in Europe.",
        importance: 4,
        location: "Basel",
        sources: [sources.medicalReview],
        tags: [tagRegistry.medicine]
      },
      {
        date: "1796-01-01",
        datePrecision: "year",
        title: "Jenner introduces vaccination",
        description: "Smallpox inoculation with cowpox creates a new model for preventive medicine.",
        importance: 5,
        location: "Berkeley, England",
        sources: [sources.medicalReview],
        tags: [tagRegistry.medicine]
      },
      {
        date: "1846-10-16",
        datePrecision: "day",
        title: "Public ether anesthesia demonstration",
        description: "Pain control transforms surgery from a brutal last resort into a more controlled clinical practice.",
        importance: 5,
        location: "Boston",
        sources: [sources.medicalReview],
        tags: [tagRegistry.medicine]
      },
      {
        date: "1867-01-01",
        datePrecision: "year",
        title: "Antiseptic surgery gains traction",
        description: "Joseph Lister's antiseptic methods reduce infection and mortality in surgical settings.",
        importance: 5,
        location: "Glasgow",
        sources: [sources.medicalReview],
        tags: [tagRegistry.medicine]
      },
      {
        date: "1928-01-01",
        datePrecision: "year",
        title: "Penicillin is identified",
        description: "Alexander Fleming's discovery eventually leads to the antibiotic era in clinical medicine.",
        importance: 5,
        location: "London",
        sources: [sources.medicalReview],
        tags: [tagRegistry.medicine]
      },
      {
        date: "2003-04-14",
        datePrecision: "day",
        title: "Human genome project completes",
        description: "Genomic medicine gains a foundational reference for diagnostics, risk analysis, and targeted research.",
        importance: 4,
        location: "Global",
        sources: [sources.medicalReview],
        tags: [tagRegistry.medicine, tagRegistry.technology]
      }
    ]
  },
  {
    title: "Silk Road",
    slug: "silk-road",
    description: "The routes, empires, and exchanges that shaped the Silk Road world.",
    category: "Trade Networks",
    tags: [tagRegistry.trade, tagRegistry.diplomacy],
    events: [
      {
        date: "0130-01-01",
        datePrecision: "year",
        title: "Han diplomacy reaches Central Asia",
        description: "Imperial Chinese missions help establish long-distance political and trade contact across Inner Asia.",
        importance: 4,
        location: "Central Asia",
        sources: [sources.tradeAtlas],
        tags: [tagRegistry.trade, tagRegistry.diplomacy]
      },
      {
        date: "0105-01-01",
        datePrecision: "year",
        title: "Papermaking spreads westward",
        description: "Knowledge transfer along Eurasian exchange routes changes administration, learning, and recordkeeping.",
        importance: 4,
        location: "China",
        sources: [sources.tradeAtlas],
        tags: [tagRegistry.trade]
      },
      {
        date: "0751-01-01",
        datePrecision: "year",
        title: "Battle of Talas influences regional power",
        description: "Control over Central Asian corridors shifts, affecting the balance of power and commercial exchange.",
        importance: 4,
        location: "Talas",
        sources: [sources.tradeAtlas],
        tags: [tagRegistry.trade, tagRegistry.diplomacy]
      },
      {
        date: "1271-01-01",
        datePrecision: "year",
        title: "Marco Polo begins overland journey",
        description: "European awareness of overland Eurasian trade intensifies through travel narratives and diplomacy.",
        importance: 3,
        location: "Venice",
        sources: [sources.tradeAtlas],
        tags: [tagRegistry.trade]
      },
      {
        date: "1347-01-01",
        datePrecision: "year",
        title: "Plague moves along connected trade networks",
        description: "Dense exchange routes accelerate the spread of disease as well as goods and ideas.",
        importance: 5,
        location: "Eurasia",
        sources: [sources.tradeAtlas],
        tags: [tagRegistry.trade]
      },
      {
        date: "1453-01-01",
        datePrecision: "year",
        title: "Ottoman control redirects commercial routes",
        description: "Changes in imperial control encourage maritime alternatives to some classic overland exchanges.",
        importance: 4,
        location: "Constantinople",
        sources: [sources.tradeAtlas],
        tags: [tagRegistry.trade, tagRegistry.diplomacy]
      }
    ]
  },
  {
    title: "Ancient Egypt",
    slug: "ancient-egypt",
    description: "A long view of dynastic power, monumental building, and political transformation in ancient Egypt.",
    category: "Ancient History",
    tags: [tagRegistry.egypt, tagRegistry.archaeology],
    events: [
      {
        date: "3100-01-01",
        datePrecision: "year",
        title: "Upper and Lower Egypt are unified",
        description: "Early dynastic rule brings the Nile valley under a single royal authority.",
        importance: 5,
        location: "Nile Valley",
        sources: [sources.egyptology],
        tags: [tagRegistry.egypt]
      },
      {
        date: "2580-01-01",
        datePrecision: "year",
        title: "Great Pyramid construction begins",
        description: "Old Kingdom state capacity is expressed through monumental building at Giza.",
        importance: 5,
        location: "Giza",
        sources: [sources.egyptology],
        tags: [tagRegistry.egypt, tagRegistry.archaeology]
      },
      {
        date: "1332-01-01",
        datePrecision: "year",
        title: "Tutankhamun ascends the throne",
        description: "The restoration of traditional cult practice follows the upheaval of the Amarna period.",
        importance: 4,
        location: "Thebes",
        sources: [sources.egyptology],
        tags: [tagRegistry.egypt]
      },
      {
        date: "1279-01-01",
        datePrecision: "year",
        title: "Ramesses II begins his reign",
        description: "One of Egypt's longest and most visible reigns expands monumental state display and diplomacy.",
        importance: 4,
        location: "Pi-Ramesses",
        sources: [sources.egyptology],
        tags: [tagRegistry.egypt]
      },
      {
        date: "0051-01-01",
        datePrecision: "year",
        title: "Cleopatra VII takes power",
        description: "The final Ptolemaic ruler becomes central to Egypt's last independent phase before Roman control.",
        importance: 5,
        location: "Alexandria",
        sources: [sources.egyptology],
        tags: [tagRegistry.egypt]
      },
      {
        date: "1922-11-04",
        datePrecision: "day",
        title: "Tutankhamun's tomb is discovered",
        description: "Howard Carter's discovery renews global fascination with ancient Egypt and modern archaeology.",
        importance: 5,
        location: "Valley of the Kings",
        sources: [sources.egyptology],
        tags: [tagRegistry.archaeology]
      }
    ]
  }
];

function toSummary(seed: MockSeed, index: number): TimelineSummary {
  return {
    id: 10_000 + index,
    title: seed.title,
    slug: seed.slug,
    description: seed.description,
    category: seed.category,
    createdAt: baseTimestamp,
    updatedAt: baseTimestamp,
    tags: seed.tags,
    eventCount: seed.events.length,
    highlightedEventTitles: seed.events.slice(0, 3).map((event) => event.title)
  };
}

const mockSummaries = mockSeeds.map(toSummary);

function toDetail(seed: MockSeed, index: number): TimelineDetail {
  return {
    ...toSummary(seed, index),
    events: seed.events.map((event, eventIndex) => ({
      id: 20_000 + index * 100 + eventIndex,
      date: event.date,
      datePrecision: event.datePrecision,
      title: event.title,
      description: event.description,
      importance: event.importance,
      location: event.location,
      imageUrl: null,
      createdAt: baseTimestamp,
      updatedAt: baseTimestamp,
      sources: event.sources,
      tags: event.tags
    })),
    relatedTimelines: mockSummaries.filter((summary) => summary.slug !== seed.slug).slice(0, 3)
  };
}

export const mockFeaturedTimelines: TimelineSummary[] = mockSummaries;
export const mockTimelineSlugs = mockSummaries.map((timeline) => timeline.slug);

export function getMockTimelineDetail(slug: string): TimelineDetail | null {
  const seedIndex = mockSeeds.findIndex((seed) => seed.slug === slug);
  const seed = mockSeeds[seedIndex];
  if (!seed) {
    return null;
  }

  return toDetail(seed, seedIndex);
}
