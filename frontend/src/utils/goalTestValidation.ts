/**
 * Goal Test Wizard Validation Schemas
 * Zod schemas for validating goal test creation form data
 */

import { z } from 'zod';
import type {
  BasicInfoFormData,
  WizardFormData,
} from '../types/goalTestWizard.types';
import type {
  UserPersonaDTO,
  ConversationGoalDTO,
  TestConstraintDTO,
  ResponseConfigDTO,
  TestCategory,
} from '../types/testMonitor.types';

// ============================================================================
// BASIC INFO VALIDATION
// ============================================================================

export const basicInfoSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must be less than 100 characters'),

  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be less than 500 characters'),

  category: z.enum(['happy-path', 'edge-case', 'error-handling'], {
    required_error: 'Please select a category',
  }),

  tags: z.array(z.string()).optional().default([]),

  initialMessage: z.string().optional().default(''),
});

export type BasicInfoSchemaType = z.infer<typeof basicInfoSchema>;

// ============================================================================
// PERSONA VALIDATION
// ============================================================================

// Dynamic field spec for AI-generated personas
const dynamicFieldSpec = z.object({
  _dynamic: z.literal(true),
  fieldType: z.string(),
  constraints: z.any().optional(),
});

// Field that can be either a string value or a dynamic spec
const stringOrDynamic = z.union([z.string().min(1), dynamicFieldSpec]);

// Relaxed field for optional values
const optionalStringOrDynamic = z.union([z.string(), dynamicFieldSpec]).optional();

// TristateValue: boolean or 'random'
const tristateValue = z.union([z.boolean(), z.literal('random')]);
const optionalTristateValue = z.union([z.boolean(), z.literal('random')]).optional();

const childSchema = z.object({
  firstName: stringOrDynamic,
  lastName: stringOrDynamic,
  dateOfBirth: stringOrDynamic,
  isNewPatient: tristateValue,
  hadBracesBefore: optionalTristateValue,
  specialNeeds: z.string().optional(),
});

const inventorySchema = z.object({
  parentFirstName: stringOrDynamic,
  parentLastName: stringOrDynamic,
  parentPhone: z.union([
    z.string().min(10, 'Phone must be at least 10 digits'),
    dynamicFieldSpec,
  ]),
  parentEmail: z.union([z.string().email('Invalid email'), dynamicFieldSpec, z.literal('')]).optional(),
  children: z.array(childSchema).min(1, 'At least one child is required'),
  hasInsurance: optionalTristateValue,
  insuranceProvider: z.string().optional(),
  preferredLocation: z.string().optional(),
  preferredTimeOfDay: z.enum(['morning', 'afternoon', 'any']).optional(),
  preferredDateRange: z
    .object({
      start: z.string(),
      end: z.string(),
    })
    .optional(),
  previousVisitToOffice: optionalTristateValue,
  previousOrthoTreatment: optionalTristateValue,
});

const traitsSchema = z.object({
  verbosity: z.enum(['terse', 'normal', 'verbose']),
  providesExtraInfo: tristateValue,
  patienceLevel: z.enum(['patient', 'moderate', 'impatient']).optional(),
  techSavviness: z.enum(['low', 'moderate', 'high']).optional(),
});

export const personaSchema = z.object({
  name: z.string().min(1, 'Persona name is required'),
  description: z.string().optional(),
  inventory: inventorySchema,
  traits: traitsSchema,
});

export type PersonaSchemaType = z.infer<typeof personaSchema>;

// ============================================================================
// GOALS VALIDATION
// ============================================================================

const goalSchema = z.object({
  id: z.string().min(1, 'Goal ID is required'),
  type: z.enum([
    'data_collection',
    'booking_confirmed',
    'transfer_initiated',
    'conversation_ended',
    'error_handled',
    'custom',
  ]),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  requiredFields: z.array(z.string()).optional(),
  priority: z.number().min(1).max(10),
  required: z.boolean(),
});

export const goalsArraySchema = z
  .array(goalSchema)
  .min(1, 'At least one goal is required');

export type GoalSchemaType = z.infer<typeof goalSchema>;

// ============================================================================
// CONSTRAINTS VALIDATION
// ============================================================================

const constraintSchema = z
  .object({
    type: z.enum(['must_happen', 'must_not_happen', 'max_turns', 'max_time']),
    description: z.string().min(1, 'Description is required'),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    maxTurns: z.number().min(1).max(100).optional(),
    maxTimeMs: z.number().min(1000).max(600000).optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'max_turns' && !data.maxTurns) {
        return false;
      }
      if (data.type === 'max_time' && !data.maxTimeMs) {
        return false;
      }
      return true;
    },
    {
      message: 'max_turns type requires maxTurns value, max_time requires maxTimeMs',
    }
  );

export const constraintsArraySchema = z.array(constraintSchema).optional().default([]);

export type ConstraintSchemaType = z.infer<typeof constraintSchema>;

// ============================================================================
// RESPONSE CONFIG VALIDATION
// ============================================================================

export const responseConfigSchema = z.object({
  maxTurns: z
    .number()
    .min(5, 'Minimum 5 turns')
    .max(50, 'Maximum 50 turns'),
  useLlmResponses: tristateValue,
  handleUnknownIntents: z.enum(['fail', 'clarify', 'generic', 'random']),
});

export type ResponseConfigSchemaType = z.infer<typeof responseConfigSchema>;

// ============================================================================
// COMPLETE WIZARD FORM VALIDATION
// ============================================================================

export const wizardFormSchema = z.object({
  basicInfo: basicInfoSchema,
  persona: personaSchema,
  goals: goalsArraySchema,
  constraints: constraintsArraySchema,
  responseConfig: responseConfigSchema,
});

export type WizardFormSchemaType = z.infer<typeof wizardFormSchema>;

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

/**
 * Validate basic info step
 */
export function validateBasicInfo(data: BasicInfoFormData): {
  isValid: boolean;
  errors: string[];
} {
  // Handle undefined/null data
  if (!data) {
    return { isValid: false, errors: ['Basic info is required'] };
  }

  const result = basicInfoSchema.safeParse(data);
  if (result.success) {
    return { isValid: true, errors: [] };
  }

  // Safely extract errors
  const errors = result.error?.errors?.map((e) => `${e.path.join('.')}: ${e.message}`) || ['Validation failed'];
  return {
    isValid: false,
    errors,
  };
}

/**
 * Validate persona step
 */
export function validatePersona(data: UserPersonaDTO): {
  isValid: boolean;
  errors: string[];
} {
  const result = personaSchema.safeParse(data);
  if (result.success) {
    return { isValid: true, errors: [] };
  }
  return {
    isValid: false,
    errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
  };
}

/**
 * Validate goals step (goals + constraints)
 */
export function validateGoals(
  goals: ConversationGoalDTO[],
  constraints: TestConstraintDTO[]
): {
  isValid: boolean;
  errors: string[];
} {
  const goalsResult = goalsArraySchema.safeParse(goals);
  const constraintsResult = constraintsArraySchema.safeParse(constraints);

  const errors: string[] = [];

  if (!goalsResult.success) {
    errors.push(...goalsResult.error.errors.map((e) => `Goals: ${e.message}`));
  }

  if (!constraintsResult.success) {
    errors.push(
      ...constraintsResult.error.errors.map((e) => `Constraints: ${e.message}`)
    );
  }

  // Additional validation: data_collection goals must have requiredFields
  goals.forEach((goal, index) => {
    if (goal.type === 'data_collection' && (!goal.requiredFields || goal.requiredFields.length === 0)) {
      errors.push(`Goal ${index + 1}: Data collection goals must specify required fields`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate response config step
 */
export function validateResponseConfig(data: ResponseConfigDTO): {
  isValid: boolean;
  errors: string[];
} {
  const result = responseConfigSchema.safeParse(data);
  if (result.success) {
    return { isValid: true, errors: [] };
  }
  return {
    isValid: false,
    errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
  };
}

/**
 * Validate entire wizard form
 */
export function validateWizardForm(data: WizardFormData): {
  isValid: boolean;
  stepErrors: {
    basicInfo: string[];
    persona: string[];
    goals: string[];
    config: string[];
  };
} {
  const basicInfoValidation = validateBasicInfo(data.basicInfo);
  const personaValidation = validatePersona(data.persona);
  const goalsValidation = validateGoals(data.goals, data.constraints);
  const configValidation = validateResponseConfig(data.responseConfig);

  return {
    isValid:
      basicInfoValidation.isValid &&
      personaValidation.isValid &&
      goalsValidation.isValid &&
      configValidation.isValid,
    stepErrors: {
      basicInfo: basicInfoValidation.errors,
      persona: personaValidation.errors,
      goals: goalsValidation.errors,
      config: configValidation.errors,
    },
  };
}

// ============================================================================
// CASE ID GENERATION
// ============================================================================

/**
 * Generate a case ID prefix based on category
 */
export function getCaseIdPrefix(category: TestCategory): string {
  switch (category) {
    case 'happy-path':
      return 'GOAL-HAPPY';
    case 'edge-case':
      return 'GOAL-EDGE';
    case 'error-handling':
      return 'GOAL-ERR';
    default:
      return 'GOAL-TEST';
  }
}

/**
 * Generate a new case ID (placeholder - actual generation needs API call)
 */
export function generateCaseId(category: TestCategory, sequence: number): string {
  const prefix = getCaseIdPrefix(category);
  return `${prefix}-${sequence.toString().padStart(3, '0')}`;
}
