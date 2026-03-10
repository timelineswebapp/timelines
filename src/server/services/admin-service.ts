import { analyticsRepository } from "@/src/server/repositories/analytics-repository";
import { adsRepository } from "@/src/server/repositories/ads-repository";
import { eventRepository } from "@/src/server/repositories/event-repository";
import { requestRepository } from "@/src/server/repositories/request-repository";
import { tagRepository } from "@/src/server/repositories/tag-repository";
import { timelineRepository } from "@/src/server/repositories/timeline-repository";

export const adminService = {
  getDashboardOverview: analyticsRepository.getDashboardOverview,
  getAnalyticsSnapshot: analyticsRepository.getAnalyticsSnapshot,
  getAnalyticsReport: analyticsRepository.getAnalyticsReport,
  listTimelines: () => timelineRepository.listSummaries(100),
  getTimelineById: timelineRepository.getById,
  createTimeline: timelineRepository.create,
  updateTimeline: timelineRepository.update,
  deleteTimeline: timelineRepository.delete,
  listEvents: eventRepository.list,
  createEvent: eventRepository.create,
  updateEvent: eventRepository.update,
  deleteEvent: eventRepository.delete,
  listTags: tagRepository.list,
  createTag: tagRepository.create,
  updateTag: tagRepository.update,
  deleteTag: tagRepository.delete,
  listRequests: requestRepository.list,
  updateRequestStatus: requestRepository.updateStatus,
  getAdsDashboardData: adsRepository.getDashboardData,
  createAdCampaign: adsRepository.createCampaign,
  updateAdCampaign: adsRepository.updateCampaign,
  deleteAdCampaign: adsRepository.deleteCampaign
};
