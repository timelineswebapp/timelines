"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AnalyticsSnapshot,
  DashboardOverview,
  EventRecord,
  ImportExecutionResult,
  ImportPreview,
  TagRecord,
  TimelineRequestRecord,
  TimelineSummary
} from "@/src/lib/types";
import { ContentSnapshot } from "@/components/admin/ContentSnapshot";
import { EventManager } from "@/components/admin/EventManager";
import { ImportData } from "@/components/admin/ImportData";
import { RequestsManager } from "@/components/admin/RequestsManager";
import { TimelineManager } from "@/components/admin/TimelineManager";
import {
  initialContentDataset,
  type AdminFetcher,
  type ContentDataset,
  type ContentSection,
  type EventDraft,
  type StatusHandlers,
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
      const [overview, analyticsSnapshot, timelines, events, tags, requests] = await Promise.all([
        fetchAdmin<DashboardOverview>("/api/admin/analytics"),
        fetchAdmin<AnalyticsSnapshot>("/api/admin/analytics?mode=snapshot"),
        fetchAdmin<TimelineSummary[]>("/api/admin/timelines"),
        fetchAdmin<EventRecord[]>("/api/admin/events"),
        fetchAdmin<TagRecord[]>("/api/admin/tags"),
        fetchAdmin<TimelineRequestRecord[]>("/api/admin/requests")
      ]);

      setDataset({ overview, analyticsSnapshot, timelines, events, tags, requests });
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
    async (input: {
      format: "json" | "csv" | "text";
      importType: "timeline_with_events" | "events_into_existing_timeline";
      timelineId?: number | null;
      content: string;
      skipDuplicates: boolean;
    }): Promise<ImportPreview> => {
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
    async (input: {
      format: "json" | "csv" | "text";
      importType: "timeline_with_events" | "events_into_existing_timeline";
      timelineId?: number | null;
      content: string;
      skipDuplicates: boolean;
    }): Promise<ImportExecutionResult> => {
      setError("");
      setStatus("Importing approved rows...");

      try {
        const result = await fetchAdmin<ImportExecutionResult>("/api/admin/import/execute", {
          method: "POST",
          body: JSON.stringify(input)
        });
        setStatus(`Import completed: ${result.eventsCreatedCount} created, ${result.duplicatesSkipped} duplicates skipped.`);
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

  const downloadRegistry = useCallback(async () => {
    setError("");
    setStatus("Preparing timeline registry export...");

    try {
      const response = await fetch("/api/admin/timelines/export", {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-admin-token": token
        }
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; error?: { message?: string } }
          | null;
        throw new Error(payload?.error?.message || "Unable to export timelines.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "existing-timelines.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatus("Timeline registry downloaded.");
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Timeline export failed.");
      setStatus("Timeline export failed.");
    }
  }, [setError, setStatus, token]);

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
        tags={dataset.tags}
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
              sources: draft.sources.map((source) => ({
                title: source.title,
                url: source.url,
                publisher: source.publisher || null
              })),
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

  if (section === "import_data") {
    return (
      <ImportData
        timelines={dataset.timelines}
        onDownloadRegistry={downloadRegistry}
        onPreview={previewImport}
        onApprove={approveImport}
      />
    );
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
