import type { TopTab } from "@/components/admin/admin-shared";

export function AdminTabs({
  activeTab,
  onTabChange
}: {
  activeTab: TopTab;
  onTabChange: (tab: TopTab) => void;
}) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      {(["content", "analytics", "ads"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          className={`button ${activeTab === tab ? "" : "secondary"}`}
          onClick={() => onTabChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
