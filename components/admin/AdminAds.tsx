"use client";

import { useCallback, useEffect, useState } from "react";
import { AdSlotsManager } from "@/components/admin/AdSlotsManager";
import { AdsPerformance } from "@/components/admin/AdsPerformance";
import { AdsSnapshot } from "@/components/admin/AdsSnapshot";
import { CampaignManager } from "@/components/admin/CampaignManager";
import type { AdsDashboardData } from "@/src/lib/types";
import {
  type AdminFetcher,
  type AdCampaignDraft,
  type StatusHandlers
} from "@/components/admin/admin-shared";

export function AdminAds({
  token,
  fetchAdmin,
  statusHandlers
}: {
  token: string;
  fetchAdmin: AdminFetcher;
  statusHandlers: StatusHandlers;
}) {
  const { setStatus, setError, onLoaded } = statusHandlers;
  const [ads, setAds] = useState<AdsDashboardData | null>(null);

  const loadAds = useCallback(async () => {
    if (!token) {
      return;
    }

    setError("");
    setStatus("Loading ads datasets...");

    try {
      const nextAds = await fetchAdmin<AdsDashboardData>("/api/admin/ads");
      setAds(nextAds);
      setStatus("Ads module synchronized.");
      onLoaded();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load ads data.");
      setStatus("Ads module unavailable.");
    }
  }, [fetchAdmin, onLoaded, setError, setStatus, token]);

  useEffect(() => {
    void loadAds();
  }, [loadAds]);

  const submitJson = useCallback(
    async (endpoint: string, method: "POST" | "PATCH" | "DELETE", body?: Record<string, unknown>) => {
      setError("");
      setStatus("Saving ad changes...");

      try {
        await fetchAdmin(endpoint, {
          method,
          body: body ? JSON.stringify(body) : undefined
        });
        await loadAds();
        return true;
      } catch (submissionError) {
        setError(submissionError instanceof Error ? submissionError.message : "Save failed.");
        setStatus("Save failed.");
        return false;
      }
    },
    [fetchAdmin, loadAds, setError, setStatus]
  );

  return (
    <div className="stack">
      <AdsSnapshot ads={ads} />
      <AdSlotsManager ads={ads} />
      <CampaignManager
        campaigns={ads?.campaigns || []}
        onSubmit={(draft: AdCampaignDraft) =>
          submitJson(
            draft.id ? `/api/admin/ads/${draft.id}` : "/api/admin/ads",
            draft.id ? "PATCH" : "POST",
            {
              slot: draft.slot,
              campaignName: draft.campaignName,
              advertiser: draft.advertiser,
              creativeImage: draft.creativeImage || null,
              headline: draft.headline,
              description: draft.description,
              cta: draft.cta,
              targetUrl: draft.targetUrl,
              startDate: draft.startDate,
              endDate: draft.endDate,
              status: draft.status
            }
          )
        }
        onDelete={(id: number) => submitJson(`/api/admin/ads/${id}`, "DELETE")}
      />
      <AdsPerformance ads={ads} />
    </div>
  );
}
