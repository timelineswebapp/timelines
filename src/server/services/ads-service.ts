import type { AdCampaignRecord, AdSlotKey, AdsDashboardData } from "@/src/lib/types";
import { adsRepository } from "@/src/server/repositories/ads-repository";

type CampaignInput = Omit<
  AdCampaignRecord,
  "id" | "impressions" | "clicks" | "revenue" | "createdAt" | "updatedAt"
>;

export const adsService = {
  getDashboardData(): Promise<AdsDashboardData> {
    return adsRepository.getDashboardData();
  },

  getPublicAssignments(slots: AdSlotKey[]) {
    return adsRepository.getPublicAssignments(slots);
  },

  createCampaign(input: CampaignInput) {
    return adsRepository.createCampaign(input);
  },

  updateCampaign(id: number, input: CampaignInput) {
    return adsRepository.updateCampaign(id, input);
  },

  deleteCampaign(id: number) {
    return adsRepository.deleteCampaign(id);
  }
};
