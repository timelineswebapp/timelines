import { governanceRepository } from "@/src/server/repositories/governance-repository";
import { historicalLibraryRepository } from "@/src/server/repositories/historical-library-repository";

const SNAPSHOT_LIMIT = 100;

export type GovernanceOperationsSnapshot = Awaited<ReturnType<typeof governanceOperationsService.getSnapshot>>;

export const governanceOperationsService = {
  async getSnapshot() {
    const [
      publicationPackages,
      governanceDecisions,
      feedbackPackages,
      auditRecords,
      historicalLibraryRevisions,
      historicalLibraryRetirements,
      historicalLibraryMerges,
      historicalLibraryPreservations,
      historicalLibraryFeedbackLinks
    ] = await Promise.all([
      governanceRepository.listPublicationPackages(SNAPSHOT_LIMIT),
      governanceRepository.listDecisions(SNAPSHOT_LIMIT),
      governanceRepository.listFeedbackPackages(SNAPSHOT_LIMIT),
      governanceRepository.listAuditRecords(SNAPSHOT_LIMIT),
      historicalLibraryRepository.listRevisions(SNAPSHOT_LIMIT),
      historicalLibraryRepository.listRetirements(SNAPSHOT_LIMIT),
      historicalLibraryRepository.listMerges(SNAPSHOT_LIMIT),
      historicalLibraryRepository.listPreservations(SNAPSHOT_LIMIT),
      historicalLibraryRepository.listFeedbackLinks(SNAPSHOT_LIMIT)
    ]);

    return {
      generatedAt: new Date().toISOString(),
      limits: {
        perCollection: SNAPSHOT_LIMIT
      },
      publicationPackages,
      governanceDecisions,
      feedbackPackages,
      auditRecords,
      historicalLibrary: {
        revisions: historicalLibraryRevisions,
        retirements: historicalLibraryRetirements,
        merges: historicalLibraryMerges,
        preservations: historicalLibraryPreservations,
        feedbackLinks: historicalLibraryFeedbackLinks
      }
    };
  }
};
