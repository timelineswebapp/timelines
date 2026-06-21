import type {
  HistoricalObjectType,
  MilestoneContext,
  MilestoneContextGroup,
  MilestoneContextItem,
  ParticipationPriority
} from "@/src/lib/types";

export const HISTORICAL_CONTEXT_VISIBLE_TARGET = 6;
export const HISTORICAL_CONTEXT_FETCH_CAP = 24;
export const HISTORICAL_OBJECT_HISTORY_CAP = 50;

export const HISTORICAL_CONTEXT_GROUPS: Array<{ type: HistoricalObjectType; label: string }> = [
  { type: "person", label: "People" },
  { type: "institution", label: "Institutions" },
  { type: "place", label: "Places" },
  { type: "technology", label: "Technologies" },
  { type: "publication", label: "Publications" },
  { type: "conflict", label: "Conflicts" },
  { type: "movement", label: "Movements" },
  { type: "period", label: "Periods" }
];

export const PARTICIPATION_PRIORITY_ORDER: ParticipationPriority[] = ["PRIMARY", "SUPPORTING", "CONTEXT", "BACKGROUND"];

const groupRank = new Map(HISTORICAL_CONTEXT_GROUPS.map((group, index) => [group.type, index]));
const priorityRank = new Map(PARTICIPATION_PRIORITY_ORDER.map((priority, index) => [priority, index]));

export function compareMilestoneContextItems(left: MilestoneContextItem, right: MilestoneContextItem): number {
  const priorityDelta = (priorityRank.get(left.priority) ?? 99) - (priorityRank.get(right.priority) ?? 99);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const groupDelta = (groupRank.get(left.historicalObjectType) ?? 99) - (groupRank.get(right.historicalObjectType) ?? 99);
  if (groupDelta !== 0) {
    return groupDelta;
  }

  return left.historicalObjectName.localeCompare(right.historicalObjectName);
}

export function groupMilestoneContextItems(
  milestoneId: number,
  items: MilestoneContextItem[],
  visibleTarget = HISTORICAL_CONTEXT_VISIBLE_TARGET
): MilestoneContext {
  const grouped = new Map<HistoricalObjectType, MilestoneContextItem[]>();
  for (const item of [...items].sort(compareMilestoneContextItems)) {
    const groupItems = grouped.get(item.historicalObjectType) || [];
    groupItems.push(item);
    grouped.set(item.historicalObjectType, groupItems);
  }

  const groups: MilestoneContextGroup[] = HISTORICAL_CONTEXT_GROUPS
    .map((group) => ({
      ...group,
      items: grouped.get(group.type) || []
    }))
    .filter((group) => group.items.length > 0);

  return {
    milestoneId,
    groups,
    totalCount: items.length,
    visibleTarget
  };
}

export function splitVisibleContextGroups(context: MilestoneContext): {
  visibleGroups: MilestoneContextGroup[];
  overflowGroups: MilestoneContextGroup[];
} {
  const orderedItems = context.groups.flatMap((group) => group.items).sort(compareMilestoneContextItems);
  const visibleItems = orderedItems.slice(0, context.visibleTarget);
  const overflowItems = orderedItems.slice(context.visibleTarget);

  return {
    visibleGroups: groupMilestoneContextItems(context.milestoneId, visibleItems, context.visibleTarget).groups,
    overflowGroups: groupMilestoneContextItems(context.milestoneId, overflowItems, context.visibleTarget).groups
  };
}
