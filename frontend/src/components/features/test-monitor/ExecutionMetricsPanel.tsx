/**
 * Enhanced Execution Metrics Panel
 * Displays real-time metrics for parallel test execution
 */

import { useState, useEffect, useMemo } from 'react';
import { Card } from '../../ui';
import type {
  ExecutionProgress,
  WorkerStatus,
  EnhancedExecutionMetrics,
  RecentFailure,
  FailureClusterSummary,
} from '../../../types/testMonitor.types';

interface ExecutionMetricsPanelProps {
  progress: ExecutionProgress;
  workers: WorkerStatus[];
  startedAt?: string;
  isExecuting: boolean;
}

// Calculate ETA and throughput from progress history
function useExecutionMetrics(
  progress: ExecutionProgress,
  workers: WorkerStatus[],
  startedAt?: string
): EnhancedExecutionMetrics | null {
  const [progressHistory, setProgressHistory] = useState<
    Array<{ completed: number; timestamp: number }>
  >([]);

  // Track progress over time for throughput calculation
  useEffect(() => {
    if (progress.completed > 0) {
      setProgressHistory((prev) => {
        const now = Date.now();
        // Keep last 30 seconds of history
        const cutoff = now - 30000;
        const filtered = prev.filter((p) => p.timestamp > cutoff);
        return [...filtered, { completed: progress.completed, timestamp: now }];
      });
    }
  }, [progress.completed]);

  // Reset history when execution starts
  useEffect(() => {
    if (startedAt) {
      setProgressHistory([]);
    }
  }, [startedAt]);

  return useMemo(() => {
    if (!startedAt) return null;

    const startTime = new Date(startedAt).getTime();
    const now = Date.now();
    const elapsedMs = now - startTime;

    // Calculate throughput (tests per minute)
    let testsPerMinute = 0;
    if (progressHistory.length >= 2) {
      const oldest = progressHistory[0];
      const newest = progressHistory[progressHistory.length - 1];
      const timeDiffMinutes = (newest.timestamp - oldest.timestamp) / 60000;
      const testsDiff = newest.completed - oldest.completed;
      if (timeDiffMinutes > 0) {
        testsPerMinute = Math.round((testsDiff / timeDiffMinutes) * 10) / 10;
      }
    } else if (progress.completed > 0 && elapsedMs > 0) {
      testsPerMinute =
        Math.round((progress.completed / (elapsedMs / 60000)) * 10) / 10;
    }

    // Calculate average test duration
    const avgTestDurationMs =
      progress.completed > 0 ? elapsedMs / progress.completed : 0;

    // Calculate ETA
    const remainingTests = progress.total - progress.completed;
    let estimatedRemainingMs: number | null = null;
    let estimatedCompletionAt: string | null = null;

    if (testsPerMinute > 0 && remainingTests > 0) {
      estimatedRemainingMs = (remainingTests / testsPerMinute) * 60000;
      estimatedCompletionAt = new Date(
        now + estimatedRemainingMs
      ).toISOString();
    }

    // Calculate worker utilization
    const activeWorkers = workers.filter((w) => w.status === 'running').length;
    const totalWorkers = workers.length || 1;
    const workerUtilization = activeWorkers / totalWorkers;
    const idleWorkerCount = workers.filter((w) => w.status === 'idle').length;

    // Calculate failure rate
    const failureRate =
      progress.completed > 0 ? progress.failed / progress.completed : 0;

    return {
      startedAt,
      elapsedMs,
      estimatedRemainingMs,
      estimatedCompletionAt,
      testsPerMinute,
      avgTestDurationMs: Math.round(avgTestDurationMs),
      failureRate: Math.round(failureRate * 1000) / 10, // Percentage with 1 decimal
      recentFailures: [], // Would be populated from SSE events
      failureClusters: [], // Would be populated from API
      workerUtilization: Math.round(workerUtilization * 100) / 100,
      idleWorkerCount,
      totalRetries: 0,
      retriedTests: [],
      earlyTerminations: 0,
    };
  }, [progress, workers, startedAt, progressHistory]);
}

// Format duration for display
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

// Format time for display
function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function ExecutionMetricsPanel({
  progress,
  workers,
  startedAt,
  isExecuting,
}: ExecutionMetricsPanelProps) {
  const metrics = useExecutionMetrics(progress, workers, startedAt);

  if (!isExecuting || !metrics) {
    return null;
  }

  const progressPercentage =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  return (
    <Card>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Execution Metrics
        </h3>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Throughput */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <svg
                className="w-4 h-4 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                Throughput
              </span>
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {metrics.testsPerMinute}
            </div>
            <div className="text-xs text-blue-600/70 dark:text-blue-400/70">
              tests/min
            </div>
          </div>

          {/* Avg Duration */}
          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <svg
                className="w-4 h-4 text-purple-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-xs font-medium text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                Avg Duration
              </span>
            </div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {formatDuration(metrics.avgTestDurationMs)}
            </div>
            <div className="text-xs text-purple-600/70 dark:text-purple-400/70">
              per test
            </div>
          </div>

          {/* ETA */}
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <svg
                className="w-4 h-4 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wider">
                ETA
              </span>
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {metrics.estimatedRemainingMs
                ? formatDuration(metrics.estimatedRemainingMs)
                : '--'}
            </div>
            <div className="text-xs text-green-600/70 dark:text-green-400/70">
              {metrics.estimatedCompletionAt
                ? `~${formatTime(metrics.estimatedCompletionAt)}`
                : 'calculating...'}
            </div>
          </div>

          {/* Worker Utilization */}
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <svg
                className="w-4 h-4 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                Workers
              </span>
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {Math.round(metrics.workerUtilization * 100)}%
            </div>
            <div className="text-xs text-amber-600/70 dark:text-amber-400/70">
              {workers.filter((w) => w.status === 'running').length}/
              {workers.length} active
            </div>
          </div>
        </div>

        {/* Progress Details */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Elapsed: </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatDuration(metrics.elapsedMs)}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">
              Failure Rate:{' '}
            </span>
            <span
              className={`font-medium ${
                metrics.failureRate > 20
                  ? 'text-red-600 dark:text-red-400'
                  : metrics.failureRate > 10
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-green-600 dark:text-green-400'
              }`}
            >
              {metrics.failureRate}%
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Progress: </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {progressPercentage}%
            </span>
          </div>
        </div>

        {/* Enhanced Progress Bar with segments */}
        <div className="mt-4">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
            {progress.passed > 0 && (
              <div
                className="bg-green-500 transition-all duration-300"
                style={{
                  width: `${(progress.passed / progress.total) * 100}%`,
                }}
              />
            )}
            {progress.failed > 0 && (
              <div
                className="bg-red-500 transition-all duration-300"
                style={{
                  width: `${(progress.failed / progress.total) * 100}%`,
                }}
              />
            )}
            {progress.skipped > 0 && (
              <div
                className="bg-yellow-500 transition-all duration-300"
                style={{
                  width: `${(progress.skipped / progress.total) * 100}%`,
                }}
              />
            )}
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              {progress.passed} passed
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              {progress.failed} failed
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              {progress.skipped} skipped
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
              {progress.total - progress.completed} remaining
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default ExecutionMetricsPanel;
