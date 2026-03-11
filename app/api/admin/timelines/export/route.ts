import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";

function escapeCsv(value: string | number) {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  return text;
}

export const GET = withAdminAuth(async () => {
  const rows = await adminService.exportTimelinesRegistry();
  const header = [
    "timeline_title",
    "timeline_slug",
    "category",
    "event_count",
    "last_updated"
  ];

  const body = [
    header.join(","),
    ...rows.map((row) =>
      [
        escapeCsv(row.timelineTitle),
        escapeCsv(row.timelineSlug),
        escapeCsv(row.category),
        escapeCsv(row.eventCount),
        escapeCsv(row.lastUpdated)
      ].join(",")
    )
  ].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="existing-timelines.csv"'
    }
  });
});
