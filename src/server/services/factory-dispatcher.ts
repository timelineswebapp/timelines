import { factoryOperationsService } from "@/src/server/services/factory-operations-service";

export class FactoryDispatcher {
  private timer: NodeJS.Timeout | null = null;
  private cycle: Promise<unknown> | null = null;
  constructor(private readonly intervalMs = 2000) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (!this.cycle) this.cycle = factoryOperationsService.runCycle({ actor: "dispatcher" })
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
