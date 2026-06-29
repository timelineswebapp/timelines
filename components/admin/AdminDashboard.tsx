"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminAds } from "@/components/admin/AdminAds";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";
import { AdminContent } from "@/components/admin/AdminContent";
import { AdminGovernance } from "@/components/admin/AdminGovernance";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPublicationPath } from "@/components/admin/AdminPublicationPath";
import { AdminFactoryOperations } from "@/components/admin/AdminFactoryOperations";
import type { AnalyticsSnapshot } from "@/src/lib/types";
import type { ContentSection, TopTab } from "@/components/admin/admin-shared";

const ADMIN_CSRF_COOKIE_NAME = "timelines_admin_csrf";
const UNSAFE_ADMIN_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCookieValue(name: string): string {
  return document.cookie
    .split(";")
    .map((segment) => segment.trim())
    .find((segment) => segment.startsWith(`${name}=`))
    ?.slice(name.length + 1) || "";
}

function csrfHeadersFor(init?: RequestInit): Record<string, string> {
  const method = (init?.method || "GET").toUpperCase();
  if (!UNSAFE_ADMIN_METHODS.has(method)) {
    return {};
  }
  const token = readCookieValue(ADMIN_CSRF_COOKIE_NAME);
  return token ? { "x-csrf-token": decodeURIComponent(token) } : {};
}

export function AdminDashboard({ initialDatabaseConnected }: { initialDatabaseConnected: boolean }) {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("Enter the Founder access key to begin.");
  const [error, setError] = useState("");
  const [databaseConnected, setDatabaseConnected] = useState(initialDatabaseConnected);
  const [activeTab, setActiveTab] = useState<TopTab>("home");
  const [contentSection, setContentSection] = useState<ContentSection>("snapshot");
  const [isLoaded, setIsLoaded] = useState(false);
  const [founderStatus, setFounderStatus] = useState<{
    institution: string;
    factory: string;
    mode: string;
  } | null>(null);

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
          ...csrfHeadersFor(init),
          ...(init?.headers || {})
        }
      });

      const payload = (await response.json()) as {
        ok: boolean;
        data?: T;
        error?: { code?: string; message?: string };
      };

      if (!response.ok || !payload.ok || payload.data === undefined) {
        const error = new Error(payload.error?.message || "The institution could not complete this request.") as Error & {
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
      founderStatus={founderStatus}
    >
      {activeTab === "home" || activeTab === "queue" || activeTab === "settings" ? (
        <AdminFactoryOperations token={token} fetchAdmin={fetchAdmin} statusHandlers={statusHandlers} view={activeTab} onFounderStatus={setFounderStatus} />
      ) : null}
      {activeTab === "library" ? (
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

      {activeTab === "diagnostics" ? (
        <div className="stack">
          <AdminPublicationPath token={token} fetchAdmin={fetchAdmin} statusHandlers={statusHandlers} />
          <AdminGovernance token={token} fetchAdmin={fetchAdmin} statusHandlers={statusHandlers} />
          <AdminAds token={token} fetchAdmin={fetchAdmin} statusHandlers={statusHandlers} />
        </div>
      ) : null}
    </AdminLayout>
  );
}
