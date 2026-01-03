/**
 * Priority-Based Test Queue for Parallel Execution
 * Optimizes test execution order based on historical data
 */

export interface TestHistoryData {
  testId: string;
  avgDurationMs: number;
  lastPassRate: number;  // 0-1, where 1 = always passes
  runCount: number;
  lastStatus: 'passed' | 'failed' | 'error' | 'skipped' | 'unknown';
  lastRunAt: Date | null;
  flakyScore: number;    // 0-1, where 1 = very flaky
  category: string;
}

export interface QueuedTest {
  testId: string;
  testName: string;
  category: string;
  priority: number;       // Higher = runs first
  estimatedDurationMs: number;
  retryCount: number;
  maxRetries: number;
  metadata?: Record<string, any>;
}

export type PriorityStrategy = 'speed' | 'reliability' | 'balanced' | 'random';

export interface PriorityQueueOptions {
  strategy?: PriorityStrategy;
  historyFetcher?: (testId: string) => TestHistoryData | null;
  defaultDurationMs?: number;
  maxRetries?: number;
}

/**
 * Calculate priority score for a test based on strategy
 */
function calculatePriority(
  test: { testId: string; category: string },
  history: TestHistoryData | null,
  strategy: PriorityStrategy
): number {
  if (!history) {
    // New tests: medium priority
    return 500;
  }

  switch (strategy) {
    case 'speed':
      // Fast tests first - inverse of duration
      // Score: 1000 for <1s, 100 for 10s, 10 for 100s
      return Math.max(10, 1000 / Math.max(1, history.avgDurationMs / 1000));

    case 'reliability':
      // Reliable tests first, flaky tests last
      // Score: 1000 for always pass, 0 for always fail
      return Math.round(history.lastPassRate * 1000 * (1 - history.flakyScore));

    case 'balanced':
      // Balance between speed and reliability
      const speedScore = 1000 / Math.max(1, history.avgDurationMs / 1000);
      const reliabilityScore = history.lastPassRate * 500;
      const flakyPenalty = history.flakyScore * 300;
      return Math.round(speedScore + reliabilityScore - flakyPenalty);

    case 'random':
      // Random order (useful for finding order-dependent bugs)
      return Math.random() * 1000;

    default:
      return 500;
  }
}

export class PriorityQueue {
  private queue: QueuedTest[] = [];
  private strategy: PriorityStrategy;
  private historyFetcher: (testId: string) => TestHistoryData | null;
  private defaultDurationMs: number;
  private maxRetries: number;

  // Stats
  private totalEnqueued: number = 0;
  private totalDequeued: number = 0;

  constructor(options: PriorityQueueOptions = {}) {
    this.strategy = options.strategy ?? 'balanced';
    this.historyFetcher = options.historyFetcher ?? (() => null);
    this.defaultDurationMs = options.defaultDurationMs ?? 30000;
    this.maxRetries = options.maxRetries ?? 2;
  }

  /**
   * Add a test to the queue with priority calculation
   */
  enqueue(test: {
    testId: string;
    testName: string;
    category: string;
    metadata?: Record<string, any>;
  }): void {
    const history = this.historyFetcher(test.testId);

    const queuedTest: QueuedTest = {
      testId: test.testId,
      testName: test.testName,
      category: test.category,
      priority: calculatePriority(test, history, this.strategy),
      estimatedDurationMs: history?.avgDurationMs ?? this.defaultDurationMs,
      retryCount: 0,
      maxRetries: this.maxRetries,
      metadata: test.metadata
    };

    // Insert in sorted order (highest priority first)
    const insertIndex = this.queue.findIndex(t => t.priority < queuedTest.priority);
    if (insertIndex === -1) {
      this.queue.push(queuedTest);
    } else {
      this.queue.splice(insertIndex, 0, queuedTest);
    }

    this.totalEnqueued++;
  }

  /**
   * Add multiple tests to the queue
   */
  enqueueMany(tests: Array<{
    testId: string;
    testName: string;
    category: string;
    metadata?: Record<string, any>;
  }>): void {
    for (const test of tests) {
      this.enqueue(test);
    }
  }

  /**
   * Get the next highest priority test
   */
  dequeue(): QueuedTest | null {
    const test = this.queue.shift() ?? null;
    if (test) {
      this.totalDequeued++;
    }
    return test;
  }

  /**
   * Get the next N tests without removing them
   */
  peek(count: number = 1): QueuedTest[] {
    return this.queue.slice(0, count);
  }

  /**
   * Re-queue a failed test for retry with lower priority
   */
  requeue(test: QueuedTest): boolean {
    if (test.retryCount >= test.maxRetries) {
      return false; // Max retries reached
    }

    const requeuedTest: QueuedTest = {
      ...test,
      retryCount: test.retryCount + 1,
      // Lower priority for retries (put near end of queue)
      priority: Math.max(1, test.priority / 2)
    };

    // Add to end of similar-priority items
    const insertIndex = this.queue.findIndex(t => t.priority < requeuedTest.priority);
    if (insertIndex === -1) {
      this.queue.push(requeuedTest);
    } else {
      this.queue.splice(insertIndex, 0, requeuedTest);
    }

    return true;
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    size: number;
    totalEnqueued: number;
    totalDequeued: number;
    estimatedTotalDurationMs: number;
    categoryBreakdown: Record<string, number>;
    priorityDistribution: { high: number; medium: number; low: number };
  } {
    const categoryBreakdown: Record<string, number> = {};
    let high = 0, medium = 0, low = 0;
    let totalDuration = 0;

    for (const test of this.queue) {
      categoryBreakdown[test.category] = (categoryBreakdown[test.category] ?? 0) + 1;
      totalDuration += test.estimatedDurationMs;

      if (test.priority >= 700) high++;
      else if (test.priority >= 300) medium++;
      else low++;
    }

    return {
      size: this.queue.length,
      totalEnqueued: this.totalEnqueued,
      totalDequeued: this.totalDequeued,
      estimatedTotalDurationMs: totalDuration,
      categoryBreakdown,
      priorityDistribution: { high, medium, low }
    };
  }

  /**
   * Get current queue size
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  get isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Get all tests in queue order
   */
  getAll(): QueuedTest[] {
    return [...this.queue];
  }

  /**
   * Get tests by category
   */
  getByCategory(category: string): QueuedTest[] {
    return this.queue.filter(t => t.category === category);
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Change the priority strategy (re-sorts existing items)
   */
  setStrategy(strategy: PriorityStrategy): void {
    this.strategy = strategy;

    // Recalculate priorities and re-sort
    for (const test of this.queue) {
      const history = this.historyFetcher(test.testId);
      test.priority = calculatePriority(test, history, strategy);
    }

    this.queue.sort((a, b) => b.priority - a.priority);
  }
}

/**
 * Create a priority queue with database-backed history
 */
export function createDatabasePriorityQueue(
  db: any, // Database instance
  options?: Partial<Omit<PriorityQueueOptions, 'historyFetcher'>>
): PriorityQueue {
  return new PriorityQueue({
    ...options,
    historyFetcher: (testId: string) => {
      try {
        // Query test history from database
        const results = db.getTestResultHistory?.(testId, 10) ?? [];

        if (results.length === 0) {
          return null;
        }

        // Calculate statistics
        const totalDuration = results.reduce((sum: number, r: any) => sum + (r.durationMs ?? 0), 0);
        const passCount = results.filter((r: any) => r.status === 'passed').length;

        // Calculate flaky score (status changes / runs)
        let statusChanges = 0;
        for (let i = 1; i < results.length; i++) {
          if (results[i].status !== results[i - 1].status) {
            statusChanges++;
          }
        }

        return {
          testId,
          avgDurationMs: totalDuration / results.length,
          lastPassRate: passCount / results.length,
          runCount: results.length,
          lastStatus: results[0]?.status ?? 'unknown',
          lastRunAt: results[0]?.completedAt ? new Date(results[0].completedAt) : null,
          flakyScore: Math.min(1, statusChanges / Math.max(1, results.length - 1)),
          category: results[0]?.category ?? 'unknown'
        };
      } catch {
        return null;
      }
    }
  });
}

