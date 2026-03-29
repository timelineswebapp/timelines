import { config } from "@/src/lib/config";
import type { TimelineDetail } from "@/src/lib/types";
import { summarizeShareText } from "@/src/lib/share";

function getStructuredEventDate(date: string | null | undefined) {
  if (!date) {
    return undefined;
  }

  const normalized = date.trim();
  return /^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(normalized) ? normalized : undefined;
}

export function buildTimelineJsonLd(timeline: TimelineDetail) {
  const url = `${config.siteUrl}/timeline/${timeline.slug}`;
  const itemListElement = timeline.events.slice(0, 20).map((event, index) => {
    const item: {
      "@type": "ListItem";
      position: number;
      name: string;
      description: string;
      startDate?: string;
    } = {
      "@type": "ListItem",
      position: index + 1,
      name: event.title,
      description: summarizeShareText(event.description, index < 10 ? 240 : 120)
    };

    const startDate = getStructuredEventDate(event.legacyDate || event.date);
    if (startDate) {
      item.startDate = startDate;
    }

    return item;
  });

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    headline: timeline.title,
    description: timeline.description,
    url,
    mainEntity: {
      "@type": "ItemList",
      name: timeline.title,
      numberOfItems: itemListElement.length,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      itemListElement
    }
  };
}
