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
  // Data from Cloud 9 sandbox
  patients: Patient[];
  locations: Location[];
  providers: Provider[];
  appointmentTypes: AppointmentType[];
  availableSlots: AvailableSlot[];

  // Selections made during test
  selectedPatient?: Patient;
  selectedLocation?: Location;
  selectedProvider?: Provider;
  selectedAppointmentType?: AppointmentType;
  selectedSlot?: AvailableSlot;

  // Conversation history
  conversationHistory: ConversationTurn[];

  // Custom data extracted from responses
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

  // The message to send - can be static or dynamic
  userMessage: string | ((context: TestContext) => string);

  // Patterns that SHOULD appear in the response (regex-based, kept as fallback)
  expectedPatterns: (string | RegExp | ((context: TestContext) => string | RegExp))[];

  // Patterns that should NOT appear in the response (regex-based, kept as fallback)
  unexpectedPatterns: (string | RegExp | ((context: TestContext) => string | RegExp))[];

  // NEW: Semantic expectations (AI-powered evaluation)
  semanticExpectations?: SemanticExpectation[];

  // NEW: Negative semantic expectations
  negativeExpectations?: NegativeExpectation[];

  // Custom validation function
  validator?: (response: string, context: TestContext) => ValidationResult;

  // Extract data from response to use in later steps
  extractData?: (response: string, context: TestContext) => Record<string, any>;

  // Update context selections based on response
  updateContext?: (response: string, context: TestContext) => Partial<TestContext>;

  // Timeout for this specific step (ms)
  timeout?: number;

  // Delay before sending message (ms)
  delay?: number;

  // Whether this step is optional (doesn't fail test if it fails)
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

  // Data needed for this test
  dataRequirements: DataRequirement[];

  // Conversation steps
  steps: ConversationStep[];

  // Expected outcomes
  expectations: Expectation[];

  // Setup function (optional)
  setup?: (context: TestContext) => Promise<void> | void;

  // Teardown function (optional)
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
export function createStep(
  id: string,
  userMessage: string | ((ctx: TestContext) => string),
  options: Partial<ConversationStep> = {}
): ConversationStep {
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
export function createSemanticStep(
  id: string,
  userMessage: string | ((ctx: TestContext) => string),
  semanticExpectations: SemanticExpectation[],
  options: Partial<ConversationStep> = {}
): ConversationStep {
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
export const patterns = {
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
  containsName: (name: string) => new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
};

/**
 * Semantic expectation type helpers for common scenarios
 */
export const semanticExpectations = {
  /** Agent should greet the caller */
  greeting: (): SemanticExpectation => ({
    type: 'contains_greeting',
    description: 'Response should contain a greeting',
    required: true,
  }),

  /** Agent should ask for the caller's name */
  askForName: (): SemanticExpectation => ({
    type: 'asks_for_name',
    description: 'Should ask for caller name',
    required: true,
  }),

  /** Agent should ask for general information */
  askForInfo: (info?: string): SemanticExpectation => ({
    type: 'asks_for_info',
    description: info || 'Should ask for information',
    required: true,
  }),

  /** Agent should confirm provided information */
  confirmInfo: (): SemanticExpectation => ({
    type: 'confirms_info',
    description: 'Should confirm the information provided',
    required: true,
  }),

  /** Agent should confirm a booking */
  confirmBooking: (): SemanticExpectation => ({
    type: 'confirms_booking',
    description: 'Should confirm the booking was made',
    required: true,
  }),

  /** Agent should offer options */
  offerOptions: (): SemanticExpectation => ({
    type: 'offers_options',
    description: 'Should offer choices or options',
    required: false,
  }),

  /** Agent should acknowledge input */
  acknowledge: (): SemanticExpectation => ({
    type: 'acknowledges_input',
    description: 'Should acknowledge what was said',
    required: true,
  }),

  /** Agent should handle an error gracefully */
  handleError: (): SemanticExpectation => ({
    type: 'handles_error',
    description: 'Should handle error gracefully',
    required: true,
  }),

  /** Agent should ask for date of birth */
  askForDob: (): SemanticExpectation => ({
    type: 'asks_for_dob',
    description: 'Should ask for date of birth',
    required: true,
  }),

  /** Agent should ask about insurance */
  askForInsurance: (): SemanticExpectation => ({
    type: 'asks_for_insurance',
    description: 'Should ask about insurance',
    required: true,
  }),

  /** Agent should ask for email */
  askForEmail: (): SemanticExpectation => ({
    type: 'asks_for_email',
    description: 'Should ask for email address',
    required: true,
  }),

  /** Agent should mention the location */
  mentionLocation: (): SemanticExpectation => ({
    type: 'mentions_location',
    description: 'Should mention the location',
    required: true,
  }),

  /** Agent should transfer to live agent */
  transferToAgent: (): SemanticExpectation => ({
    type: 'transfers_to_agent',
    description: 'Should transfer to a live agent',
    required: true,
  }),

  /** Custom expectation */
  custom: (criteria: string, required = true): SemanticExpectation => ({
    type: 'custom',
    description: criteria,
    customCriteria: criteria,
    required,
  }),
};

/**
 * Negative expectation helpers for common error conditions
 */
export const negativeExpectations = {
  /** Response should not contain errors */
  noErrors: (): NegativeExpectation => ({
    type: 'contains_error',
    description: 'Should not contain errors',
    severity: 'critical',
  }),

  /** Response should not expose internal details */
  noInternalDetails: (): NegativeExpectation => ({
    type: 'exposes_internal',
    description: 'Should not expose internal implementation details',
    severity: 'high',
  }),

  /** Response should not contradict earlier statements */
  noContradiction: (): NegativeExpectation => ({
    type: 'contradicts_previous',
    description: 'Should not contradict earlier statements',
    severity: 'high',
  }),

  /** Response should not ignore user input */
  noIgnoring: (): NegativeExpectation => ({
    type: 'ignores_input',
    description: 'Should not ignore what the user said',
    severity: 'medium',
  }),

  /** Response should not use banned words */
  noBannedWords: (): NegativeExpectation => ({
    type: 'uses_banned_words',
    description: 'Should not use banned words (sorry, problem, etc.)',
    severity: 'low',
  }),

  /** Custom negative expectation */
  custom: (criteria: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): NegativeExpectation => ({
    type: 'custom',
    description: criteria,
    customCriteria: criteria,
    severity,
  }),
};
