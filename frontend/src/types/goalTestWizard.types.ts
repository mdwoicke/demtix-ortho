/**
 * Goal Test Wizard Types
 * Types specific to the Create Goal Test wizard flow
 */

import type {
  GoalTestCaseRecord,
  UserPersonaDTO,
  ConversationGoalDTO,
  TestConstraintDTO,
  ResponseConfigDTO,
  TestCategory,
  PersonaTraitsDTO,
  DynamicUserPersonaDTO,
  DynamicFieldSpecDTO,
} from './testMonitor.types';
import { DEFAULT_FIELD_CONSTRAINTS } from './testMonitor.types';

// ============================================================================
// WIZARD STEP DEFINITIONS
// ============================================================================

export enum WizardStep {
  Analyzer = 0,
  BasicInfo = 1,
  Persona = 2,
  Goals = 3,
  Config = 4,
  Review = 5,
}

export const WIZARD_STEPS = [
  { id: WizardStep.Analyzer, label: 'AI Analyzer', description: 'Describe your test (optional)' },
  { id: WizardStep.BasicInfo, label: 'Basic Info', description: 'Name, category, and description' },
  { id: WizardStep.Persona, label: 'Persona', description: 'Test user profile' },
  { id: WizardStep.Goals, label: 'Goals', description: 'Success criteria and constraints' },
  { id: WizardStep.Config, label: 'Config', description: 'Response settings' },
  { id: WizardStep.Review, label: 'Review', description: 'Review and create' },
] as const;

// ============================================================================
// FORM DATA TYPES
// ============================================================================

/**
 * Basic info form data
 */
export interface BasicInfoFormData {
  name: string;
  description: string;
  category: TestCategory;
  tags: string[];
  initialMessage: string;
}

/**
 * Complete wizard form data
 */
export interface WizardFormData {
  basicInfo: BasicInfoFormData;
  persona: UserPersonaDTO | DynamicUserPersonaDTO;
  goals: ConversationGoalDTO[];
  constraints: TestConstraintDTO[];
  responseConfig: ResponseConfigDTO;
}

/**
 * Step validation state
 */
export interface StepValidation {
  isValid: boolean;
  errors: string[];
  touched: boolean;
}

/**
 * Full wizard validation state
 */
export interface WizardValidation {
  [WizardStep.Analyzer]: StepValidation;
  [WizardStep.BasicInfo]: StepValidation;
  [WizardStep.Persona]: StepValidation;
  [WizardStep.Goals]: StepValidation;
  [WizardStep.Config]: StepValidation;
  [WizardStep.Review]: StepValidation;
}

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

/**
 * Test case template definition
 */
export interface GoalTestTemplate {
  id: string;
  name: string;
  description: string;
  category: TestCategory;
  icon: 'calendar' | 'users' | 'shield' | 'phone' | 'alert' | 'x-circle';
  tags: string[];
  defaults: {
    persona: Partial<UserPersonaDTO>;
    goals: ConversationGoalDTO[];
    constraints: TestConstraintDTO[];
    responseConfig: ResponseConfigDTO;
    initialMessage: string;
  };
}

/**
 * Template category for filtering
 */
export interface TemplateCategory {
  id: TestCategory;
  name: string;
  templates: GoalTestTemplate[];
}

// ============================================================================
// SOURCE TYPES (Template vs Clone)
// ============================================================================

export type WizardSourceType = 'blank' | 'template' | 'clone' | 'ai-analyzed';

export interface WizardSource {
  type: WizardSourceType;
  id: string | null;
  name: string | null;
}

// ============================================================================
// AI SUGGESTION TYPES
// ============================================================================

/**
 * AI suggestion request parameters
 */
export interface AISuggestionRequest {
  name: string;
  category: TestCategory;
  description?: string;
  personaTraits?: Partial<PersonaTraitsDTO>;
  tags?: string[];
  model?: 'fast' | 'standard' | 'detailed';
  /**
   * Original goal description from Step 0 AI Analyzer.
   * This provides the primary context for what the test should verify.
   * The AI Helper should use this as the main guide for generating suggestions.
   */
  originalGoalDescription?: string;
}

/**
 * Individual suggestion with explanation
 */
export interface SuggestionItem<T> {
  data: T;
  explanation: string;
  confidence: number;
  accepted?: boolean;
}

/**
 * AI suggestion response
 */
export interface AISuggestionResponse {
  success: boolean;
  suggestions: {
    goals: SuggestionItem<ConversationGoalDTO>[];
    constraints: SuggestionItem<TestConstraintDTO>[];
    initialMessage?: {
      message: string;
      explanation: string;
    };
    reasoning: string;
  } | null;
  metadata: {
    model: string;
    processingTimeMs: number;
    tokensUsed?: number;
  };
  error?: string;
}

/**
 * AI suggestion state in Redux
 */
export interface AISuggestionState {
  loading: boolean;
  suggestions: AISuggestionResponse['suggestions'];
  error: string | null;
  lastRequestedAt: string | null;
}

// ============================================================================
// AI GOAL ANALYSIS TYPES (Step 0)
// ============================================================================

/**
 * Collectable field type for goal analysis
 */
export type CollectableField =
  | 'parent_name' | 'parent_name_spelling' | 'parent_phone' | 'parent_email'
  | 'child_count' | 'child_names' | 'child_dob' | 'child_age'
  | 'is_new_patient' | 'previous_visit' | 'previous_ortho'
  | 'insurance' | 'special_needs' | 'time_preference' | 'location_preference';

/**
 * AI analysis result from backend
 */
export interface GoalAnalysisResult {
  success: boolean;
  analysis: {
    detectedIntent: string;
    cloud9Operations: string[];
    requiredDataFields: CollectableField[];
    suggestedCategory: TestCategory;
    confidence: number;
  };
  wizardData: WizardFormData;
  reasoning: string;
  metadata: {
    model: string;
    processingTimeMs: number;
    tokensUsed?: number;
  };
  error?: string;
}

/**
 * AI analyzer state in Redux (Step 0)
 */
export interface GoalAnalysisState {
  description: string;
  loading: boolean;
  result: GoalAnalysisResult | null;
  error: string | null;
  lastAnalyzedAt: string | null;
}

// ============================================================================
// WIZARD STATE
// ============================================================================

/**
 * Draft state for auto-save
 */
export interface WizardDraft {
  id: string;
  formData: Partial<WizardFormData>;
  currentStep: WizardStep;
  source: WizardSource;
  savedAt: string;
}

/**
 * Complete wizard Redux state
 */
export interface CreateGoalTestState {
  // Navigation
  currentStep: WizardStep;
  isComplete: boolean;

  // Form data
  formData: WizardFormData;

  // Validation per step
  validation: WizardValidation;

  // Source tracking
  source: WizardSource;

  // Generated case ID
  generatedCaseId: string | null;

  // Draft management
  draftId: string | null;
  isDirty: boolean;
  lastSavedAt: string | null;

  // AI suggestions (Goals step)
  aiSuggestions: AISuggestionState;

  // AI analyzer (Step 0)
  aiAnalyzer: GoalAnalysisState;

  /**
   * Original goal description from Step 0 AI Analyzer.
   * Stored when user accepts AI analysis to maintain context throughout wizard.
   * Used by AI Helper in Goals step to generate relevant suggestions.
   */
  originalGoalDescription: string | null;

  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  isSubmitting: boolean;

  // Error state
  error: string | null;
  submitError: string | null;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_RESPONSE_CONFIG: ResponseConfigDTO = {
  maxTurns: 25,
  useLlmResponses: true,
  handleUnknownIntents: 'clarify',
};

// Helper to create a dynamic field spec
const dynamicField = (fieldType: DynamicFieldSpecDTO['fieldType']): DynamicFieldSpecDTO => ({
  _dynamic: true,
  fieldType,
  constraints: DEFAULT_FIELD_CONSTRAINTS[fieldType],
});

export const DEFAULT_PERSONA: DynamicUserPersonaDTO = {
  name: 'New Persona',
  description: '',
  inventory: {
    parentFirstName: dynamicField('firstName'),
    parentLastName: dynamicField('lastName'),
    parentPhone: dynamicField('phone'),
    parentEmail: dynamicField('email'),
    children: [
      {
        firstName: dynamicField('firstName'),
        lastName: dynamicField('lastName'),
        dateOfBirth: dynamicField('dateOfBirth'),
        isNewPatient: true,
      },
    ],
    hasInsurance: false,
    preferredTimeOfDay: 'any',
    previousVisitToOffice: false,
    previousOrthoTreatment: false,
  },
  traits: {
    verbosity: 'normal',
    providesExtraInfo: true,
    patienceLevel: 'patient',
    techSavviness: 'moderate',
  },
};

export const DEFAULT_BASIC_INFO: BasicInfoFormData = {
  name: '',
  description: '',
  category: 'happy-path',
  tags: [],
  initialMessage: '',
};

export const DEFAULT_FORM_DATA: WizardFormData = {
  basicInfo: DEFAULT_BASIC_INFO,
  persona: DEFAULT_PERSONA,
  goals: [],
  constraints: [],
  responseConfig: DEFAULT_RESPONSE_CONFIG,
};

export const DEFAULT_STEP_VALIDATION: StepValidation = {
  isValid: false,
  errors: [],
  touched: false,
};

export const DEFAULT_VALIDATION: WizardValidation = {
  [WizardStep.Analyzer]: { isValid: true, errors: [], touched: false }, // Analyzer is optional
  [WizardStep.BasicInfo]: { ...DEFAULT_STEP_VALIDATION },
  [WizardStep.Persona]: { ...DEFAULT_STEP_VALIDATION },
  [WizardStep.Goals]: { ...DEFAULT_STEP_VALIDATION },
  [WizardStep.Config]: { isValid: true, errors: [], touched: false }, // Config has defaults
  [WizardStep.Review]: { ...DEFAULT_STEP_VALIDATION },
};

export const DEFAULT_AI_ANALYZER_STATE: GoalAnalysisState = {
  description: '',
  loading: false,
  result: null,
  error: null,
  lastAnalyzedAt: null,
};

// ============================================================================
// PERSONA PRESETS
// ============================================================================

export const PERSONA_PRESETS: UserPersonaDTO[] = [
  {
    name: 'Sarah Johnson',
    description: 'New patient parent with one child, has insurance',
    inventory: {
      parentFirstName: 'Sarah',
      parentLastName: 'Johnson',
      parentPhone: '2155551234',
      parentEmail: 'sarah.johnson@email.com',
      children: [
        {
          firstName: 'Emma',
          lastName: 'Johnson',
          dateOfBirth: '2015-03-15',
          isNewPatient: true,
        },
      ],
      hasInsurance: true,
      insuranceProvider: 'Keystone First',
      preferredTimeOfDay: 'morning',
      previousVisitToOffice: false,
      previousOrthoTreatment: false,
    },
    traits: {
      verbosity: 'normal',
      providesExtraInfo: true,
      patienceLevel: 'patient',
      techSavviness: 'moderate',
    },
  },
  {
    name: 'Michael Davis',
    description: 'Parent with two children, no insurance',
    inventory: {
      parentFirstName: 'Michael',
      parentLastName: 'Davis',
      parentPhone: '2155555678',
      parentEmail: 'mdavis@email.com',
      children: [
        {
          firstName: 'Jake',
          lastName: 'Davis',
          dateOfBirth: '2012-07-22',
          isNewPatient: true,
        },
        {
          firstName: 'Lily',
          lastName: 'Davis',
          dateOfBirth: '2014-11-08',
          isNewPatient: true,
        },
      ],
      hasInsurance: false,
      preferredTimeOfDay: 'afternoon',
      previousVisitToOffice: false,
      previousOrthoTreatment: false,
    },
    traits: {
      verbosity: 'verbose',
      providesExtraInfo: true,
      patienceLevel: 'moderate',
      techSavviness: 'high',
    },
  },
  {
    name: 'Robert Chen',
    description: 'Returning patient parent, existing relationship',
    inventory: {
      parentFirstName: 'Robert',
      parentLastName: 'Chen',
      parentPhone: '2155559012',
      parentEmail: 'rchen@email.com',
      children: [
        {
          firstName: 'Sophia',
          lastName: 'Chen',
          dateOfBirth: '2013-09-05',
          isNewPatient: false,
        },
      ],
      hasInsurance: true,
      insuranceProvider: 'Blue Cross Blue Shield',
      preferredTimeOfDay: 'any',
      previousVisitToOffice: true,
      previousOrthoTreatment: true,
    },
    traits: {
      verbosity: 'terse',
      providesExtraInfo: false,
      patienceLevel: 'impatient',
      techSavviness: 'low',
    },
  },
];
