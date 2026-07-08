// Small FIFO utility that enforces a minimum gap between the *initiation* of
// successive calls scheduled through it. Intended for the admin dashboard,
// which fires four independent GET requests (summary/occupancy/revenue/
// bookings-by-status) — sequencing them through this queue instead of
// Promise.all keeps us comfortably under Nginx's general_limit rate zone
// (120r/min, zero burst) even if a user rapidly re-focuses the dashboard tab.

type Task<T> = () => Promise<T>;

const DEFAULT_MIN_GAP_MS = 600;

export class RequestQueue {
  private readonly minGapMs: number;
  private tail: Promise<unknown> = Promise.resolve();
  private lastStartedAt = 0;

  constructor(minGapMs: number = DEFAULT_MIN_GAP_MS) {
    this.minGapMs = minGapMs;
  }

  /** Enqueues `task`, guaranteeing it starts at least `minGapMs` after the previous task started. */
  schedule<T>(task: Task<T>): Promise<T> {
    const run = this.tail.then(async () => {
      const waitMs = Math.max(0, this.lastStartedAt + this.minGapMs - Date.now());
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      this.lastStartedAt = Date.now();
      return task();
    });

    // Keep the chain alive even if a task rejects — otherwise every task
    // after a failure would run without the intended gap. The real error is
    // still delivered to the caller via the returned `run` promise.
    this.tail = run.catch(() => undefined);

    return run;
  }
}

/** Shared queue for the admin dashboard's sequenced summary/occupancy/revenue/status calls. */
export const dashboardRequestQueue = new RequestQueue();
