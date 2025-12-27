/**
 * Zod Schemas for AI-Powered Test Evaluation
 *
 * These schemas define structured outputs for LLM-based semantic evaluation,
 * replacing brittle regex patterns with type-safe, validated responses.
 */
import { z } from 'zod';
/**
 * Evaluates the quality of an assistant response
 */
export declare const ResponseQualitySchema: z.ZodObject<{
    /** Whether the response is helpful to the user */
    isHelpful: z.ZodBoolean;
    /** Whether the response stays on topic */
    isOnTopic: z.ZodBoolean;
    /** Whether an error was detected in the response */
    hasError: z.ZodBoolean;
    /** Type of error if detected */
    errorType: z.ZodDefault<z.ZodEnum<["technical", "timeout", "unclear", "none"]>>;
    /** Level of uncertainty expressed in the response */
    uncertaintyLevel: z.ZodEnum<["none", "low", "medium", "high"]>;
    /** Whether the response maintains professional tone */
    professionalTone: z.ZodBoolean;
    /** Confidence score for this evaluation (0-1) */
    confidence: z.ZodNumber;
    /** Explanation of the evaluation reasoning */
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    isHelpful: boolean;
    isOnTopic: boolean;
    hasError: boolean;
    errorType: "timeout" | "technical" | "unclear" | "none";
    uncertaintyLevel: "none" | "low" | "medium" | "high";
    professionalTone: boolean;
    confidence: number;
    reasoning: string;
}, {
    isHelpful: boolean;
    isOnTopic: boolean;
    hasError: boolean;
    uncertaintyLevel: "none" | "low" | "medium" | "high";
    professionalTone: boolean;
    confidence: number;
    reasoning: string;
    errorType?: "timeout" | "technical" | "unclear" | "none" | undefined;
}>;
export type ResponseQuality = z.infer<typeof ResponseQualitySchema>;
/**
 * Classifies the primary intent of a message
 */
export declare const IntentClassificationSchema: z.ZodObject<{
    /** The primary detected intent */
    primaryIntent: z.ZodEnum<["greeting", "schedule_appointment", "cancel_appointment", "reschedule", "ask_question", "provide_information", "confirmation", "rejection", "unclear", "farewell", "transfer_request", "complaint", "thanks"]>;
    /** Any secondary intents detected */
    secondaryIntents: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    /** Confidence score for intent classification (0-1) */
    confidence: z.ZodNumber;
    /** Entities extracted from the message (name, date, etc.) */
    extractedEntities: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    confidence: number;
    primaryIntent: "unclear" | "greeting" | "schedule_appointment" | "cancel_appointment" | "reschedule" | "ask_question" | "provide_information" | "confirmation" | "rejection" | "farewell" | "transfer_request" | "complaint" | "thanks";
    secondaryIntents?: string[] | undefined;
    extractedEntities?: Record<string, string> | undefined;
}, {
    confidence: number;
    primaryIntent: "unclear" | "greeting" | "schedule_appointment" | "cancel_appointment" | "reschedule" | "ask_question" | "provide_information" | "confirmation" | "rejection" | "farewell" | "transfer_request" | "complaint" | "thanks";
    secondaryIntents?: string[] | undefined;
    extractedEntities?: Record<string, string> | undefined;
}>;
export type IntentClassification = z.infer<typeof IntentClassificationSchema>;
/**
 * Tracks the current state of the conversation flow
 */
export declare const ConversationFlowSchema: z.ZodObject<{
    /** Current state in the conversation flow */
    flowState: z.ZodEnum<["greeting", "collecting_parent_info", "collecting_child_info", "checking_previous_visits", "checking_insurance", "checking_special_needs", "collecting_preferences", "searching_availability", "presenting_options", "scheduling", "confirming", "closing", "error_recovery", "transfer_requested", "off_topic"]>;
    /** Whether the conversation is progressing as expected */
    isProgressingCorrectly: z.ZodBoolean;
    /** Whether the conversation appears stuck */
    isStuck: z.ZodBoolean;
    /** Whether the assistant is repeating itself */
    isRepeating: z.ZodBoolean;
    /** Information still needed from the caller */
    missingInformation: z.ZodArray<z.ZodString, "many">;
    /** Confidence score for flow state detection (0-1) */
    confidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    confidence: number;
    flowState: "greeting" | "collecting_parent_info" | "collecting_child_info" | "checking_previous_visits" | "checking_insurance" | "checking_special_needs" | "collecting_preferences" | "searching_availability" | "presenting_options" | "scheduling" | "confirming" | "closing" | "error_recovery" | "transfer_requested" | "off_topic";
    isProgressingCorrectly: boolean;
    isStuck: boolean;
    isRepeating: boolean;
    missingInformation: string[];
}, {
    confidence: number;
    flowState: "greeting" | "collecting_parent_info" | "collecting_child_info" | "checking_previous_visits" | "checking_insurance" | "checking_special_needs" | "collecting_preferences" | "searching_availability" | "presenting_options" | "scheduling" | "confirming" | "closing" | "error_recovery" | "transfer_requested" | "off_topic";
    isProgressingCorrectly: boolean;
    isStuck: boolean;
    isRepeating: boolean;
    missingInformation: string[];
}>;
export type ConversationFlow = z.infer<typeof ConversationFlowSchema>;
/**
 * Result of validating a single conversation step
 */
export declare const StepValidationSchema: z.ZodObject<{
    /** Whether the step passed validation */
    passed: z.ZodBoolean;
    /** Expectations that were met */
    matchedExpectations: z.ZodArray<z.ZodString, "many">;
    /** Expectations that were not met */
    unmatchedExpectations: z.ZodArray<z.ZodString, "many">;
    /** Unexpected behaviors detected */
    unexpectedBehaviors: z.ZodArray<z.ZodString, "many">;
    /** Severity of any issues found */
    severity: z.ZodEnum<["none", "low", "medium", "high", "critical"]>;
    /** Confidence score for this validation (0-1) */
    confidence: z.ZodNumber;
    /** Explanation of the validation reasoning */
    reasoning: z.ZodString;
    /** Suggested action if validation failed */
    suggestedAction: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    confidence: number;
    reasoning: string;
    passed: boolean;
    matchedExpectations: string[];
    unmatchedExpectations: string[];
    unexpectedBehaviors: string[];
    severity: "none" | "low" | "medium" | "high" | "critical";
    suggestedAction?: string | undefined;
}, {
    confidence: number;
    reasoning: string;
    passed: boolean;
    matchedExpectations: string[];
    unmatchedExpectations: string[];
    unexpectedBehaviors: string[];
    severity: "none" | "low" | "medium" | "high" | "critical";
    suggestedAction?: string | undefined;
}>;
export type StepValidation = z.infer<typeof StepValidationSchema>;
/**
 * Complete semantic evaluation for a conversation step
 */
export declare const SemanticEvaluationSchema: z.ZodObject<{
    /** Unique identifier for the step being evaluated */
    stepId: z.ZodString;
    /** Quality assessment of the response */
    responseQuality: z.ZodObject<{
        /** Whether the response is helpful to the user */
        isHelpful: z.ZodBoolean;
        /** Whether the response stays on topic */
        isOnTopic: z.ZodBoolean;
        /** Whether an error was detected in the response */
        hasError: z.ZodBoolean;
        /** Type of error if detected */
        errorType: z.ZodDefault<z.ZodEnum<["technical", "timeout", "unclear", "none"]>>;
        /** Level of uncertainty expressed in the response */
        uncertaintyLevel: z.ZodEnum<["none", "low", "medium", "high"]>;
        /** Whether the response maintains professional tone */
        professionalTone: z.ZodBoolean;
        /** Confidence score for this evaluation (0-1) */
        confidence: z.ZodNumber;
        /** Explanation of the evaluation reasoning */
        reasoning: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        isHelpful: boolean;
        isOnTopic: boolean;
        hasError: boolean;
        errorType: "timeout" | "technical" | "unclear" | "none";
        uncertaintyLevel: "none" | "low" | "medium" | "high";
        professionalTone: boolean;
        confidence: number;
        reasoning: string;
    }, {
        isHelpful: boolean;
        isOnTopic: boolean;
        hasError: boolean;
        uncertaintyLevel: "none" | "low" | "medium" | "high";
        professionalTone: boolean;
        confidence: number;
        reasoning: string;
        errorType?: "timeout" | "technical" | "unclear" | "none" | undefined;
    }>;
    /** Intent classification of the response */
    intent: z.ZodObject<{
        /** The primary detected intent */
        primaryIntent: z.ZodEnum<["greeting", "schedule_appointment", "cancel_appointment", "reschedule", "ask_question", "provide_information", "confirmation", "rejection", "unclear", "farewell", "transfer_request", "complaint", "thanks"]>;
        /** Any secondary intents detected */
        secondaryIntents: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Confidence score for intent classification (0-1) */
        confidence: z.ZodNumber;
        /** Entities extracted from the message (name, date, etc.) */
        extractedEntities: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        primaryIntent: "unclear" | "greeting" | "schedule_appointment" | "cancel_appointment" | "reschedule" | "ask_question" | "provide_information" | "confirmation" | "rejection" | "farewell" | "transfer_request" | "complaint" | "thanks";
        secondaryIntents?: string[] | undefined;
        extractedEntities?: Record<string, string> | undefined;
    }, {
        confidence: number;
        primaryIntent: "unclear" | "greeting" | "schedule_appointment" | "cancel_appointment" | "reschedule" | "ask_question" | "provide_information" | "confirmation" | "rejection" | "farewell" | "transfer_request" | "complaint" | "thanks";
        secondaryIntents?: string[] | undefined;
        extractedEntities?: Record<string, string> | undefined;
    }>;
    /** Conversation flow state */
    flowState: z.ZodObject<{
        /** Current state in the conversation flow */
        flowState: z.ZodEnum<["greeting", "collecting_parent_info", "collecting_child_info", "checking_previous_visits", "checking_insurance", "checking_special_needs", "collecting_preferences", "searching_availability", "presenting_options", "scheduling", "confirming", "closing", "error_recovery", "transfer_requested", "off_topic"]>;
        /** Whether the conversation is progressing as expected */
        isProgressingCorrectly: z.ZodBoolean;
        /** Whether the conversation appears stuck */
        isStuck: z.ZodBoolean;
        /** Whether the assistant is repeating itself */
        isRepeating: z.ZodBoolean;
        /** Information still needed from the caller */
        missingInformation: z.ZodArray<z.ZodString, "many">;
        /** Confidence score for flow state detection (0-1) */
        confidence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        flowState: "greeting" | "collecting_parent_info" | "collecting_child_info" | "checking_previous_visits" | "checking_insurance" | "checking_special_needs" | "collecting_preferences" | "searching_availability" | "presenting_options" | "scheduling" | "confirming" | "closing" | "error_recovery" | "transfer_requested" | "off_topic";
        isProgressingCorrectly: boolean;
        isStuck: boolean;
        isRepeating: boolean;
        missingInformation: string[];
    }, {
        confidence: number;
        flowState: "greeting" | "collecting_parent_info" | "collecting_child_info" | "checking_previous_visits" | "checking_insurance" | "checking_special_needs" | "collecting_preferences" | "searching_availability" | "presenting_options" | "scheduling" | "confirming" | "closing" | "error_recovery" | "transfer_requested" | "off_topic";
        isProgressingCorrectly: boolean;
        isStuck: boolean;
        isRepeating: boolean;
        missingInformation: string[];
    }>;
    /** Validation result against expectations */
    validation: z.ZodObject<{
        /** Whether the step passed validation */
        passed: z.ZodBoolean;
        /** Expectations that were met */
        matchedExpectations: z.ZodArray<z.ZodString, "many">;
        /** Expectations that were not met */
        unmatchedExpectations: z.ZodArray<z.ZodString, "many">;
        /** Unexpected behaviors detected */
        unexpectedBehaviors: z.ZodArray<z.ZodString, "many">;
        /** Severity of any issues found */
        severity: z.ZodEnum<["none", "low", "medium", "high", "critical"]>;
        /** Confidence score for this validation (0-1) */
        confidence: z.ZodNumber;
        /** Explanation of the validation reasoning */
        reasoning: z.ZodString;
        /** Suggested action if validation failed */
        suggestedAction: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        reasoning: string;
        passed: boolean;
        matchedExpectations: string[];
        unmatchedExpectations: string[];
        unexpectedBehaviors: string[];
        severity: "none" | "low" | "medium" | "high" | "critical";
        suggestedAction?: string | undefined;
    }, {
        confidence: number;
        reasoning: string;
        passed: boolean;
        matchedExpectations: string[];
        unmatchedExpectations: string[];
        unexpectedBehaviors: string[];
        severity: "none" | "low" | "medium" | "high" | "critical";
        suggestedAction?: string | undefined;
    }>;
    /** Timestamp of evaluation */
    timestamp: z.ZodString;
    /** Time taken for evaluation in milliseconds */
    evaluationTimeMs: z.ZodNumber;
    /** Whether this was a fallback (regex) evaluation */
    isFallback: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    validation: {
        confidence: number;
        reasoning: string;
        passed: boolean;
        matchedExpectations: string[];
        unmatchedExpectations: string[];
        unexpectedBehaviors: string[];
        severity: "none" | "low" | "medium" | "high" | "critical";
        suggestedAction?: string | undefined;
    };
    flowState: {
        confidence: number;
        flowState: "greeting" | "collecting_parent_info" | "collecting_child_info" | "checking_previous_visits" | "checking_insurance" | "checking_special_needs" | "collecting_preferences" | "searching_availability" | "presenting_options" | "scheduling" | "confirming" | "closing" | "error_recovery" | "transfer_requested" | "off_topic";
        isProgressingCorrectly: boolean;
        isStuck: boolean;
        isRepeating: boolean;
        missingInformation: string[];
    };
    stepId: string;
    responseQuality: {
        isHelpful: boolean;
        isOnTopic: boolean;
        hasError: boolean;
        errorType: "timeout" | "technical" | "unclear" | "none";
        uncertaintyLevel: "none" | "low" | "medium" | "high";
        professionalTone: boolean;
        confidence: number;
        reasoning: string;
    };
    intent: {
        confidence: number;
        primaryIntent: "unclear" | "greeting" | "schedule_appointment" | "cancel_appointment" | "reschedule" | "ask_question" | "provide_information" | "confirmation" | "rejection" | "farewell" | "transfer_request" | "complaint" | "thanks";
        secondaryIntents?: string[] | undefined;
        extractedEntities?: Record<string, string> | undefined;
    };
    timestamp: string;
    evaluationTimeMs: number;
    isFallback?: boolean | undefined;
}, {
    validation: {
        confidence: number;
        reasoning: string;
        passed: boolean;
        matchedExpectations: string[];
        unmatchedExpectations: string[];
        unexpectedBehaviors: string[];
        severity: "none" | "low" | "medium" | "high" | "critical";
        suggestedAction?: string | undefined;
    };
    flowState: {
        confidence: number;
        flowState: "greeting" | "collecting_parent_info" | "collecting_child_info" | "checking_previous_visits" | "checking_insurance" | "checking_special_needs" | "collecting_preferences" | "searching_availability" | "presenting_options" | "scheduling" | "confirming" | "closing" | "error_recovery" | "transfer_requested" | "off_topic";
        isProgressingCorrectly: boolean;
        isStuck: boolean;
        isRepeating: boolean;
        missingInformation: string[];
    };
    stepId: string;
    responseQuality: {
        isHelpful: boolean;
        isOnTopic: boolean;
        hasError: boolean;
        uncertaintyLevel: "none" | "low" | "medium" | "high";
        professionalTone: boolean;
        confidence: number;
        reasoning: string;
        errorType?: "timeout" | "technical" | "unclear" | "none" | undefined;
    };
    intent: {
        confidence: number;
        primaryIntent: "unclear" | "greeting" | "schedule_appointment" | "cancel_appointment" | "reschedule" | "ask_question" | "provide_information" | "confirmation" | "rejection" | "farewell" | "transfer_request" | "complaint" | "thanks";
        secondaryIntents?: string[] | undefined;
        extractedEntities?: Record<string, string> | undefined;
    };
    timestamp: string;
    evaluationTimeMs: number;
    isFallback?: boolean | undefined;
}>;
export type SemanticEvaluation = z.infer<typeof SemanticEvaluationSchema>;
/**
 * Semantic expectation types (replaces regex patterns in test definitions)
 */
export declare const SemanticExpectationTypeSchema: z.ZodEnum<["contains_greeting", "asks_for_name", "asks_for_info", "confirms_info", "confirms_booking", "offers_options", "offers_times", "acknowledges_input", "provides_availability", "handles_error", "transfers_to_agent", "asks_for_spelling", "asks_for_dob", "asks_for_insurance", "asks_for_email", "asks_about_previous_visits", "asks_about_special_needs", "mentions_location", "provides_instructions", "says_goodbye", "custom"]>;
export type SemanticExpectationType = z.infer<typeof SemanticExpectationTypeSchema>;
/**
 * A semantic expectation for test validation
 */
export declare const SemanticExpectationSchema: z.ZodObject<{
    /** Type of semantic expectation */
    type: z.ZodEnum<["contains_greeting", "asks_for_name", "asks_for_info", "confirms_info", "confirms_booking", "offers_options", "offers_times", "acknowledges_input", "provides_availability", "handles_error", "transfers_to_agent", "asks_for_spelling", "asks_for_dob", "asks_for_insurance", "asks_for_email", "asks_about_previous_visits", "asks_about_special_needs", "mentions_location", "provides_instructions", "says_goodbye", "custom"]>;
    /** Human-readable description of what is expected */
    description: z.ZodOptional<z.ZodString>;
    /** Whether this expectation is required to pass */
    required: z.ZodDefault<z.ZodBoolean>;
    /** Weight for scoring (0-1) */
    weight: z.ZodDefault<z.ZodNumber>;
    /** Custom criteria for 'custom' type */
    customCriteria: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "custom" | "contains_greeting" | "asks_for_name" | "asks_for_info" | "confirms_info" | "confirms_booking" | "offers_options" | "offers_times" | "acknowledges_input" | "provides_availability" | "handles_error" | "transfers_to_agent" | "asks_for_spelling" | "asks_for_dob" | "asks_for_insurance" | "asks_for_email" | "asks_about_previous_visits" | "asks_about_special_needs" | "mentions_location" | "provides_instructions" | "says_goodbye";
    required: boolean;
    weight: number;
    description?: string | undefined;
    customCriteria?: string | undefined;
}, {
    type: "custom" | "contains_greeting" | "asks_for_name" | "asks_for_info" | "confirms_info" | "confirms_booking" | "offers_options" | "offers_times" | "acknowledges_input" | "provides_availability" | "handles_error" | "transfers_to_agent" | "asks_for_spelling" | "asks_for_dob" | "asks_for_insurance" | "asks_for_email" | "asks_about_previous_visits" | "asks_about_special_needs" | "mentions_location" | "provides_instructions" | "says_goodbye";
    description?: string | undefined;
    required?: boolean | undefined;
    weight?: number | undefined;
    customCriteria?: string | undefined;
}>;
export type SemanticExpectation = z.input<typeof SemanticExpectationSchema>;
/**
 * Negative expectation types (things that should NOT happen)
 */
export declare const NegativeExpectationTypeSchema: z.ZodEnum<["contains_error", "exposes_internal", "contradicts_previous", "ignores_input", "repeats_verbatim", "hallucinates_data", "uses_banned_words", "wrong_language", "inappropriate_tone", "reveals_system_info", "custom"]>;
export type NegativeExpectationType = z.infer<typeof NegativeExpectationTypeSchema>;
/**
 * A negative expectation (what should NOT happen)
 */
export declare const NegativeExpectationSchema: z.ZodObject<{
    /** Type of negative expectation */
    type: z.ZodEnum<["contains_error", "exposes_internal", "contradicts_previous", "ignores_input", "repeats_verbatim", "hallucinates_data", "uses_banned_words", "wrong_language", "inappropriate_tone", "reveals_system_info", "custom"]>;
    /** Human-readable description */
    description: z.ZodOptional<z.ZodString>;
    /** Severity if this expectation is violated */
    severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
    /** Custom criteria for 'custom' type */
    customCriteria: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "custom" | "contains_error" | "exposes_internal" | "contradicts_previous" | "ignores_input" | "repeats_verbatim" | "hallucinates_data" | "uses_banned_words" | "wrong_language" | "inappropriate_tone" | "reveals_system_info";
    severity: "low" | "medium" | "high" | "critical";
    description?: string | undefined;
    customCriteria?: string | undefined;
}, {
    type: "custom" | "contains_error" | "exposes_internal" | "contradicts_previous" | "ignores_input" | "repeats_verbatim" | "hallucinates_data" | "uses_banned_words" | "wrong_language" | "inappropriate_tone" | "reveals_system_info";
    severity: "low" | "medium" | "high" | "critical";
    description?: string | undefined;
    customCriteria?: string | undefined;
}>;
export type NegativeExpectation = z.input<typeof NegativeExpectationSchema>;
/**
 * Context for evaluating a single step
 */
export declare const EvaluationContextSchema: z.ZodObject<{
    stepId: z.ZodString;
    stepDescription: z.ZodOptional<z.ZodString>;
    userMessage: z.ZodString;
    assistantResponse: z.ZodString;
    conversationHistory: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["user", "assistant", "system"]>;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        role: "user" | "assistant" | "system";
        content: string;
    }, {
        role: "user" | "assistant" | "system";
        content: string;
    }>, "many">;
    expectedBehaviors: z.ZodArray<z.ZodString, "many">;
    unexpectedBehaviors: z.ZodArray<z.ZodString, "many">;
    semanticExpectations: z.ZodOptional<z.ZodArray<z.ZodObject<{
        /** Type of semantic expectation */
        type: z.ZodEnum<["contains_greeting", "asks_for_name", "asks_for_info", "confirms_info", "confirms_booking", "offers_options", "offers_times", "acknowledges_input", "provides_availability", "handles_error", "transfers_to_agent", "asks_for_spelling", "asks_for_dob", "asks_for_insurance", "asks_for_email", "asks_about_previous_visits", "asks_about_special_needs", "mentions_location", "provides_instructions", "says_goodbye", "custom"]>;
        /** Human-readable description of what is expected */
        description: z.ZodOptional<z.ZodString>;
        /** Whether this expectation is required to pass */
        required: z.ZodDefault<z.ZodBoolean>;
        /** Weight for scoring (0-1) */
        weight: z.ZodDefault<z.ZodNumber>;
        /** Custom criteria for 'custom' type */
        customCriteria: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "custom" | "contains_greeting" | "asks_for_name" | "asks_for_info" | "confirms_info" | "confirms_booking" | "offers_options" | "offers_times" | "acknowledges_input" | "provides_availability" | "handles_error" | "transfers_to_agent" | "asks_for_spelling" | "asks_for_dob" | "asks_for_insurance" | "asks_for_email" | "asks_about_previous_visits" | "asks_about_special_needs" | "mentions_location" | "provides_instructions" | "says_goodbye";
        required: boolean;
        weight: number;
        description?: string | undefined;
        customCriteria?: string | undefined;
    }, {
        type: "custom" | "contains_greeting" | "asks_for_name" | "asks_for_info" | "confirms_info" | "confirms_booking" | "offers_options" | "offers_times" | "acknowledges_input" | "provides_availability" | "handles_error" | "transfers_to_agent" | "asks_for_spelling" | "asks_for_dob" | "asks_for_insurance" | "asks_for_email" | "asks_about_previous_visits" | "asks_about_special_needs" | "mentions_location" | "provides_instructions" | "says_goodbye";
        description?: string | undefined;
        required?: boolean | undefined;
        weight?: number | undefined;
        customCriteria?: string | undefined;
    }>, "many">>;
    negativeExpectations: z.ZodOptional<z.ZodArray<z.ZodObject<{
        /** Type of negative expectation */
        type: z.ZodEnum<["contains_error", "exposes_internal", "contradicts_previous", "ignores_input", "repeats_verbatim", "hallucinates_data", "uses_banned_words", "wrong_language", "inappropriate_tone", "reveals_system_info", "custom"]>;
        /** Human-readable description */
        description: z.ZodOptional<z.ZodString>;
        /** Severity if this expectation is violated */
        severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
        /** Custom criteria for 'custom' type */
        customCriteria: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "custom" | "contains_error" | "exposes_internal" | "contradicts_previous" | "ignores_input" | "repeats_verbatim" | "hallucinates_data" | "uses_banned_words" | "wrong_language" | "inappropriate_tone" | "reveals_system_info";
        severity: "low" | "medium" | "high" | "critical";
        description?: string | undefined;
        customCriteria?: string | undefined;
    }, {
        type: "custom" | "contains_error" | "exposes_internal" | "contradicts_previous" | "ignores_input" | "repeats_verbatim" | "hallucinates_data" | "uses_banned_words" | "wrong_language" | "inappropriate_tone" | "reveals_system_info";
        severity: "low" | "medium" | "high" | "critical";
        description?: string | undefined;
        customCriteria?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    unexpectedBehaviors: string[];
    stepId: string;
    userMessage: string;
    assistantResponse: string;
    conversationHistory: {
        role: "user" | "assistant" | "system";
        content: string;
    }[];
    expectedBehaviors: string[];
    stepDescription?: string | undefined;
    semanticExpectations?: {
        type: "custom" | "contains_greeting" | "asks_for_name" | "asks_for_info" | "confirms_info" | "confirms_booking" | "offers_options" | "offers_times" | "acknowledges_input" | "provides_availability" | "handles_error" | "transfers_to_agent" | "asks_for_spelling" | "asks_for_dob" | "asks_for_insurance" | "asks_for_email" | "asks_about_previous_visits" | "asks_about_special_needs" | "mentions_location" | "provides_instructions" | "says_goodbye";
        required: boolean;
        weight: number;
        description?: string | undefined;
        customCriteria?: string | undefined;
    }[] | undefined;
    negativeExpectations?: {
        type: "custom" | "contains_error" | "exposes_internal" | "contradicts_previous" | "ignores_input" | "repeats_verbatim" | "hallucinates_data" | "uses_banned_words" | "wrong_language" | "inappropriate_tone" | "reveals_system_info";
        severity: "low" | "medium" | "high" | "critical";
        description?: string | undefined;
        customCriteria?: string | undefined;
    }[] | undefined;
}, {
    unexpectedBehaviors: string[];
    stepId: string;
    userMessage: string;
    assistantResponse: string;
    conversationHistory: {
        role: "user" | "assistant" | "system";
        content: string;
    }[];
    expectedBehaviors: string[];
    stepDescription?: string | undefined;
    semanticExpectations?: {
        type: "custom" | "contains_greeting" | "asks_for_name" | "asks_for_info" | "confirms_info" | "confirms_booking" | "offers_options" | "offers_times" | "acknowledges_input" | "provides_availability" | "handles_error" | "transfers_to_agent" | "asks_for_spelling" | "asks_for_dob" | "asks_for_insurance" | "asks_for_email" | "asks_about_previous_visits" | "asks_about_special_needs" | "mentions_location" | "provides_instructions" | "says_goodbye";
        description?: string | undefined;
        required?: boolean | undefined;
        weight?: number | undefined;
        customCriteria?: string | undefined;
    }[] | undefined;
    negativeExpectations?: {
        type: "custom" | "contains_error" | "exposes_internal" | "contradicts_previous" | "ignores_input" | "repeats_verbatim" | "hallucinates_data" | "uses_banned_words" | "wrong_language" | "inappropriate_tone" | "reveals_system_info";
        severity: "low" | "medium" | "high" | "critical";
        description?: string | undefined;
        customCriteria?: string | undefined;
    }[] | undefined;
}>;
export type EvaluationContext = z.infer<typeof EvaluationContextSchema>;
/**
 * Batch evaluation request
 */
export declare const BatchEvaluationRequestSchema: z.ZodObject<{
    testId: z.ZodString;
    steps: z.ZodArray<z.ZodObject<{
        stepId: z.ZodString;
        stepDescription: z.ZodOptional<z.ZodString>;
        userMessage: z.ZodString;
        assistantResponse: z.ZodString;
        conversationHistory: z.ZodArray<z.ZodObject<{
            role: z.ZodEnum<["user", "assistant", "system"]>;
            content: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            role: "user" | "assistant" | "system";
            content: string;
        }, {
            role: "user" | "assistant" | "system";
            content: string;
        }>, "many">;
        expectedBehaviors: z.ZodArray<z.ZodString, "many">;
        unexpectedBehaviors: z.ZodArray<z.ZodString, "many">;
        semanticExpectations: z.ZodOptional<z.ZodArray<z.ZodObject<{
            /** Type of semantic expectation */
            type: z.ZodEnum<["contains_greeting", "asks_for_name", "asks_for_info", "confirms_info", "confirms_booking", "offers_options", "offers_times", "acknowledges_input", "provides_availability", "handles_error", "transfers_to_agent", "asks_for_spelling", "asks_for_dob", "asks_for_insurance", "asks_for_email", "asks_about_previous_visits", "asks_about_special_needs", "mentions_location", "provides_instructions", "says_goodbye", "custom"]>;
            /** Human-readable description of what is expected */
            description: z.ZodOptional<z.ZodString>;
            /** Whether this expectation is required to pass */
            required: z.ZodDefault<z.ZodBoolean>;
            /** Weight for scoring (0-1) */
            weight: z.ZodDefault<z.ZodNumber>;
            /** Custom criteria for 'custom' type */
            customCriteria: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "custom" | "contains_greeting" | "asks_for_name" | "asks_for_info" | "confirms_info" | "confirms_booking" | "offers_options" | "offers_times" | "acknowledges_input" | "provides_availability" | "handles_error" | "transfers_to_agent" | "asks_for_spelling" | "asks_for_dob" | "asks_for_insurance" | "asks_for_email" | "asks_about_previous_visits" | "asks_about_special_needs" | "mentions_location" | "provides_instructions" | "says_goodbye";
            required: boolean;
            weight: number;
            description?: string | undefined;
            customCriteria?: string | undefined;
        }, {
            type: "custom" | "contains_greeting" | "asks_for_name" | "asks_for_info" | "confirms_info" | "confirms_booking" | "offers_options" | "offers_times" | "acknowledges_input" | "provides_availability" | "handles_error" | "transfers_to_agent" | "asks_for_spelling" | "asks_for_dob" | "asks_for_insurance" | "asks_for_email" | "asks_about_previous_visits" | "asks_about_special_needs" | "mentions_location" | "provides_instructions" | "says_goodbye";
            description?: string | undefined;
            required?: boolean | undefined;
            weight?: number | undefined;
            customCriteria?: string | undefined;
        }>, "many">>;
        negativeExpectations: z.ZodOptional<z.ZodArray<z.ZodObject<{
            /** Type of negative expectation */
            type: z.ZodEnum<["contains_error", "exposes_internal", "contradicts_previous", "ignores_input", "repeats_verbatim", "hallucinates_data", "uses_banned_words", "wrong_language", "inappropriate_tone", "reveals_system_info", "custom"]>;
            /** Human-readable description */
            description: z.ZodOptional<z.ZodString>;
            /** Severity if this expectation is violated */
            severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
            /** Custom criteria for 'custom' type */
            customCriteria: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "custom" | "contains_error" | "exposes_internal" | "contradicts_previous" | "ignores_input" | "repeats_verbatim" | "hallucinates_data" | "uses_banned_words" | "wrong_language" | "inappropriate_tone" | "reveals_system_info";
            severity: "low" | "medium" | "high" | "critical";
            description?: string | undefined;
            customCriteria?: string | undefined;
        }, {
            type: "custom" | "contains_error" | "exposes_internal" | "contradicts_previous" | "ignores_input" | "repeats_verbatim" | "hallucinates_data" | "uses_banned_words" | "wrong_language" | "inappropriate_tone" | "reveals_system_info";
            severity: "low" | "medium" | "high" | "critical";
            description?: string | undefined;
            customCriteria?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        unexpectedBehaviors: string[];
        stepId: string;
        userMessage: string;
        assistantResponse: string;
        conversationHistory: {
            role: "user" | "assistant" | "system";
            content: string;
        }[];
        expectedBehaviors: string[];
        stepDescription?: string | undefined;
        semanticExpectations?: {
            type: "custom" | "contains_greeting" | "asks_for_name" | "asks_for_info" | "confirms_info" | "confirms_booking" | "offers_options" | "offers_times" | "acknowledges_input" | "provides_availability" | "handles_error" | "transfers_to_agent" | "asks_for_spelling" | "asks_for_dob" | "asks_for_insurance" | "asks_for_email" | "asks_about_previous_visits" | "asks_about_special_needs" | "mentions_location" | "provides_instructions" | "says_goodbye";
            required: boolean;
            weight: number;
            description?: string | undefined;
            customCriteria?: string | undefined;
        }[] | undefined;
        negativeExpectations?: {
            type: "custom" | "contains_error" | "exposes_internal" | "contradicts_previous" | "ignores_input" | "repeats_verbatim" | "hallucinates_data" | "uses_banned_words" | "wrong_language" | "inappropriate_tone" | "reveals_system_info";
            severity: "low" | "medium" | "high" | "critical";
            description?: string | undefined;
            customCriteria?: string | undefined;
        }[] | undefined;
    }, {
        unexpectedBehaviors: string[];
        stepId: string;
        userMessage: string;
        assistantResponse: string;
        conversationHistory: {
            role: "user" | "assistant" | "system";
            content: string;
        }[];
        expectedBehaviors: string[];
        stepDescription?: string | undefined;
        semanticExpectations?: {
            type: "custom" | "contains_greeting" | "asks_for_name" | "asks_for_info" | "confirms_info" | "confirms_booking" | "offers_options" | "offers_times" | "acknowledges_input" | "provides_availability" | "handles_error" | "transfers_to_agent" | "asks_for_spelling" | "asks_for_dob" | "asks_for_insurance" | "asks_for_email" | "asks_about_previous_visits" | "asks_about_special_needs" | "mentions_location" | "provides_instructions" | "says_goodbye";
            description?: string | undefined;
            required?: boolean | undefined;
            weight?: number | undefined;
            customCriteria?: string | undefined;
        }[] | undefined;
        negativeExpectations?: {
            type: "custom" | "contains_error" | "exposes_internal" | "contradicts_previous" | "ignores_input" | "repeats_verbatim" | "hallucinates_data" | "uses_banned_words" | "wrong_language" | "inappropriate_tone" | "reveals_system_info";
            severity: "low" | "medium" | "high" | "critical";
            description?: string | undefined;
            customCriteria?: string | undefined;
        }[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    testId: string;
    steps: {
        unexpectedBehaviors: string[];
        stepId: string;
        userMessage: string;
        assistantResponse: string;
        conversationHistory: {
            role: "user" | "assistant" | "system";
            content: string;
        }[];
        expectedBehaviors: string[];
        stepDescription?: string | undefined;
        semanticExpectations?: {
            type: "custom" | "contains_greeting" | "asks_for_name" | "asks_for_info" | "confirms_info" | "confirms_booking" | "offers_options" | "offers_times" | "acknowledges_input" | "provides_availability" | "handles_error" | "transfers_to_agent" | "asks_for_spelling" | "asks_for_dob" | "asks_for_insurance" | "asks_for_email" | "asks_about_previous_visits" | "asks_about_special_needs" | "mentions_location" | "provides_instructions" | "says_goodbye";
            required: boolean;
            weight: number;
            description?: string | undefined;
            customCriteria?: string | undefined;
        }[] | undefined;
        negativeExpectations?: {
            type: "custom" | "contains_error" | "exposes_internal" | "contradicts_previous" | "ignores_input" | "repeats_verbatim" | "hallucinates_data" | "uses_banned_words" | "wrong_language" | "inappropriate_tone" | "reveals_system_info";
            severity: "low" | "medium" | "high" | "critical";
            description?: string | undefined;
            customCriteria?: string | undefined;
        }[] | undefined;
    }[];
}, {
    testId: string;
    steps: {
        unexpectedBehaviors: string[];
        stepId: string;
        userMessage: string;
        assistantResponse: string;
        conversationHistory: {
            role: "user" | "assistant" | "system";
            content: string;
        }[];
        expectedBehaviors: string[];
        stepDescription?: string | undefined;
        semanticExpectations?: {
            type: "custom" | "contains_greeting" | "asks_for_name" | "asks_for_info" | "confirms_info" | "confirms_booking" | "offers_options" | "offers_times" | "acknowledges_input" | "provides_availability" | "handles_error" | "transfers_to_agent" | "asks_for_spelling" | "asks_for_dob" | "asks_for_insurance" | "asks_for_email" | "asks_about_previous_visits" | "asks_about_special_needs" | "mentions_location" | "provides_instructions" | "says_goodbye";
            description?: string | undefined;
            required?: boolean | undefined;
            weight?: number | undefined;
            customCriteria?: string | undefined;
        }[] | undefined;
        negativeExpectations?: {
            type: "custom" | "contains_error" | "exposes_internal" | "contradicts_previous" | "ignores_input" | "repeats_verbatim" | "hallucinates_data" | "uses_banned_words" | "wrong_language" | "inappropriate_tone" | "reveals_system_info";
            severity: "low" | "medium" | "high" | "critical";
            description?: string | undefined;
            customCriteria?: string | undefined;
        }[] | undefined;
    }[];
}>;
export type BatchEvaluationRequest = z.infer<typeof BatchEvaluationRequestSchema>;
/**
 * Batch evaluation response
 */
export declare const BatchEvaluationResponseSchema: z.ZodObject<{
    testId: z.ZodString;
    evaluations: z.ZodArray<z.ZodObject<{
        /** Unique identifier for the step being evaluated */
        stepId: z.ZodString;
        /** Quality assessment of the response */
        responseQuality: z.ZodObject<{
            /** Whether the response is helpful to the user */
            isHelpful: z.ZodBoolean;
            /** Whether the response stays on topic */
            isOnTopic: z.ZodBoolean;
            /** Whether an error was detected in the response */
            hasError: z.ZodBoolean;
            /** Type of error if detected */
            errorType: z.ZodDefault<z.ZodEnum<["technical", "timeout", "unclear", "none"]>>;
            /** Level of uncertainty expressed in the response */
            uncertaintyLevel: z.ZodEnum<["none", "low", "medium", "high"]>;
            /** Whether the response maintains professional tone */
            professionalTone: z.ZodBoolean;
            /** Confidence score for this evaluation (0-1) */
            confidence: z.ZodNumber;
            /** Explanation of the evaluation reasoning */
            reasoning: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            isHelpful: boolean;
            isOnTopic: boolean;
            hasError: boolean;
            errorType: "timeout" | "technical" | "unclear" | "none";
            uncertaintyLevel: "none" | "low" | "medium" | "high";
            professionalTone: boolean;
            confidence: number;
            reasoning: string;
        }, {
            isHelpful: boolean;
            isOnTopic: boolean;
            hasError: boolean;
            uncertaintyLevel: "none" | "low" | "medium" | "high";
            professionalTone: boolean;
            confidence: number;
            reasoning: string;
            errorType?: "timeout" | "technical" | "unclear" | "none" | undefined;
        }>;
        /** Intent classification of the response */
        intent: z.ZodObject<{
            /** The primary detected intent */
            primaryIntent: z.ZodEnum<["greeting", "schedule_appointment", "cancel_appointment", "reschedule", "ask_question", "provide_information", "confirmation", "rejection", "unclear", "farewell", "transfer_request", "complaint", "thanks"]>;
            /** Any secondary intents detected */
            secondaryIntents: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            /** Confidence score for intent classification (0-1) */
            confidence: z.ZodNumber;
            /** Entities extracted from the message (name, date, etc.) */
            extractedEntities: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            confidence: number;
            primaryIntent: "unclear" | "greeting" | "schedule_appointment" | "cancel_appointment" | "reschedule" | "ask_question" | "provide_information" | "confirmation" | "rejection" | "farewell" | "transfer_request" | "complaint" | "thanks";
            secondaryIntents?: string[] | undefined;
            extractedEntities?: Record<string, string> | undefined;
        }, {
            confidence: number;
            primaryIntent: "unclear" | "greeting" | "schedule_appointment" | "cancel_appointment" | "reschedule" | "ask_question" | "provide_information" | "confirmation" | "rejection" | "farewell" | "transfer_request" | "complaint" | "thanks";
            secondaryIntents?: string[] | undefined;
            extractedEntities?: Record<string, string> | undefined;
        }>;
        /** Conversation flow state */
        flowState: z.ZodObject<{
            /** Current state in the conversation flow */
            flowState: z.ZodEnum<["greeting", "collecting_parent_info", "collecting_child_info", "checking_previous_visits", "checking_insurance", "checking_special_needs", "collecting_preferences", "searching_availability", "presenting_options", "scheduling", "confirming", "closing", "error_recovery", "transfer_requested", "off_topic"]>;
            /** Whether the conversation is progressing as expected */
            isProgressingCorrectly: z.ZodBoolean;
            /** Whether the conversation appears stuck */
            isStuck: z.ZodBoolean;
            /** Whether the assistant is repeating itself */
            isRepeating: z.ZodBoolean;
            /** Information still needed from the caller */
            missingInformation: z.ZodArray<z.ZodString, "many">;
            /** Confidence score for flow state detection (0-1) */
            confidence: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            confidence: number;
            flowState: "greeting" | "collecting_parent_info" | "collecting_child_info" | "checking_previous_visits" | "checking_insurance" | "checking_special_needs" | "collecting_preferences" | "searching_availability" | "presenting_options" | "scheduling" | "confirming" | "closing" | "error_recovery" | "transfer_requested" | "off_topic";
            isProgressingCorrectly: boolean;
            isStuck: boolean;
            isRepeating: boolean;
            missingInformation: string[];
        }, {
            confidence: number;
            flowState: "greeting" | "collecting_parent_info" | "collecting_child_info" | "checking_previous_visits" | "checking_insurance" | "checking_special_needs" | "collecting_preferences" | "searching_availability" | "presenting_options" | "scheduling" | "confirming" | "closing" | "error_recovery" | "transfer_requested" | "off_topic";
            isProgressingCorrectly: boolean;
            isStuck: boolean;
            isRepeating: boolean;
            missingInformation: string[];
        }>;
        /** Validation result against expectations */
        validation: z.ZodObject<{
            /** Whether the step passed validation */
            passed: z.ZodBoolean;
            /** Expectations that were met */
            matchedExpectations: z.ZodArray<z.ZodString, "many">;
            /** Expectations that were not met */
            unmatchedExpectations: z.ZodArray<z.ZodString, "many">;
            /** Unexpected behaviors detected */
            unexpectedBehaviors: z.ZodArray<z.ZodString, "many">;
            /** Severity of any issues found */
            severity: z.ZodEnum<["none", "low", "medium", "high", "critical"]>;
            /** Confidence score for this validation (0-1) */
            confidence: z.ZodNumber;
            /** Explanation of the validation reasoning */
            reasoning: z.ZodString;
            /** Suggested action if validation failed */
            suggestedAction: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            confidence: number;
            reasoning: string;
            passed: boolean;
            matchedExpectations: string[];
            unmatchedExpectations: string[];
            unexpectedBehaviors: string[];
            severity: "none" | "low" | "medium" | "high" | "critical";
            suggestedAction?: string | undefined;
        }, {
            confidence: number;
            reasoning: string;
            passed: boolean;
            matchedExpectations: string[];
            unmatchedExpectations: string[];
            unexpectedBehaviors: string[];
            severity: "none" | "low" | "medium" | "high" | "critical";
            suggestedAction?: string | undefined;
        }>;
        /** Timestamp of evaluation */
        timestamp: z.ZodString;
        /** Time taken for evaluation in milliseconds */
        evaluationTimeMs: z.ZodNumber;
        /** Whether this was a fallback (regex) evaluation */
        isFallback: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        validation: {
            confidence: number;
            reasoning: string;
            passed: boolean;
            matchedExpectations: string[];
            unmatchedExpectations: string[];
            unexpectedBehaviors: string[];
            severity: "none" | "low" | "medium" | "high" | "critical";
            suggestedAction?: string | undefined;
        };
        flowState: {
            confidence: number;
            flowState: "greeting" | "collecting_parent_info" | "collecting_child_info" | "checking_previous_visits" | "checking_insurance" | "checking_special_needs" | "collecting_preferences" | "searching_availability" | "presenting_options" | "scheduling" | "confirming" | "closing" | "error_recovery" | "transfer_requested" | "off_topic";
            isProgressingCorrectly: boolean;
            isStuck: boolean;
            isRepeating: boolean;
            missingInformation: string[];
        };
        stepId: string;
        responseQuality: {
            isHelpful: boolean;
            isOnTopic: boolean;
            hasError: boolean;
            errorType: "timeout" | "technical" | "unclear" | "none";
            uncertaintyLevel: "none" | "low" | "medium" | "high";
            professionalTone: boolean;
            confidence: number;
            reasoning: string;
        };
        intent: {
            confidence: number;
            primaryIntent: "unclear" | "greeting" | "schedule_appointment" | "cancel_appointment" | "reschedule" | "ask_question" | "provide_information" | "confirmation" | "rejection" | "farewell" | "transfer_request" | "complaint" | "thanks";
            secondaryIntents?: string[] | undefined;
            extractedEntities?: Record<string, string> | undefined;
        };
        timestamp: string;
        evaluationTimeMs: number;
        isFallback?: boolean | undefined;
    }, {
        validation: {
            confidence: number;
            reasoning: string;
            passed: boolean;
            matchedExpectations: string[];
            unmatchedExpectations: string[];
            unexpectedBehaviors: string[];
            severity: "none" | "low" | "medium" | "high" | "critical";
            suggestedAction?: string | undefined;
        };
        flowState: {
            confidence: number;
            flowState: "greeting" | "collecting_parent_info" | "collecting_child_info" | "checking_previous_visits" | "checking_insurance" | "checking_special_needs" | "collecting_preferences" | "searching_availability" | "presenting_options" | "scheduling" | "confirming" | "closing" | "error_recovery" | "transfer_requested" | "off_topic";
            isProgressingCorrectly: boolean;
            isStuck: boolean;
            isRepeating: boolean;
            missingInformation: string[];
        };
        stepId: string;
        responseQuality: {
            isHelpful: boolean;
            isOnTopic: boolean;
            hasError: boolean;
            uncertaintyLevel: "none" | "low" | "medium" | "high";
            professionalTone: boolean;
            confidence: number;
            reasoning: string;
            errorType?: "timeout" | "technical" | "unclear" | "none" | undefined;
        };
        intent: {
            confidence: number;
            primaryIntent: "unclear" | "greeting" | "schedule_appointment" | "cancel_appointment" | "reschedule" | "ask_question" | "provide_information" | "confirmation" | "rejection" | "farewell" | "transfer_request" | "complaint" | "thanks";
            secondaryIntents?: string[] | undefined;
            extractedEntities?: Record<string, string> | undefined;
        };
        timestamp: string;
        evaluationTimeMs: number;
        isFallback?: boolean | undefined;
    }>, "many">;
    totalTimeMs: z.ZodNumber;
    tokensUsed: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    testId: string;
    evaluations: {
        validation: {
            confidence: number;
            reasoning: string;
            passed: boolean;
            matchedExpectations: string[];
            unmatchedExpectations: string[];
            unexpectedBehaviors: string[];
            severity: "none" | "low" | "medium" | "high" | "critical";
            suggestedAction?: string | undefined;
        };
        flowState: {
            confidence: number;
            flowState: "greeting" | "collecting_parent_info" | "collecting_child_info" | "checking_previous_visits" | "checking_insurance" | "checking_special_needs" | "collecting_preferences" | "searching_availability" | "presenting_options" | "scheduling" | "confirming" | "closing" | "error_recovery" | "transfer_requested" | "off_topic";
            isProgressingCorrectly: boolean;
            isStuck: boolean;
            isRepeating: boolean;
            missingInformation: string[];
        };
        stepId: string;
        responseQuality: {
            isHelpful: boolean;
            isOnTopic: boolean;
            hasError: boolean;
            errorType: "timeout" | "technical" | "unclear" | "none";
            uncertaintyLevel: "none" | "low" | "medium" | "high";
            professionalTone: boolean;
            confidence: number;
            reasoning: string;
        };
        intent: {
            confidence: number;
            primaryIntent: "unclear" | "greeting" | "schedule_appointment" | "cancel_appointment" | "reschedule" | "ask_question" | "provide_information" | "confirmation" | "rejection" | "farewell" | "transfer_request" | "complaint" | "thanks";
            secondaryIntents?: string[] | undefined;
            extractedEntities?: Record<string, string> | undefined;
        };
        timestamp: string;
        evaluationTimeMs: number;
        isFallback?: boolean | undefined;
    }[];
    totalTimeMs: number;
    tokensUsed?: number | undefined;
}, {
    testId: string;
    evaluations: {
        validation: {
            confidence: number;
            reasoning: string;
            passed: boolean;
            matchedExpectations: string[];
            unmatchedExpectations: string[];
            unexpectedBehaviors: string[];
            severity: "none" | "low" | "medium" | "high" | "critical";
            suggestedAction?: string | undefined;
        };
        flowState: {
            confidence: number;
            flowState: "greeting" | "collecting_parent_info" | "collecting_child_info" | "checking_previous_visits" | "checking_insurance" | "checking_special_needs" | "collecting_preferences" | "searching_availability" | "presenting_options" | "scheduling" | "confirming" | "closing" | "error_recovery" | "transfer_requested" | "off_topic";
            isProgressingCorrectly: boolean;
            isStuck: boolean;
            isRepeating: boolean;
            missingInformation: string[];
        };
        stepId: string;
        responseQuality: {
            isHelpful: boolean;
            isOnTopic: boolean;
            hasError: boolean;
            uncertaintyLevel: "none" | "low" | "medium" | "high";
            professionalTone: boolean;
            confidence: number;
            reasoning: string;
            errorType?: "timeout" | "technical" | "unclear" | "none" | undefined;
        };
        intent: {
            confidence: number;
            primaryIntent: "unclear" | "greeting" | "schedule_appointment" | "cancel_appointment" | "reschedule" | "ask_question" | "provide_information" | "confirmation" | "rejection" | "farewell" | "transfer_request" | "complaint" | "thanks";
            secondaryIntents?: string[] | undefined;
            extractedEntities?: Record<string, string> | undefined;
        };
        timestamp: string;
        evaluationTimeMs: number;
        isFallback?: boolean | undefined;
    }[];
    totalTimeMs: number;
    tokensUsed?: number | undefined;
}>;
export type BatchEvaluationResponse = z.infer<typeof BatchEvaluationResponseSchema>;
//# sourceMappingURL=evaluation-schemas.d.ts.map