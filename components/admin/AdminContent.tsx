"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AnalyticsSnapshot,
  DashboardOverview,
  EventRecord,
  ImportExecutionResult,
  ImportPreview,
  SourceRecord,
  TagRecord,
  TimelineRequestRecord,
  TimelineSummary
} from "@/src/lib/types";
import { ContentSnapshot } from "@/components/admin/ContentSnapshot";
import { EventManager } from "@/components/admin/EventManager";
import { ImportEvents } from "@/components/admin/ImportEvents";
import { RequestsManager } from "@/components/admin/RequestsManager";
import { SourceManager } from "@/components/admin/SourceManager";
import { TimelineManager } from "@/components/admin/TimelineManager";
import {
  initialContentDataset,
  type AdminFetcher,
  type ContentDataset,
  type ContentSection,
  type EventDraft,
  type SourceDraft,
  type StatusHandlers,
  type TagDraft,
  type TimelineDraft
} from "@/components/admin/admin-shared";

export function AdminContent({
  token,
  fetchAdmin,
  section,
  statusHandlers
}: {
  token: string;
  fetchAdmin: AdminFetcher;
  section: ContentSection;
  statusHandlers: StatusHandlers;
}) {
  const { setStatus, setError, onLoaded } = statusHandlers;
  const [dataset, setDataset] = useState<ContentDataset>(initialContentDataset);

  const loadContent = useCallback(async () => {
    if (!token) {
      return;
    }

    setError("");
    setStatus("Loading content datasets...");

    try {
      const [overview, analyticsSnapshot, timelines, events, sources, tags, requests] = await Promise.all([
        fetchAdmin<DashboardOverview>("/api/admin/analytics"),
        fetchAdmin<AnalyticsSnapshot>("/api/admin/analytics?mode=snapshot"),
        fetchAdmin<TimelineSummary[]>("/api/admin/timelines"),
        fetchAdmin<EventRecord[]>("/api/admin/events"),
        fetchAdmin<SourceRecord[]>("/api/admin/sources"),
        fetchAdmin<TagRecord[]>("/api/admin/tags"),
        fetchAdmin<TimelineRequestRecord[]>("/api/admin/requests")
      ]);

      setDataset({ overview, analyticsSnapshot, timelines, events, sources, tags, requests });
      setStatus("Content module synchronized.");
      onLoaded();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load content data.");
      setStatus("Content module unavailable.");
    }
  }, [fetchAdmin, onLoaded, setError, setStatus, token]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const submitJson = useCallback(
    async (endpoint: string, method: "POST" | "PATCH" | "DELETE", body?: Record<string, unknown>) => {
      setError("");
      setStatus("Saving content changes...");

      try {
        await fetchAdmin(endpoint, {
          method,
          body: body ? JSON.stringify(body) : undefined
        });
        await loadContent();
        return true;
      } catch (submissionError) {
        setError(submissionError instanceof Error ? submissionError.message : "Save failed.");
        setStatus("Save failed.");
        return false;
      }
    },
    [fetchAdmin, loadContent, setError, setStatus]
  );

  const previewImport = useCallback(
    async (input: { format: "json" | "csv"; timelineId: number; content: string }): Promise<ImportPreview> => {
      setError("");
      setStatus("Preparing import preview...");

      try {
        const preview = await fetchAdmin<ImportPreview>("/api/admin/import/preview", {
          method: "POST",
          body: JSON.stringify(input)
        });
        setStatus(`Preview ready: ${preview.totals.accepted} accepted, ${preview.totals.duplicates} duplicates.`);
        return preview;
      } catch (previewError) {
        setError(previewError instanceof Error ? previewError.message : "Import preview failed.");
        setStatus("Import preview failed.");
        throw previewError;
      }
    },
    [fetchAdmin, setError, setStatus]
  );

  const approveImport = useCallback(
    async (input: { format: "json" | "csv"; timelineId: number; content: string }): Promise<ImportExecutionResult> => {
      setError("");
      setStatus("Importing approved rows...");

      try {
        const result = await fetchAdmin<ImportExecutionResult>("/api/admin/import/execute", {
          method: "POST",
          body: JSON.stringify(input)
        });
        setStatus(`Import completed: ${result.created} created, ${result.skipped} skipped.`);
        await loadContent();
        return result;
      } catch (importError) {
        setError(importError instanceof Error ? importError.message : "Import failed.");
        setStatus("Import failed.");
        throw importError;
      }
    },
    [fetchAdmin, loadContent, setError, setStatus]
  );

  if (section === "snapshot") {
    return <ContentSnapshot dataset={dataset} />;
  }

  if (section === "timelines") {
    return (
      <TimelineManager
        timelines={dataset.timelines}
        onSubmit={(draft: TimelineDraft) =>
          submitJson(
            draft.id ? `/api/admin/timelines/${draft.id}` : "/api/admin/timelines",
            draft.id ? "PATCH" : "POST",
            {
              title: draft.title,
              slug: draft.slug,
              description: draft.description,
              category: draft.category
            }
          )
        }
        onDelete={(id: number) => submitJson(`/api/admin/timelines/${id}`, "DELETE")}
      />
    );
  }

  if (section === "events") {
    return (
      <EventManager
        timelines={dataset.timelines}
        events={dataset.events}
        onSubmit={(draft: EventDraft) =>
          submitJson(
            draft.id ? `/api/admin/events/${draft.id}` : "/api/admin/events",
            draft.id ? "PATCH" : "POST",
            {
              timelineId: Number(draft.timelineId),
              eventOrder: Number(draft.eventOrder),
              date: draft.date,
              datePrecision: draft.datePrecision,
              title: draft.title,
              description: draft.description,
              importance: Number(draft.importance),
              location: draft.location || null,
              imageUrl: draft.imageUrl || null,
              sourceIds: draft.sourceIds
                .split(",")
                .map((item) => Number(item.trim()))
                .filter(Boolean),
              tagIds: draft.tagIds
                .split(",")
                .map((item) => Number(item.trim()))
                .filter(Boolean)
            }
          )
        }
        onDelete={(id: number) => submitJson(`/api/admin/events/${id}`, "DELETE")}
      />
    );
  }

  if (section === "sources") {
    return (
      <SourceManager
        sources={dataset.sources}
        tags={dataset.tags}
        onSubmitSource={(draft: SourceDraft) =>
          submitJson(
            draft.id ? `/api/admin/sources/${draft.id}` : "/api/admin/sources",
            draft.id ? "PATCH" : "POST",
            {
              publisher: draft.publisher,
              url: draft.url,
              credibilityScore: Number(draft.credibilityScore)
            }
          )
        }
        onDeleteSource={(id: number) => submitJson(`/api/admin/sources/${id}`, "DELETE")}
        onSubmitTag={(draft: TagDraft) =>
          submitJson(
            draft.id ? `/api/admin/tags/${draft.id}` : "/api/admin/tags",
            draft.id ? "PATCH" : "POST",
            {
              name: draft.name,
              slug: draft.slug
            }
          )
        }
        onDeleteTag={(id: number) => submitJson(`/api/admin/tags/${id}`, "DELETE")}
      />
    );
  }

  if (section === "import_events") {
    return <ImportEvents timelines={dataset.timelines} onPreview={previewImport} onApprove={approveImport} />;
  }

  return (
    <RequestsManager
      requests={dataset.requests}
      onUpdateStatus={(id: number, status: string) =>
        submitJson("/api/admin/requests", "PATCH", {
          id,
          status
        })
      }
    />
  );
}
