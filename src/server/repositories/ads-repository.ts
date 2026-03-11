import type { AdCampaignRecord, AdSlotAssignment, AdSlotKey, AdsDashboardData, AdsSnapshot } from "@/src/lib/types";
import { getSql, getWriteSql } from "@/src/server/db/client";

const SLOT_LABELS: Record<AdSlotKey, string> = {
  home_feed_ad: "Home feed ad",
  timeline_inline_1: "Timeline inline 1",
  timeline_inline_2: "Timeline inline 2",
  timeline_bottom: "Timeline bottom",
  search_bottom: "Search bottom"
};

let memoryCampaigns: AdCampaignRecord[] = [];
let nextCampaignId = 1;

type CampaignInput = Omit<
  AdCampaignRecord,
  "id" | "impressions" | "clicks" | "revenue" | "createdAt" | "updatedAt"
>;

function computeCtr(impressions: number, clicks: number): number {
  if (impressions <= 0) {
    return 0;
  }

  return Number(((clicks / impressions) * 100).toFixed(2));
}

function isActiveCampaign(campaign: AdCampaignRecord, now: Date): boolean {
  if (campaign.status !== "active") {
    return false;
  }

  const start = new Date(`${campaign.startDate}T00:00:00Z`);
  const end = new Date(`${campaign.endDate}T23:59:59Z`);
  return start <= now && end >= now;
}

function selectActiveCampaign(campaigns: AdCampaignRecord[], slot: AdSlotKey, now: Date): AdCampaignRecord | null {
  return (
    campaigns
      .filter((campaign) => campaign.slot === slot && isActiveCampaign(campaign, now))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null
  );
}

function buildSlotAssignments(campaigns: AdCampaignRecord[], slots: AdSlotKey[], now = new Date()): AdSlotAssignment[] {
  return slots.map((slot) => ({
    slot,
    label: SLOT_LABELS[slot],
    activeCampaign: selectActiveCampaign(campaigns, slot, now)
  }));
}

function buildSnapshot(campaigns: AdCampaignRecord[], now = new Date()): AdsSnapshot {
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const campaignsTouchedToday = campaigns.filter((campaign) => new Date(campaign.updatedAt) >= startOfToday);
  const campaignsTouchedThisMonth = campaigns.filter((campaign) => new Date(campaign.updatedAt) >= startOfMonth);
  const activeCampaigns = campaigns.filter((campaign) => isActiveCampaign(campaign, now));
  const totalImpressions = activeCampaigns.reduce((sum, campaign) => sum + campaign.impressions, 0);
  const totalClicks = activeCampaigns.reduce((sum, campaign) => sum + campaign.clicks, 0);

  return {
    revenueToday: Number(campaignsTouchedToday.reduce((sum, campaign) => sum + campaign.revenue, 0).toFixed(2)),
    revenueMonth: Number(campaignsTouchedThisMonth.reduce((sum, campaign) => sum + campaign.revenue, 0).toFixed(2)),
    activeCampaigns: activeCampaigns.length,
    fillRate: Number(((activeCampaigns.length / Object.keys(SLOT_LABELS).length) * 100).toFixed(2)),
    impressionsToday: campaignsTouchedToday.reduce((sum, campaign) => sum + campaign.impressions, 0),
    ctr: computeCtr(totalImpressions, totalClicks)
  };
}

function dashboardFromCampaigns(campaigns: AdCampaignRecord[]): AdsDashboardData {
  return {
    snapshot: buildSnapshot(campaigns),
    slots: buildSlotAssignments(campaigns, Object.keys(SLOT_LABELS) as AdSlotKey[]),
    campaigns
  };
}

function mapRow(row: {
  id: number;
  slot: AdSlotKey;
  campaign_name: string;
  advertiser: string;
  creative_image: string | null;
  headline: string;
  description: string;
  cta: string;
  target_url: string;
  start_date: string;
  end_date: string;
  status: AdCampaignRecord["status"];
  impressions: number;
  clicks: number;
  revenue: string;
  created_at: string;
  updated_at: string;
}): AdCampaignRecord {
  return {
    id: row.id,
    slot: row.slot,
    campaignName: row.campaign_name,
    advertiser: row.advertiser,
    creativeImage: row.creative_image,
    headline: row.headline,
    description: row.description,
    cta: row.cta,
    targetUrl: row.target_url,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    impressions: row.impressions,
    clicks: row.clicks,
    revenue: Number(row.revenue),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export const adsRepository = {
  async listCampaigns(): Promise<AdCampaignRecord[]> {
    const sql = getSql();
    if (!sql) {
      return [...memoryCampaigns].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    }

    try {
      const rows = await sql<{
        id: number;
        slot: AdSlotKey;
        campaign_name: string;
        advertiser: string;
        creative_image: string | null;
        headline: string;
        description: string;
        cta: string;
        target_url: string;
        start_date: string;
        end_date: string;
        status: AdCampaignRecord["status"];
        impressions: number;
        clicks: number;
        revenue: string;
        created_at: string;
        updated_at: string;
      }[]>`
        SELECT
          id,
          slot,
          campaign_name,
          advertiser,
          creative_image,
          headline,
          description,
          cta,
          target_url,
          start_date::text,
          end_date::text,
          status,
          impressions,
          clicks,
          revenue::text,
          created_at::text,
          updated_at::text
        FROM ad_campaigns
        ORDER BY updated_at DESC, id DESC
      `;

      return rows.map(mapRow);
    } catch (error) {
      if ((error as { code?: string }).code === "42P01") {
        console.warn(
          JSON.stringify({
            level: "warn",
            component: "ads_repository",
            message: "ad_campaigns table is not available. Returning empty ad inventory."
          })
        );
        return [];
      }

      throw error;
    }
  },

  async getDashboardData(): Promise<AdsDashboardData> {
    return dashboardFromCampaigns(await this.listCampaigns());
  },

  async getPublicAssignments(slots: AdSlotKey[]): Promise<AdSlotAssignment[]> {
    return buildSlotAssignments(await this.listCampaigns(), slots);
  },

  async createCampaign(input: CampaignInput): Promise<AdCampaignRecord> {
    const sql = getWriteSql("ad campaign create");

    const [row] = await sql<{
      id: number;
      slot: AdSlotKey;
      campaign_name: string;
      advertiser: string;
      creative_image: string | null;
      headline: string;
      description: string;
      cta: string;
      target_url: string;
      start_date: string;
      end_date: string;
      status: AdCampaignRecord["status"];
      impressions: number;
      clicks: number;
      revenue: string;
      created_at: string;
      updated_at: string;
    }[]>`
      INSERT INTO ad_campaigns (
        slot,
        campaign_name,
        advertiser,
        creative_image,
        headline,
        description,
        cta,
        target_url,
        start_date,
        end_date,
        status
      )
      VALUES (
        ${input.slot},
        ${input.campaignName},
        ${input.advertiser},
        ${input.creativeImage},
        ${input.headline},
        ${input.description},
        ${input.cta},
        ${input.targetUrl},
        ${input.startDate},
        ${input.endDate},
        ${input.status}
      )
      RETURNING
        id,
        slot,
        campaign_name,
        advertiser,
        creative_image,
        headline,
        description,
        cta,
        target_url,
        start_date::text,
        end_date::text,
        status,
        impressions,
        clicks,
        revenue::text,
        created_at::text,
        updated_at::text
    `;

    if (!row) {
      throw new Error("Ad campaign insert failed.");
    }

    return mapRow(row);
  },

  async updateCampaign(id: number, input: CampaignInput): Promise<AdCampaignRecord | null> {
    const sql = getWriteSql("ad campaign update");

    const [row] = await sql<{
      id: number;
      slot: AdSlotKey;
      campaign_name: string;
      advertiser: string;
      creative_image: string | null;
      headline: string;
      description: string;
      cta: string;
      target_url: string;
      start_date: string;
      end_date: string;
      status: AdCampaignRecord["status"];
      impressions: number;
      clicks: number;
      revenue: string;
      created_at: string;
      updated_at: string;
    }[]>`
      UPDATE ad_campaigns
      SET
        slot = ${input.slot},
        campaign_name = ${input.campaignName},
        advertiser = ${input.advertiser},
        creative_image = ${input.creativeImage},
        headline = ${input.headline},
        description = ${input.description},
        cta = ${input.cta},
        target_url = ${input.targetUrl},
        start_date = ${input.startDate},
        end_date = ${input.endDate},
        status = ${input.status}
      WHERE id = ${id}
      RETURNING
        id,
        slot,
        campaign_name,
        advertiser,
        creative_image,
        headline,
        description,
        cta,
        target_url,
        start_date::text,
        end_date::text,
        status,
        impressions,
        clicks,
        revenue::text,
        created_at::text,
        updated_at::text
    `;

    return row ? mapRow(row) : null;
  },

  async deleteCampaign(id: number): Promise<boolean> {
    const sql = getWriteSql("ad campaign delete");

    const result = await sql`
      DELETE FROM ad_campaigns
      WHERE id = ${id}
    `;

    return result.count > 0;
  }
};
