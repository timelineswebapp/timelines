import assert from "node:assert/strict";
import test from "node:test";
import { groupMilestoneContextItems, splitVisibleContextGroups } from "@/src/lib/historical-context";
import type { MilestoneContextItem } from "@/src/lib/types";

function item(overrides: Partial<MilestoneContextItem>): MilestoneContextItem {
  return {
    participationId: overrides.participationId || "participation-id",
    historicalObjectId: overrides.historicalObjectId || "historical-object-id",
    historicalObjectSlug: overrides.historicalObjectSlug || "object",
    historicalObjectName: overrides.historicalObjectName || "Object",
    historicalObjectType: overrides.historicalObjectType || "person",
    role: overrides.role || "Participant",
    meaning: overrides.meaning || "Meaning",
    priority: overrides.priority || "SUPPORTING"
  };
}

test("groups milestone context by locked editorial type order", () => {
  const context = groupMilestoneContextItems(10, [
    item({ historicalObjectName: "Background period", historicalObjectType: "period", priority: "BACKGROUND" }),
    item({ historicalObjectName: "Primary technology", historicalObjectType: "technology", priority: "PRIMARY" }),
    item({ historicalObjectName: "Supporting person", historicalObjectType: "person", priority: "SUPPORTING" })
  ]);

  assert.equal(context.totalCount, 3);
  assert.deepEqual(
    context.groups.map((group) => group.label),
    ["People", "Technologies", "Periods"]
  );
});

test("splits visible and overflow groups using the locked visible target", () => {
  const context = groupMilestoneContextItems(
    12,
    [
      item({ participationId: "1", historicalObjectName: "One", historicalObjectType: "person" }),
      item({ participationId: "2", historicalObjectName: "Two", historicalObjectType: "person" }),
      item({ participationId: "3", historicalObjectName: "Three", historicalObjectType: "technology" })
    ],
    2
  );

  const { visibleGroups, overflowGroups } = splitVisibleContextGroups(context);

  assert.equal(visibleGroups.length, 1);
  assert.deepEqual(
    visibleGroups.flatMap((group) => group.items.map((visibleItem) => visibleItem.participationId)),
    ["1", "2"]
  );
  assert.deepEqual(
    overflowGroups.flatMap((group) => group.items.map((overflowItem) => overflowItem.participationId)),
    ["3"]
  );
});

test("selects visible context by priority before regrouping", () => {
  const context = groupMilestoneContextItems(
    14,
    [
      item({ participationId: "background-person", historicalObjectName: "Background Person", historicalObjectType: "person", priority: "BACKGROUND" }),
      item({ participationId: "primary-technology", historicalObjectName: "Primary Technology", historicalObjectType: "technology", priority: "PRIMARY" })
    ],
    1
  );

  const { visibleGroups, overflowGroups } = splitVisibleContextGroups(context);

  assert.deepEqual(
    visibleGroups.flatMap((group) => group.items.map((visibleItem) => visibleItem.participationId)),
    ["primary-technology"]
  );
  assert.deepEqual(
    overflowGroups.flatMap((group) => group.items.map((overflowItem) => overflowItem.participationId)),
    ["background-person"]
  );
});
