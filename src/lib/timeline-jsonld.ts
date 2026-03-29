import { buildPublicUrl, getVerifiedPublicSiteUrl } from "@/src/lib/public-site";
import { buildTimelineOgImagePath, buildTimelinePath } from "@/src/lib/share";
import type { CategoryDetail, TimelineDetail } from "@/src/lib/types";
import { slugify } from "@/src/lib/utils";

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

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": webPageId,
        url: canonicalUrl,
        name: timeline.title,
        description: timeline.description,
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
        mainEntityOfPage: {
          "@id": webPageId
        },
        isPartOf: {
          "@id": webPageId
        },
        keywords: timeline.tags.map((tag) => tag.name).join(", ")
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
