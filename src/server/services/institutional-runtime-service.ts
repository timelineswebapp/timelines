import { FactoryDispatcher } from "@/src/server/services/factory-dispatcher";
import { factoryOperationsService } from "@/src/server/services/factory-operations-service";
import { governanceExecutionService } from "@/src/server/services/governance-execution-service";
import { platformRevalidationService } from "@/src/server/services/platform-revalidation-service";

type InstitutionalRuntimeDependencies = {
  executeFactory: () => Promise<unknown>;
  executeGovernance: () => Promise<unknown>;
  executeContinuation: () => Promise<unknown>;
  revalidatePlatform: (continuation: unknown) => Promise<unknown>;
};

const defaultDependencies: InstitutionalRuntimeDependencies = {
  executeFactory: () => new FactoryDispatcher().runCycle(),
  executeGovernance: () => governanceExecutionService.runCycle(),
  executeContinuation: () => factoryOperationsService.runCycle({
    actor: "local-institutional-runtime"
  }),
  revalidatePlatform: (continuation) =>
    platformRevalidationService.revalidateAfterContinuation(continuation)
};

export class InstitutionalRuntimeOrchestrator {
  constructor(private readonly dependencies: InstitutionalRuntimeDependencies = defaultDependencies) {}

  async runCycle() {
    const factory = await this.dependencies.executeFactory();
    const governance = await this.dependencies.executeGovernance();
    const continuation = await this.dependencies.executeContinuation();
    const revalidation = await this.dependencies.revalidatePlatform(continuation);

    return {
      factory,
      governance,
      continuation,
      revalidation
    };
  }
}

export const institutionalRuntimeService = new InstitutionalRuntimeOrchestrator();
