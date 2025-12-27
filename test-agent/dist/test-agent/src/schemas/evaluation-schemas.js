"use strict";
/**
 * Zod Schemas for AI-Powered Test Evaluation
 *
 * These schemas define structured outputs for LLM-based semantic evaluation,
 * replacing brittle regex patterns with type-safe, validated responses.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchEvaluationResponseSchema = exports.BatchEvaluationRequestSchema = exports.EvaluationContextSchema = exports.NegativeExpectationSchema = exports.NegativeExpectationTypeSchema = exports.SemanticExpectationSchema = exports.SemanticExpectationTypeSchema = exports.SemanticEvaluationSchema = exports.StepValidationSchema = exports.ConversationFlowSchema = exports.IntentClassificationSchema = exports.ResponseQualitySchema = void 0;
const zod_1 = require("zod");
// =============================================================================
// Response Quality Evaluation
// =============================================================================
/**
 * Evaluates the quality of an assistant response
 */
exports.ResponseQualitySchema = zod_1.z.object({
    /** Whether the response is helpful to the user */
    isHelpful: zod_1.z.boolean(),
    /** Whether the response stays on topic */
    isOnTopic: zod_1.z.boolean(),
    /** Whether an error was detected in the response */
    hasError: zod_1.z.boolean(),
    /** Type of error if detected */
    errorType: zod_1.z.enum(['technical', 'timeout', 'unclear', 'none']).default('none'),
    /** Level of uncertainty expressed in the response */
    uncertaintyLevel: zod_1.z.enum(['none', 'low', 'medium', 'high']),
    /** Whether the response maintains professional tone */
    professionalTone: zod_1.z.boolean(),
    /** Confidence score for this evaluation (0-1) */
    confidence: zod_1.z.number().min(0).max(1),
    /** Explanation of the evaluation reasoning */
    reasoning: zod_1.z.string(),
});
// =============================================================================
// Intent Classification
// =============================================================================
/**
 * Classifies the primary intent of a message
 */
exports.IntentClassificationSchema = zod_1.z.object({
    /** The primary detected intent */
    primaryIntent: zod_1.z.enum([
        'greeting',
        'schedule_appointment',
        'cancel_appointment',
        'reschedule',
        'ask_question',
        'provide_information',
        'confirmation',
        'rejection',
        'unclear',
        'farewell',
        'transfer_request',
        'complaint',
        'thanks',
    ]),
    /** Any secondary intents detected */
    secondaryIntents: zod_1.z.array(zod_1.z.string()).optional(),
    /** Confidence score for intent classification (0-1) */
    confidence: zod_1.z.number().min(0).max(1),
    /** Entities extracted from the message (name, date, etc.) */
    extractedEntities: zod_1.z.record(zod_1.z.string()).optional(),
});
// =============================================================================
// Conversation Flow State
// =============================================================================
/**
 * Tracks the current state of the conversation flow
 */
exports.ConversationFlowSchema = zod_1.z.object({
    /** Current state in the conversation flow */
    flowState: zod_1.z.enum([
        'greeting',
        'collecting_parent_info',
        'collecting_child_info',
        'checking_previous_visits',
        'checking_insurance',
        'checking_special_needs',
        'collecting_preferences',
        'searching_availability',
        'presenting_options',
        'scheduling',
        'confirming',
        'closing',
        'error_recovery',
        'transfer_requested',
        'off_topic',
    ]),
    /** Whether the conversation is progressing as expected */
    isProgressingCorrectly: zod_1.z.boolean(),
    /** Whether the conversation appears stuck */
    isStuck: zod_1.z.boolean(),
    /** Whether the assistant is repeating itself */
    isRepeating: zod_1.z.boolean(),
    /** Information still needed from the caller */
    missingInformation: zod_1.z.array(zod_1.z.string()),
    /** Confidence score for flow state detection (0-1) */
    confidence: zod_1.z.number().min(0).max(1),
});
// =============================================================================
// Step Validation Result
// =============================================================================
/**
 * Result of validating a single conversation step
 */
exports.StepValidationSchema = zod_1.z.object({
    /** Whether the step passed validation */
    passed: zod_1.z.boolean(),
    /** Expectations that were met */
    matchedExpectations: zod_1.z.array(zod_1.z.string()),
    /** Expectations that were not met */
    unmatchedExpectations: zod_1.z.array(zod_1.z.string()),
    /** Unexpected behaviors detected */
    unexpectedBehaviors: zod_1.z.array(zod_1.z.string()),
    /** Severity of any issues found */
    severity: zod_1.z.enum(['none', 'low', 'medium', 'high', 'critical']),
    /** Confidence score for this validation (0-1) */
    confidence: zod_1.z.number().min(0).max(1),
    /** Explanation of the validation reasoning */
    reasoning: zod_1.z.string(),
    /** Suggested action if validation failed */
    suggestedAction: zod_1.z.string().optional(),
});
// =============================================================================
// Combined Semantic Evaluation
// =============================================================================
/**
 * Complete semantic evaluation for a conversation step
 */
exports.SemanticEvaluationSchema = zod_1.z.object({
    /** Unique identifier for the step being evaluated */
    stepId: zod_1.z.string(),
    /** Quality assessment of the response */
    responseQuality: exports.ResponseQualitySchema,
    /** Intent classification of the response */
    intent: exports.IntentClassificationSchema,
    /** Conversation flow state */
    flowState: exports.ConversationFlowSchema,
    /** Validation result against expectations */
    validation: exports.StepValidationSchema,
    /** Timestamp of evaluation */
    timestamp: zod_1.z.string(),
    /** Time taken for evaluation in milliseconds */
    evaluationTimeMs: zod_1.z.number(),
    /** Whether this was a fallback (regex) evaluation */
    isFallback: zod_1.z.boolean().optional(),
});
// =============================================================================
// Semantic Expectation Types (for test definitions)
// =============================================================================
/**
 * Semantic expectation types (replaces regex patterns in test definitions)
 */
exports.SemanticExpectationTypeSchema = zod_1.z.enum([
    'contains_greeting',
    'asks_for_name',
    'asks_for_info',
    'confirms_info',
    'confirms_booking',
    'offers_options',
    'offers_times',
    'acknowledges_input',
    'provides_availability',
    'handles_error',
    'transfers_to_agent',
    'asks_for_spelling',
    'asks_for_dob',
    'asks_for_insurance',
    'asks_for_email',
    'asks_about_previous_visits',
    'asks_about_special_needs',
    'mentions_location',
    'provides_instructions',
    'says_goodbye',
    'custom',
]);
/**
 * A semantic expectation for test validation
 */
exports.SemanticExpectationSchema = zod_1.z.object({
    /** Type of semantic expectation */
    type: exports.SemanticExpectationTypeSchema,
    /** Human-readable description of what is expected */
    description: zod_1.z.string().optional(),
    /** Whether this expectation is required to pass */
    required: zod_1.z.boolean().default(true),
    /** Weight for scoring (0-1) */
    weight: zod_1.z.number().min(0).max(1).default(1),
    /** Custom criteria for 'custom' type */
    customCriteria: zod_1.z.string().optional(),
});
/**
 * Negative expectation types (things that should NOT happen)
 */
exports.NegativeExpectationTypeSchema = zod_1.z.enum([
    'contains_error',
    'exposes_internal',
    'contradicts_previous',
    'ignores_input',
    'repeats_verbatim',
    'hallucinates_data',
    'uses_banned_words',
    'wrong_language',
    'inappropriate_tone',
    'reveals_system_info',
    'custom',
]);
/**
 * A negative expectation (what should NOT happen)
 */
exports.NegativeExpectationSchema = zod_1.z.object({
    /** Type of negative expectation */
    type: exports.NegativeExpectationTypeSchema,
    /** Human-readable description */
    description: zod_1.z.string().optional(),
    /** Severity if this expectation is violated */
    severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
    /** Custom criteria for 'custom' type */
    customCriteria: zod_1.z.string().optional(),
});
// =============================================================================
// Batch Evaluation Request/Response
// =============================================================================
/**
 * Context for evaluating a single step
 */
exports.EvaluationContextSchema = zod_1.z.object({
    stepId: zod_1.z.string(),
    stepDescription: zod_1.z.string().optional(),
    userMessage: zod_1.z.string(),
    assistantResponse: zod_1.z.string(),
    conversationHistory: zod_1.z.array(zod_1.z.object({
        role: zod_1.z.enum(['user', 'assistant', 'system']),
        content: zod_1.z.string(),
    })),
    expectedBehaviors: zod_1.z.array(zod_1.z.string()),
    unexpectedBehaviors: zod_1.z.array(zod_1.z.string()),
    semanticExpectations: zod_1.z.array(exports.SemanticExpectationSchema).optional(),
    negativeExpectations: zod_1.z.array(exports.NegativeExpectationSchema).optional(),
});
/**
 * Batch evaluation request
 */
exports.BatchEvaluationRequestSchema = zod_1.z.object({
    testId: zod_1.z.string(),
    steps: zod_1.z.array(exports.EvaluationContextSchema),
});
/**
 * Batch evaluation response
 */
exports.BatchEvaluationResponseSchema = zod_1.z.object({
    testId: zod_1.z.string(),
    evaluations: zod_1.z.array(exports.SemanticEvaluationSchema),
    totalTimeMs: zod_1.z.number(),
    tokensUsed: zod_1.z.number().optional(),
});
//# sourceMappingURL=evaluation-schemas.js.map