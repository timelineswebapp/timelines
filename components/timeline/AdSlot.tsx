import type { AdSlotAssignment } from "@/src/lib/types";

export function AdSlot({
  assignment,
  className = ""
}: {
  assignment: AdSlotAssignment;
  className?: string;
}) {
  const campaign = assignment.activeCampaign;
  if (!campaign) {
    return null;
  }

  const shellClassName = ["glass", "section-card", "ad-slot", className].filter(Boolean).join(" ");

  return (
    <section className={shellClassName} aria-label={`${assignment.label} sponsored placement`}>
      <div className="stack ad-slot-content">
        <div className="timeline-meta">
          <span className="eyebrow">Sponsored</span>
          <span className="pill">{campaign.advertiser}</span>
        </div>
        <strong className="ad-slot-headline">{campaign.headline}</strong>
        <p className="muted" style={{ margin: 0 }}>
          {campaign.description}
        </p>
        <a href={campaign.targetUrl} className="ad-slot-link" target="_blank" rel="noreferrer">
          {campaign.cta}
        </a>
      </div>
    </section>
  );
}
