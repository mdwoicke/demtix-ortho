/**
 * Migration Script: Convert Sequential Test Cases to Goal-Oriented Format
 *
 * Run with: npx ts-node scripts/migrate-to-goal-tests.ts
 */

import BetterSqlite3 from 'better-sqlite3';
import path from 'path';

// Path to test-agent database
const TEST_AGENT_DB_PATH = path.resolve(__dirname, '../data/test-results.db');

// ============================================================================
// TYPE DEFINITIONS (matching goalTestService.ts)
// ============================================================================

interface ChildDataDTO {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  isNewPatient: boolean;
  hadBracesBefore?: boolean;
  specialNeeds?: string;
}

interface DataInventoryDTO {
  parentFirstName: string;
  parentLastName: string;
  parentPhone: string;
  parentEmail?: string;
  children: ChildDataDTO[];
  hasInsurance?: boolean;
  insuranceProvider?: string;
  preferredLocation?: string;
  preferredTimeOfDay?: 'morning' | 'afternoon' | 'any';
  preferredDateRange?: {
    start: string;
    end: string;
  };
  previousVisitToOffice?: boolean;
  previousOrthoTreatment?: boolean;
}

interface PersonaTraitsDTO {
  verbosity: 'terse' | 'normal' | 'verbose';
  providesExtraInfo: boolean;
  patienceLevel?: 'patient' | 'moderate' | 'impatient';
  techSavviness?: 'low' | 'moderate' | 'high';
}

interface UserPersonaDTO {
  name: string;
  description?: string;
  inventory: DataInventoryDTO;
  traits: PersonaTraitsDTO;
}

type CollectableFieldDTO =
  | 'parent_name' | 'parent_name_spelling' | 'parent_phone' | 'parent_email'
  | 'child_count' | 'child_names' | 'child_dob' | 'child_age'
  | 'is_new_patient' | 'previous_visit' | 'previous_ortho'
  | 'insurance' | 'insurance_group_id' | 'insurance_member_id' | 'insurance_in_network'
  | 'special_needs' | 'time_preference' | 'location_preference'
  | 'address_provided' | 'parking_info' | 'hours_info'
  | 'court_docs_mentioned' | 'early_arrival_mentioned' | 'card_reminder';

type GoalTypeDTO =
  | 'data_collection'
  | 'booking_confirmed'
  | 'transfer_initiated'
  | 'conversation_ended'
  | 'error_handled'
  | 'custom';

interface ConversationGoalDTO {
  id: string;
  type: GoalTypeDTO;
  description: string;
  requiredFields?: CollectableFieldDTO[];
  priority: number;
  required: boolean;
}

type ConstraintTypeDTO =
  | 'must_happen'
  | 'must_not_happen'
  | 'max_turns'
  | 'max_time';

interface TestConstraintDTO {
  type: ConstraintTypeDTO;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  maxTurns?: number;
  maxTimeMs?: number;
}

interface ResponseConfigDTO {
  maxTurns: number;
  useLlmResponses: boolean;
  handleUnknownIntents: 'fail' | 'clarify' | 'generic';
}

interface GoalTestCase {
  caseId: string;
  name: string;
  description: string;
  category: 'happy-path' | 'edge-case' | 'error-handling';
  tags: string[];
  persona: UserPersonaDTO;
  goals: ConversationGoalDTO[];
  constraints: TestConstraintDTO[];
  responseConfig: ResponseConfigDTO;
  initialMessage: string;
}

// ============================================================================
// DEFAULT TRAITS
// ============================================================================

const DEFAULT_TRAITS: PersonaTraitsDTO = {
  verbosity: 'normal',
  providesExtraInfo: false,
  patienceLevel: 'moderate',
  techSavviness: 'moderate',
};

// ============================================================================
// STANDARD GOAL SETS
// ============================================================================

const STANDARD_DATA_COLLECTION_GOALS: ConversationGoalDTO[] = [
  {
    id: 'collect-parent-info',
    type: 'data_collection',
    description: 'Collect parent name and phone number',
    requiredFields: ['parent_name', 'parent_name_spelling', 'parent_phone'],
    priority: 1,
    required: true,
  },
  {
    id: 'collect-child-count',
    type: 'data_collection',
    description: 'Determine number of children for appointment',
    requiredFields: ['child_count'],
    priority: 2,
    required: true,
  },
  {
    id: 'collect-patient-status',
    type: 'data_collection',
    description: 'Confirm patient history (previous visit implies new patient status)',
    requiredFields: ['previous_visit', 'previous_ortho'],
    priority: 3,
    required: true,
  },
  {
    id: 'collect-child-info',
    type: 'data_collection',
    description: 'Collect child name and date of birth',
    requiredFields: ['child_names', 'child_dob'],
    priority: 4,
    required: true,
  },
  {
    id: 'collect-insurance',
    type: 'data_collection',
    description: 'Collect insurance information',
    requiredFields: ['insurance'],
    priority: 5,
    required: true,
  },
  {
    id: 'collect-preferences',
    type: 'data_collection',
    description: 'Collect special needs and scheduling preferences',
    requiredFields: ['special_needs', 'parent_email', 'time_preference'],
    priority: 6,
    required: false,
  },
];

const BOOKING_GOAL: ConversationGoalDTO = {
  id: 'booking-confirmed',
  type: 'booking_confirmed',
  description: 'Appointment successfully scheduled',
  priority: 10,
  required: true,
};

const TRANSFER_GOAL: ConversationGoalDTO = {
  id: 'transfer-to-agent',
  type: 'transfer_initiated',
  description: 'Transfer to live agent or specialist',
  priority: 10,
  required: true,
};

const GRACEFUL_END_GOAL: ConversationGoalDTO = {
  id: 'graceful-end',
  type: 'conversation_ended',
  description: 'Conversation ended gracefully',
  priority: 10,
  required: true,
};

const ERROR_HANDLED_GOAL: ConversationGoalDTO = {
  id: 'error-handled',
  type: 'error_handled',
  description: 'Error handled gracefully without crashing',
  priority: 10,
  required: true,
};

// ============================================================================
// STANDARD CONSTRAINTS
// ============================================================================

const NO_ERRORS_CONSTRAINT: TestConstraintDTO = {
  type: 'must_not_happen',
  description: 'No error messages or system failures',
  severity: 'critical',
};

const NO_INTERNAL_DETAILS_CONSTRAINT: TestConstraintDTO = {
  type: 'must_not_happen',
  description: 'No internal error details exposed to user',
  severity: 'high',
};

const MAX_TURNS_20: TestConstraintDTO = {
  type: 'max_turns',
  description: 'Complete within 20 conversation turns',
  severity: 'medium',
  maxTurns: 20,
};

const MAX_TURNS_25: TestConstraintDTO = {
  type: 'max_turns',
  description: 'Complete within 25 conversation turns',
  severity: 'medium',
  maxTurns: 25,
};

const MAX_TURNS_10: TestConstraintDTO = {
  type: 'max_turns',
  description: 'Complete within 10 conversation turns',
  severity: 'medium',
  maxTurns: 10,
};

// ============================================================================
// TEST CASES CONVERTED TO GOAL-ORIENTED FORMAT
// ============================================================================

const goalTestCases: GoalTestCase[] = [
  // =========================================================================
  // HAPPY PATH SCENARIOS
  // =========================================================================
  {
    caseId: 'GOAL-HAPPY-001',
    name: 'New Patient Ortho Consult - Single Child',
    description: 'Complete new patient orthodontic consult booking for one child. Agent should collect all required info and confirm booking.',
    category: 'happy-path',
    tags: ['booking', 'new-patient', 'single-child', 'priority-high'],
    persona: {
      name: 'Sarah Johnson',
      description: 'Parent with one child needing orthodontic consult',
      inventory: {
        parentFirstName: 'Sarah',
        parentLastName: 'Johnson',
        parentPhone: '2155551234',
        parentEmail: 'sarah@email.com',
        children: [{
          firstName: 'Emma',
          lastName: 'Johnson',
          dateOfBirth: '2014-03-15',
          isNewPatient: true,
          hadBracesBefore: false,
        }],
        hasInsurance: true,
        insuranceProvider: 'Keystone First',
        previousVisitToOffice: false,
        previousOrthoTreatment: false,
        preferredTimeOfDay: 'any',
        preferredDateRange: { start: '2026-01-01', end: '2026-01-02' },
      },
      traits: DEFAULT_TRAITS,
    },
    goals: [...STANDARD_DATA_COLLECTION_GOALS, BOOKING_GOAL],
    constraints: [NO_ERRORS_CONSTRAINT, MAX_TURNS_20],
    responseConfig: {
      maxTurns: 20,
      useLlmResponses: false,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'Hi I need to schedule an orthodontic appointment for my child',
  },

  {
    caseId: 'GOAL-HAPPY-002',
    name: 'New Patient Ortho Consult - Two Siblings',
    description: 'Book new patient orthodontic consult for two children (siblings). Agent should handle multiple children correctly.',
    category: 'happy-path',
    tags: ['booking', 'new-patient', 'siblings', 'multiple-children'],
    persona: {
      name: 'Michael Davis',
      description: 'Parent with two children needing appointments',
      inventory: {
        parentFirstName: 'Michael',
        parentLastName: 'Davis',
        parentPhone: '2155559876',
        parentEmail: 'mike@email.com',
        children: [
          {
            firstName: 'Jake',
            lastName: 'Davis',
            dateOfBirth: '2012-01-10',
            isNewPatient: true,
            hadBracesBefore: false,
          },
          {
            firstName: 'Lily',
            lastName: 'Davis',
            dateOfBirth: '2015-05-20',
            isNewPatient: true,
            hadBracesBefore: false,
          },
        ],
        hasInsurance: true,
        insuranceProvider: 'Aetna Better Health',
        previousVisitToOffice: false,
        previousOrthoTreatment: false,
        preferredTimeOfDay: 'any',
        preferredDateRange: { start: '2026-01-01', end: '2026-01-02' },
      },
      traits: DEFAULT_TRAITS,
    },
    goals: [...STANDARD_DATA_COLLECTION_GOALS, BOOKING_GOAL],
    constraints: [NO_ERRORS_CONSTRAINT, MAX_TURNS_25],
    responseConfig: {
      maxTurns: 25,
      useLlmResponses: false,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'Hi I need to schedule appointments for my two kids',
  },

  {
    caseId: 'GOAL-HAPPY-003',
    name: 'Quick Info Provider - All Details Upfront',
    description: 'Parent provides extensive information upfront. Agent should acknowledge and process efficiently.',
    category: 'happy-path',
    tags: ['booking', 'quick-path', 'efficient', 'verbose-user'],
    persona: {
      name: 'Jane Smith',
      description: 'Efficient parent who provides lots of info at once',
      inventory: {
        parentFirstName: 'Jane',
        parentLastName: 'Smith',
        parentPhone: '2155551111',
        parentEmail: 'jane@email.com',
        children: [{
          firstName: 'Emma',
          lastName: 'Smith',
          dateOfBirth: '2014-02-05',
          isNewPatient: true,
          hadBracesBefore: false,
        }],
        hasInsurance: true,
        insuranceProvider: 'Keystone First',
        previousVisitToOffice: false,
        previousOrthoTreatment: false,
        preferredTimeOfDay: 'any',
        preferredDateRange: { start: '2026-01-01', end: '2026-01-02' },
      },
      traits: {
        verbosity: 'verbose',
        providesExtraInfo: true,
        patienceLevel: 'impatient',
        techSavviness: 'high',
      },
    },
    goals: [...STANDARD_DATA_COLLECTION_GOALS, BOOKING_GOAL],
    constraints: [NO_ERRORS_CONSTRAINT, MAX_TURNS_20],
    responseConfig: {
      maxTurns: 20,
      useLlmResponses: true, // Enable LLM for natural responses
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'Hi I need to schedule an appointment',
  },

  // =========================================================================
  // EDGE CASE SCENARIOS
  // =========================================================================
  {
    caseId: 'GOAL-EDGE-001',
    name: 'Existing Patient - Transfer to Specialist',
    description: 'Existing patient should be transferred to live agent (not new patient consult). Agent must recognize and transfer.',
    category: 'edge-case',
    tags: ['existing-patient', 'transfer', 'not-new'],
    persona: {
      name: 'John Smith',
      description: 'Existing patient who has visited before',
      inventory: {
        parentFirstName: 'John',
        parentLastName: 'Smith',
        parentPhone: '2155551234',
        children: [{
          firstName: 'Tommy',
          lastName: 'Smith',
          dateOfBirth: '2013-06-15',
          isNewPatient: false, // EXISTING patient
          hadBracesBefore: false,
        }],
        previousVisitToOffice: true, // Has visited before
        previousOrthoTreatment: false,
      },
      traits: DEFAULT_TRAITS,
    },
    goals: [
      {
        id: 'collect-basic-info',
        type: 'data_collection',
        description: 'Collect parent name and phone',
        requiredFields: ['parent_name', 'parent_phone'],
        priority: 1,
        required: true,
      },
      {
        id: 'recognize-existing',
        type: 'custom',
        description: 'Agent recognizes this is an existing patient',
        priority: 5,
        required: true,
      },
      TRANSFER_GOAL,
    ],
    constraints: [
      NO_ERRORS_CONSTRAINT,
      {
        type: 'must_not_happen',
        description: 'Should not continue with new patient flow',
        severity: 'high',
      },
    ],
    responseConfig: {
      maxTurns: 15,
      useLlmResponses: false,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'Hi I need to schedule an appointment for my child',
  },

  {
    caseId: 'GOAL-EDGE-002',
    name: 'Multiple Children - Three Siblings',
    description: 'Handle booking for three siblings in same call. Agent should manage multiple children correctly.',
    category: 'edge-case',
    tags: ['siblings', 'multiple-children', 'three-children'],
    persona: {
      name: 'Mary Johnson',
      description: 'Parent with three children needing appointments',
      inventory: {
        parentFirstName: 'Mary',
        parentLastName: 'Johnson',
        parentPhone: '2155559999',
        parentEmail: 'mary@email.com',
        children: [
          { firstName: 'Alex', lastName: 'Johnson', dateOfBirth: '2011-03-10', isNewPatient: true },
          { firstName: 'Ben', lastName: 'Johnson', dateOfBirth: '2013-07-22', isNewPatient: true },
          { firstName: 'Cara', lastName: 'Johnson', dateOfBirth: '2016-01-15', isNewPatient: true },
        ],
        hasInsurance: true,
        insuranceProvider: 'Blue Cross',
        previousVisitToOffice: false,
        previousOrthoTreatment: false,
      },
      traits: DEFAULT_TRAITS,
    },
    goals: [
      ...STANDARD_DATA_COLLECTION_GOALS,
      {
        id: 'handle-three-children',
        type: 'custom',
        description: 'Correctly collect info for all three children',
        priority: 5,
        required: true,
      },
      BOOKING_GOAL,
    ],
    constraints: [NO_ERRORS_CONSTRAINT, MAX_TURNS_25],
    responseConfig: {
      maxTurns: 30, // More turns for 3 children
      useLlmResponses: false,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'I need to schedule orthodontic consults for my three children',
  },

  {
    caseId: 'GOAL-EDGE-003',
    name: 'User Changes Mind Mid-Flow',
    description: 'User wants to change number of children mid-conversation. Agent should handle corrections gracefully.',
    category: 'edge-case',
    tags: ['flow-change', 'user-correction', 'mid-conversation'],
    persona: {
      name: 'Lisa Brown',
      description: 'Parent who changes mind about number of children',
      inventory: {
        parentFirstName: 'Lisa',
        parentLastName: 'Brown',
        parentPhone: '2155557777',
        children: [
          { firstName: 'Child1', lastName: 'Brown', dateOfBirth: '2012-04-10', isNewPatient: true },
          { firstName: 'Child2', lastName: 'Brown', dateOfBirth: '2014-08-20', isNewPatient: true },
          { firstName: 'Child3', lastName: 'Brown', dateOfBirth: '2016-12-05', isNewPatient: true },
        ],
        previousVisitToOffice: false,
        previousOrthoTreatment: false,
      },
      traits: {
        verbosity: 'normal',
        providesExtraInfo: false,
        patienceLevel: 'patient',
        techSavviness: 'moderate',
      },
    },
    goals: [
      {
        id: 'collect-basic-info',
        type: 'data_collection',
        description: 'Collect parent name',
        requiredFields: ['parent_name', 'parent_name_spelling'],
        priority: 1,
        required: true,
      },
      {
        id: 'handle-correction',
        type: 'custom',
        description: 'Handle user correction about number of children',
        priority: 5,
        required: true,
      },
    ],
    constraints: [
      NO_ERRORS_CONSTRAINT,
      {
        type: 'must_not_happen',
        description: 'Agent should not be confused by correction',
        severity: 'high',
      },
    ],
    responseConfig: {
      maxTurns: 15,
      useLlmResponses: true,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'I need to schedule appointments for my kids',
  },

  {
    caseId: 'GOAL-EDGE-004',
    name: 'Previous Orthodontic Treatment',
    description: 'Child has had previous orthodontic treatment elsewhere. Agent should note this and continue appropriately.',
    category: 'edge-case',
    tags: ['previous-treatment', 'ortho-history', 'had-braces'],
    persona: {
      name: 'Susan Miller',
      description: 'Parent whose child has had braces before at another office',
      inventory: {
        parentFirstName: 'Susan',
        parentLastName: 'Miller',
        parentPhone: '2155553333',
        children: [{
          firstName: 'Amy',
          lastName: 'Miller',
          dateOfBirth: '2010-09-12',
          isNewPatient: true, // New to this office
          hadBracesBefore: true, // Had braces elsewhere
        }],
        previousVisitToOffice: false,
        previousOrthoTreatment: true, // Important flag
        hasInsurance: true,
        insuranceProvider: 'Delta Dental',
      },
      traits: DEFAULT_TRAITS,
    },
    goals: [
      ...STANDARD_DATA_COLLECTION_GOALS,
      {
        id: 'note-previous-treatment',
        type: 'data_collection',
        description: 'Agent asks about and collects previous orthodontic treatment history',
        requiredFields: ['previous_ortho'],
        priority: 5,
        required: true,
      },
      BOOKING_GOAL, // Added to ensure full booking flow is tested
    ],
    constraints: [NO_ERRORS_CONSTRAINT, MAX_TURNS_25], // Increased turns for full booking
    responseConfig: {
      maxTurns: 25,
      useLlmResponses: false,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'I need a consult for my daughter',
  },

  {
    caseId: 'GOAL-EDGE-005',
    name: 'Not Orthodontic - General Dentistry',
    description: 'Caller asks about general dentistry instead of orthodontics. Agent should clarify scope.',
    category: 'edge-case',
    tags: ['wrong-intent', 'general-dentistry', 'scope-mismatch'],
    persona: {
      name: 'Bob Wilson',
      description: 'Parent looking for general dental cleaning, not orthodontics',
      inventory: {
        parentFirstName: 'Bob',
        parentLastName: 'Wilson',
        parentPhone: '2155554444',
        children: [{
          firstName: 'Sam',
          lastName: 'Wilson',
          dateOfBirth: '2015-11-20',
          isNewPatient: true,
        }],
      },
      traits: DEFAULT_TRAITS,
    },
    goals: [
      {
        id: 'clarify-scope',
        type: 'custom',
        description: 'Agent clarifies this line is for orthodontics only',
        priority: 1,
        required: true,
      },
      TRANSFER_GOAL,
    ],
    constraints: [
      NO_ERRORS_CONSTRAINT,
      {
        type: 'must_happen',
        description: 'Must clarify orthodontic-only service',
        severity: 'high',
      },
    ],
    responseConfig: {
      maxTurns: 10,
      useLlmResponses: false,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'Hi I need to schedule a dental cleaning for my child',
  },

  // =========================================================================
  // ERROR HANDLING SCENARIOS
  // =========================================================================
  {
    caseId: 'GOAL-ERR-001',
    name: 'Gibberish Input Recovery',
    description: 'Handle completely nonsensical user input and recover. Agent should ask for clarification.',
    category: 'error-handling',
    tags: ['input-validation', 'gibberish', 'recovery'],
    persona: {
      name: 'Test User',
      description: 'User who initially sends gibberish then clarifies',
      inventory: {
        parentFirstName: 'Test',
        parentLastName: 'User',
        parentPhone: '2155550000',
        children: [{
          firstName: 'Child',
          lastName: 'User',
          dateOfBirth: '2015-01-01',
          isNewPatient: true,
        }],
      },
      traits: DEFAULT_TRAITS,
    },
    goals: [
      ERROR_HANDLED_GOAL,
      {
        id: 'recover-from-gibberish',
        type: 'custom',
        description: 'Agent recovers and continues after gibberish input',
        priority: 5,
        required: true,
      },
    ],
    constraints: [
      NO_ERRORS_CONSTRAINT,
      NO_INTERNAL_DETAILS_CONSTRAINT,
      {
        type: 'must_not_happen',
        description: 'System should not crash or show error',
        severity: 'critical',
      },
    ],
    responseConfig: {
      maxTurns: 10,
      useLlmResponses: true,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'asdfghjkl qwerty zxcvbnm 12345',
  },

  {
    caseId: 'GOAL-ERR-002',
    name: 'Empty or Whitespace Input',
    description: 'Handle empty or whitespace-only messages. Agent should not crash.',
    category: 'error-handling',
    tags: ['input-validation', 'empty', 'whitespace'],
    persona: {
      name: 'Quiet User',
      description: 'User who sends empty message first',
      inventory: {
        parentFirstName: 'Quiet',
        parentLastName: 'User',
        parentPhone: '2155550001',
        children: [{
          firstName: 'Child',
          lastName: 'User',
          dateOfBirth: '2015-06-15',
          isNewPatient: true,
        }],
      },
      traits: { verbosity: 'terse', providesExtraInfo: false },
    },
    goals: [
      ERROR_HANDLED_GOAL,
      {
        id: 'handle-empty-input',
        type: 'custom',
        description: 'Agent handles empty input without crashing',
        priority: 5,
        required: true,
      },
    ],
    constraints: [
      NO_ERRORS_CONSTRAINT,
      NO_INTERNAL_DETAILS_CONSTRAINT,
    ],
    responseConfig: {
      maxTurns: 10,
      useLlmResponses: false,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: '   ',
  },

  {
    caseId: 'GOAL-ERR-003',
    name: 'Very Long Input',
    description: 'Handle extremely long user messages without timing out.',
    category: 'error-handling',
    tags: ['input-validation', 'length', 'stress-test'],
    persona: {
      name: 'Sarah Johnson',
      description: 'User who sends very long message',
      inventory: {
        parentFirstName: 'Sarah',
        parentLastName: 'Johnson',
        parentPhone: '2155551234',
        children: [{
          firstName: 'Emma',
          lastName: 'Johnson',
          dateOfBirth: '2014-03-15',
          isNewPatient: true,
        }],
      },
      traits: { verbosity: 'verbose', providesExtraInfo: true },
    },
    goals: [
      ERROR_HANDLED_GOAL,
      {
        id: 'process-long-input',
        type: 'custom',
        description: 'Agent processes long input without timing out',
        priority: 5,
        required: true,
      },
    ],
    constraints: [
      NO_ERRORS_CONSTRAINT,
      {
        type: 'max_time',
        description: 'Should respond within 30 seconds',
        severity: 'medium',
        maxTimeMs: 30000,
      },
    ],
    responseConfig: {
      maxTurns: 10,
      useLlmResponses: true,
      handleUnknownIntents: 'generic',
    },
    // Long message will be generated at runtime
    initialMessage: 'I would like to schedule an orthodontic appointment for my child please. '.repeat(30) + 'My name is Sarah Johnson and my phone is 2155551234',
  },

  {
    caseId: 'GOAL-ERR-004',
    name: 'Cancel Mid-Conversation',
    description: 'User wants to cancel/abandon booking process. Agent should acknowledge and end gracefully.',
    category: 'error-handling',
    tags: ['cancellation', 'flow-control', 'abort'],
    persona: {
      name: 'Tom Wilson',
      description: 'User who decides to cancel mid-conversation',
      inventory: {
        parentFirstName: 'Tom',
        parentLastName: 'Wilson',
        parentPhone: '2155558888',
        children: [{
          firstName: 'Child',
          lastName: 'Wilson',
          dateOfBirth: '2014-08-20',
          isNewPatient: true,
        }],
      },
      traits: DEFAULT_TRAITS,
    },
    goals: [
      {
        id: 'collect-initial-info',
        type: 'data_collection',
        description: 'Collect initial parent info before cancellation',
        requiredFields: ['parent_name', 'parent_name_spelling'],
        priority: 1,
        required: true,
      },
      {
        id: 'acknowledge-cancel',
        type: 'custom',
        description: 'Agent acknowledges cancellation request',
        priority: 10,
        required: true,
      },
      GRACEFUL_END_GOAL,
    ],
    constraints: [
      NO_ERRORS_CONSTRAINT,
      {
        type: 'must_not_happen',
        description: 'Should not continue with booking flow after cancel',
        severity: 'high',
      },
    ],
    responseConfig: {
      maxTurns: 10,
      useLlmResponses: false,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'Hi I need to schedule an appointment for my child',
  },

  {
    caseId: 'GOAL-ERR-005',
    name: 'Special Characters in Name',
    description: "Handle special characters in parent/child names (O'Connor-Smith). Agent should not error.",
    category: 'error-handling',
    tags: ['input-validation', 'special-chars', 'names'],
    persona: {
      name: "Mary O'Connor-Smith",
      description: 'Parent with apostrophe and hyphen in name',
      inventory: {
        parentFirstName: 'Mary',
        parentLastName: "O'Connor-Smith",
        parentPhone: '2155551111',
        children: [{
          firstName: "Sean-Patrick",
          lastName: "O'Connor-Smith",
          dateOfBirth: '2013-04-17',
          isNewPatient: true,
        }],
        hasInsurance: true,
        insuranceProvider: 'Keystone First',
      },
      traits: DEFAULT_TRAITS,
    },
    goals: [
      {
        id: 'collect-special-name',
        type: 'data_collection',
        description: 'Collect name with special characters',
        requiredFields: ['parent_name', 'parent_name_spelling'],
        priority: 1,
        required: true,
      },
      ERROR_HANDLED_GOAL,
    ],
    constraints: [
      NO_ERRORS_CONSTRAINT,
      {
        type: 'must_not_happen',
        description: 'Should not reject special characters in names',
        severity: 'high',
      },
    ],
    responseConfig: {
      maxTurns: 15,
      useLlmResponses: false,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'Hi I need to schedule an appointment',
  },

  {
    caseId: 'GOAL-ERR-006',
    name: 'Unclear Number of Children',
    description: 'Handle vague or unclear response about number of children. Agent should ask for clarification.',
    category: 'error-handling',
    tags: ['clarification', 'ambiguous-input', 'vague-response'],
    persona: {
      name: 'Jane Doe',
      description: 'User who gives vague answers',
      inventory: {
        parentFirstName: 'Jane',
        parentLastName: 'Doe',
        parentPhone: '2155552222',
        children: [
          { firstName: 'Child1', lastName: 'Doe', dateOfBirth: '2012-03-10', isNewPatient: true },
          { firstName: 'Child2', lastName: 'Doe', dateOfBirth: '2014-07-22', isNewPatient: true },
        ],
      },
      traits: {
        verbosity: 'terse',
        providesExtraInfo: false,
        patienceLevel: 'patient',
        techSavviness: 'low',
      },
    },
    goals: [
      {
        id: 'collect-name',
        type: 'data_collection',
        description: 'Collect parent name',
        requiredFields: ['parent_name', 'parent_name_spelling'],
        priority: 1,
        required: true,
      },
      {
        id: 'clarify-child-count',
        type: 'custom',
        description: 'Agent clarifies vague child count response',
        priority: 5,
        required: true,
      },
      {
        id: 'collect-child-count',
        type: 'data_collection',
        description: 'Get specific number of children after clarification',
        requiredFields: ['child_count'],
        priority: 6,
        required: true,
      },
    ],
    constraints: [
      NO_ERRORS_CONSTRAINT,
      {
        type: 'must_happen',
        description: 'Should ask for clarification on vague answer',
        severity: 'medium',
      },
    ],
    responseConfig: {
      maxTurns: 15,
      useLlmResponses: false,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'Schedule orthodontic appointment for my kids',
  },

  // =========================================================================
  // FRD GAP COVERAGE - NEW TEST CASES
  // =========================================================================

  // GAP-001: Out-of-Network Insurance Handling
  {
    caseId: 'GOAL-EDGE-006',
    name: 'Out-of-Network Insurance - Proceed Anyway',
    description: 'Caller has out-of-network insurance. Agent discloses not in-network, asks if proceed, caller confirms.',
    category: 'edge-case',
    tags: ['insurance', 'out-of-network', 'disclosure', 'proceed'],
    persona: {
      name: 'Robert Chen',
      description: 'Parent with out-of-network insurance who wants to proceed',
      inventory: {
        parentFirstName: 'Robert',
        parentLastName: 'Chen',
        parentPhone: '2155556666',
        parentEmail: 'robert@email.com',
        children: [{
          firstName: 'Kevin',
          lastName: 'Chen',
          dateOfBirth: '2013-08-22',
          isNewPatient: true,
          hadBracesBefore: false,
        }],
        hasInsurance: true,
        insuranceProvider: 'United Healthcare', // NOT in-network
        previousVisitToOffice: false,
        previousOrthoTreatment: false,
        preferredTimeOfDay: 'any',
      },
      traits: DEFAULT_TRAITS,
    },
    goals: [
      ...STANDARD_DATA_COLLECTION_GOALS,
      {
        id: 'disclose-out-of-network',
        type: 'custom',
        description: 'Agent discloses insurance is not in-network and asks if caller wants to proceed',
        priority: 6,
        required: true,
      },
      {
        id: 'collect-card-reminder',
        type: 'data_collection',
        description: 'Agent reminds caller to bring insurance card',
        requiredFields: ['card_reminder'],
        priority: 7,
        required: true,
      },
      BOOKING_GOAL,
    ],
    constraints: [
      NO_ERRORS_CONSTRAINT,
      {
        type: 'must_happen',
        description: 'Must disclose out-of-network status before proceeding',
        severity: 'high',
      },
      {
        type: 'must_not_happen',
        description: 'Should NOT transfer for out-of-network insurance',
        severity: 'high',
      },
    ],
    responseConfig: {
      maxTurns: 25,
      useLlmResponses: false,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'Hi I need to schedule an orthodontic appointment for my son',
  },

  // GAP-003: Age Validation - Under 7
  {
    caseId: 'GOAL-EDGE-007',
    name: 'Age Out of Range - Child Under 7',
    description: 'Child is under age 7. Agent should recognize and transfer to specialist.',
    category: 'edge-case',
    tags: ['age-validation', 'under-7', 'transfer', 'ineligible'],
    persona: {
      name: 'Amanda Wilson',
      description: 'Parent with child too young for orthodontic consult',
      inventory: {
        parentFirstName: 'Amanda',
        parentLastName: 'Wilson',
        parentPhone: '2155557777',
        children: [{
          firstName: 'Toby',
          lastName: 'Wilson',
          dateOfBirth: '2020-06-15', // 5 years old - too young
          isNewPatient: true,
        }],
        previousVisitToOffice: false,
      },
      traits: DEFAULT_TRAITS,
    },
    goals: [
      {
        id: 'collect-basic-info',
        type: 'data_collection',
        description: 'Collect parent name and phone',
        requiredFields: ['parent_name', 'parent_phone'],
        priority: 1,
        required: true,
      },
      {
        id: 'collect-child-dob',
        type: 'data_collection',
        description: 'Collect child date of birth',
        requiredFields: ['child_dob'],
        priority: 3,
        required: true,
      },
      {
        id: 'recognize-age-invalid',
        type: 'custom',
        description: 'Agent recognizes child is under 7 and needs transfer',
        priority: 5,
        required: true,
      },
      TRANSFER_GOAL,
    ],
    constraints: [
      NO_ERRORS_CONSTRAINT,
      {
        type: 'must_not_happen',
        description: 'Should not continue with booking for under-7 child',
        severity: 'critical',
      },
    ],
    responseConfig: {
      maxTurns: 15,
      useLlmResponses: false,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'I need to schedule an orthodontic consult for my child',
  },

  // GAP-003: Age Validation - Over 20
  {
    caseId: 'GOAL-EDGE-008',
    name: 'Age Out of Range - Patient Over 20',
    description: 'Patient is over age 20. Agent should recognize and transfer to specialist.',
    category: 'edge-case',
    tags: ['age-validation', 'over-20', 'transfer', 'adult'],
    persona: {
      name: 'Carol Martinez',
      description: 'Parent calling for adult child over 20',
      inventory: {
        parentFirstName: 'Carol',
        parentLastName: 'Martinez',
        parentPhone: '2155558888',
        children: [{
          firstName: 'Diego',
          lastName: 'Martinez',
          dateOfBirth: '2002-03-10', // 23 years old - too old
          isNewPatient: true,
        }],
        previousVisitToOffice: false,
      },
      traits: DEFAULT_TRAITS,
    },
    goals: [
      {
        id: 'collect-basic-info',
        type: 'data_collection',
        description: 'Collect parent name and phone',
        requiredFields: ['parent_name', 'parent_phone'],
        priority: 1,
        required: true,
      },
      {
        id: 'collect-child-dob',
        type: 'data_collection',
        description: 'Collect patient date of birth',
        requiredFields: ['child_dob'],
        priority: 3,
        required: true,
      },
      {
        id: 'recognize-age-invalid',
        type: 'custom',
        description: 'Agent recognizes patient is over 20 and needs transfer',
        priority: 5,
        required: true,
      },
      TRANSFER_GOAL,
    ],
    constraints: [
      NO_ERRORS_CONSTRAINT,
      {
        type: 'must_not_happen',
        description: 'Should not continue with booking for over-20 patient',
        severity: 'critical',
      },
    ],
    responseConfig: {
      maxTurns: 15,
      useLlmResponses: false,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'I want to schedule an orthodontic appointment for my son',
  },

  // GAP-008/009: Address and Parking Request
  {
    caseId: 'GOAL-EDGE-009',
    name: 'Address Request with Parking Info',
    description: 'After booking, caller asks for address. Agent should provide address AND parking information.',
    category: 'edge-case',
    tags: ['address', 'parking', 'faq', 'location-info'],
    persona: {
      name: 'Patricia Lee',
      description: 'Parent who needs address and parking info after booking',
      inventory: {
        parentFirstName: 'Patricia',
        parentLastName: 'Lee',
        parentPhone: '2155559999',
        parentEmail: 'patricia@email.com',
        children: [{
          firstName: 'Sophia',
          lastName: 'Lee',
          dateOfBirth: '2014-11-05',
          isNewPatient: true,
          hadBracesBefore: false,
        }],
        hasInsurance: true,
        insuranceProvider: 'Keystone First',
        previousVisitToOffice: false,
        previousOrthoTreatment: false,
      },
      traits: DEFAULT_TRAITS,
    },
    goals: [
      ...STANDARD_DATA_COLLECTION_GOALS,
      BOOKING_GOAL,
      {
        id: 'provide-address',
        type: 'data_collection',
        description: 'Agent provides address when requested',
        requiredFields: ['address_provided'],
        priority: 11,
        required: true,
      },
      {
        id: 'provide-parking',
        type: 'data_collection',
        description: 'Agent includes parking information with address',
        requiredFields: ['parking_info'],
        priority: 12,
        required: true,
      },
    ],
    constraints: [
      NO_ERRORS_CONSTRAINT,
      {
        type: 'must_happen',
        description: 'Must provide parking info when giving address',
        severity: 'medium',
      },
    ],
    responseConfig: {
      maxTurns: 25,
      useLlmResponses: false,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'Hi I need to schedule an orthodontic appointment for my daughter',
  },

  // GAP-008: Hours of Operation FAQ
  {
    caseId: 'GOAL-EDGE-010',
    name: 'Hours of Operation Question',
    description: 'Caller asks about hours of operation. Agent should provide hours info.',
    category: 'edge-case',
    tags: ['hours', 'faq', 'office-info'],
    persona: {
      name: 'David Thompson',
      description: 'Parent who wants to know office hours before scheduling',
      inventory: {
        parentFirstName: 'David',
        parentLastName: 'Thompson',
        parentPhone: '2155550101',
        children: [{
          firstName: 'Ryan',
          lastName: 'Thompson',
          dateOfBirth: '2012-09-18',
          isNewPatient: true,
        }],
        previousVisitToOffice: false,
      },
      traits: DEFAULT_TRAITS,
    },
    goals: [
      {
        id: 'provide-hours',
        type: 'data_collection',
        description: 'Agent provides hours of operation when asked',
        requiredFields: ['hours_info'],
        priority: 1,
        required: true,
      },
      {
        id: 'continue-to-booking',
        type: 'custom',
        description: 'After providing hours, continue with booking if caller wants',
        priority: 5,
        required: false,
      },
    ],
    constraints: [
      NO_ERRORS_CONSTRAINT,
      {
        type: 'must_happen',
        description: 'Must provide hours info when asked',
        severity: 'high',
      },
    ],
    responseConfig: {
      maxTurns: 20,
      useLlmResponses: false,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'Hi, what are your hours?',
  },

  // GAP-002: Silence Handling
  {
    caseId: 'GOAL-ERR-007',
    name: 'Silence Fallback Handling',
    description: 'Caller goes silent. Agent should prompt once then disconnect gracefully.',
    category: 'error-handling',
    tags: ['silence', 'fallback', 'disconnect', 'no-response'],
    persona: {
      name: 'Silent Caller',
      description: 'Caller who stops responding mid-conversation',
      inventory: {
        parentFirstName: 'Silent',
        parentLastName: 'Caller',
        parentPhone: '2155550000',
        children: [{
          firstName: 'Child',
          lastName: 'Caller',
          dateOfBirth: '2014-01-01',
          isNewPatient: true,
        }],
      },
      traits: {
        verbosity: 'terse',
        providesExtraInfo: false,
        patienceLevel: 'patient',
        techSavviness: 'low',
      },
    },
    goals: [
      {
        id: 'detect-silence',
        type: 'custom',
        description: 'Agent detects no response from caller',
        priority: 1,
        required: true,
      },
      {
        id: 'prompt-still-there',
        type: 'custom',
        description: 'Agent asks "Are you still there?"',
        priority: 2,
        required: true,
      },
      {
        id: 'graceful-disconnect',
        type: 'conversation_ended',
        description: 'Agent disconnects gracefully with appropriate message',
        priority: 10,
        required: true,
      },
    ],
    constraints: [
      NO_ERRORS_CONSTRAINT,
      {
        type: 'must_happen',
        description: 'Must say disconnect message before ending call',
        severity: 'high',
      },
    ],
    responseConfig: {
      maxTurns: 5,
      useLlmResponses: false,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'Hi I need to schedule an appointment',
  },

  // GAP-005/006: Full Confirmation Flow with Legal + Paperwork
  {
    caseId: 'GOAL-HAPPY-004',
    name: 'Full Confirmation with Legal and Paperwork Notice',
    description: 'Complete booking with full confirmation including court documentation mention and early arrival notice.',
    category: 'happy-path',
    tags: ['confirmation', 'legal-notice', 'paperwork', 'early-arrival', 'full-flow'],
    persona: {
      name: 'Jennifer Adams',
      description: 'Parent completing full booking flow to hear all confirmation details',
      inventory: {
        parentFirstName: 'Jennifer',
        parentLastName: 'Adams',
        parentPhone: '2155550202',
        parentEmail: 'jennifer@email.com',
        children: [{
          firstName: 'Lucas',
          lastName: 'Adams',
          dateOfBirth: '2013-04-20',
          isNewPatient: true,
          hadBracesBefore: false,
        }],
        hasInsurance: true,
        insuranceProvider: 'PA Medicaid',
        previousVisitToOffice: false,
        previousOrthoTreatment: false,
      },
      traits: DEFAULT_TRAITS,
    },
    goals: [
      ...STANDARD_DATA_COLLECTION_GOALS,
      BOOKING_GOAL,
      {
        id: 'mention-guardian-requirement',
        type: 'data_collection',
        description: 'Agent mentions parent/legal guardian must be present',
        requiredFields: ['court_docs_mentioned'],
        priority: 11,
        required: true,
      },
      {
        id: 'mention-early-arrival',
        type: 'data_collection',
        description: 'Agent mentions 20-30 minute early arrival if paperwork not done',
        requiredFields: ['early_arrival_mentioned'],
        priority: 12,
        required: true,
      },
      GRACEFUL_END_GOAL,
    ],
    constraints: [
      NO_ERRORS_CONSTRAINT,
      {
        type: 'must_happen',
        description: 'Must mention court documentation for non-parent guardians',
        severity: 'high',
      },
      {
        type: 'must_happen',
        description: 'Must mention early arrival for paperwork',
        severity: 'medium',
      },
    ],
    responseConfig: {
      maxTurns: 25,
      useLlmResponses: false,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'Hi I need to schedule an orthodontic appointment for my son',
  },

  // GAP-007: Insurance with Group/Member ID Collection
  {
    caseId: 'GOAL-HAPPY-005',
    name: 'Insurance with Group and Member ID Collection',
    description: 'Caller provides insurance with Group # and Member ID. Agent collects and reminds about card.',
    category: 'happy-path',
    tags: ['insurance', 'group-id', 'member-id', 'card-reminder'],
    persona: {
      name: 'Karen White',
      description: 'Parent who provides full insurance details',
      inventory: {
        parentFirstName: 'Karen',
        parentLastName: 'White',
        parentPhone: '2155550303',
        parentEmail: 'karen@email.com',
        children: [{
          firstName: 'Emma',
          lastName: 'White',
          dateOfBirth: '2012-07-12',
          isNewPatient: true,
          hadBracesBefore: false,
        }],
        hasInsurance: true,
        insuranceProvider: 'Aetna Better Health',
        previousVisitToOffice: false,
        previousOrthoTreatment: false,
      },
      traits: {
        verbosity: 'verbose',
        providesExtraInfo: true,
        patienceLevel: 'patient',
        techSavviness: 'high',
      },
    },
    goals: [
      ...STANDARD_DATA_COLLECTION_GOALS,
      {
        id: 'confirm-in-network',
        type: 'data_collection',
        description: 'Agent confirms insurance is in-network',
        requiredFields: ['insurance_in_network'],
        priority: 6,
        required: true,
      },
      {
        id: 'collect-group-id',
        type: 'data_collection',
        description: 'Agent asks for Group # (optional)',
        requiredFields: ['insurance_group_id'],
        priority: 7,
        required: false,
      },
      {
        id: 'collect-member-id',
        type: 'data_collection',
        description: 'Agent asks for Member ID (optional)',
        requiredFields: ['insurance_member_id'],
        priority: 8,
        required: false,
      },
      {
        id: 'provide-card-reminder',
        type: 'data_collection',
        description: 'Agent reminds caller to bring insurance card',
        requiredFields: ['card_reminder'],
        priority: 9,
        required: true,
      },
      BOOKING_GOAL,
    ],
    constraints: [
      NO_ERRORS_CONSTRAINT,
      {
        type: 'must_happen',
        description: 'Must remind to bring insurance card',
        severity: 'medium',
      },
    ],
    responseConfig: {
      maxTurns: 25,
      useLlmResponses: false,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'Hi I need to schedule an orthodontic consult for my daughter',
  },

  // GAP-004: Intent Probing - Unclear Intent
  {
    caseId: 'GOAL-EDGE-011',
    name: 'Intent Probing - Unclear Appointment Type',
    description: 'Caller asks for generic appointment. Agent should probe to clarify if ortho or general dentistry.',
    category: 'edge-case',
    tags: ['intent', 'probing', 'clarification', 'ortho-vs-general'],
    persona: {
      name: 'Mike Brown',
      description: 'Parent with unclear intent about type of appointment',
      inventory: {
        parentFirstName: 'Mike',
        parentLastName: 'Brown',
        parentPhone: '2155550404',
        children: [{
          firstName: 'Tyler',
          lastName: 'Brown',
          dateOfBirth: '2013-02-28',
          isNewPatient: true,
        }],
        previousVisitToOffice: false,
      },
      traits: DEFAULT_TRAITS,
    },
    goals: [
      {
        id: 'probe-intent',
        type: 'custom',
        description: 'Agent asks if calling about orthodontics or general dentistry',
        priority: 1,
        required: true,
      },
      {
        id: 'collect-basic-info',
        type: 'data_collection',
        description: 'After confirming ortho intent, collect parent info',
        requiredFields: ['parent_name', 'parent_phone'],
        priority: 2,
        required: true,
      },
    ],
    constraints: [
      NO_ERRORS_CONSTRAINT,
      {
        type: 'must_happen',
        description: 'Must ask clarifying question about ortho vs general',
        severity: 'high',
      },
    ],
    responseConfig: {
      maxTurns: 15,
      useLlmResponses: false,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'Hi I need to schedule an appointment for my son',
  },

  // GAP-003: Spelling Confirmation Verification
  {
    caseId: 'GOAL-HAPPY-006',
    name: 'Spelling Confirmation Loop',
    description: 'Agent asks for spelling and REPEATS spelling back for confirmation before proceeding.',
    category: 'happy-path',
    tags: ['spelling', 'confirmation', 'name-verification', 'accuracy'],
    persona: {
      name: 'Christina Nguyen',
      description: 'Parent with name that requires careful spelling confirmation',
      inventory: {
        parentFirstName: 'Christina',
        parentLastName: 'Nguyen',
        parentPhone: '2155550505',
        parentEmail: 'christina@email.com',
        children: [{
          firstName: 'Minh',
          lastName: 'Nguyen',
          dateOfBirth: '2014-06-18',
          isNewPatient: true,
        }],
        hasInsurance: true,
        insuranceProvider: 'Gateway',
        previousVisitToOffice: false,
        previousOrthoTreatment: false,
      },
      traits: DEFAULT_TRAITS,
    },
    goals: [
      {
        id: 'collect-name',
        type: 'data_collection',
        description: 'Collect parent name',
        requiredFields: ['parent_name'],
        priority: 1,
        required: true,
      },
      {
        id: 'request-spelling',
        type: 'data_collection',
        description: 'Agent asks caller to spell name',
        requiredFields: ['parent_name_spelling'],
        priority: 2,
        required: true,
      },
      {
        id: 'confirm-spelling',
        type: 'custom',
        description: 'Agent repeats spelling back and asks for confirmation',
        priority: 3,
        required: true,
      },
      ...STANDARD_DATA_COLLECTION_GOALS.slice(1), // Skip parent-info goal
      BOOKING_GOAL,
    ],
    constraints: [
      NO_ERRORS_CONSTRAINT,
      {
        type: 'must_happen',
        description: 'Must repeat spelling back for confirmation',
        severity: 'high',
      },
    ],
    responseConfig: {
      maxTurns: 25,
      useLlmResponses: false,
      handleUnknownIntents: 'clarify',
    },
    initialMessage: 'Hi I need to schedule an orthodontic appointment for my child',
  },
];

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

function initDatabase(db: BetterSqlite3.Database): void {
  // Create goal_test_cases table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS goal_test_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT CHECK(category IN ('happy-path', 'edge-case', 'error-handling')) NOT NULL,
      tags_json TEXT DEFAULT '[]',
      persona_json TEXT NOT NULL,
      goals_json TEXT NOT NULL,
      constraints_json TEXT DEFAULT '[]',
      response_config_json TEXT NOT NULL,
      initial_message TEXT NOT NULL,
      is_archived INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✓ Database table initialized');
}

function insertGoalTestCase(db: BetterSqlite3.Database, testCase: GoalTestCase): void {
  const stmt = db.prepare(`
    INSERT INTO goal_test_cases (
      case_id, name, description, category, tags_json,
      persona_json, goals_json, constraints_json, response_config_json,
      initial_message, is_archived, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)
    ON CONFLICT(case_id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      category = excluded.category,
      tags_json = excluded.tags_json,
      persona_json = excluded.persona_json,
      goals_json = excluded.goals_json,
      constraints_json = excluded.constraints_json,
      response_config_json = excluded.response_config_json,
      initial_message = excluded.initial_message,
      version = goal_test_cases.version + 1,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(
    testCase.caseId,
    testCase.name,
    testCase.description,
    testCase.category,
    JSON.stringify(testCase.tags),
    JSON.stringify(testCase.persona),
    JSON.stringify(testCase.goals),
    JSON.stringify(testCase.constraints),
    JSON.stringify(testCase.responseConfig),
    testCase.initialMessage
  );
}

// ============================================================================
// MAIN MIGRATION
// ============================================================================

function migrate(): void {
  console.log('============================================');
  console.log('Goal-Oriented Test Case Migration');
  console.log('============================================\n');

  // Check if database file exists
  if (!require('fs').existsSync(TEST_AGENT_DB_PATH)) {
    console.error(`Database not found at: ${TEST_AGENT_DB_PATH}`);
    console.log('Creating new database...');
  }

  const db = new BetterSqlite3(TEST_AGENT_DB_PATH);

  try {
    initDatabase(db);

    console.log(`\nMigrating ${goalTestCases.length} test cases...\n`);

    for (const testCase of goalTestCases) {
      insertGoalTestCase(db, testCase);
      console.log(`  ✓ ${testCase.caseId}: ${testCase.name}`);
    }

    // Summary
    const stats = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM goal_test_cases
      WHERE is_archived = 0
      GROUP BY category
    `).all() as { category: string; count: number }[];

    console.log('\n============================================');
    console.log('Migration Complete!');
    console.log('============================================');
    console.log('\nTest Cases by Category:');
    for (const stat of stats) {
      console.log(`  ${stat.category}: ${stat.count}`);
    }
    console.log(`\nTotal: ${goalTestCases.length} test cases`);

  } finally {
    db.close();
  }
}

// Run migration
migrate();
