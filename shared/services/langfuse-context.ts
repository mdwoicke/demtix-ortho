/**
 * Langfuse Trace Context
 * Provides AsyncLocalStorage-based context propagation for trace correlation
 *
 * Usage:
 *   // At the start of a test run
 *   await runWithTrace({ traceId, runId }, async () => {
 *     // All code here can access the context
 *     const ctx = getCurrentTraceContext();
 *   });
 */

import { AsyncLocalStorage } from 'async_hooks';
import type { TraceContext } from '../types/langfuse.types';

// ============================================================================
// AsyncLocalStorage Instance
// ============================================================================

const traceStorage = new AsyncLocalStorage<TraceContext>();

// ============================================================================
// Context Management Functions
// ============================================================================

/**
 * Run a function within a trace context
 * All code executed within the callback will have access to the context
 */
export function runWithTrace<T>(context: TraceContext, fn: () => T | Promise<T>): Promise<T> {
  return Promise.resolve(traceStorage.run(context, fn));
}

/**
 * Get the current trace context
 * Returns undefined if not running within a trace context
 */
export function getCurrentTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}

/**
 * Check if we're currently within a trace context
 */
export function hasTraceContext(): boolean {
  return traceStorage.getStore() !== undefined;
}

/**
 * Update the current trace context with additional metadata
 * Creates a new context with merged values
 */
export function updateTraceContext(updates: Partial<TraceContext>): TraceContext | undefined {
  const current = traceStorage.getStore();
  if (!current) return undefined;

  // Merge updates into current context
  const updated: TraceContext = {
    ...current,
    ...updates,
    metadata: {
      ...current.metadata,
      ...updates.metadata,
    },
  };

  // Note: AsyncLocalStorage doesn't allow direct mutation
  // The caller should use runWithTrace with the new context if needed
  return updated;
}

/**
 * Get the current trace ID if available
 */
export function getCurrentTraceId(): string | undefined {
  return traceStorage.getStore()?.traceId;
}

/**
 * Get the current run ID if available
 */
export function getCurrentRunId(): string | undefined {
  return traceStorage.getStore()?.runId;
}

/**
 * Get the current test ID if available
 */
export function getCurrentTestId(): string | undefined {
  return traceStorage.getStore()?.testId;
}

/**
 * Get the current session ID if available
 */
export function getCurrentSessionId(): string | undefined {
  return traceStorage.getStore()?.sessionId;
}

/**
 * Get the current parent observation ID if available
 */
export function getCurrentParentObservationId(): string | undefined {
  return traceStorage.getStore()?.parentObservationId;
}

// ============================================================================
// Context Builder Helper
// ============================================================================

/**
 * Create a new trace context
 */
export function createTraceContext(
  traceId: string,
  runId: string,
  options?: {
    testId?: string;
    sessionId?: string;
    parentObservationId?: string;
    metadata?: Record<string, any>;
  }
): TraceContext {
  return {
    traceId,
    runId,
    testId: options?.testId,
    sessionId: options?.sessionId,
    parentObservationId: options?.parentObservationId,
    metadata: options?.metadata,
  };
}

/**
 * Create a child context with a new parent observation
 */
export function createChildContext(
  parentObservationId: string,
  options?: {
    testId?: string;
    metadata?: Record<string, any>;
  }
): TraceContext | undefined {
  const current = traceStorage.getStore();
  if (!current) return undefined;

  return {
    ...current,
    parentObservationId,
    testId: options?.testId ?? current.testId,
    metadata: {
      ...current.metadata,
      ...options?.metadata,
    },
  };
}

// ============================================================================
// Wrapper Helpers
// ============================================================================

/**
 * Execute a function with test-specific context
 * Useful when running individual tests within a run
 */
export async function withTestContext<T>(
  testId: string,
  sessionId: string,
  fn: () => T | Promise<T>
): Promise<T> {
  const current = getCurrentTraceContext();
  if (!current) {
    // No parent context, just run the function
    return fn();
  }

  const testContext: TraceContext = {
    ...current,
    testId,
    sessionId,
    metadata: {
      ...current.metadata,
      testId,
    },
  };

  return runWithTrace(testContext, fn);
}

/**
 * Execute a function with a new parent observation
 * Useful when nesting spans
 */
export async function withParentObservation<T>(
  parentObservationId: string,
  fn: () => T | Promise<T>
): Promise<T> {
  const current = getCurrentTraceContext();
  if (!current) {
    return fn();
  }

  const childContext: TraceContext = {
    ...current,
    parentObservationId,
  };

  return runWithTrace(childContext, fn);
}

// ============================================================================
// Debug Helpers
// ============================================================================

/**
 * Get a debug string for the current context
 */
export function debugContext(): string {
  const ctx = traceStorage.getStore();
  if (!ctx) return '[No trace context]';

  const parts = [
    `trace=${ctx.traceId.substring(0, 8)}`,
    `run=${ctx.runId.substring(0, 8)}`,
  ];

  if (ctx.testId) parts.push(`test=${ctx.testId}`);
  if (ctx.sessionId) parts.push(`session=${ctx.sessionId.substring(0, 8)}`);
  if (ctx.parentObservationId) parts.push(`parent=${ctx.parentObservationId.substring(0, 8)}`);

  return `[${parts.join(', ')}]`;
}
