/**
 * Test Case Interface Definitions
 *
 * Enhanced with semantic expectation types for AI-powered evaluation
 */
import { Patient, Location, Provider, AppointmentType, AvailableSlot } from '../core/cloud9-client';
import { SemanticEvaluation, SemanticExpectation, NegativeExpectation } from '../schemas/evaluation-schemas';
/**
 * Context passed between test steps
 */
export interface TestContext {
    patients: Patient[];
    locations: Location[];
    providers: Provider[];
    appointmentTypes: AppointmentType[];
    availableSlots: AvailableSlot[];
    selectedPatient?: Patient;
    selectedLocation?: Location;
    selectedProvider?: Provider;
    selectedAppointmentType?: AppointmentType;
    selectedSlot?: AvailableSlot;
    conversationHistory: ConversationTurn[];
    extractedData: Record<string, any>;
}
/**
 * A single turn in the conversation
 */
export interface ConversationTurn {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    responseTimeMs?: number;
    stepId?: string;
    validationPassed?: boolean;
    validationMessage?: string;
}
/**
 * Result of validating a response
 */
export interface ValidationResult {
    passed: boolean;
    message: string;
    severity?: 'critical' | 'high' | 'medium' | 'low';
    recommendation?: string;
    /** Confidence score from semantic evaluation (0-1) */
    confidence?: number;
    /** Full semantic evaluation result (when using AI-powered evaluation) */
    semanticEvaluation?: SemanticEvaluation;
}
/**
 * A single step in a test conversation
 */
export interface ConversationStep {
    id: string;
    description?: string;
    userMessage: string | ((context: TestContext) => string);
    expectedPatterns: (string | RegExp | ((context: TestContext) => string | RegExp))[];
    unexpectedPatterns: (string | RegExp | ((context: TestContext) => string | RegExp))[];
    semanticExpectations?: SemanticExpectation[];
    negativeExpectations?: NegativeExpectation[];
    validator?: (response: string, context: TestContext) => ValidationResult;
    extractData?: (response: string, context: TestContext) => Record<string, any>;
    updateContext?: (response: string, context: TestContext) => Partial<TestContext>;
    timeout?: number;
    delay?: number;
    optional?: boolean;
}
/**
 * Data requirements for a test
 */
export interface DataRequirement {
    type: 'patient' | 'location' | 'provider' | 'appointmentType' | 'availableSlot';
    source: 'cloud9-sandbox';
    filter?: Record<string, any>;
    count?: number;
}
/**
 * Expected outcome of a test
 */
export interface Expectation {
    type: 'conversation-complete' | 'final-state' | 'no-errors' | 'custom';
    description: string;
    validator?: (context: TestContext) => ValidationResult;
}
/**
 * Complete test case definition
 */
export interface TestCase {
    id: string;
    name: string;
    description: string;
    category: 'happy-path' | 'edge-case' | 'error-handling';
    tags: string[];
    dataRequirements: DataRequirement[];
    steps: ConversationStep[];
    expectations: Expectation[];
    setup?: (context: TestContext) => Promise<void> | void;
    teardown?: (context: TestContext) => Promise<void> | void;
}
/**
 * Finding discovered during test execution
 */
export interface Finding {
    type: 'bug' | 'enhancement' | 'prompt-issue' | 'tool-issue' | 'regression';
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    affectedStep?: string;
    agentQuestion?: string;
    expectedBehavior?: string;
    actualBehavior?: string;
    recommendation?: string;
}
/**
 * Helper to create a conversation step
 */
export declare function createStep(id: string, userMessage: string | ((ctx: TestContext) => string), options?: Partial<ConversationStep>): ConversationStep;
/**
 * Helper to create a conversation step with semantic expectations
 */
export declare function createSemanticStep(id: string, userMessage: string | ((ctx: TestContext) => string), semanticExpectations: SemanticExpectation[], options?: Partial<ConversationStep>): ConversationStep;
/**
 * Helper to create pattern matchers
 */
export declare const patterns: {
    success: RegExp;
    found: RegExp;
    askForMore: RegExp;
    error: RegExp;
    notFound: RegExp;
    askPatient: RegExp;
    askLocation: RegExp;
    askAppointmentType: RegExp;
    askDateTime: RegExp;
    askConfirm: RegExp;
    containsName: (name: string) => RegExp;
};
/**
 * Semantic expectation type helpers for common scenarios
 */
export declare const semanticExpectations: {
    /** Agent should greet the caller */
    greeting: () => SemanticExpectation;
    /** Agent should ask for the caller's name */
    askForName: () => SemanticExpectation;
    /** Agent should ask for general information */
    askForInfo: (info?: string) => SemanticExpectation;
    /** Agent should confirm provided information */
    confirmInfo: () => SemanticExpectation;
    /** Agent should confirm a booking */
    confirmBooking: () => SemanticExpectation;
    /** Agent should offer options */
    offerOptions: () => SemanticExpectation;
    /** Agent should acknowledge input */
    acknowledge: () => SemanticExpectation;
    /** Agent should handle an error gracefully */
    handleError: () => SemanticExpectation;
    /** Agent should ask for date of birth */
    askForDob: () => SemanticExpectation;
    /** Agent should ask about insurance */
    askForInsurance: () => SemanticExpectation;
    /** Agent should ask for email */
    askForEmail: () => SemanticExpectation;
    /** Agent should mention the location */
    mentionLocation: () => SemanticExpectation;
    /** Agent should transfer to live agent */
    transferToAgent: () => SemanticExpectation;
    /** Custom expectation */
    custom: (criteria: string, required?: boolean) => SemanticExpectation;
};
/**
 * Negative expectation helpers for common error conditions
 */
export declare const negativeExpectations: {
    /** Response should not contain errors */
    noErrors: () => NegativeExpectation;
    /** Response should not expose internal details */
    noInternalDetails: () => NegativeExpectation;
    /** Response should not contradict earlier statements */
    noContradiction: () => NegativeExpectation;
    /** Response should not ignore user input */
    noIgnoring: () => NegativeExpectation;
    /** Response should not use banned words */
    noBannedWords: () => NegativeExpectation;
    /** Custom negative expectation */
    custom: (criteria: string, severity?: "low" | "medium" | "high" | "critical") => NegativeExpectation;
};
//# sourceMappingURL=test-case.d.ts.map