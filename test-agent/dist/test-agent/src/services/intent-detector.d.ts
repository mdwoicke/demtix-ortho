/**
 * Intent Detector Service
 *
 * Uses LLM to detect what the agent is asking for from its response.
 * Falls back to keyword-based detection when LLM is unavailable.
 */
import { IntentDetectionResult } from '../tests/types/intent';
import type { CollectableField } from '../tests/types/goals';
import type { ConversationTurn } from '../tests/test-case';
/**
 * Configuration for the intent detector
 */
export interface IntentDetectorConfig {
    /** Whether to use LLM for detection */
    useLlm: boolean;
    /** Model to use for detection */
    model: string;
    /** Temperature for detection (lower = more deterministic) */
    temperature: number;
    /** Max tokens for response */
    maxTokens: number;
    /** Timeout in ms */
    timeout: number;
    /** Whether to cache results */
    cacheEnabled: boolean;
    /** Cache TTL in ms */
    cacheTtlMs: number;
}
/**
 * Intent Detector Service
 *
 * Analyzes agent responses to determine what information they're asking for.
 */
export declare class IntentDetector {
    private llmProvider;
    private detectorConfig;
    private cache;
    constructor(cfg?: Partial<IntentDetectorConfig>);
    /**
     * Check if LLM-based detection is available
     */
    isLlmAvailable(): Promise<boolean>;
    /**
     * Detect the intent from an agent response
     */
    detectIntent(agentResponse: string, conversationHistory: ConversationTurn[], pendingFields?: CollectableField[]): Promise<IntentDetectionResult>;
    /**
     * Detect intent using LLM
     */
    private detectWithLlm;
    /**
     * Build the prompt for intent detection
     */
    private buildPrompt;
    /**
     * Parse LLM response into IntentDetectionResult
     */
    private parseResponse;
    /**
     * Detect intent using keyword matching
     */
    private detectWithKeywords;
    /**
     * Generate cache key
     */
    private getCacheKey;
    /**
     * Get from cache if valid
     */
    private getFromCache;
    /**
     * Save to cache
     */
    private saveToCache;
    /**
     * Clean expired cache entries
     */
    private cleanCache;
    /**
     * Clear the cache
     */
    clearCache(): void;
}
export declare function getIntentDetector(): IntentDetector;
//# sourceMappingURL=intent-detector.d.ts.map