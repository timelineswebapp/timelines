import type { ReactNode } from "react";
import { AdminTabs } from "@/components/admin/AdminTabs";
import type { ContentSection, TopTab } from "@/components/admin/admin-shared";

export function AdminLayout({
  token,
  onTokenChange,
  databaseConnected,
  activeTab,
  onTabChange,
  contentSection,
  onContentSectionChange,
  status,
  error,
  showLockedNotice,
  children
}: {
  token: string;
  onTokenChange: (value: string) => void;
  databaseConnected: boolean;
  activeTab: TopTab;
  onTabChange: (tab: TopTab) => void;
  contentSection?: ContentSection;
  onContentSectionChange?: (section: ContentSection) => void;
  status: string;
  error: string;
  showLockedNotice: boolean;
  children: ReactNode;
}) {
  return (
    <div className="admin-grid">
      <aside className="glass section-card admin-sidebar stack">
        <div className="stack" style={{ gap: 10 }}>
          <span className="eyebrow">Admin</span>
          <strong>Editorial control surface</strong>
          <p className="muted" style={{ margin: 0 }}>
            Content operations, analytics aggregation, and ad inventory remain behind authenticated admin APIs.
          </p>
        </div>

        <input
          className="input"
          value={token}
          onChange={(event) => onTokenChange(event.target.value)}
          placeholder="Admin API token"
        />

        <div className={`pill admin-db-indicator ${databaseConnected ? "admin-db-indicator-connected" : "admin-db-indicator-disconnected"}`}>
          {databaseConnected ? "Database Connected" : "Database Not Connected"}
        </div>

        <AdminTabs activeTab={activeTab} onTabChange={onTabChange} />

        {activeTab === "content" && contentSection && onContentSectionChange ? (
          <div className="admin-subnav">
            {(["snapshot", "timelines", "events", "import_data", "requests"] as const).map((section) => (
              <button
                key={section}
                type="button"
                className={`button admin-subtab ${contentSection === section ? "admin-subtab-active" : ""}`}
                onClick={() => onContentSectionChange(section)}
              >
                {section === "import_data" ? "import data" : section.replace("_", " ")}
              </button>
            ))}
          </div>
        ) : null}

        <p className="small muted" style={{ margin: 0 }}>
          {status}
        </p>
        {error ? (
          <p className="small" style={{ color: "var(--danger)", margin: 0 }}>
            {error}
          </p>
        ) : null}
      </aside>

      <section className="stack">
        {children}

        {showLockedNotice ? (
          <section className="glass section-card">
            <p className="muted" style={{ margin: 0 }}>
              `ADMIN_API_TOKEN` is now mandatory in every environment. The dashboard will not fetch any admin dataset until you provide a valid token.
            </p>
          </section>
        ) : null}
      </section>
    </div>
  );
}
