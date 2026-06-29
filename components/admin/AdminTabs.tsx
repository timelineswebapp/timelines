import type { TopTab } from "@/components/admin/admin-shared";

export function AdminTabs({
  activeTab,
  onTabChange
}: {
  activeTab: TopTab;
  onTabChange: (tab: TopTab) => void;
}) {
  // Institutional "governance" tooling remains available inside Diagnostics.
  return (
    <div className="stack" style={{ gap: 8 }}>
      {(["home", "queue", "library", "analytics", "settings", "diagnostics"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          className={`button ${activeTab === tab ? "" : "secondary"}`}
          onClick={() => onTabChange(tab)}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
    </div>
  );
}
