/**
 * Failure Fingerprinting System
 * Generates unique fingerprints for test failures to enable deduplication and clustering
 */

import * as crypto from 'crypto';

export interface FailureFingerprint {
  fingerprintId: string;
  hash: string;
  components: FingerprintComponents;
  firstSeen: Date;
  lastSeen: Date;
  occurrenceCount: number;
  clusterId?: string;
  testIds: string[];
}

export interface FingerprintComponents {
  terminalState: string;           // How the conversation ended
  lastIntents: string[];           // Last 3 intents
  missingGoalTypes: string[];      // Types of goals not satisfied
  errorSignature?: string;         // Normalized error pattern
  failureType: string;             // Categorized failure type
  turnCount: number;               // Approximate turn count bucket
  hasToolFailure: boolean;         // Any tool call failed
  hasApiError: boolean;            // Any API error
}

export interface TestFailureContext {
  testId: string;
  testName: string;
  category: string;
  status: 'failed' | 'error';
  errorMessage?: string;
  transcript?: Array<{
    role: string;
    content: string;
    intent?: string;
    toolCalls?: any[];
  }>;
  goals?: Array<{
    id: string;
    type: string;
    satisfied: boolean;
  }>;
  apiCalls?: Array<{
    status: string;
    error?: string;
  }>;
  durationMs?: number;
}

/**
 * Extract fingerprint components from a test failure
 */
function extractComponents(context: TestFailureContext): FingerprintComponents {
  const transcript = context.transcript ?? [];
  const goals = context.goals ?? [];
  const apiCalls = context.apiCalls ?? [];

  // Get last 3 intents
  const intents = transcript
    .filter(t => t.intent)
    .map(t => t.intent!)
    .slice(-3);

  // Get missing goal types
  const missingGoalTypes = goals
    .filter(g => !g.satisfied)
    .map(g => g.type)
    .filter((v, i, a) => a.indexOf(v) === i); // Unique

  // Determine terminal state
  let terminalState = 'unknown';
  if (transcript.length > 0) {
    const lastTurn = transcript[transcript.length - 1];
    if (lastTurn.role === 'assistant') {
      terminalState = classifyBotResponse(lastTurn.content);
    } else {
      terminalState = 'user-message';
    }
  }

  // Normalize error signature
  const errorSignature = context.errorMessage
    ? normalizeError(context.errorMessage)
    : undefined;

  // Classify failure type
  const failureType = classifyFailureType(context);

  // Bucket turn count (0-5, 6-10, 11-15, 16-20, 21+)
  const turnBucket = Math.min(Math.floor(transcript.length / 5) * 5, 20);

  // Check for tool/API failures
  const hasToolFailure = transcript.some(t =>
    t.toolCalls?.some((tc: any) => tc.error)
  );
  const hasApiError = apiCalls.some(a => a.error || a.status === 'error');

  return {
    terminalState,
    lastIntents: intents,
    missingGoalTypes,
    errorSignature,
    failureType,
    turnCount: turnBucket,
    hasToolFailure,
    hasApiError
  };
}

/**
 * Classify how the bot responded at end of conversation
 */
function classifyBotResponse(content: string): string {
  const lower = content.toLowerCase();

  if (lower.includes('sorry') || lower.includes('cannot')) {
    return 'apology';
  }
  if (lower.includes('scheduled') || lower.includes('appointment')) {
    return 'scheduling-response';
  }
  if (lower.includes('transfer') || lower.includes('connect')) {
    return 'transfer';
  }
  if (lower.includes('help') || lower.includes('assist')) {
    return 'offer-help';
  }
  if (lower.includes('?')) {
    return 'question';
  }
  return 'statement';
}

/**
 * Normalize error message to a signature
 */
function normalizeError(error: string): string {
  return error
    // Remove specific values
    .replace(/\d{4}-\d{2}-\d{2}/g, 'DATE')
    .replace(/\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?/gi, 'TIME')
    .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID')
    .replace(/\d+/g, 'N')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 200); // Limit length
}

/**
 * Classify the type of failure
 */
function classifyFailureType(context: TestFailureContext): string {
  const error = context.errorMessage?.toLowerCase() ?? '';
  const transcript = context.transcript ?? [];

  // Check error patterns
  if (error.includes('timeout') || error.includes('timed out')) {
    return 'timeout';
  }
  if (error.includes('rate limit') || error.includes('429')) {
    return 'rate-limit';
  }
  if (error.includes('network') || error.includes('connection')) {
    return 'network';
  }

  // Check conversation patterns
  const intents = transcript
    .filter(t => t.intent)
    .map(t => t.intent!);

  // Intent loop
  if (intents.length >= 3) {
    const last3 = intents.slice(-3);
    if (last3.every(i => i === last3[0])) {
      return 'intent-loop';
    }
  }

  // Check goals
  const goals = context.goals ?? [];
  const satisfiedCount = goals.filter(g => g.satisfied).length;

  if (satisfiedCount === 0) {
    return 'no-progress';
  }
  if (satisfiedCount < goals.length * 0.5) {
    return 'partial-progress';
  }

  // Default
  return 'assertion-failure';
}

/**
 * Generate a hash from fingerprint components
 */
function hashComponents(components: FingerprintComponents): string {
  const normalized = {
    ts: components.terminalState,
    li: components.lastIntents.sort(),
    mg: components.missingGoalTypes.sort(),
    es: components.errorSignature ?? '',
    ft: components.failureType,
    tc: components.turnCount,
    tf: components.hasToolFailure,
    ae: components.hasApiError
  };

  const json = JSON.stringify(normalized);
  return crypto.createHash('sha256').update(json).digest('hex').slice(0, 16);
}

/**
 * Generate a fingerprint ID
 */
function generateFingerprintId(): string {
  return `fp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a fingerprint for a test failure
 */
export function createFingerprint(context: TestFailureContext): FailureFingerprint {
  const components = extractComponents(context);
  const hash = hashComponents(components);

  return {
    fingerprintId: generateFingerprintId(),
    hash,
    components,
    firstSeen: new Date(),
    lastSeen: new Date(),
    occurrenceCount: 1,
    testIds: [context.testId]
  };
}

/**
 * Calculate similarity between two fingerprints (0-1)
 */
export function calculateSimilarity(fp1: FingerprintComponents, fp2: FingerprintComponents): number {
  let score = 0;
  let weights = 0;

  // Terminal state match (weight: 2)
  if (fp1.terminalState === fp2.terminalState) {
    score += 2;
  }
  weights += 2;

  // Failure type match (weight: 3)
  if (fp1.failureType === fp2.failureType) {
    score += 3;
  }
  weights += 3;

  // Intent overlap (weight: 2)
  const intentOverlap = fp1.lastIntents.filter(i => fp2.lastIntents.includes(i)).length;
  const intentTotal = Math.max(fp1.lastIntents.length, fp2.lastIntents.length, 1);
  score += (intentOverlap / intentTotal) * 2;
  weights += 2;

  // Missing goal overlap (weight: 2)
  const goalOverlap = fp1.missingGoalTypes.filter(g => fp2.missingGoalTypes.includes(g)).length;
  const goalTotal = Math.max(fp1.missingGoalTypes.length, fp2.missingGoalTypes.length, 1);
  score += (goalOverlap / goalTotal) * 2;
  weights += 2;

  // Error signature similarity (weight: 1)
  if (fp1.errorSignature && fp2.errorSignature) {
    if (fp1.errorSignature === fp2.errorSignature) {
      score += 1;
    } else {
      // Partial match using Jaccard similarity on words
      const words1 = new Set(fp1.errorSignature.split(' '));
      const words2 = new Set(fp2.errorSignature.split(' '));
      const intersection = [...words1].filter(w => words2.has(w)).length;
      const union = new Set([...words1, ...words2]).size;
      score += (intersection / Math.max(union, 1)) * 1;
    }
  }
  weights += 1;

  // Turn count proximity (weight: 1)
  const turnDiff = Math.abs(fp1.turnCount - fp2.turnCount);
  score += Math.max(0, 1 - turnDiff / 20);
  weights += 1;

  // Tool/API failure flags (weight: 0.5 each)
  if (fp1.hasToolFailure === fp2.hasToolFailure) score += 0.5;
  if (fp1.hasApiError === fp2.hasApiError) score += 0.5;
  weights += 1;

  return score / weights;
}

/**
 * Fingerprint store for tracking failures across runs
 */
export class FingerprintStore {
  private fingerprints: Map<string, FailureFingerprint> = new Map();

  /**
   * Add or update a fingerprint
   */
  add(context: TestFailureContext): {
    fingerprint: FailureFingerprint;
    isNew: boolean;
    matchedHash: string | null;
  } {
    const newFp = createFingerprint(context);

    // Check for exact hash match
    for (const [hash, existing] of this.fingerprints) {
      if (existing.hash === newFp.hash) {
        // Update existing
        existing.lastSeen = new Date();
        existing.occurrenceCount++;
        if (!existing.testIds.includes(context.testId)) {
          existing.testIds.push(context.testId);
        }
        return { fingerprint: existing, isNew: false, matchedHash: hash };
      }
    }

    // Check for similar fingerprints (>0.8 similarity)
    for (const [hash, existing] of this.fingerprints) {
      const similarity = calculateSimilarity(newFp.components, existing.components);
      if (similarity >= 0.8) {
        // Update existing
        existing.lastSeen = new Date();
        existing.occurrenceCount++;
        if (!existing.testIds.includes(context.testId)) {
          existing.testIds.push(context.testId);
        }
        return { fingerprint: existing, isNew: false, matchedHash: hash };
      }
    }

    // Add new fingerprint
    this.fingerprints.set(newFp.hash, newFp);
    return { fingerprint: newFp, isNew: true, matchedHash: null };
  }

  /**
   * Get fingerprint by hash
   */
  get(hash: string): FailureFingerprint | undefined {
    return this.fingerprints.get(hash);
  }

  /**
   * Get all fingerprints
   */
  getAll(): FailureFingerprint[] {
    return Array.from(this.fingerprints.values());
  }

  /**
   * Get fingerprints sorted by occurrence count
   */
  getMostFrequent(limit: number = 10): FailureFingerprint[] {
    return this.getAll()
      .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
      .slice(0, limit);
  }

  /**
   * Get fingerprints that appeared in recent time window
   */
  getRecent(windowMs: number = 3600000): FailureFingerprint[] {
    const cutoff = new Date(Date.now() - windowMs);
    return this.getAll().filter(fp => fp.lastSeen >= cutoff);
  }

  /**
   * Clear all fingerprints
   */
  clear(): void {
    this.fingerprints.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalFingerprints: number;
    totalOccurrences: number;
    typeDistribution: Record<string, number>;
    averageOccurrences: number;
  } {
    const fps = this.getAll();
    const totalOccurrences = fps.reduce((sum, fp) => sum + fp.occurrenceCount, 0);

    const typeDistribution: Record<string, number> = {};
    for (const fp of fps) {
      const type = fp.components.failureType;
      typeDistribution[type] = (typeDistribution[type] ?? 0) + 1;
    }

    return {
      totalFingerprints: fps.length,
      totalOccurrences,
      typeDistribution,
      averageOccurrences: fps.length > 0 ? totalOccurrences / fps.length : 0
    };
  }
}

// Export singleton store
let defaultStore: FingerprintStore | null = null;

export function getDefaultStore(): FingerprintStore {
  if (!defaultStore) {
    defaultStore = new FingerprintStore();
  }
  return defaultStore;
}

export function setDefaultStore(store: FingerprintStore): void {
  defaultStore = store;
}
