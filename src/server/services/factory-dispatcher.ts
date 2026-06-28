import { factoryOperationsService } from "@/src/server/services/factory-operations-service";
import { reliabilityService } from "@/src/server/services/reliability-service";
import { scheduledOperationsService } from "@/src/server/services/scheduled-operations-service";

export class FactoryDispatcher {
  private timer: NodeJS.Timeout | null = null;
  private cycle: Promise<unknown> | null = null;
  private lastMonitoringAt = 0;
  private lastSchedulerAt = 0;
  constructor(private readonly intervalMs = 2000) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (!this.cycle) this.cycle = (async () => {
        await factoryOperationsService.runCycle({ actor: "dispatcher" });
        if (Date.now() - this.lastMonitoringAt >= 60_000) {
          await reliabilityService.collectAndEvaluate();
          this.lastMonitoringAt = Date.now();
        }
        if (Date.now() - this.lastSchedulerAt >= 30_000) {
          await scheduledOperationsService.runDue();
          this.lastSchedulerAt = Date.now();
        }
      })()
        .catch((error) => console.error(JSON.stringify({ level: "error", component: "factory_dispatcher", message: error instanceof Error ? error.message : "Cycle failed" })))
        .finally(() => { this.cycle = null; });
    }, this.intervalMs);
    this.timer.unref();
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.cycle;
  }
}
