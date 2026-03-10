import type { AdsDashboardData } from "@/src/lib/types";

export function AdSlotsManager({ ads }: { ads: AdsDashboardData | null }) {
  return (
    <section className="glass section-card stack">
      <h2 style={{ marginTop: 0 }}>Ad slots</h2>
      <div className="admin-lists">
        {(ads?.slots || []).map((slot) => (
          <article key={slot.slot} className="glass-card stack">
            <strong>{slot.label}</strong>
            <p className="small muted" style={{ margin: 0 }}>
              {slot.activeCampaign ? `${slot.activeCampaign.campaignName} · ${slot.activeCampaign.status}` : "No active campaign"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
