/**
 * Semantic Evaluator Service
 *
 * Uses Claude API to perform semantic analysis of chatbot responses,
 * replacing brittle regex patterns with AI-powered understanding.
 *
 * Modes:
 * - real-time: Evaluate each step immediately (highest accuracy, highest cost)
 * - batch: Evaluate all steps after test completes (balanced)
 * - failures-only: Only use LLM for failed tests (lowest cost)
 */
import { SemanticEvaluation, EvaluationContext } from '../schemas/evaluation-schemas';
export interface EvaluatorConfig {
    enabled: boolean;
    mode: 'realtime' | 'batch' | 'failures-only';
    fallbackToRegex: boolean;
    cacheEnabled: boolean;
    cacheTTLMs: number;
    minConfidenceThreshold: number;
    batchSize: number;
    timeout: number;
}
export declare class SemanticEvaluator {
    private client;
    private cache;
    private config;
    constructor(evaluatorConfig?: Partial<EvaluatorConfig>);
    private initializeClient;
    /**
     * Check if LLM-based evaluation is available
     */
    isAvailable(): boolean;
    /**
     * Get the current evaluation mode
     */
    getMode(): 'realtime' | 'batch' | 'failures-only';
    /**
     * Evaluate a single conversation step
     */
    evaluateStep(context: EvaluationContext): Promise<SemanticEvaluation>;
    /**
     * Evaluate multiple steps in a batch (more efficient)
     */
    evaluateBatch(contexts: EvaluationContext[]): Promise<SemanticEvaluation[]>;
    private evaluateBatchInternal;
    /**
     * Build the evaluation prompt for a single step
     */
    private buildEvaluationPrompt;
    /**
     * Build a batch prompt for multiple steps
     */
    private buildBatchPrompt;
    /**
     * Parse and validate LLM response for single step
     */
    private parseAndValidate;
    /**
     * Parse batch response
     */
    private parseBatchResponse;
    /**
     * Fallback evaluation using regex patterns (when LLM unavailable)
     */
    private fallbackEvaluation;
    /**
     * Generate cache key from context
     */
    private getCacheKey;
    /**
     * Get cached evaluation if available and not expired
     */
    private getCachedEvaluation;
    /**
     * Cache an evaluation result
     */
    private cacheEvaluation;
    /**
     * Clear the evaluation cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        enabled: boolean;
    };
}
export declare const semanticEvaluator: SemanticEvaluator;
//# sourceMappingURL=semantic-evaluator.d.ts.map