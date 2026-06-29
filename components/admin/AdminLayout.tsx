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
          <span className="eyebrow">TiMELiNES</span>
          <strong>Founder Operating System</strong>
          <p className="muted" style={{ margin: 0 }}>
            Operate the publishing institution and review work requiring human judgment.
          </p>
        </div>

        <input
          className="input"
          value={token}
          onChange={(event) => onTokenChange(event.target.value)}
          placeholder="Founder access key"
          aria-label="Founder access key"
        />

        <div className={`pill admin-db-indicator ${databaseConnected ? "admin-db-indicator-connected" : "admin-db-indicator-disconnected"}`}>
          {databaseConnected ? "Institution Ready" : "Institution Unavailable"}
        </div>

        <AdminTabs activeTab={activeTab} onTabChange={onTabChange} />

        {activeTab === "library" && contentSection && onContentSectionChange ? (
          <div className="admin-subnav">
            {(["snapshot", "timelines", "events", "taxonomy", "import_data", "data_health", "requests"] as const).map((section) => (
              <button
                key={section}
                type="button"
                className={`button admin-subtab ${contentSection === section ? "admin-subtab-active" : ""}`}
                onClick={() => onContentSectionChange(section)}
              >
                {section === "import_data" ? "import data" : section === "data_health" ? "data health" : section.replace("_", " ")}
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
              Enter the Founder access key to view and operate the institution.
            </p>
          </section>
        ) : null}
      </section>
    </div>
  );
}
