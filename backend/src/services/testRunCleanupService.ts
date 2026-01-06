/**
 * Test Run Cleanup Service
 *
 * Handles automatic detection and cleanup of abandoned test runs.
 *
 * Abandoned runs can occur when:
 * - Server restarts while tests are running
 * - Test-agent process crashes unexpectedly
 * - Network disconnection during test execution
 * - Process killed externally
 *
 * Cleanup Strategy:
 * 1. On server startup: Mark ALL running tests as aborted (process died)
 * 2. Periodic cleanup: Check for tests running > MAX_RUN_DURATION and mark as aborted
 */

import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import logger from '../utils/logger';

// Configuration
const TEST_AGENT_DB_PATH = path.resolve(__dirname, '../../../test-agent/data/test-results.db');

// Default timeout: 30 minutes (most tests should complete within this time)
const DEFAULT_MAX_RUN_DURATION_MINUTES = 30;

// Cleanup interval: Check every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

interface CleanupResult {
  count: number;
  runIds: string[];
  reason: string;
}

interface RunningTestRun {
  runId: string;
  startedAt: string;
  ageMinutes: number;
  totalTests: number;
  passed: number;
  failed: number;
}

/**
 * Get writable database connection
 */
function getTestAgentDb(): BetterSqlite3.Database {
  return new BetterSqlite3(TEST_AGENT_DB_PATH, { readonly: false });
}

/**
 * Mark all currently running test runs as aborted
 * Called on server startup to clean up interrupted runs
 */
export function markAbandonedRunsOnStartup(): CleanupResult {
  const db = getTestAgentDb();

  try {
    // Get running test IDs for logging
    const runningRuns = db.prepare(`
      SELECT run_id, started_at FROM test_runs WHERE status = 'running'
    `).all() as Array<{ run_id: string; started_at: string }>;

    if (runningRuns.length === 0) {
      return { count: 0, runIds: [], reason: 'No running tests found' };
    }

    const runIds = runningRuns.map(r => r.run_id);
    const now = new Date().toISOString();

    // Update all running runs to aborted
    const result = db.prepare(`
      UPDATE test_runs
      SET completed_at = ?,
          status = 'aborted',
          summary = json_set(
            COALESCE(summary, '{}'),
            '$.aborted', true,
            '$.abortReason', 'Server restart - process terminated unexpectedly',
            '$.abortedAt', ?
          )
      WHERE status = 'running'
    `).run(now, now);

    return {
      count: result.changes,
      runIds,
      reason: 'Server restart - process terminated unexpectedly'
    };
  } finally {
    db.close();
  }
}

/**
 * Get all currently running test runs with their age
 */
export function getRunningTestRuns(): RunningTestRun[] {
  const db = getTestAgentDb();

  try {
    const now = Date.now();

    const runs = db.prepare(`
      SELECT run_id, started_at, total_tests, passed, failed
      FROM test_runs
      WHERE status = 'running'
      ORDER BY started_at DESC
    `).all() as Array<{
      run_id: string;
      started_at: string;
      total_tests: number;
      passed: number;
      failed: number;
    }>;

    return runs.map(r => ({
      runId: r.run_id,
      startedAt: r.started_at,
      ageMinutes: Math.round((now - new Date(r.started_at).getTime()) / 60000),
      totalTests: r.total_tests,
      passed: r.passed,
      failed: r.failed,
    }));
  } finally {
    db.close();
  }
}

/**
 * Mark a specific run as abandoned with a custom reason
 */
export function markRunAsAbandoned(runId: string, reason: string): boolean {
  const db = getTestAgentDb();

  try {
    const now = new Date().toISOString();

    // Get current stats for the run
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN status IN ('failed', 'error') THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
      FROM test_results WHERE run_id = ?
    `).get(runId) as { total: number; passed: number; failed: number; skipped: number } | undefined;

    const summary = {
      totalTests: stats?.total || 0,
      passed: stats?.passed || 0,
      failed: stats?.failed || 0,
      skipped: stats?.skipped || 0,
      aborted: true,
      abortReason: reason,
      abortedAt: now,
    };

    const result = db.prepare(`
      UPDATE test_runs
      SET completed_at = ?,
          status = 'aborted',
          total_tests = ?,
          passed = ?,
          failed = ?,
          skipped = ?,
          summary = ?
      WHERE run_id = ? AND status = 'running'
    `).run(
      now,
      summary.totalTests,
      summary.passed,
      summary.failed,
      summary.skipped,
      JSON.stringify(summary),
      runId
    );

    return result.changes > 0;
  } finally {
    db.close();
  }
}

/**
 * Clean up stale running test runs that have exceeded the maximum duration
 */
export function cleanupStaleRuns(maxDurationMinutes: number = DEFAULT_MAX_RUN_DURATION_MINUTES): CleanupResult {
  const runningRuns = getRunningTestRuns();
  const staleRuns = runningRuns.filter(r => r.ageMinutes > maxDurationMinutes);

  if (staleRuns.length === 0) {
    return { count: 0, runIds: [], reason: 'No stale runs found' };
  }

  const reason = `Exceeded maximum run duration of ${maxDurationMinutes} minutes`;
  const abortedRunIds: string[] = [];

  for (const run of staleRuns) {
    const success = markRunAsAbandoned(run.runId, reason);
    if (success) {
      abortedRunIds.push(run.runId);
    }
  }

  return { count: abortedRunIds.length, runIds: abortedRunIds, reason };
}

// Interval handle for cleanup job
let cleanupIntervalHandle: NodeJS.Timeout | null = null;

/**
 * Start the periodic cleanup job
 */
export function startPeriodicCleanup(
  intervalMs: number = CLEANUP_INTERVAL_MS,
  maxDurationMinutes: number = DEFAULT_MAX_RUN_DURATION_MINUTES
): void {
  // Don't start if already running
  if (cleanupIntervalHandle) {
    logger.warn('[TestRunCleanup] Periodic cleanup already running');
    return;
  }

  logger.info('[TestRunCleanup] Starting periodic cleanup job', {
    intervalMinutes: intervalMs / 60000,
    maxDurationMinutes,
  });

  cleanupIntervalHandle = setInterval(() => {
    try {
      const result = cleanupStaleRuns(maxDurationMinutes);
      if (result.count > 0) {
        logger.info('[TestRunCleanup] Cleaned up stale test runs', {
          count: result.count,
          runIds: result.runIds,
          reason: result.reason,
        });
      }
    } catch (error: any) {
      logger.error('[TestRunCleanup] Error during periodic cleanup', {
        error: error.message,
      });
    }
  }, intervalMs);
}

/**
 * Stop the periodic cleanup job
 */
export function stopPeriodicCleanup(): void {
  if (cleanupIntervalHandle) {
    clearInterval(cleanupIntervalHandle);
    cleanupIntervalHandle = null;
    logger.info('[TestRunCleanup] Stopped periodic cleanup job');
  }
}

/**
 * Initialize test run cleanup on server startup
 * This handles both startup cleanup and starting the periodic job
 */
export function initializeTestRunCleanup(): void {
  logger.info('[TestRunCleanup] Initializing test run cleanup service');

  // 1. Clean up any runs that were interrupted by server restart
  try {
    const startupResult = markAbandonedRunsOnStartup();
    if (startupResult.count > 0) {
      logger.warn('[TestRunCleanup] Marked abandoned test runs from previous session', {
        count: startupResult.count,
        runIds: startupResult.runIds,
        reason: startupResult.reason,
      });
    } else {
      logger.info('[TestRunCleanup] No abandoned test runs found from previous session');
    }
  } catch (error: any) {
    logger.error('[TestRunCleanup] Error during startup cleanup', {
      error: error.message,
    });
  }

  // 2. Start periodic cleanup job
  startPeriodicCleanup();
}

/**
 * Get cleanup service status
 */
export function getCleanupStatus(): {
  isRunning: boolean;
  runningTests: RunningTestRun[];
  config: {
    intervalMinutes: number;
    maxDurationMinutes: number;
  };
} {
  return {
    isRunning: cleanupIntervalHandle !== null,
    runningTests: getRunningTestRuns(),
    config: {
      intervalMinutes: CLEANUP_INTERVAL_MS / 60000,
      maxDurationMinutes: DEFAULT_MAX_RUN_DURATION_MINUTES,
    },
  };
}
