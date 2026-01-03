/**
 * Failure Classifier with Smart Retry Logic
 * Classifies test failures and determines appropriate retry strategies
 */

export type FailureType =
  | 'assertion'      // Deterministic failure - don't retry
  | 'timeout'        // API or execution timeout - retry with longer timeout
  | 'rate-limit'     // Rate limited - retry with backoff
  | 'network'        // Network error - retry with backoff
  | 'flaky'          // Intermittent failure - retry with backoff
  | 'state'          // State-dependent failure - may retry
  | 'unknown';       // Unknown - attempt retry once

export interface ClassificationResult {
  type: FailureType;
  shouldRetry: boolean;
  retryDelayMs: number;
  maxRetries: number;
  confidence: number;    // 0-1
  signals: string[];     // What patterns matched
  timeoutMultiplier?: number;  // For timeout failures
}

export interface FailureContext {
  testId: string;
  errorMessage?: string;
  errorStack?: string;
  transcript?: Array<{ role: string; content: string }>;
  durationMs?: number;
  apiCalls?: Array<{ status?: string; durationMs?: number }>;
  previousAttempts?: number;
  metadata?: Record<string, any>;
}

// Pattern definitions for failure classification
const FAILURE_PATTERNS: Array<{
  type: FailureType;
  patterns: RegExp[];
  weight: number;
}> = [
  {
    type: 'rate-limit',
    patterns: [
      /rate.?limit/i,
      /too many requests/i,
      /429/,
      /quota exceeded/i,
      /throttl/i
    ],
    weight: 1.0
  },
  {
    type: 'timeout',
    patterns: [
      /timeout/i,
      /timed out/i,
      /ETIMEDOUT/,
      /ESOCKETTIMEDOUT/,
      /deadline exceeded/i,
      /connection timed out/i
    ],
    weight: 0.9
  },
  {
    type: 'network',
    patterns: [
      /ECONNREFUSED/,
      /ECONNRESET/,
      /ENOTFOUND/,
      /network error/i,
      /fetch failed/i,
      /connection refused/i,
      /socket hang up/i,
      /EPROTO/,
      /certificate/i
    ],
    weight: 0.95
  },
  {
    type: 'assertion',
    patterns: [
      /expected.*but got/i,
      /assertion failed/i,
      /AssertionError/,
      /should (have|be|equal|match)/i,
      /goal not satisfied/i,
      /missing required/i,
      /incorrect response/i,
      /wrong (format|value|type)/i
    ],
    weight: 0.85
  },
  {
    type: 'state',
    patterns: [
      /session (not found|expired|invalid)/i,
      /state (mismatch|conflict)/i,
      /already (scheduled|exists|cancelled)/i,
      /concurrent modification/i,
      /stale/i
    ],
    weight: 0.8
  },
  {
    type: 'flaky',
    patterns: [
      /intermittent/i,
      /random/i,
      /race condition/i,
      /sometimes/i,
      /occasionally/i
    ],
    weight: 0.7
  }
];

// Retry strategies by failure type
const RETRY_STRATEGIES: Record<FailureType, {
  shouldRetry: boolean;
  baseDelayMs: number;
  maxRetries: number;
  backoffMultiplier: number;
  timeoutMultiplier?: number;
}> = {
  'assertion': {
    shouldRetry: false,
    baseDelayMs: 0,
    maxRetries: 0,
    backoffMultiplier: 1
  },
  'timeout': {
    shouldRetry: true,
    baseDelayMs: 2000,
    maxRetries: 2,
    backoffMultiplier: 1.5,
    timeoutMultiplier: 2.0
  },
  'rate-limit': {
    shouldRetry: true,
    baseDelayMs: 10000, // Start with 10s delay
    maxRetries: 3,
    backoffMultiplier: 3.0
  },
  'network': {
    shouldRetry: true,
    baseDelayMs: 3000,
    maxRetries: 3,
    backoffMultiplier: 2.0
  },
  'flaky': {
    shouldRetry: true,
    baseDelayMs: 1000,
    maxRetries: 2,
    backoffMultiplier: 1.5
  },
  'state': {
    shouldRetry: true,
    baseDelayMs: 2000,
    maxRetries: 1,
    backoffMultiplier: 1.0
  },
  'unknown': {
    shouldRetry: true,
    baseDelayMs: 2000,
    maxRetries: 1,
    backoffMultiplier: 2.0
  }
};

/**
 * Classify a test failure and determine retry strategy
 */
export function classifyFailure(context: FailureContext): ClassificationResult {
  const signals: string[] = [];
  let bestMatch: { type: FailureType; score: number } = { type: 'unknown', score: 0 };

  // Check error message against patterns
  const searchText = [
    context.errorMessage ?? '',
    context.errorStack ?? '',
    context.metadata?.lastError ?? ''
  ].join(' ');

  for (const pattern of FAILURE_PATTERNS) {
    for (const regex of pattern.patterns) {
      if (regex.test(searchText)) {
        const score = pattern.weight;
        signals.push(`${pattern.type}:${regex.source}`);

        if (score > bestMatch.score) {
          bestMatch = { type: pattern.type, score };
        }
      }
    }
  }

  // Additional heuristics

  // Long duration with no result often indicates timeout
  if (!bestMatch.score && context.durationMs && context.durationMs > 60000) {
    signals.push('duration>60s');
    if (bestMatch.score < 0.5) {
      bestMatch = { type: 'timeout', score: 0.6 };
    }
  }

  // Failed API calls indicate network issues
  const failedApiCalls = context.apiCalls?.filter(c => c.status && c.status !== 'success') ?? [];
  if (failedApiCalls.length > 0 && bestMatch.score < 0.7) {
    signals.push(`failedApiCalls:${failedApiCalls.length}`);
    if (bestMatch.score < 0.5) {
      bestMatch = { type: 'network', score: 0.6 };
    }
  }

  // Transcript patterns for flaky detection
  if (context.transcript && context.transcript.length > 0) {
    // Check for conversation loops (same message repeated)
    const messages = context.transcript.map(t => t.content);
    const repeated = messages.filter((m, i) => messages.indexOf(m) !== i);
    if (repeated.length > 2) {
      signals.push('conversation-loop');
      if (bestMatch.type === 'unknown') {
        bestMatch = { type: 'flaky', score: 0.5 };
      }
    }
  }

  const strategy = RETRY_STRATEGIES[bestMatch.type];
  const attemptNumber = (context.previousAttempts ?? 0) + 1;

  // Calculate delay with exponential backoff
  const retryDelay = strategy.shouldRetry
    ? Math.round(strategy.baseDelayMs * Math.pow(strategy.backoffMultiplier, context.previousAttempts ?? 0))
    : 0;

  return {
    type: bestMatch.type,
    shouldRetry: strategy.shouldRetry && attemptNumber <= strategy.maxRetries,
    retryDelayMs: retryDelay,
    maxRetries: strategy.maxRetries,
    confidence: bestMatch.score || 0.3,
    signals,
    timeoutMultiplier: strategy.timeoutMultiplier
  };
}

/**
 * Determine if a test should be retried based on classification
 */
export function shouldRetryTest(context: FailureContext): {
  shouldRetry: boolean;
  delayMs: number;
  reason: string;
} {
  const classification = classifyFailure(context);

  if (!classification.shouldRetry) {
    return {
      shouldRetry: false,
      delayMs: 0,
      reason: `${classification.type} failure - no retry (${classification.signals.join(', ')})`
    };
  }

  return {
    shouldRetry: true,
    delayMs: classification.retryDelayMs,
    reason: `${classification.type} failure - retry in ${classification.retryDelayMs}ms`
  };
}

/**
 * Sleep for specified duration (for retry delays)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with smart failure handling
 */
export async function retryWithClassification<T>(
  fn: () => Promise<T>,
  options: {
    testId: string;
    maxRetries?: number;
    onRetry?: (attempt: number, error: Error, classification: ClassificationResult) => void;
  }
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const classification = classifyFailure({
        testId: options.testId,
        errorMessage: lastError.message,
        errorStack: lastError.stack,
        previousAttempts: attempt
      });

      if (!classification.shouldRetry || attempt >= maxRetries) {
        throw lastError;
      }

      attempt++;
      options.onRetry?.(attempt, lastError, classification);

      await sleep(classification.retryDelayMs);
    }
  }

  throw lastError!;
}

/**
 * Calculate flaky score based on failure history
 */
export function calculateFlakyScore(
  recentResults: Array<{ status: 'passed' | 'failed' | 'error' }>
): number {
  if (recentResults.length < 2) {
    return 0;
  }

  let transitions = 0;
  for (let i = 1; i < recentResults.length; i++) {
    const prev = recentResults[i - 1].status === 'passed';
    const curr = recentResults[i].status === 'passed';
    if (prev !== curr) {
      transitions++;
    }
  }

  // More transitions = more flaky
  // Max score when transitions = results - 1 (alternating)
  return transitions / (recentResults.length - 1);
}

