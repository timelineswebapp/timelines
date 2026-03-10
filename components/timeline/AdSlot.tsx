import type { AdSlotAssignment } from "@/src/lib/types";

const hasAdsense = Boolean(process.env.NEXT_PUBLIC_ADSENSE_ID);

export function AdSlot({
  assignment,
  className = ""
}: {
  assignment: AdSlotAssignment;
  className?: string;
}) {
  const campaign = assignment.activeCampaign;
  const shellClassName = ["glass", "section-card", "ad-slot", className].filter(Boolean).join(" ");

  if (!campaign) {
    return (
      <section className={shellClassName} aria-label={`${assignment.label} placeholder`}>
        <div className="stack ad-slot-content">
          <span className="eyebrow">Sponsored</span>
          <strong>{assignment.label}</strong>
          <p className="muted" style={{ margin: 0 }}>
            {hasAdsense
              ? "Ad inventory is reserved for the next active campaign."
              : "No active campaign is running for this placement yet."}
          </p>
        </div>
      </section>
    );
  }

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
