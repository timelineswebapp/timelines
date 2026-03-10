"use client";

import { useCallback, useMemo, useState } from "react";
import { AdminAds } from "@/components/admin/AdminAds";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";
import { AdminContent } from "@/components/admin/AdminContent";
import { AdminLayout } from "@/components/admin/AdminLayout";
import type { TopTab } from "@/components/admin/admin-shared";

export function AdminDashboard() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("Provide the admin token to unlock dashboard actions.");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TopTab>("analytics");
  const [contentSection, setContentSection] = useState<"snapshot" | "timelines" | "events" | "sources" | "import_events" | "requests">("snapshot");
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
        error?: { message?: string };
      };

      if (!response.ok || !payload.ok || payload.data === undefined) {
        throw new Error(payload.error?.message || `Request failed for ${url}`);
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
