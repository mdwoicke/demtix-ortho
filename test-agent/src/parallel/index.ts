/**
 * Parallel Execution Module
 * Utilities for optimized parallel test execution
 */

export {
  WriteQueue,
  createDatabaseWriteQueue,
  getWriteQueue,
  setWriteQueue,
  type QueuedWrite,
  type WriteQueueOptions,
  type WriteQueueStats,
} from './write-queue';

export {
  PriorityQueue,
  createDatabasePriorityQueue,
  type QueuedTest,
  type TestHistoryData,
  type PriorityStrategy,
  type PriorityQueueOptions,
} from './priority-queue';

export {
  classifyFailure,
  shouldRetryTest,
  retryWithClassification,
  calculateFlakyScore,
  sleep,
  type FailureType,
  type ClassificationResult,
  type FailureContext,
} from './failure-classifier';
