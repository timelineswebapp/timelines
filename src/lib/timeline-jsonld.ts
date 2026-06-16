import { buildPublicUrl, getVerifiedPublicSiteUrl } from "@/src/lib/public-site";
import { buildEventPath, buildMilestonePath, buildTimelineOgImagePath, buildTimelinePath } from "@/src/lib/share";
import type { CategoryDetail, EventRecord, TimelineDetail } from "@/src/lib/types";
import { formatDisplayDate, slugify } from "@/src/lib/utils";

function buildBreadcrumbList(items: Array<{ name: string; path: string }>, id: string) {
  return {
    "@type": "BreadcrumbList",
    "@id": id,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: buildPublicUrl(item.path)
    }))
  };
}

export function sanitizeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function buildHomePageJsonLd() {
  const siteUrl = getVerifiedPublicSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}#website`,
    url: siteUrl,
    name: "TiMELiNES",
    description: "Structured timelines for complex histories, developments, and events.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/search?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };
}

export function buildCategoryJsonLd(detail: CategoryDetail) {
  const canonicalPath = `/category/${detail.category.slug}`;
  const canonicalUrl = buildPublicUrl(canonicalPath);
  const breadcrumbId = `${canonicalUrl}#breadcrumb`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonicalUrl}#collection`,
        url: canonicalUrl,
        name: `${detail.category.name} timelines`,
        description: `Browse timelines in ${detail.category.name} connected by shared themes, events, and developments.`,
        isPartOf: {
          "@id": `${getVerifiedPublicSiteUrl()}#website`
        },
        breadcrumb: {
          "@id": breadcrumbId
        },
        hasPart: detail.timelines.slice(0, 12).map((timeline) => ({
          "@type": "CreativeWork",
          name: timeline.title,
          url: buildPublicUrl(buildTimelinePath(timeline.slug))
        }))
      },
      buildBreadcrumbList(
        [
          { name: "TiMELiNES", path: "/" },
          { name: detail.category.name, path: canonicalPath }
        ],
        breadcrumbId
      )
    ]
  };
}

export function buildTimelineJsonLd(timeline: TimelineDetail) {
  const categorySlug = slugify(timeline.category);
  const canonicalPath = buildTimelinePath(timeline.slug);
  const canonicalUrl = buildPublicUrl(canonicalPath);
  const breadcrumbId = `${canonicalUrl}#breadcrumb`;
  const webPageId = `${canonicalUrl}#webpage`;
  const articleId = `${canonicalUrl}#article`;
  const itemListId = `${canonicalUrl}#milestones`;
  const uniqueSources = Array.from(
    timeline.events
      .flatMap((event) => event.sources)
      .reduce<Map<number, TimelineDetail["events"][number]["sources"][number]>>((sources, source) => {
        if (!sources.has(source.id)) {
          sources.set(source.id, source);
        }
        return sources;
      }, new Map())
      .values()
  );
  const startEvent = timeline.events[0];
  const endEvent = timeline.events[timeline.events.length - 1];
  const temporalCoverage = startEvent && endEvent
    ? `${formatDisplayDate(startEvent.date, startEvent.datePrecision, startEvent)} / ${formatDisplayDate(endEvent.date, endEvent.datePrecision, endEvent)}`
    : undefined;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": webPageId,
        url: canonicalUrl,
        name: timeline.title,
        description: timeline.description,
        about: timeline.tags.map((tag) => tag.name),
        temporalCoverage,
        isPartOf: {
          "@id": `${getVerifiedPublicSiteUrl()}#website`
        },
        breadcrumb: {
          "@id": breadcrumbId
        }
      },
      {
        "@type": "Article",
        "@id": articleId,
        url: canonicalUrl,
        headline: timeline.title,
        description: timeline.description,
        articleSection: timeline.category,
        image: [buildPublicUrl(buildTimelineOgImagePath(timeline.slug))],
        datePublished: timeline.createdAt,
        dateModified: timeline.updatedAt,
        wordCount: timeline.events.length,
        citation: uniqueSources.slice(0, 24).map((source) => ({
          "@type": "CreativeWork",
          name: source.publisher,
          url: source.url
        })),
        mentions: {
          "@id": itemListId
        },
        mainEntityOfPage: {
          "@id": webPageId
        },
        isPartOf: {
          "@id": webPageId
        },
        keywords: timeline.tags.map((tag) => tag.name).join(", ")
      },
      {
        "@type": "ItemList",
        "@id": itemListId,
        name: `${timeline.title} milestones`,
        numberOfItems: timeline.events.length,
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        itemListElement: timeline.events.slice(0, 40).map((event, index) => {
          const eventUrl = buildPublicUrl(buildEventPath(timeline.slug, event.id));
          const displayDate = formatDisplayDate(event.date, event.datePrecision, {
            displayDate: event.displayDate,
            sortYear: event.sortYear,
            sortMonth: event.sortMonth,
            sortDay: event.sortDay
          });

          return {
            "@type": "ListItem",
            position: index + 1,
            item: {
              "@type": "Event",
              "@id": `${eventUrl}#event`,
              name: event.title,
              description: event.description,
              url: eventUrl,
              startDate: event.legacyDate || event.date,
              temporalCoverage: displayDate,
              location: event.location || undefined,
              citation: event.sources.map((source) => ({
                "@type": "CreativeWork",
                name: source.publisher,
                url: source.url
              })),
              keywords: event.tags.map((tag) => tag.name).join(", ")
            }
          };
        })
      },
      buildBreadcrumbList(
        [
          { name: "TiMELiNES", path: "/" },
          { name: timeline.category, path: `/category/${categorySlug}` },
          { name: timeline.title, path: canonicalPath }
        ],
        breadcrumbId
      )
    ]
  };
}

export function buildMilestoneJsonLd(milestone: EventRecord) {
  const canonicalPath = buildMilestonePath(milestone.id, milestone.title);
  const canonicalUrl = buildPublicUrl(canonicalPath);
  const breadcrumbId = `${canonicalUrl}#breadcrumb`;
  const webPageId = `${canonicalUrl}#webpage`;
  const eventId = `${canonicalUrl}#event`;
  const displayDate = formatDisplayDate(milestone.date, milestone.datePrecision, {
    displayDate: milestone.displayDate,
    sortYear: milestone.sortYear,
    sortMonth: milestone.sortMonth,
    sortDay: milestone.sortDay
  });

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": webPageId,
        url: canonicalUrl,
        name: milestone.title,
        description: milestone.description,
        about: milestone.tags.map((tag) => tag.name),
        mainEntity: {
          "@id": eventId
        },
        isPartOf: {
          "@id": `${getVerifiedPublicSiteUrl()}#website`
        },
        breadcrumb: {
          "@id": breadcrumbId
        }
      },
      {
        "@type": "Event",
        "@id": eventId,
        url: canonicalUrl,
        name: milestone.title,
        description: milestone.description,
        startDate: milestone.legacyDate || milestone.date,
        temporalCoverage: displayDate,
        location: milestone.location || undefined,
        image: milestone.imageUrl ? [milestone.imageUrl] : undefined,
        citation: milestone.sources.map((source) => ({
          "@type": "CreativeWork",
          name: source.publisher,
          url: source.url
        })),
        keywords: milestone.tags.map((tag) => tag.name).join(", "),
        isPartOf: (milestone.timelineLinks || []).map((timeline) => ({
          "@type": "CreativeWork",
          name: timeline.title,
          url: buildPublicUrl(buildTimelinePath(timeline.slug))
        }))
      },
      buildBreadcrumbList(
        [
          { name: "TiMELiNES", path: "/" },
          { name: milestone.title, path: canonicalPath }
        ],
        breadcrumbId
      )
    ]
  };
}
