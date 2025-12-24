/**
 * Zod Schemas for AI-Powered Test Evaluation
 *
 * These schemas define structured outputs for LLM-based semantic evaluation,
 * replacing brittle regex patterns with type-safe, validated responses.
 */

import { z } from 'zod';

// =============================================================================
// Response Quality Evaluation
// =============================================================================

/**
 * Evaluates the quality of an assistant response
 */
export const ResponseQualitySchema = z.object({
  /** Whether the response is helpful to the user */
  isHelpful: z.boolean(),
  /** Whether the response stays on topic */
  isOnTopic: z.boolean(),
  /** Whether an error was detected in the response */
  hasError: z.boolean(),
  /** Type of error if detected */
  errorType: z.enum(['technical', 'timeout', 'unclear', 'none']).default('none'),
  /** Level of uncertainty expressed in the response */
  uncertaintyLevel: z.enum(['none', 'low', 'medium', 'high']),
  /** Whether the response maintains professional tone */
  professionalTone: z.boolean(),
  /** Confidence score for this evaluation (0-1) */
  confidence: z.number().min(0).max(1),
  /** Explanation of the evaluation reasoning */
  reasoning: z.string(),
});

export type ResponseQuality = z.infer<typeof ResponseQualitySchema>;

// =============================================================================
// Intent Classification
// =============================================================================

/**
 * Classifies the primary intent of a message
 */
export const IntentClassificationSchema = z.object({
  /** The primary detected intent */
  primaryIntent: z.enum([
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
  secondaryIntents: z.array(z.string()).optional(),
  /** Confidence score for intent classification (0-1) */
  confidence: z.number().min(0).max(1),
  /** Entities extracted from the message (name, date, etc.) */
  extractedEntities: z.record(z.string()).optional(),
});

export type IntentClassification = z.infer<typeof IntentClassificationSchema>;

// =============================================================================
// Conversation Flow State
// =============================================================================

/**
 * Tracks the current state of the conversation flow
 */
export const ConversationFlowSchema = z.object({
  /** Current state in the conversation flow */
  flowState: z.enum([
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
  isProgressingCorrectly: z.boolean(),
  /** Whether the conversation appears stuck */
  isStuck: z.boolean(),
  /** Whether the assistant is repeating itself */
  isRepeating: z.boolean(),
  /** Information still needed from the caller */
  missingInformation: z.array(z.string()),
  /** Confidence score for flow state detection (0-1) */
  confidence: z.number().min(0).max(1),
});

export type ConversationFlow = z.infer<typeof ConversationFlowSchema>;

// =============================================================================
// Step Validation Result
// =============================================================================

/**
 * Result of validating a single conversation step
 */
export const StepValidationSchema = z.object({
  /** Whether the step passed validation */
  passed: z.boolean(),
  /** Expectations that were met */
  matchedExpectations: z.array(z.string()),
  /** Expectations that were not met */
  unmatchedExpectations: z.array(z.string()),
  /** Unexpected behaviors detected */
  unexpectedBehaviors: z.array(z.string()),
  /** Severity of any issues found */
  severity: z.enum(['none', 'low', 'medium', 'high', 'critical']),
  /** Confidence score for this validation (0-1) */
  confidence: z.number().min(0).max(1),
  /** Explanation of the validation reasoning */
  reasoning: z.string(),
  /** Suggested action if validation failed */
  suggestedAction: z.string().optional(),
});

export type StepValidation = z.infer<typeof StepValidationSchema>;

// =============================================================================
// Combined Semantic Evaluation
// =============================================================================

/**
 * Complete semantic evaluation for a conversation step
 */
export const SemanticEvaluationSchema = z.object({
  /** Unique identifier for the step being evaluated */
  stepId: z.string(),
  /** Quality assessment of the response */
  responseQuality: ResponseQualitySchema,
  /** Intent classification of the response */
  intent: IntentClassificationSchema,
  /** Conversation flow state */
  flowState: ConversationFlowSchema,
  /** Validation result against expectations */
  validation: StepValidationSchema,
  /** Timestamp of evaluation */
  timestamp: z.string(),
  /** Time taken for evaluation in milliseconds */
  evaluationTimeMs: z.number(),
  /** Whether this was a fallback (regex) evaluation */
  isFallback: z.boolean().optional(),
});

export type SemanticEvaluation = z.infer<typeof SemanticEvaluationSchema>;

// =============================================================================
// Semantic Expectation Types (for test definitions)
// =============================================================================

/**
 * Semantic expectation types (replaces regex patterns in test definitions)
 */
export const SemanticExpectationTypeSchema = z.enum([
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

export type SemanticExpectationType = z.infer<typeof SemanticExpectationTypeSchema>;

/**
 * A semantic expectation for test validation
 */
export const SemanticExpectationSchema = z.object({
  /** Type of semantic expectation */
  type: SemanticExpectationTypeSchema,
  /** Human-readable description of what is expected */
  description: z.string().optional(),
  /** Whether this expectation is required to pass */
  required: z.boolean().default(true),
  /** Weight for scoring (0-1) */
  weight: z.number().min(0).max(1).default(1),
  /** Custom criteria for 'custom' type */
  customCriteria: z.string().optional(),
});

// Use z.input to allow omitting fields with defaults
export type SemanticExpectation = z.input<typeof SemanticExpectationSchema>;

/**
 * Negative expectation types (things that should NOT happen)
 */
export const NegativeExpectationTypeSchema = z.enum([
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

export type NegativeExpectationType = z.infer<typeof NegativeExpectationTypeSchema>;

/**
 * A negative expectation (what should NOT happen)
 */
export const NegativeExpectationSchema = z.object({
  /** Type of negative expectation */
  type: NegativeExpectationTypeSchema,
  /** Human-readable description */
  description: z.string().optional(),
  /** Severity if this expectation is violated */
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  /** Custom criteria for 'custom' type */
  customCriteria: z.string().optional(),
});

// Use z.input to allow omitting fields with defaults
export type NegativeExpectation = z.input<typeof NegativeExpectationSchema>;

// =============================================================================
// Batch Evaluation Request/Response
// =============================================================================

/**
 * Context for evaluating a single step
 */
export const EvaluationContextSchema = z.object({
  stepId: z.string(),
  stepDescription: z.string().optional(),
  userMessage: z.string(),
  assistantResponse: z.string(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })),
  expectedBehaviors: z.array(z.string()),
  unexpectedBehaviors: z.array(z.string()),
  semanticExpectations: z.array(SemanticExpectationSchema).optional(),
  negativeExpectations: z.array(NegativeExpectationSchema).optional(),
});

export type EvaluationContext = z.infer<typeof EvaluationContextSchema>;

/**
 * Batch evaluation request
 */
export const BatchEvaluationRequestSchema = z.object({
  testId: z.string(),
  steps: z.array(EvaluationContextSchema),
});

export type BatchEvaluationRequest = z.infer<typeof BatchEvaluationRequestSchema>;

/**
 * Batch evaluation response
 */
export const BatchEvaluationResponseSchema = z.object({
  testId: z.string(),
  evaluations: z.array(SemanticEvaluationSchema),
  totalTimeMs: z.number(),
  tokensUsed: z.number().optional(),
});

export type BatchEvaluationResponse = z.infer<typeof BatchEvaluationResponseSchema>;
