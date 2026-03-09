import type {
  DashboardOverview,
  EventRecord,
  SourceRecord,
  TagDetail,
  TagRecord,
  TimelineDetail,
  TimelineRequestRecord,
  TimelineSummary
} from "@/src/lib/types";
import { slugify } from "@/src/lib/utils";

interface SampleTimelineSeed {
  title: string;
  description: string;
  category: string;
  tags: string[];
  source: SourceRecord;
  events: Array<{
    date: string;
    datePrecision: EventRecord["datePrecision"];
    title: string;
    description: string;
    importance: number;
    location?: string;
  }>;
}

type SeedEventTuple = [string, EventRecord["datePrecision"], string, string, number, string];

const seededTimelines: SampleTimelineSeed[] = [
  {
    title: "History of Artificial Intelligence",
    description: "A curated record of the milestones that shaped artificial intelligence from formal theory to modern foundation models.",
    category: "Technology",
    tags: ["Artificial Intelligence", "Computing", "Research"],
    source: {
      id: 1,
      publisher: "TiMELiNES Research Desk",
      url: "https://example.com/ai-history",
      credibilityScore: 0.92
    },
    events: ([
      ["1943-01-01", "year", "McCulloch and Pitts propose neural computation", "A mathematical model of artificial neurons established an early theoretical basis for machine intelligence.", 4, "Chicago, United States"],
      ["1950-01-01", "year", "Turing publishes the imitation game", "Alan Turing proposed a practical framing for machine intelligence and public debate around thinking machines.", 5, "Manchester, United Kingdom"],
      ["1956-07-01", "month", "Dartmouth workshop coins AI", "The Dartmouth summer project established artificial intelligence as a named research field with a long-term agenda.", 5, "Hanover, United States"],
      ["1958-01-01", "year", "Perceptron research gains momentum", "Frank Rosenblatt's perceptron work accelerated interest in trainable machine systems.", 4, "Ithaca, United States"],
      ["1966-01-01", "year", "ELIZA demonstrates conversational interfaces", "Joseph Weizenbaum's ELIZA showed how patterned language interaction could create convincing dialogue effects.", 3, "Cambridge, United States"],
      ["1969-01-01", "year", "Perceptrons critique slows neural research", "A prominent critique of perceptrons reduced enthusiasm for multi-layer neural approaches for years.", 4, "Cambridge, United States"],
      ["1972-01-01", "year", "PROLOG popularizes logic programming", "Declarative programming styles became influential in symbolic AI research and expert systems.", 3, "Marseille, France"],
      ["1980-01-01", "year", "Expert systems enter commercial use", "Knowledge-based systems reached enterprises and made AI a material business category.", 4, "Palo Alto, United States"],
      ["1986-01-01", "year", "Backpropagation revives neural networks", "Improved training methods restored confidence in multi-layer neural networks.", 5, "San Diego, United States"],
      ["1997-05-11", "day", "Deep Blue defeats Garry Kasparov", "IBM's system beat the world chess champion in a full match, creating a landmark public moment for AI.", 5, "New York City, United States"],
      ["2006-01-01", "year", "Deep learning terminology returns", "Research into deep belief networks renewed large-scale interest in layered neural architectures.", 4, "Toronto, Canada"],
      ["2009-01-01", "year", "ImageNet dataset scales visual learning", "Large labeled datasets helped modern computer vision move from theory into measurable benchmark progress.", 4, "Princeton, United States"],
      ["2012-09-30", "day", "AlexNet wins ImageNet", "A breakthrough convolutional neural network sharply improved benchmark accuracy and accelerated deep learning adoption.", 5, "Lake Tahoe, United States"],
      ["2014-06-01", "month", "Generative adversarial networks emerge", "GANs opened a major new line of research for synthesis, simulation, and creative tooling.", 4, "Montreal, Canada"],
      ["2016-03-15", "day", "AlphaGo defeats Lee Sedol", "DeepMind combined neural networks and search to beat a leading Go player, broadening public understanding of AI capability.", 5, "Seoul, South Korea"],
      ["2017-06-01", "month", "Transformer architecture is introduced", "Attention-centric sequence modeling reshaped natural language processing and later multimodal systems.", 5, "Long Beach, United States"],
      ["2018-06-01", "month", "BERT changes language modeling", "Bidirectional pretraining established a new performance baseline for many language tasks.", 4, "Mountain View, United States"],
      ["2020-06-01", "month", "Large language models scale rapidly", "Model scale and few-shot performance began redefining expectations for general-purpose AI systems.", 4, "San Francisco, United States"],
      ["2022-11-30", "day", "Conversational AI reaches mass adoption", "User-facing generative systems brought AI into mainstream daily workflows and public policy debates.", 5, "San Francisco, United States"],
      ["2024-01-01", "year", "Multimodal agent systems mature", "Integrated text, image, audio, and tool-use systems moved AI from single-task models toward broader operating environments.", 4, "Global"]
    ] satisfies SeedEventTuple[]).map(([date, datePrecision, title, description, importance, location]) => ({
      date,
      datePrecision,
      title,
      description,
      importance,
      location
    }))
  },
  {
    title: "Space Exploration Milestones",
    description: "Key missions, scientific breakthroughs, and human achievements that shaped modern space exploration.",
    category: "Science",
    tags: ["Space", "Science", "Exploration"],
    source: {
      id: 2,
      publisher: "TiMELiNES Space Desk",
      url: "https://example.com/space-history",
      credibilityScore: 0.95
    },
    events: ([
      ["1957-10-04", "day", "Sputnik 1 launches", "The first artificial satellite marked the start of the space age and reoriented global science policy.", 5, "Baikonur, Kazakhstan"],
      ["1961-04-12", "day", "Yuri Gagarin orbits Earth", "Human spaceflight became operational with the first crewed orbital mission.", 5, "Baikonur, Kazakhstan"],
      ["1963-06-16", "day", "Valentina Tereshkova reaches space", "The first woman in space expanded the human profile of early orbital missions.", 4, "Baikonur, Kazakhstan"],
      ["1965-03-18", "day", "First spacewalk completed", "Extravehicular activity became possible, expanding mission design for future stations and lunar work.", 4, "Low Earth Orbit"],
      ["1969-07-20", "day", "Apollo 11 lands on the Moon", "A crewed lunar landing became one of the defining engineering achievements of the twentieth century.", 5, "Sea of Tranquility"],
      ["1971-04-19", "day", "Salyut 1 launches", "The first space station proved long-duration orbital habitation was feasible.", 4, "Baikonur, Kazakhstan"],
      ["1976-07-20", "day", "Viking 1 lands on Mars", "Surface operations on Mars began producing direct images and atmospheric measurements.", 4, "Chryse Planitia, Mars"],
      ["1981-04-12", "day", "First Space Shuttle mission flies", "Reusable orbital vehicle operations reshaped American human spaceflight planning for decades.", 4, "Florida, United States"],
      ["1990-04-24", "day", "Hubble Space Telescope is deployed", "High-resolution space observation transformed cosmology, planetary science, and public engagement.", 5, "Low Earth Orbit"],
      ["1998-11-20", "day", "International Space Station assembly begins", "A sustained multinational orbital program entered construction and long-term operation.", 5, "Low Earth Orbit"],
      ["2004-01-04", "day", "Spirit rover lands on Mars", "Long-duration rover science demonstrated resilient surface robotics and expanded Martian field exploration.", 4, "Gusev Crater, Mars"],
      ["2008-05-25", "day", "Phoenix confirms Martian ice", "Direct evidence of water ice near the Martian surface strengthened habitability and resource discussions.", 4, "Vastitas Borealis, Mars"],
      ["2012-08-06", "day", "Curiosity lands on Mars", "Nuclear-powered mobile science platforms enabled larger payloads and more ambitious geology campaigns.", 5, "Gale Crater, Mars"],
      ["2014-11-12", "day", "Rosetta mission lands Philae", "A soft landing on a comet demonstrated precision deep-space navigation and small-body science.", 4, "67P/Churyumov–Gerasimenko"],
      ["2015-07-14", "day", "New Horizons flies past Pluto", "Detailed flyby science redefined Pluto and the outer solar system in public and scientific understanding.", 4, "Pluto system"],
      ["2020-05-30", "day", "Crew Dragon restores orbital launch from U.S.", "Commercial crew capability changed how NASA procured human launch services.", 4, "Florida, United States"],
      ["2021-02-18", "day", "Perseverance arrives on Mars", "Sample-caching strategy and autonomous operations advanced the next phase of Mars exploration.", 5, "Jezero Crater, Mars"],
      ["2021-12-25", "day", "James Webb Space Telescope launches", "Next-generation infrared observation extended the frontier of astronomy and telescope engineering.", 5, "Kourou, French Guiana"],
      ["2023-08-23", "day", "Chandrayaan-3 lands near lunar south pole", "India's lunar landing expanded access to planetary exploration and polar mission strategy.", 4, "Lunar south polar region"],
      ["2024-01-20", "day", "Commercial lunar delivery missions begin", "Commercial delivery systems started turning lunar access into an operational market rather than a single-program effort.", 3, "Moon"]
    ] satisfies SeedEventTuple[]).map(([date, datePrecision, title, description, importance, location]) => ({
      date,
      datePrecision,
      title,
      description,
      importance,
      location
    }))
  },
  {
    title: "Evolution of the Internet",
    description: "A timeline of protocols, platforms, and infrastructure shifts that turned the internet into the default global information network.",
    category: "Infrastructure",
    tags: ["Internet", "Web", "Networking"],
    source: {
      id: 3,
      publisher: "TiMELiNES Network Desk",
      url: "https://example.com/internet-history",
      credibilityScore: 0.9
    },
    events: ([
      ["1969-10-29", "day", "ARPANET sends first host-to-host message", "Packet-switched networking moved from concept into functioning infrastructure.", 5, "Los Angeles, United States"],
      ["1971-01-01", "year", "Network email appears", "Email quickly became a dominant use case for networked computing and drove adoption.", 4, "United States"],
      ["1974-01-01", "year", "TCP design is published", "A foundational protocol framework for internetworking was formalized in public technical literature.", 5, "United States"],
      ["1983-01-01", "day", "ARPANET transitions to TCP/IP", "A coordinated protocol migration created the technical basis of the modern internet.", 5, "United States"],
      ["1984-01-01", "year", "Domain name system is introduced", "Human-readable addressing improved network usability and naming governance.", 4, "United States"],
      ["1986-01-01", "year", "NSFNET expands research connectivity", "Higher-capacity academic backbone infrastructure accelerated national network growth.", 4, "United States"],
      ["1989-03-01", "month", "Proposal for the World Wide Web", "Hypertext over the internet became a practical plan for linked information systems.", 5, "Geneva, Switzerland"],
      ["1991-08-06", "day", "The web opens to public access", "The internet gained a user-facing publishing layer that dramatically broadened participation.", 5, "Geneva, Switzerland"],
      ["1993-01-23", "day", "Mosaic popularizes browsing", "Graphical browsing expanded usability and accelerated mainstream awareness of the web.", 4, "Champaign, United States"],
      ["1995-08-09", "day", "Commercial web era accelerates", "Public market enthusiasm and browser competition pushed the web into mass commercial deployment.", 4, "United States"],
      ["1998-09-04", "day", "Search quality becomes a platform advantage", "Link analysis and web indexing created a new model for navigating large-scale information.", 4, "California, United States"],
      ["2001-01-15", "day", "Wikipedia launches", "Collaborative publishing demonstrated that large open knowledge systems could be sustained online.", 3, "Global"],
      ["2004-02-04", "day", "Social networking centralizes identity", "Persistent profiles and network effects changed how the public used the web.", 4, "Cambridge, United States"],
      ["2005-02-14", "day", "Online video platforms scale", "User-generated video publishing changed bandwidth demand and platform economics.", 4, "California, United States"],
      ["2007-06-29", "day", "Mobile internet usage inflects", "Modern smartphones made full web access a default daily behavior rather than a desktop activity.", 5, "United States"],
      ["2010-01-01", "year", "Cloud platforms reshape deployment", "Elastic infrastructure turned internet software distribution into a service-first operating model.", 4, "Global"],
      ["2014-01-01", "year", "Streaming becomes primary media delivery", "Always-on bandwidth and subscription distribution shifted traffic patterns and consumer expectations.", 3, "Global"],
      ["2019-01-01", "year", "Privacy regulation alters platform behavior", "Regulatory pressure changed how major internet products handled identity, consent, and analytics.", 3, "Global"],
      ["2020-03-15", "day", "Remote collaboration becomes internet critical infrastructure", "The pandemic period made network resilience and collaboration tooling central to economic continuity.", 5, "Global"],
      ["2024-01-01", "year", "AI-native internet products emerge", "Search, creation, and support workflows increasingly integrated generative systems into core internet experiences.", 4, "Global"]
    ] satisfies SeedEventTuple[]).map(([date, datePrecision, title, description, importance, location]) => ({
      date,
      datePrecision,
      title,
      description,
      importance,
      location
    }))
  }
];

const allTags = Array.from(
  new Map(
    seededTimelines
      .flatMap((timeline) => timeline.tags)
      .map((name, index) => [slugify(name), { id: index + 1, name, slug: slugify(name) }])
  ).values()
);

function buildTimelineSummary(seed: SampleTimelineSeed, index: number): TimelineSummary {
  const id = index + 1;
  const timelineTags = allTags.filter((tag) => seed.tags.includes(tag.name));

  return {
    id,
    title: seed.title,
    slug: slugify(seed.title),
    description: seed.description,
    category: seed.category,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    tags: timelineTags,
    eventCount: seed.events.length,
    highlightedEventTitles: seed.events.slice(0, 3).map((event) => event.title)
  };
}

function buildTimelineDetail(seed: SampleTimelineSeed, index: number): TimelineDetail {
  const summary = buildTimelineSummary(seed, index);
  const timelineTags = allTags.filter((tag) => seed.tags.includes(tag.name));
  const events: EventRecord[] = seed.events.map((event, eventIndex) => ({
    id: index * 100 + eventIndex + 1,
    date: event.date,
    datePrecision: event.datePrecision,
    title: event.title,
    description: event.description,
    importance: event.importance,
    location: event.location || null,
    imageUrl: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sources: [{ ...seed.source }],
    tags: timelineTags
  }));

  return {
    ...summary,
    events,
    relatedTimelines: seededTimelines
      .map((otherSeed, otherIndex) => buildTimelineSummary(otherSeed, otherIndex))
      .filter((timeline) => timeline.id !== summary.id)
      .slice(0, 3)
  };
}

export const sampleTimelines: TimelineDetail[] = seededTimelines.map(buildTimelineDetail);

export const sampleTimelineSummaries: TimelineSummary[] = sampleTimelines.map(({ events: _events, relatedTimelines: _relatedTimelines, ...summary }) => summary);

export const sampleSources: SourceRecord[] = seededTimelines.map((timeline) => timeline.source);

export const sampleTags: TagRecord[] = allTags;

export const sampleRequests: TimelineRequestRecord[] = [
  {
    id: 1,
    query: "History of biotechnology",
    normalizedQuery: "history of biotechnology",
    ipHash: "sample",
    language: "en",
    status: "pending",
    createdAt: "2026-03-08T10:00:00.000Z"
  },
  {
    id: 2,
    query: "Timeline of renewable energy policy",
    normalizedQuery: "timeline of renewable energy policy",
    ipHash: "sample",
    language: "en",
    status: "planned",
    createdAt: "2026-03-07T09:00:00.000Z"
  }
];

export function getSampleDashboardOverview(): DashboardOverview {
  return {
    totals: {
      timelines: sampleTimelineSummaries.length,
      events: sampleTimelines.reduce((total, timeline) => total + timeline.events.length, 0),
      sources: sampleSources.length,
      tags: sampleTags.length,
      requests: sampleRequests.length
    },
    requestStatusBreakdown: [
      { status: "pending", count: 1 },
      { status: "planned", count: 1 },
      { status: "reviewed", count: 0 },
      { status: "rejected", count: 0 },
      { status: "completed", count: 0 }
    ],
    latestRequests: sampleRequests
  };
}

export function getSampleTagDetail(slug: string): TagDetail | null {
  const tag = sampleTags.find((item) => item.slug === slug);
  if (!tag) {
    return null;
  }

  return {
    tag,
    timelines: sampleTimelines
      .filter((timeline) => timeline.tags.some((timelineTag) => timelineTag.slug === slug))
      .map(({ events: _events, relatedTimelines: _relatedTimelines, ...summary }) => summary)
  };
}
