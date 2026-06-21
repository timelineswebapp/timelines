import Link from "next/link";
import { splitVisibleContextGroups } from "@/src/lib/historical-context";
import { buildHistoricalObjectPath } from "@/src/lib/share";
import type { MilestoneContext, MilestoneContextGroup, MilestoneContextItem } from "@/src/lib/types";

function ContextItem({ item, compact }: { item: MilestoneContextItem; compact: boolean }) {
  return (
    <li className="historical-context-item">
      <div className="historical-context-item-head">
        <Link href={buildHistoricalObjectPath(item.historicalObjectSlug)} className="historical-context-object">
          {item.historicalObjectName}
        </Link>
        <span className="historical-context-role">{item.role}</span>
      </div>
      <p className="historical-context-meaning">{item.meaning}</p>
    </li>
  );
}

function ContextGroup({ group, compact }: { group: MilestoneContextGroup; compact: boolean }) {
  return (
    <section className="historical-context-group" aria-label={group.label}>
      <h3>{group.label}</h3>
      <ul className="historical-context-list">
        {group.items.map((item) => (
          <ContextItem key={item.participationId} item={item} compact={compact} />
        ))}
      </ul>
    </section>
  );
}

function overflowLabel(group: MilestoneContextGroup, groupCount: number): string {
  if (groupCount > 1) {
    return "More Context";
  }

  return `More ${group.label}`;
}

export function HistoricalContextSection({
  context,
  compact = false
}: {
  context?: MilestoneContext;
  compact?: boolean;
}) {
  if (!context || context.totalCount === 0) {
    return null;
  }

  const { visibleGroups, overflowGroups } = splitVisibleContextGroups(context);
  const firstOverflowGroup = overflowGroups[0];

  return (
    <section className={compact ? "historical-context-section historical-context-section-compact" : "historical-context-section"}>
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Historical Context</p>
          <h2>Context</h2>
        </div>
      </div>

      <div className="historical-context-groups">
        {visibleGroups.map((group) => (
          <ContextGroup key={group.type} group={group} compact={compact} />
        ))}
      </div>

      {firstOverflowGroup ? (
        <details className="historical-context-overflow">
          <summary>{overflowLabel(firstOverflowGroup, overflowGroups.length)}</summary>
          <div className="historical-context-groups">
            {overflowGroups.map((group) => (
              <ContextGroup key={group.type} group={group} compact={compact} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
