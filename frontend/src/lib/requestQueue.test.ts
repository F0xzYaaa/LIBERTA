import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestQueue } from './requestQueue';

describe('RequestQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('spaces enqueued calls at least minGapMs apart', async () => {
    const queue = new RequestQueue(600);
    const startTimes: number[] = [];

    const makeTask = () => async () => {
      startTimes.push(Date.now());
      return 'ok';
    };

    const p1 = queue.schedule(makeTask());
    const p2 = queue.schedule(makeTask());
    const p3 = queue.schedule(makeTask());

    await vi.runAllTimersAsync();
    await Promise.all([p1, p2, p3]);

    expect(startTimes).toHaveLength(3);
    expect(startTimes[1] - startTimes[0]).toBeGreaterThanOrEqual(600);
    expect(startTimes[2] - startTimes[1]).toBeGreaterThanOrEqual(600);
  });

  it('preserves FIFO order even when tasks resolve at different speeds', async () => {
    const queue = new RequestQueue(600);
    const order: number[] = [];

    const slow = queue.schedule(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      order.push(1);
      return 1;
    });
    const fast = queue.schedule(async () => {
      order.push(2);
      return 2;
    });

    await vi.runAllTimersAsync();
    await Promise.all([slow, fast]);

    // Task 2 was enqueued after task 1, so it must start only after task 1's
    // gap gating -- but since schedule() chains via `.tail`, task 2's actual
    // start is still gated behind task 1's start, preserving submission order.
    expect(order).toEqual([1, 2]);
  });

  it('a slow/rejecting task does not block a differently-instantiated queue', async () => {
    const queueA = new RequestQueue(600);
    const queueB = new RequestQueue(600);

    const slowFailing = queueA.schedule(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      throw new Error('boom');
    });
    // Swallow to avoid unhandled rejection noise in the test.
    slowFailing.catch(() => undefined);

    const independent = queueB.schedule(async () => 'fast');

    await vi.advanceTimersByTimeAsync(10);
    await expect(independent).resolves.toBe('fast');
  });

  it('keeps the chain alive after a task rejects -- subsequent tasks still run with the gap', async () => {
    const queue = new RequestQueue(600);
    const results: Array<string | Error> = [];

    const failing = queue.schedule(async () => {
      throw new Error('task failed');
    });
    failing.catch((err) => results.push(err));

    const succeeding = queue.schedule(async () => 'recovered');

    await vi.runAllTimersAsync();
    await expect(failing).rejects.toThrow('task failed');
    await expect(succeeding).resolves.toBe('recovered');
  });

  it('handles concurrent enqueues from multiple "callers" -- all eventually run exactly once', async () => {
    const queue = new RequestQueue(600);
    const callOrder: number[] = [];

    const tasks = Array.from({ length: 5 }, (_, i) =>
      queue.schedule(async () => {
        callOrder.push(i);
        return i;
      }),
    );

    await vi.runAllTimersAsync();
    const results = await Promise.all(tasks);

    expect(results).toEqual([0, 1, 2, 3, 4]);
    expect(callOrder).toEqual([0, 1, 2, 3, 4]);
  });

  it('does not wait at all for the very first task (no artificial startup delay)', async () => {
    const queue = new RequestQueue(600);
    const task = vi.fn().mockResolvedValue('immediate');

    const promise = queue.schedule(task);
    // Even with zero timer advancement, the first task's microtask chain
    // should resolve because waitMs computes to 0 for the first call.
    await vi.advanceTimersByTimeAsync(0);
    await expect(promise).resolves.toBe('immediate');
  });
});
