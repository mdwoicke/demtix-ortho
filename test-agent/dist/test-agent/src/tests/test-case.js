"use strict";
/**
 * Test Case Interface Definitions
 *
 * Enhanced with semantic expectation types for AI-powered evaluation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.negativeExpectations = exports.semanticExpectations = exports.patterns = void 0;
exports.createStep = createStep;
exports.createSemanticStep = createSemanticStep;
/**
 * Helper to create a conversation step
 */
function createStep(id, userMessage, options = {}) {
    return {
        id,
        userMessage,
        expectedPatterns: [],
        unexpectedPatterns: [],
        ...options,
    };
}
/**
 * Helper to create a conversation step with semantic expectations
 */
function createSemanticStep(id, userMessage, semanticExpectations, options = {}) {
    return {
        id,
        userMessage,
        expectedPatterns: [], // Empty - using semantic expectations instead
        unexpectedPatterns: [],
        semanticExpectations,
        ...options,
    };
}
/**
 * Helper to create pattern matchers
 */
exports.patterns = {
    // Common success patterns
    success: /success|confirmed|booked|scheduled|complete/i,
    found: /found|match|result|located/i,
    askForMore: /would you like|can i help|anything else/i,
    // Common error patterns (excluding "sorry" which can be polite, not an error)
    error: /error|cannot|unable|failed|problem|went wrong/i,
    notFound: /not found|no results|couldn't find|no matches/i,
    // Conversation flow patterns
    askPatient: /patient|name|who|search|find/i,
    askLocation: /location|where|office|clinic/i,
    askAppointmentType: /appointment type|what type|service|reason/i,
    askDateTime: /date|time|when|available|schedule/i,
    askConfirm: /confirm|proceed|book|schedule/i,
    // Create dynamic pattern for checking if a name appears
    containsName: (name) => new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
};
/**
 * Semantic expectation type helpers for common scenarios
 */
exports.semanticExpectations = {
    /** Agent should greet the caller */
    greeting: () => ({
        type: 'contains_greeting',
        description: 'Response should contain a greeting',
        required: true,
    }),
    /** Agent should ask for the caller's name */
    askForName: () => ({
        type: 'asks_for_name',
        description: 'Should ask for caller name',
        required: true,
    }),
    /** Agent should ask for general information */
    askForInfo: (info) => ({
        type: 'asks_for_info',
        description: info || 'Should ask for information',
        required: true,
    }),
    /** Agent should confirm provided information */
    confirmInfo: () => ({
        type: 'confirms_info',
        description: 'Should confirm the information provided',
        required: true,
    }),
    /** Agent should confirm a booking */
    confirmBooking: () => ({
        type: 'confirms_booking',
        description: 'Should confirm the booking was made',
        required: true,
    }),
    /** Agent should offer options */
    offerOptions: () => ({
        type: 'offers_options',
        description: 'Should offer choices or options',
        required: false,
    }),
    /** Agent should acknowledge input */
    acknowledge: () => ({
        type: 'acknowledges_input',
        description: 'Should acknowledge what was said',
        required: true,
    }),
    /** Agent should handle an error gracefully */
    handleError: () => ({
        type: 'handles_error',
        description: 'Should handle error gracefully',
        required: true,
    }),
    /** Agent should ask for date of birth */
    askForDob: () => ({
        type: 'asks_for_dob',
        description: 'Should ask for date of birth',
        required: true,
    }),
    /** Agent should ask about insurance */
    askForInsurance: () => ({
        type: 'asks_for_insurance',
        description: 'Should ask about insurance',
        required: true,
    }),
    /** Agent should ask for email */
    askForEmail: () => ({
        type: 'asks_for_email',
        description: 'Should ask for email address',
        required: true,
    }),
    /** Agent should mention the location */
    mentionLocation: () => ({
        type: 'mentions_location',
        description: 'Should mention the location',
        required: true,
    }),
    /** Agent should transfer to live agent */
    transferToAgent: () => ({
        type: 'transfers_to_agent',
        description: 'Should transfer to a live agent',
        required: true,
    }),
    /** Custom expectation */
    custom: (criteria, required = true) => ({
        type: 'custom',
        description: criteria,
        customCriteria: criteria,
        required,
    }),
};
/**
 * Negative expectation helpers for common error conditions
 */
exports.negativeExpectations = {
    /** Response should not contain errors */
    noErrors: () => ({
        type: 'contains_error',
        description: 'Should not contain errors',
        severity: 'critical',
    }),
    /** Response should not expose internal details */
    noInternalDetails: () => ({
        type: 'exposes_internal',
        description: 'Should not expose internal implementation details',
        severity: 'high',
    }),
    /** Response should not contradict earlier statements */
    noContradiction: () => ({
        type: 'contradicts_previous',
        description: 'Should not contradict earlier statements',
        severity: 'high',
    }),
    /** Response should not ignore user input */
    noIgnoring: () => ({
        type: 'ignores_input',
        description: 'Should not ignore what the user said',
        severity: 'medium',
    }),
    /** Response should not use banned words */
    noBannedWords: () => ({
        type: 'uses_banned_words',
        description: 'Should not use banned words (sorry, problem, etc.)',
        severity: 'low',
    }),
    /** Custom negative expectation */
    custom: (criteria, severity = 'medium') => ({
        type: 'custom',
        description: criteria,
        customCriteria: criteria,
        severity,
    }),
};
//# sourceMappingURL=test-case.js.map