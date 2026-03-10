"use client";

import { useState } from "react";
import type { AdCampaignRecord } from "@/src/lib/types";
import { initialCampaignDraft, type AdCampaignDraft } from "@/components/admin/admin-shared";

export function CampaignManager({
  campaigns,
  onSubmit,
  onDelete
}: {
  campaigns: AdCampaignRecord[];
  onSubmit: (draft: AdCampaignDraft) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<AdCampaignDraft>(initialCampaignDraft);

  return (
    <section className="glass section-card stack">
      <h2 style={{ marginTop: 0 }}>Campaigns</h2>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(draft).then((saved) => {
            if (saved) {
              setDraft(initialCampaignDraft);
            }
          });
        }}
      >
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <select className="select" value={draft.slot} onChange={(event) => setDraft((current) => ({ ...current, slot: event.target.value as AdCampaignRecord["slot"] }))}>
            <option value="home_feed_ad">Home feed ad</option>
            <option value="timeline_inline_1">Timeline inline 1</option>
            <option value="timeline_inline_2">Timeline inline 2</option>
            <option value="timeline_bottom">Timeline bottom</option>
            <option value="search_bottom">Search bottom</option>
          </select>
          <input className="input" value={draft.campaignName} onChange={(event) => setDraft((current) => ({ ...current, campaignName: event.target.value }))} placeholder="Campaign name" required />
          <input className="input" value={draft.advertiser} onChange={(event) => setDraft((current) => ({ ...current, advertiser: event.target.value }))} placeholder="Advertiser" required />
        </div>
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <input className="input" value={draft.headline} onChange={(event) => setDraft((current) => ({ ...current, headline: event.target.value }))} placeholder="Headline" required />
          <input className="input" value={draft.cta} onChange={(event) => setDraft((current) => ({ ...current, cta: event.target.value }))} placeholder="CTA" required />
        </div>
        <textarea className="textarea" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Description" required />
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <input className="input" value={draft.targetUrl} onChange={(event) => setDraft((current) => ({ ...current, targetUrl: event.target.value }))} placeholder="Target URL" required />
          <input className="input" value={draft.creativeImage} onChange={(event) => setDraft((current) => ({ ...current, creativeImage: event.target.value }))} placeholder="Creative image URL" />
        </div>
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <input className="input" type="date" value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} required />
          <input className="input" type="date" value={draft.endDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} required />
          <select className="select" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as AdCampaignRecord["status"] }))}>
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="completed">completed</option>
          </select>
        </div>
        <div className="pill-row">
          <button className="button" type="submit">
            {draft.id ? "Update campaign" : "Create campaign"}
          </button>
          {draft.id ? (
            <button type="button" className="button secondary" onClick={() => setDraft(initialCampaignDraft)}>
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      <table className="table">
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Slot</th>
            <th>Status</th>
            <th>Performance</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr key={campaign.id}>
              <td>
                <strong>{campaign.campaignName}</strong>
                <div className="small muted">{campaign.advertiser}</div>
              </td>
              <td>{campaign.slot}</td>
              <td>{campaign.status}</td>
              <td>
                <div className="small muted">
                  {campaign.impressions} impressions • {campaign.clicks} clicks • {campaign.revenue.toFixed(2)} revenue
                </div>
              </td>
              <td>
                <div className="pill-row">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() =>
                      setDraft({
                        id: campaign.id,
                        slot: campaign.slot,
                        campaignName: campaign.campaignName,
                        advertiser: campaign.advertiser,
                        creativeImage: campaign.creativeImage || "",
                        headline: campaign.headline,
                        description: campaign.description,
                        cta: campaign.cta,
                        targetUrl: campaign.targetUrl,
                        startDate: campaign.startDate,
                        endDate: campaign.endDate,
                        status: campaign.status
                      })
                    }
                  >
                    Edit
                  </button>
                  <button className="button danger" type="button" onClick={() => void onDelete(campaign.id)}>
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
