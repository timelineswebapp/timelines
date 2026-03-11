"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminAds } from "@/components/admin/AdminAds";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";
import { AdminContent } from "@/components/admin/AdminContent";
import { AdminLayout } from "@/components/admin/AdminLayout";
import type { AnalyticsSnapshot } from "@/src/lib/types";
import type { TopTab } from "@/components/admin/admin-shared";

export function AdminDashboard({ initialDatabaseConnected }: { initialDatabaseConnected: boolean }) {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("Provide the admin token to unlock dashboard actions.");
  const [error, setError] = useState("");
  const [databaseConnected, setDatabaseConnected] = useState(initialDatabaseConnected);
  const [activeTab, setActiveTab] = useState<TopTab>("analytics");
  const [contentSection, setContentSection] = useState<"snapshot" | "timelines" | "events" | "import_data" | "requests">("snapshot");
  const [isLoaded, setIsLoaded] = useState(false);

  const adminHeaders = useMemo(
    () => ({
      "content-type": "application/json",
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
            "x-admin-token": token
          }
        : {})
    }),
    [token]
  );

  useEffect(() => {
    if (!token) {
      setDatabaseConnected(initialDatabaseConnected);
      return;
    }

    let cancelled = false;

    void fetch("/api/admin/analytics?mode=snapshot", {
      headers: {
        ...adminHeaders
      }
    })
      .then(async (response) => {
        if (response.status === 401) {
          return;
        }

        const payload = (await response.json()) as {
          ok: boolean;
          data?: AnalyticsSnapshot;
        };

        if (!cancelled) {
          setDatabaseConnected(Boolean(response.ok && payload.ok && payload.data?.operational.databaseConfigured));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDatabaseConnected(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [adminHeaders, initialDatabaseConnected, token]);

  const fetchAdmin = useCallback(
    async <T,>(url: string, init?: RequestInit): Promise<T> => {
      const response = await fetch(url, {
        ...init,
        headers: {
          ...adminHeaders,
          ...(init?.headers || {})
        }
      });

      const payload = (await response.json()) as {
        ok: boolean;
        data?: T;
        error?: { code?: string; message?: string };
      };

      if (!response.ok || !payload.ok || payload.data === undefined) {
        const error = new Error(payload.error?.message || `Request failed for ${url}`) as Error & {
          code?: string;
        };
        error.code = payload.error?.code;
        throw error;
      }

      return payload.data;
    },
    [adminHeaders]
  );

  const statusHandlers = useMemo(
    () => ({
      setStatus,
      setError,
      onLoaded: () => setIsLoaded(true)
    }),
    []
  );

  return (
    <AdminLayout
      token={token}
      onTokenChange={setToken}
      databaseConnected={databaseConnected}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      contentSection={contentSection}
      onContentSectionChange={setContentSection}
      status={status}
      error={error}
      showLockedNotice={!token && !isLoaded}
    >
      {activeTab === "content" ? (
        <AdminContent
          token={token}
          fetchAdmin={fetchAdmin}
          section={contentSection}
          statusHandlers={statusHandlers}
        />
      ) : null}

      {activeTab === "analytics" ? (
        <AdminAnalytics token={token} fetchAdmin={fetchAdmin} statusHandlers={statusHandlers} />
      ) : null}

      {activeTab === "ads" ? (
        <AdminAds token={token} fetchAdmin={fetchAdmin} statusHandlers={statusHandlers} />
      ) : null}
    </AdminLayout>
  );
}
