/**
 * One deadline owner for Authority-First acquisition.  Child SDKs and network
 * clients are not trusted to settle when their AbortSignal is fired: every
 * registered operation is therefore raced independently against the smaller
 * of its local allowance and the absolute run deadline.
 */
export type SupervisedOperationState = "ACTIVE" | "COMPLETED" | "FAILED" | "TIMED_OUT" | "CANCELLED" | "LATE_COMPLETION_IGNORED";
export type SupervisorState = "ACTIVE" | "CANCELLING" | "TERMINAL";

export type SupervisedOperation = {
  name: string;
  startedAt: number;
  deadlineAt: number;
  state: SupervisedOperationState;
  completedAt: number | null;
  lateCompletionIgnored: boolean;
};

export type DeadlineTerminalSnapshot = {
  deadlineAt: number;
  elapsedMs: number;
  state: SupervisorState;
  cancellationReason: string | null;
  activeOperation: string | null;
  completedOperations: string[];
  timedOutOperations: string[];
  lateCompletionsIgnored: string[];
  shutdownGraceMs: number;
  shutdownGraceOutcome: "NOT_REQUIRED" | "SETTLED" | "EXPIRED";
};

export class WholeRunDeadlineExceededError extends Error {
  constructor(message = "WHOLE_RUN_DEADLINE_EXCEEDED") {
    super(message);
    this.name = "WholeRunDeadlineExceededError";
  }
}

type Timer = ReturnType<typeof setTimeout>;

export class AuthorityFirstExecutionSupervisor {
  private readonly controller = new AbortController();
  private readonly operations = new Map<string, SupervisedOperation>();
  private operationSequence = 0;
  private readonly deadlineTimer: Timer;
  private state: SupervisorState = "ACTIVE";
  private cancellationReason: string | null = null;
  private graceOutcome: DeadlineTerminalSnapshot["shutdownGraceOutcome"] = "NOT_REQUIRED";

  constructor(
    readonly startedAt: number,
    readonly deadlineAt: number,
    readonly shutdownGraceMs = 5_000,
    private readonly now: () => number = Date.now
  ) {
    if (!Number.isFinite(deadlineAt) || deadlineAt <= startedAt) throw new Error("AUTHORITY_FIRST_SUPERVISOR_INVALID_DEADLINE");
    if (!Number.isInteger(shutdownGraceMs) || shutdownGraceMs < 0 || shutdownGraceMs > 30_000) throw new Error("AUTHORITY_FIRST_SUPERVISOR_INVALID_GRACE");
    this.deadlineTimer = setTimeout(() => this.cancel("WHOLE_RUN_DEADLINE_EXCEEDED"), Math.max(1, deadlineAt - this.now()));
  }

  get signal(): AbortSignal { return this.controller.signal; }
  get status(): SupervisorState { return this.state; }
  remainingMs(): number { return Math.max(0, this.deadlineAt - this.now()); }

  assertMayStart(name: string, maximumMs = 1): void {
    if (!name || name.length > 160) throw new Error("AUTHORITY_FIRST_SUPERVISOR_INVALID_OPERATION");
    if (this.state !== "ACTIVE" || this.remainingMs() < maximumMs) {
      this.cancel("WHOLE_RUN_DEADLINE_EXCEEDED");
      throw new WholeRunDeadlineExceededError();
    }
  }

  /** A retry is optional work: reserve shutdown grace before allowing it. */
  assertMayStartRetry(name: string, maximumRetryMs: number): void {
    if (this.state !== "ACTIVE" || this.remainingMs() < maximumRetryMs + this.shutdownGraceMs) {
      this.cancel("WHOLE_RUN_DEADLINE_EXCEEDED");
      throw new WholeRunDeadlineExceededError(`WHOLE_RUN_DEADLINE_EXCEEDED:RETRY_NOT_STARTED:${name}`);
    }
  }

  cancel(reason = "WHOLE_RUN_DEADLINE_EXCEEDED"): void {
    if (this.state !== "ACTIVE") return;
    this.state = "CANCELLING";
    this.cancellationReason = reason;
    this.controller.abort(new WholeRunDeadlineExceededError(reason));
  }

  async runChild<T>(input: { name: string; maximumMs: number; run: (signal: AbortSignal) => Promise<T> }): Promise<T> {
    if (!Number.isInteger(input.maximumMs) || input.maximumMs < 1) throw new Error("AUTHORITY_FIRST_SUPERVISOR_INVALID_CHILD_BUDGET");
    this.assertMayStart(input.name, 1);
    const allowance = Math.min(input.maximumMs, this.remainingMs());
    if (allowance < 1) throw new WholeRunDeadlineExceededError();
    const startedAt = this.now();
    const operationName = `${input.name}#${++this.operationSequence}`;
    const operation: SupervisedOperation = { name: operationName, startedAt, deadlineAt: startedAt + allowance, state: "ACTIVE", completedAt: null, lateCompletionIgnored: false };
    this.operations.set(operationName, operation);
    const childController = new AbortController();
    const abort = () => childController.abort(this.controller.signal.reason || new WholeRunDeadlineExceededError());
    this.controller.signal.addEventListener("abort", abort, { once: true });
    let timer: Timer | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        this.cancel("WHOLE_RUN_DEADLINE_EXCEEDED");
        operation.state = "TIMED_OUT";
        reject(new WholeRunDeadlineExceededError());
      }, allowance);
    });
    const child = Promise.resolve().then(() => input.run(childController.signal));
    // Never permit a late resolution to resume a sealed orchestration path.
    void child.then(() => {
      if (operation.state === "TIMED_OUT" || this.state !== "ACTIVE") {
        operation.state = "LATE_COMPLETION_IGNORED";
        operation.lateCompletionIgnored = true;
        operation.completedAt = this.now();
      }
    }, () => {
      // An SDK that honors cancellation has stopped; it must not keep the
      // shutdown-grace accounting open merely because the raced timeout has
      // already rejected the orchestration path.
      if (operation.state === "TIMED_OUT" || this.state === "CANCELLING") {
        operation.state = "CANCELLED";
        operation.completedAt = this.now();
      }
    });
    try {
      const value = await Promise.race([child, timeout]);
      operation.state = "COMPLETED";
      operation.completedAt = this.now();
      return value;
    } catch (error) {
      if (error instanceof WholeRunDeadlineExceededError) throw error;
      operation.state = this.state === "CANCELLING" ? "CANCELLED" : "FAILED";
      operation.completedAt = this.now();
      throw error;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      this.controller.signal.removeEventListener("abort", abort);
    }
  }

  async awaitShutdownGrace(): Promise<DeadlineTerminalSnapshot["shutdownGraceOutcome"]> {
    if (this.state === "ACTIVE") return this.graceOutcome;
    const unsettled = () => [...this.operations.values()].some((operation) => operation.state === "ACTIVE" || operation.state === "TIMED_OUT");
    if (!unsettled()) {
      this.graceOutcome = "SETTLED";
      return this.graceOutcome;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, this.shutdownGraceMs));
    this.graceOutcome = unsettled() ? "EXPIRED" : "SETTLED";
    return this.graceOutcome;
  }

  terminalSnapshot(): DeadlineTerminalSnapshot {
    const operations = [...this.operations.values()];
    return {
      deadlineAt: this.deadlineAt,
      elapsedMs: this.now() - this.startedAt,
      state: this.state,
      cancellationReason: this.cancellationReason,
      activeOperation: operations.find((operation) => operation.state === "ACTIVE" || operation.state === "TIMED_OUT")?.name || null,
      completedOperations: operations.filter((operation) => operation.state === "COMPLETED").map((operation) => operation.name).sort(),
      timedOutOperations: operations.filter((operation) => operation.state === "TIMED_OUT").map((operation) => operation.name).sort(),
      lateCompletionsIgnored: operations.filter((operation) => operation.lateCompletionIgnored).map((operation) => operation.name).sort(),
      shutdownGraceMs: this.shutdownGraceMs,
      shutdownGraceOutcome: this.graceOutcome
    };
  }

  close(): void {
    clearTimeout(this.deadlineTimer);
    this.state = "TERMINAL";
  }
}
