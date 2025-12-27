/**
 * Response Generator Service
 *
 * Generates user responses based on agent intent and persona inventory.
 * Uses hybrid approach: templates by default when useLlm=false, LLM when useLlm=true.
 * LLM usage is controlled independently of persona verbosity level.
 */
import type { UserPersona } from '../tests/types/persona';
import type { IntentDetectionResult } from '../tests/types/intent';
import type { CollectableField } from '../tests/types/goals';
import type { ConversationTurn } from '../tests/test-case';
/**
 * Configuration for the response generator
 */
export interface ResponseGeneratorConfig {
    /** Use LLM for response generation */
    useLlm: boolean;
    /** Model for LLM generation */
    model: string;
    /** Temperature for LLM (higher = more creative) */
    temperature: number;
    /** Max tokens for response */
    maxTokens: number;
}
/**
 * Response Generator Service
 */
export declare class ResponseGenerator {
    private client;
    private config;
    private persona;
    private context;
    constructor(persona: UserPersona, cfg?: Partial<ResponseGeneratorConfig>);
    private initializeClient;
    /**
     * Generate a response to the agent's question
     */
    generateResponse(intent: IntentDetectionResult, conversationHistory: ConversationTurn[]): Promise<string>;
    /**
     * Determine if we should use LLM instead of template
     */
    private shouldUseLlm;
    /**
     * Get relevant data from persona inventory for an intent
     */
    private getDataForIntent;
    /**
     * Mark a field as provided
     */
    private markProvided;
    /**
     * Get fields that have been provided
     */
    getProvidedFields(): CollectableField[];
    /**
     * Generate response using template
     */
    private generateTemplateResponse;
    /**
     * Generate response using LLM
     */
    private generateLlmResponse;
    /**
     * Move to next child (for multi-child scenarios)
     */
    nextChild(): void;
    /**
     * Get current child index
     */
    getCurrentChildIndex(): number;
    /**
     * Reset for a new conversation
     */
    reset(): void;
}
//# sourceMappingURL=response-generator.d.ts.map