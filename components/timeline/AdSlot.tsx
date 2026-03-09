import { config } from "@/src/lib/config";

export function AdSlot({ label }: { label: string }) {
  return (
    <section className="glass section-card ad-slot">
      <div className="stack" style={{ position: "relative", zIndex: 1 }}>
        <span className="eyebrow">Ad Placement</span>
        <strong>{label}</strong>
        <p className="muted" style={{ margin: 0 }}>
          {config.adsenseId
            ? "AdSense slot ready for integration with the configured publisher ID."
            : "AdSense ID not configured. This reserved slot keeps page layout stable until monetization is enabled."}
        </p>
      </div>
    </section>
  );
}
