"use client";

import { useCallback, useEffect, useState } from "react";
import { AudienceMetrics } from "@/components/admin/AudienceMetrics";
import { BehaviorMetrics } from "@/components/admin/BehaviorMetrics";
import { ContentPerformance } from "@/components/admin/ContentPerformance";
import { GrowthCharts } from "@/components/admin/GrowthCharts";
import { SearchIntelligence } from "@/components/admin/SearchIntelligence";
import type { AdminAnalyticsReport, AnalyticsSnapshot } from "@/src/lib/types";
import {
  initialAnalyticsDataset,
  type AdminFetcher,
  type AnalyticsDataset,
  type StatusHandlers
} from "@/components/admin/admin-shared";

export function AdminAnalytics({
  token,
  fetchAdmin,
  statusHandlers
}: {
  token: string;
  fetchAdmin: AdminFetcher;
  statusHandlers: StatusHandlers;
}) {
  const { setStatus, setError, onLoaded } = statusHandlers;
  const [dataset, setDataset] = useState<AnalyticsDataset>(initialAnalyticsDataset);

  const loadAnalytics = useCallback(async () => {
    if (!token) {
      return;
    }

    setError("");
    setStatus("Loading analytics datasets...");

    try {
      const [analyticsSnapshot, analyticsReport] = await Promise.all([
        fetchAdmin<AnalyticsSnapshot>("/api/admin/analytics?mode=snapshot"),
        fetchAdmin<AdminAnalyticsReport>("/api/admin/analytics?mode=report")
      ]);

      setDataset({ analyticsSnapshot, analyticsReport });
      setStatus("Analytics module synchronized.");
      onLoaded();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load analytics data.");
      setStatus("Analytics module unavailable.");
    }
  }, [fetchAdmin, onLoaded, setError, setStatus, token]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  return (
    <div className="stack admin-module-stack">
      <AudienceMetrics dataset={dataset} />
      <BehaviorMetrics dataset={dataset} />
      <ContentPerformance dataset={dataset} />
      <SearchIntelligence dataset={dataset} />
      <GrowthCharts dataset={dataset} />
    </div>
  );
}
