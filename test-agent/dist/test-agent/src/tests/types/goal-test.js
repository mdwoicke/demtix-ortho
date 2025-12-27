"use strict";
/**
 * Goal-Oriented Test Case Types
 *
 * Main interface for defining goal-based tests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRESET_CONSTRAINTS = exports.DEFAULT_RESPONSE_CONFIG = void 0;
exports.createGoalTest = createGoalTest;
/**
 * Default response configuration
 */
exports.DEFAULT_RESPONSE_CONFIG = {
    maxTurns: 25,
    useLlmResponses: false, // Use templates by default
    responseDelayMs: 0,
    handleUnknownIntents: 'clarify',
    llmTemperature: 0.7,
};
/**
 * Preset constraints for common validation needs
 */
exports.PRESET_CONSTRAINTS = {
    /** No error messages should appear */
    noErrors: () => ({
        type: 'must_not_happen',
        description: 'No error messages should appear in agent responses',
        condition: (ctx) => ctx.conversationHistory.some(t => t.role === 'assistant' && /\b(error|failed|problem|sorry.*trouble)\b/i.test(t.content)),
        severity: 'critical',
    }),
    /** No internal system information should be exposed */
    noInternalExposure: () => ({
        type: 'must_not_happen',
        description: 'No internal system information should be exposed',
        condition: (ctx) => ctx.conversationHistory.some(t => t.role === 'assistant' && (
        // Check for error-like patterns (not JSON values like ": null")
        /\b(exception|stack\s*trace|\[object\s*object\]|TypeError|ReferenceError|SyntaxError)\b/i.test(t.content) ||
            // Check for null/undefined in error contexts (not as JSON values)
            /(?<!["':])\s*\b(null|undefined)\b(?!\s*[,}\]])/i.test(t.content))),
        severity: 'critical',
    }),
    /** Agent should not repeat the same question */
    noRepetition: () => ({
        type: 'must_not_happen',
        description: 'Agent should not repeat the same question consecutively',
        severity: 'medium',
        // Evaluated by ProgressTracker
    }),
    /** Maximum turns constraint */
    maxTurns: (turns) => ({
        type: 'max_turns',
        description: `Conversation should complete within ${turns} turns`,
        maxTurns: turns,
        severity: 'high',
    }),
    /** Maximum time constraint */
    maxTime: (ms) => ({
        type: 'max_time',
        description: `Conversation should complete within ${ms / 1000} seconds`,
        maxTimeMs: ms,
        severity: 'medium',
    }),
};
/**
 * Helper to create a goal-oriented test case with defaults
 */
function createGoalTest(config) {
    return {
        description: config.description || config.name,
        category: config.category || 'happy-path',
        tags: config.tags || [],
        constraints: config.constraints || [
            exports.PRESET_CONSTRAINTS.noErrors(),
            exports.PRESET_CONSTRAINTS.noInternalExposure(),
        ],
        responseConfig: {
            ...exports.DEFAULT_RESPONSE_CONFIG,
            ...config.responseConfig,
        },
        dataRequirements: config.dataRequirements || [],
        ...config,
    };
}
//# sourceMappingURL=goal-test.js.map