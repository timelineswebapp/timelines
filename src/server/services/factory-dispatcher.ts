import { factoryOperationsService } from "@/src/server/services/factory-operations-service";

export class FactoryDispatcher {
  async runCycle() {
    return factoryOperationsService.runCycle({ actor: "durable-cron-dispatcher" });
  }
}
