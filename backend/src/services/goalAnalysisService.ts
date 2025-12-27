/**
 * Goal Analysis Service
 * Uses Claude API or CLI to analyze natural language goal descriptions and generate complete wizard form data
 */

import { getLLMProvider, LLMProvider } from '../../../shared/services/llm-provider';
import { isClaudeCliEnabled } from '../../../shared/config/llm-config';

// ============================================================================
// TYPES
// ============================================================================

export type TestCategory = 'happy-path' | 'edge-case' | 'error-handling';

export type GoalType =
  | 'data_collection'
  | 'booking_confirmed'
  | 'transfer_initiated'
  | 'conversation_ended'
  | 'error_handled'
  | 'custom';

export type CollectableField =
  | 'parent_name' | 'parent_name_spelling' | 'parent_phone' | 'parent_email'
  | 'child_count' | 'child_names' | 'child_dob' | 'child_age'
  | 'is_new_patient' | 'previous_visit' | 'previous_ortho'
  | 'insurance' | 'special_needs' | 'time_preference' | 'location_preference';

export type ConstraintType = 'must_happen' | 'must_not_happen' | 'max_turns' | 'max_time';

export interface ConversationGoal {
  id: string;
  type: GoalType;
  description: string;
  requiredFields?: CollectableField[];
  priority: number;
  required: boolean;
}

export interface TestConstraint {
  type: ConstraintType;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  maxTurns?: number;
  maxTimeMs?: number;
}

export interface ResponseConfig {
  maxTurns: number;
  useLlmResponses: boolean;
  handleUnknownIntents: 'fail' | 'clarify' | 'generic';
}

export interface DynamicFieldSpec {
  _dynamic: true;
  fieldType: string;
}

export interface ChildData {
  firstName: string | DynamicFieldSpec;
  lastName: string | DynamicFieldSpec;
  dateOfBirth: string | DynamicFieldSpec;
  isNewPatient: boolean;
  specialNeeds?: string;
}

export interface DataInventory {
  parentFirstName: string | DynamicFieldSpec;
  parentLastName: string | DynamicFieldSpec;
  parentPhone: string | DynamicFieldSpec;
  parentEmail?: string | DynamicFieldSpec;
  children: ChildData[];
  hasInsurance: boolean;
  insuranceProvider?: string;
  preferredTimeOfDay?: 'morning' | 'afternoon' | 'any';
  preferredLocation?: string;
  previousVisitToOffice?: boolean;
  previousOrthoTreatment?: boolean;
}

export interface PersonaTraits {
  verbosity: 'terse' | 'normal' | 'verbose';
  providesExtraInfo: boolean;
  patienceLevel?: 'patient' | 'moderate' | 'impatient';
  techSavviness?: 'low' | 'moderate' | 'high';
}

export interface UserPersona {
  name: string;
  description?: string;
  inventory: DataInventory;
  traits: PersonaTraits;
}

export interface BasicInfoFormData {
  name: string;
  description: string;
  category: TestCategory;
  tags: string[];
  initialMessage: string;
}

export interface WizardFormData {
  basicInfo: BasicInfoFormData;
  persona: UserPersona;
  goals: ConversationGoal[];
  constraints: TestConstraint[];
  responseConfig: ResponseConfig;
}

export interface GoalAnalysisRequest {
  description: string;
  model?: 'fast' | 'standard' | 'detailed';
}

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

interface FewShotExample {
  input: string;
  category: TestCategory;
  output: {
    basicInfo: Partial<BasicInfoFormData>;
    goals: Array<Partial<ConversationGoal>>;
    constraints: Array<Partial<TestConstraint>>;
    cloud9Operations: string[];
    requiredDataFields: string[];
  };
}

// ============================================================================
// MODEL CONFIGURATION
// ============================================================================

const MODEL_CONFIG = {
  fast: {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    temperature: 0.2,
  },
  standard: {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    temperature: 0.2,
  },
  detailed: {
    model: 'claude-opus-4-5-20251101',
    maxTokens: 4096,
    temperature: 0.1,
  },
};

// ============================================================================
// CLOUD9 OPERATION MAPPINGS
// ============================================================================

const CLOUD9_OPERATIONS: Record<string, { description: string; requiredFields: CollectableField[] }> = {
  SetPatient: {
    description: 'Create a new patient record',
    requiredFields: ['parent_name', 'parent_phone', 'child_names', 'child_dob'],
  },
  GetPortalPatientLookup: {
    description: 'Search for existing patients',
    requiredFields: ['parent_name'],
  },
  GetPatientInformation: {
    description: 'Get detailed patient information',
    requiredFields: [],
  },
  GetOnlineReservations: {
    description: 'Find available appointment slots',
    requiredFields: ['time_preference', 'location_preference'],
  },
  SetAppointment: {
    description: 'Book an appointment',
    requiredFields: [],
  },
  SetAppointmentStatusConfirmed: {
    description: 'Confirm an existing appointment',
    requiredFields: [],
  },
  SetAppointmentStatusCanceled: {
    description: 'Cancel an existing appointment',
    requiredFields: [],
  },
};

// ============================================================================
// FEW-SHOT EXAMPLES
// ============================================================================

const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  {
    input: 'Test that a new parent can call in, provide their information and schedule a first appointment for their child who has never been to an orthodontist before. The parent has Keystone First insurance.',
    category: 'happy-path',
    output: {
      basicInfo: {
        name: 'New Patient Single Child with Keystone First Insurance',
        description: 'Complete new patient orthodontic consult booking for one child with Keystone First insurance',
        category: 'happy-path',
        tags: ['booking', 'new-patient', 'single-child', 'insurance'],
        initialMessage: 'Hi I need to schedule an orthodontic appointment for my child',
      },
      goals: [
        { id: 'collect-parent-info', type: 'data_collection', description: 'Collect parent contact information', requiredFields: ['parent_name', 'parent_phone'], priority: 1, required: true },
        { id: 'collect-child-info', type: 'data_collection', description: 'Collect child patient information', requiredFields: ['child_names', 'child_dob'], priority: 2, required: true },
        { id: 'collect-insurance', type: 'data_collection', description: 'Collect insurance information', requiredFields: ['insurance'], priority: 3, required: true },
        { id: 'booking-confirmed', type: 'booking_confirmed', description: 'Successfully complete appointment booking', priority: 10, required: true },
        { id: 'conversation-ended', type: 'conversation_ended', description: 'Proper goodbye and conversation end', priority: 11, required: false },
      ],
      constraints: [
        { type: 'must_not_happen', description: 'No error messages or system errors exposed', severity: 'critical' },
        { type: 'max_turns', description: 'Complete booking within reasonable turns', severity: 'medium', maxTurns: 25 },
      ],
      cloud9Operations: ['SetPatient', 'GetOnlineReservations', 'SetAppointment'],
      requiredDataFields: ['parent_name', 'parent_phone', 'child_names', 'child_dob', 'insurance'],
    },
  },
  {
    input: 'Test that a parent can cancel an existing appointment for their child',
    category: 'happy-path',
    output: {
      basicInfo: {
        name: 'Appointment Cancellation',
        description: 'Verify parent can successfully cancel an existing orthodontic appointment',
        category: 'happy-path',
        tags: ['cancellation', 'existing-patient', 'appointment-management'],
        initialMessage: 'Hi I need to cancel my child\'s upcoming appointment',
      },
      goals: [
        { id: 'identify-caller', type: 'data_collection', description: 'Collect caller identity information', requiredFields: ['parent_name', 'parent_phone'], priority: 1, required: true },
        { id: 'locate-appointment', type: 'custom', description: 'System should locate the appointment to cancel', priority: 2, required: true },
        { id: 'cancellation-confirmed', type: 'custom', description: 'Successfully cancel the appointment', priority: 3, required: true },
        { id: 'confirmation-provided', type: 'custom', description: 'Provide cancellation confirmation to caller', priority: 4, required: true },
        { id: 'conversation-ended', type: 'conversation_ended', description: 'Proper goodbye', priority: 10, required: false },
      ],
      constraints: [
        { type: 'must_not_happen', description: 'Should not offer to book new appointment unless requested', severity: 'medium' },
        { type: 'must_happen', description: 'Must confirm cancellation before ending call', severity: 'high' },
        { type: 'max_turns', description: 'Complete cancellation quickly', severity: 'medium', maxTurns: 15 },
      ],
      cloud9Operations: ['GetPortalPatientLookup', 'GetAppointmentListByPatient', 'SetAppointmentStatusCanceled'],
      requiredDataFields: ['parent_name', 'parent_phone'],
    },
  },
  {
    input: 'Test that a parent can confirm an upcoming appointment',
    category: 'happy-path',
    output: {
      basicInfo: {
        name: 'Appointment Confirmation',
        description: 'Verify parent can successfully confirm an existing orthodontic appointment',
        category: 'happy-path',
        tags: ['confirmation', 'existing-patient', 'appointment-management'],
        initialMessage: 'Hi I\'m calling to confirm my child\'s appointment',
      },
      goals: [
        { id: 'identify-caller', type: 'data_collection', description: 'Collect caller identity information', requiredFields: ['parent_name', 'parent_phone'], priority: 1, required: true },
        { id: 'locate-appointment', type: 'custom', description: 'System should locate the appointment to confirm', priority: 2, required: true },
        { id: 'confirmation-completed', type: 'custom', description: 'Successfully confirm the appointment', priority: 3, required: true },
        { id: 'details-provided', type: 'custom', description: 'Provide appointment details (date, time, location)', priority: 4, required: true },
      ],
      constraints: [
        { type: 'must_happen', description: 'Must read back appointment details', severity: 'high' },
        { type: 'max_turns', description: 'Complete confirmation quickly', severity: 'medium', maxTurns: 12 },
      ],
      cloud9Operations: ['GetPortalPatientLookup', 'GetAppointmentListByPatient', 'SetAppointmentStatusConfirmed'],
      requiredDataFields: ['parent_name', 'parent_phone'],
    },
  },
  {
    input: 'Test that a parent can reschedule an existing appointment to a new time',
    category: 'happy-path',
    output: {
      basicInfo: {
        name: 'Appointment Rescheduling',
        description: 'Verify parent can successfully reschedule an existing appointment to a new date/time',
        category: 'happy-path',
        tags: ['reschedule', 'existing-patient', 'appointment-management'],
        initialMessage: 'Hi I need to reschedule my child\'s orthodontic appointment',
      },
      goals: [
        { id: 'identify-caller', type: 'data_collection', description: 'Collect caller identity information', requiredFields: ['parent_name', 'parent_phone'], priority: 1, required: true },
        { id: 'locate-appointment', type: 'custom', description: 'System should locate the appointment to reschedule', priority: 2, required: true },
        { id: 'collect-new-preference', type: 'data_collection', description: 'Collect new date/time preference', requiredFields: ['time_preference'], priority: 3, required: true },
        { id: 'reschedule-confirmed', type: 'booking_confirmed', description: 'Successfully reschedule to new time', priority: 4, required: true },
      ],
      constraints: [
        { type: 'must_happen', description: 'Must confirm new appointment details', severity: 'high' },
        { type: 'max_turns', description: 'Complete reschedule within reasonable turns', severity: 'medium', maxTurns: 20 },
      ],
      cloud9Operations: ['GetPortalPatientLookup', 'GetAppointmentListByPatient', 'SetAppointmentStatusCanceled', 'GetOnlineReservations', 'SetAppointment'],
      requiredDataFields: ['parent_name', 'parent_phone', 'time_preference'],
    },
  },
  {
    input: 'Test booking for two siblings with Aetna insurance',
    category: 'happy-path',
    output: {
      basicInfo: {
        name: 'New Patient Two Siblings with Aetna Insurance',
        description: 'Book new patient orthodontic consult for two children with Aetna insurance',
        category: 'happy-path',
        tags: ['booking', 'siblings', 'multiple-children', 'insurance'],
        initialMessage: 'Hi I need to schedule appointments for my two kids',
      },
      goals: [
        { id: 'collect-parent-info', type: 'data_collection', description: 'Collect parent contact information', requiredFields: ['parent_name', 'parent_phone'], priority: 1, required: true },
        { id: 'collect-child-count', type: 'data_collection', description: 'Confirm number of children', requiredFields: ['child_count'], priority: 2, required: true },
        { id: 'collect-children-info', type: 'data_collection', description: 'Collect information for both children', requiredFields: ['child_names', 'child_dob'], priority: 3, required: true },
        { id: 'booking-confirmed', type: 'booking_confirmed', description: 'Successfully complete appointment booking', priority: 10, required: true },
      ],
      constraints: [
        { type: 'must_not_happen', description: 'No error messages exposed', severity: 'critical' },
        { type: 'max_turns', description: 'Complete within reasonable turns', severity: 'medium', maxTurns: 30 },
      ],
      cloud9Operations: ['SetPatient', 'GetOnlineReservations', 'SetAppointment'],
      requiredDataFields: ['parent_name', 'parent_phone', 'child_count', 'child_names', 'child_dob', 'insurance'],
    },
  },
  {
    input: 'Test what happens when an existing patient tries to book through the new patient flow',
    category: 'edge-case',
    output: {
      basicInfo: {
        name: 'Existing Patient in New Patient Flow',
        description: 'Verify system correctly identifies existing patient and handles appropriately',
        category: 'edge-case',
        tags: ['existing-patient', 'edge-case', 'patient-lookup'],
        initialMessage: 'Hi I need to schedule an appointment for my child',
      },
      goals: [
        { id: 'detect-existing', type: 'custom', description: 'System should detect existing patient status', priority: 1, required: true },
        { id: 'appropriate-handling', type: 'custom', description: 'System should handle existing patient appropriately (transfer or redirect)', priority: 2, required: true },
      ],
      constraints: [
        { type: 'must_happen', description: 'Patient lookup should occur', severity: 'high' },
        { type: 'must_not_happen', description: 'Should not create duplicate patient record', severity: 'critical' },
        { type: 'max_turns', description: 'Resolve within reasonable turns', severity: 'medium', maxTurns: 15 },
      ],
      cloud9Operations: ['GetPortalPatientLookup', 'GetPatientInformation'],
      requiredDataFields: ['parent_name', 'parent_phone'],
    },
  },
  {
    input: 'Test error handling when no appointments are available',
    category: 'error-handling',
    output: {
      basicInfo: {
        name: 'No Available Appointments Error Handling',
        description: 'Verify system gracefully handles when no appointment slots are available',
        category: 'error-handling',
        tags: ['error-handling', 'no-availability', 'graceful-degradation'],
        initialMessage: 'Hi I need to schedule an orthodontic appointment',
      },
      goals: [
        { id: 'collect-basic-info', type: 'data_collection', description: 'Collect basic information', requiredFields: ['parent_name', 'parent_phone'], priority: 1, required: true },
        { id: 'error-detected', type: 'error_handled', description: 'System should detect no availability', priority: 2, required: true },
        { id: 'graceful-response', type: 'custom', description: 'System should provide helpful alternative (callback, waitlist, etc.)', priority: 3, required: true },
      ],
      constraints: [
        { type: 'must_not_happen', description: 'Should not expose technical error details', severity: 'critical' },
        { type: 'must_happen', description: 'Should offer alternative path or escalation', severity: 'high' },
        { type: 'max_turns', description: 'Handle error quickly', severity: 'medium', maxTurns: 12 },
      ],
      cloud9Operations: ['GetOnlineReservations'],
      requiredDataFields: ['parent_name', 'parent_phone', 'time_preference'],
    },
  },
];

// ============================================================================
// SERVICE
// ============================================================================

export class GoalAnalysisService {
  private llmProvider: LLMProvider;

  constructor() {
    this.llmProvider = getLLMProvider();
    this.logInitialization();
  }

  private async logInitialization(): Promise<void> {
    const mode = isClaudeCliEnabled() ? 'CLI' : 'API';
    const status = await this.llmProvider.checkAvailability();
    if (status.available) {
      console.log(`[GoalAnalysisService] Initialized with ${mode} mode (provider: ${status.provider})`);
    } else {
      console.log(`[GoalAnalysisService] ${mode} mode not available: ${status.error}`);
      console.log('[GoalAnalysisService] AI analysis will use demo mode');
    }
  }

  /**
   * Check if using real API vs demo mode
   */
  isUsingRealAPI(): boolean {
    return this.llmProvider.isAvailable();
  }

  /**
   * Analyze a natural language goal description and generate wizard form data
   */
  async analyzeGoalDescription(request: GoalAnalysisRequest): Promise<GoalAnalysisResult> {
    const startTime = Date.now();
    const modelType = request.model || 'standard';
    const modelConfig = MODEL_CONFIG[modelType];

    // Check if LLM is available
    const status = await this.llmProvider.checkAvailability();
    if (!status.available) {
      console.log('[GoalAnalysisService] Using demo mode (LLM not available)');
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate processing
      return this.generateDemoAnalysis(request, startTime);
    }

    const prompt = this.buildAnalysisPrompt(request.description);

    try {
      const response = await this.llmProvider.execute({
        prompt,
        model: modelConfig.model,
        maxTokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        timeout: 120000, // 2 minute timeout
      });

      if (!response.success) {
        console.error('[GoalAnalysisService] LLM call failed:', response.error);
        return this.generateDemoAnalysis(request, startTime);
      }

      const responseText = response.content || '';
      const parsed = this.parseAnalysisResponse(responseText, request.description);

      return {
        ...parsed,
        metadata: {
          model: modelConfig.model,
          processingTimeMs: Date.now() - startTime,
          tokensUsed: response.usage ? response.usage.inputTokens + response.usage.outputTokens : undefined,
        },
      };
    } catch (error: any) {
      console.error('[GoalAnalysisService] Error analyzing description:', error);
      return {
        success: false,
        analysis: {
          detectedIntent: 'unknown',
          cloud9Operations: [],
          requiredDataFields: [],
          suggestedCategory: 'happy-path',
          confidence: 0,
        },
        wizardData: this.generateDefaultWizardData(),
        reasoning: 'Analysis failed',
        metadata: {
          model: modelConfig.model,
          processingTimeMs: Date.now() - startTime,
        },
        error: error.message || 'Failed to analyze goal description',
      };
    }
  }

  private buildAnalysisPrompt(description: string): string {
    const fewShotExamplesText = FEW_SHOT_EXAMPLES.map((ex, i) => `
### Example ${i + 1}:
**Input:** "${ex.input}"
**Category:** ${ex.category}
**Output:**
\`\`\`json
${JSON.stringify(ex.output, null, 2)}
\`\`\`
`).join('\n');

    const cloud9OperationsText = Object.entries(CLOUD9_OPERATIONS).map(([name, info]) =>
      `- **${name}**: ${info.description}`
    ).join('\n');

    return `You are an expert at analyzing test case descriptions for an orthodontic appointment scheduling IVA (Interactive Voice Agent) called "Allie".

## SYSTEM CONTEXT

The IVA helps parents schedule orthodontic appointments for their children through a phone/chat interface. It collects information like parent name, phone, child details, and insurance information before helping them find and book an appointment.

The system integrates with Cloud9 Ortho API for patient management and scheduling.

## AVAILABLE CLOUD9 OPERATIONS

${cloud9OperationsText}

## AVAILABLE DATA FIELDS TO COLLECT

- **parent_name**: Parent's full name
- **parent_phone**: Parent's phone number
- **parent_email**: Parent's email address
- **child_count**: Number of children to schedule
- **child_names**: Names of children
- **child_dob**: Children's dates of birth
- **is_new_patient**: Whether this is a new patient
- **previous_visit**: Previous visit to this office
- **previous_ortho**: Previous orthodontic treatment
- **insurance**: Insurance information
- **special_needs**: Any special needs or accommodations
- **time_preference**: Preferred time of day
- **location_preference**: Preferred office location

## GOAL TYPES

1. **data_collection** - Bot should collect specific data fields from the user
2. **booking_confirmed** - Bot successfully books an appointment
3. **transfer_initiated** - Bot transfers user to a live agent
4. **conversation_ended** - Bot properly ends the conversation
5. **error_handled** - Bot handles an error gracefully
6. **custom** - Custom goal with free-form description

## CONSTRAINT TYPES

1. **must_happen** - Something MUST occur during the conversation
2. **must_not_happen** - Something must NOT occur
3. **max_turns** - Limit the number of conversation turns
4. **max_time** - Limit total conversation time (in milliseconds)

## CATEGORY DETECTION

- **happy-path**: Normal, successful user journeys where everything works as expected
- **edge-case**: Unusual but valid scenarios (existing patient, multiple children, out-of-network insurance, etc.)
- **error-handling**: Scenarios where things go wrong (no availability, system errors, invalid input, etc.)

## FEW-SHOT EXAMPLES

${fewShotExamplesText}

## YOUR TASK

Analyze this natural language goal description and generate complete wizard form data:

**Description:** "${description}"

## RESPONSE FORMAT

Respond with a JSON object in this exact format:
\`\`\`json
{
  "analysis": {
    "detectedIntent": "Brief description of what the test is trying to verify",
    "cloud9Operations": ["Operation1", "Operation2"],
    "requiredDataFields": ["field1", "field2"],
    "suggestedCategory": "happy-path|edge-case|error-handling",
    "confidence": 0.95
  },
  "wizardData": {
    "basicInfo": {
      "name": "Test case name (max 100 chars)",
      "description": "Detailed description (max 500 chars)",
      "category": "happy-path|edge-case|error-handling",
      "tags": ["tag1", "tag2"],
      "initialMessage": "The first message the test user says"
    },
    "persona": {
      "name": "Persona Name",
      "description": "Brief persona description",
      "inventory": {
        "parentFirstName": { "_dynamic": true, "fieldType": "firstName" },
        "parentLastName": { "_dynamic": true, "fieldType": "lastName" },
        "parentPhone": { "_dynamic": true, "fieldType": "phone" },
        "parentEmail": { "_dynamic": true, "fieldType": "email" },
        "children": [
          {
            "firstName": { "_dynamic": true, "fieldType": "firstName" },
            "lastName": { "_dynamic": true, "fieldType": "lastName" },
            "dateOfBirth": { "_dynamic": true, "fieldType": "dateOfBirth" },
            "isNewPatient": true
          }
        ],
        "hasInsurance": true,
        "insuranceProvider": "Insurance Name or null",
        "preferredTimeOfDay": "morning|afternoon|any",
        "previousVisitToOffice": false,
        "previousOrthoTreatment": false
      },
      "traits": {
        "verbosity": "terse|normal|verbose",
        "providesExtraInfo": true,
        "patienceLevel": "patient|moderate|impatient",
        "techSavviness": "low|moderate|high"
      }
    },
    "goals": [
      {
        "id": "goal-id",
        "type": "data_collection|booking_confirmed|etc",
        "description": "Goal description",
        "requiredFields": ["field1", "field2"],
        "priority": 1,
        "required": true
      }
    ],
    "constraints": [
      {
        "type": "must_happen|must_not_happen|max_turns|max_time",
        "description": "Constraint description",
        "severity": "low|medium|high|critical",
        "maxTurns": 25,
        "maxTimeMs": null
      }
    ],
    "responseConfig": {
      "maxTurns": 25,
      "useLlmResponses": true,
      "handleUnknownIntents": "clarify"
    }
  },
  "reasoning": "Explanation of why these goals, constraints, and settings are appropriate"
}
\`\`\`

## GUIDELINES

1. **Name Generation**: Create a descriptive but concise test name (max 100 chars)
2. **Description**: Explain what the test verifies (max 500 chars)
3. **Tag Generation**: Include relevant tags like 'booking', 'new-patient', 'insurance', etc.
4. **Goal Priority**: Lower numbers = higher priority (1 is highest)
5. **Required Goals**: Mark the most critical goals as required=true
6. **Constraints**: Always include at least one constraint (usually max_turns)
7. **Persona**: Use dynamic fields for realistic test data generation
8. **Insurance**: If insurance is mentioned, set hasInsurance=true and provide insuranceProvider
9. **Children**: Adjust number of children in the array based on description

Generate the analysis now.`;
  }

  private parseAnalysisResponse(responseText: string, originalDescription: string): Omit<GoalAnalysisResult, 'metadata'> {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                        responseText.match(/\{[\s\S]*"analysis"[\s\S]*"wizardData"[\s\S]*\}/);

      if (!jsonMatch) {
        console.error('[GoalAnalysisService] Could not find JSON in response');
        return this.generateFallbackAnalysis(originalDescription);
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      // Validate and normalize the response
      const analysis = {
        detectedIntent: parsed.analysis?.detectedIntent || 'Goal test scenario',
        cloud9Operations: Array.isArray(parsed.analysis?.cloud9Operations) ? parsed.analysis.cloud9Operations : [],
        requiredDataFields: Array.isArray(parsed.analysis?.requiredDataFields) ? parsed.analysis.requiredDataFields : [],
        suggestedCategory: this.validateCategory(parsed.analysis?.suggestedCategory),
        confidence: typeof parsed.analysis?.confidence === 'number' ? parsed.analysis.confidence : 0.8,
      };

      const wizardData = this.validateWizardData(parsed.wizardData);

      return {
        success: true,
        analysis,
        wizardData,
        reasoning: parsed.reasoning || 'Analysis completed successfully.',
      };
    } catch (error) {
      console.error('[GoalAnalysisService] Error parsing response:', error);
      return this.generateFallbackAnalysis(originalDescription);
    }
  }

  private validateCategory(category: any): TestCategory {
    if (category === 'happy-path' || category === 'edge-case' || category === 'error-handling') {
      return category;
    }
    return 'happy-path';
  }

  private validateWizardData(data: any): WizardFormData {
    const defaultData = this.generateDefaultWizardData();

    if (!data) return defaultData;

    return {
      basicInfo: {
        name: data.basicInfo?.name || defaultData.basicInfo.name,
        description: data.basicInfo?.description || defaultData.basicInfo.description,
        category: this.validateCategory(data.basicInfo?.category),
        tags: Array.isArray(data.basicInfo?.tags) ? data.basicInfo.tags : [],
        initialMessage: data.basicInfo?.initialMessage || defaultData.basicInfo.initialMessage,
      },
      persona: {
        name: data.persona?.name || 'Test Persona',
        description: data.persona?.description || '',
        inventory: this.validateInventory(data.persona?.inventory),
        traits: this.validateTraits(data.persona?.traits),
      },
      goals: Array.isArray(data.goals) ? data.goals.map((g: any, i: number) => ({
        id: g.id || `goal-${i + 1}`,
        type: g.type || 'custom',
        description: g.description || 'Goal',
        requiredFields: Array.isArray(g.requiredFields) ? g.requiredFields : undefined,
        priority: typeof g.priority === 'number' ? g.priority : i + 1,
        required: g.required !== false,
      })) : defaultData.goals,
      constraints: Array.isArray(data.constraints) ? data.constraints.map((c: any) => ({
        type: c.type || 'max_turns',
        description: c.description || 'Constraint',
        severity: c.severity || 'medium',
        maxTurns: c.maxTurns,
        maxTimeMs: c.maxTimeMs,
      })) : defaultData.constraints,
      responseConfig: {
        maxTurns: data.responseConfig?.maxTurns || 25,
        useLlmResponses: data.responseConfig?.useLlmResponses !== false,
        handleUnknownIntents: data.responseConfig?.handleUnknownIntents || 'clarify',
      },
    };
  }

  private validateInventory(inventory: any): DataInventory {
    const dynamicField = (fieldType: string): DynamicFieldSpec => ({
      _dynamic: true,
      fieldType,
    });

    if (!inventory) {
      return {
        parentFirstName: dynamicField('firstName'),
        parentLastName: dynamicField('lastName'),
        parentPhone: dynamicField('phone'),
        parentEmail: dynamicField('email'),
        children: [{
          firstName: dynamicField('firstName'),
          lastName: dynamicField('lastName'),
          dateOfBirth: dynamicField('dateOfBirth'),
          isNewPatient: true,
        }],
        hasInsurance: false,
        preferredTimeOfDay: 'any',
        previousVisitToOffice: false,
        previousOrthoTreatment: false,
      };
    }

    return {
      parentFirstName: inventory.parentFirstName || dynamicField('firstName'),
      parentLastName: inventory.parentLastName || dynamicField('lastName'),
      parentPhone: inventory.parentPhone || dynamicField('phone'),
      parentEmail: inventory.parentEmail || dynamicField('email'),
      children: Array.isArray(inventory.children) && inventory.children.length > 0
        ? inventory.children.map((c: any) => ({
            firstName: c.firstName || dynamicField('firstName'),
            lastName: c.lastName || dynamicField('lastName'),
            dateOfBirth: c.dateOfBirth || dynamicField('dateOfBirth'),
            isNewPatient: c.isNewPatient !== false,
            specialNeeds: c.specialNeeds,
          }))
        : [{
            firstName: dynamicField('firstName'),
            lastName: dynamicField('lastName'),
            dateOfBirth: dynamicField('dateOfBirth'),
            isNewPatient: true,
          }],
      hasInsurance: inventory.hasInsurance === true,
      insuranceProvider: inventory.insuranceProvider || undefined,
      preferredTimeOfDay: inventory.preferredTimeOfDay || 'any',
      preferredLocation: inventory.preferredLocation,
      previousVisitToOffice: inventory.previousVisitToOffice === true,
      previousOrthoTreatment: inventory.previousOrthoTreatment === true,
    };
  }

  private validateTraits(traits: any): PersonaTraits {
    return {
      verbosity: traits?.verbosity || 'normal',
      providesExtraInfo: traits?.providesExtraInfo !== false,
      patienceLevel: traits?.patienceLevel || 'patient',
      techSavviness: traits?.techSavviness || 'moderate',
    };
  }

  private generateDefaultWizardData(): WizardFormData {
    const dynamicField = (fieldType: string): DynamicFieldSpec => ({
      _dynamic: true,
      fieldType,
    });

    return {
      basicInfo: {
        name: 'New Goal Test',
        description: 'Test case generated from natural language description',
        category: 'happy-path',
        tags: ['goal-based'],
        initialMessage: 'Hi, I need to schedule an appointment for my child',
      },
      persona: {
        name: 'Test Persona',
        description: 'Dynamically generated test persona',
        inventory: {
          parentFirstName: dynamicField('firstName'),
          parentLastName: dynamicField('lastName'),
          parentPhone: dynamicField('phone'),
          parentEmail: dynamicField('email'),
          children: [{
            firstName: dynamicField('firstName'),
            lastName: dynamicField('lastName'),
            dateOfBirth: dynamicField('dateOfBirth'),
            isNewPatient: true,
          }],
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
      },
      goals: [
        {
          id: 'collect-info',
          type: 'data_collection',
          description: 'Collect required information',
          requiredFields: ['parent_name', 'parent_phone', 'child_names', 'child_dob'],
          priority: 1,
          required: true,
        },
        {
          id: 'booking-confirmed',
          type: 'booking_confirmed',
          description: 'Complete appointment booking',
          priority: 10,
          required: true,
        },
      ],
      constraints: [
        {
          type: 'must_not_happen',
          description: 'No error messages exposed',
          severity: 'critical',
        },
        {
          type: 'max_turns',
          description: 'Complete within reasonable turns',
          severity: 'medium',
          maxTurns: 25,
        },
      ],
      responseConfig: {
        maxTurns: 25,
        useLlmResponses: true,
        handleUnknownIntents: 'clarify',
      },
    };
  }

  private generateFallbackAnalysis(description: string): Omit<GoalAnalysisResult, 'metadata'> {
    // Try to extract some meaning from the description
    const lowerDesc = description.toLowerCase();

    let category: TestCategory = 'happy-path';
    if (lowerDesc.includes('error') || lowerDesc.includes('fail') || lowerDesc.includes('wrong')) {
      category = 'error-handling';
    } else if (lowerDesc.includes('existing') || lowerDesc.includes('edge') || lowerDesc.includes('already')) {
      category = 'edge-case';
    }

    const cloud9Operations: string[] = [];
    const requiredFields: CollectableField[] = ['parent_name', 'parent_phone'];

    if (lowerDesc.includes('book') || lowerDesc.includes('schedule') || lowerDesc.includes('appointment')) {
      cloud9Operations.push('GetOnlineReservations', 'SetAppointment');
    }
    if (lowerDesc.includes('new patient') || lowerDesc.includes('first time')) {
      cloud9Operations.push('SetPatient');
      requiredFields.push('child_names', 'child_dob');
    }
    if (lowerDesc.includes('existing') || lowerDesc.includes('lookup')) {
      cloud9Operations.push('GetPortalPatientLookup', 'GetPatientInformation');
    }
    if (lowerDesc.includes('cancel')) {
      cloud9Operations.push('SetAppointmentStatusCanceled');
    }
    if (lowerDesc.includes('insurance')) {
      requiredFields.push('insurance');
    }

    const wizardData = this.generateDefaultWizardData();
    wizardData.basicInfo.category = category;
    wizardData.basicInfo.name = description.slice(0, 100);

    return {
      success: true,
      analysis: {
        detectedIntent: 'Goal test from description',
        cloud9Operations,
        requiredDataFields: requiredFields,
        suggestedCategory: category,
        confidence: 0.6,
      },
      wizardData,
      reasoning: 'Fallback analysis generated due to parsing issues. Review and adjust as needed.',
    };
  }

  /**
   * Generate demo analysis for testing when no API key is available
   */
  private generateDemoAnalysis(request: GoalAnalysisRequest, startTime: number): GoalAnalysisResult {
    const lowerDesc = request.description.toLowerCase();

    // Detect specific intents first (cancellation, confirmation, reschedule)
    const isCancellation = lowerDesc.includes('cancel');
    const isConfirmation = lowerDesc.includes('confirm') && !lowerDesc.includes('booking');
    const isReschedule = lowerDesc.includes('reschedule') || lowerDesc.includes('change appointment') || lowerDesc.includes('move appointment');
    const isExistingPatient = lowerDesc.includes('existing') || lowerDesc.includes('returning') || lowerDesc.includes('follow-up');
    const isNewPatient = lowerDesc.includes('new patient') || lowerDesc.includes('first time') || lowerDesc.includes('never been');
    const isBooking = !isCancellation && !isConfirmation && !isReschedule &&
                       (lowerDesc.includes('book') || lowerDesc.includes('schedule'));

    // Detect category based on intent
    let category: TestCategory = 'happy-path';
    let detectedIntent = 'New patient appointment booking';

    if (isCancellation) {
      detectedIntent = 'Appointment cancellation';
    } else if (isConfirmation) {
      detectedIntent = 'Appointment confirmation';
    } else if (isReschedule) {
      detectedIntent = 'Appointment rescheduling';
    } else if (isExistingPatient && !isBooking) {
      category = 'edge-case';
      detectedIntent = 'Existing patient scenario';
    } else if (lowerDesc.includes('error') || lowerDesc.includes('fail') || lowerDesc.includes('no available') || lowerDesc.includes('wrong')) {
      category = 'error-handling';
      detectedIntent = 'Error handling scenario';
    } else if (lowerDesc.includes('edge')) {
      category = 'edge-case';
      detectedIntent = 'Edge case scenario';
    }

    // Detect operations and fields based on intent
    const cloud9Operations: string[] = [];
    const requiredFields: CollectableField[] = ['parent_name', 'parent_phone'];
    const tags: string[] = ['goal-based'];

    if (isCancellation) {
      cloud9Operations.push('GetPortalPatientLookup', 'GetAppointmentListByPatient', 'SetAppointmentStatusCanceled');
      tags.push('cancellation', 'appointment-management');
    } else if (isConfirmation) {
      cloud9Operations.push('GetPortalPatientLookup', 'GetAppointmentListByPatient', 'SetAppointmentStatusConfirmed');
      tags.push('confirmation', 'appointment-management');
    } else if (isReschedule) {
      cloud9Operations.push('GetPortalPatientLookup', 'GetAppointmentListByPatient', 'SetAppointmentStatusCanceled', 'GetOnlineReservations', 'SetAppointment');
      tags.push('reschedule', 'appointment-management');
      requiredFields.push('time_preference');
    } else if (isBooking || isNewPatient) {
      cloud9Operations.push('GetOnlineReservations', 'SetAppointment');
      tags.push('booking');
      if (isNewPatient || lowerDesc.includes('new') || lowerDesc.includes('first')) {
        cloud9Operations.push('SetPatient');
        tags.push('new-patient');
        requiredFields.push('child_names', 'child_dob');
      }
    }

    if (isExistingPatient && !isCancellation && !isConfirmation && !isReschedule) {
      cloud9Operations.push('GetPortalPatientLookup', 'GetPatientInformation');
      tags.push('existing-patient');
    }

    if (lowerDesc.includes('sibling') || lowerDesc.includes('two') || lowerDesc.includes('multiple')) {
      tags.push('multiple-children');
      requiredFields.push('child_count');
    }

    // Detect insurance
    let hasInsurance = false;
    let insuranceProvider: string | undefined;
    const insurancePatterns = [
      { pattern: /aetna/i, provider: 'Aetna' },
      { pattern: /keystone/i, provider: 'Keystone First' },
      { pattern: /blue\s*cross/i, provider: 'Blue Cross Blue Shield' },
      { pattern: /medicaid/i, provider: 'Medicaid' },
      { pattern: /insurance/i, provider: 'Insurance Provider' },
    ];
    for (const { pattern, provider } of insurancePatterns) {
      if (pattern.test(request.description)) {
        hasInsurance = true;
        insuranceProvider = provider;
        requiredFields.push('insurance');
        tags.push('insurance');
        break;
      }
    }

    // Count children
    let childCount = 1;
    if (lowerDesc.includes('two') || lowerDesc.includes('siblings') || lowerDesc.includes('2 ')) {
      childCount = 2;
    } else if (lowerDesc.includes('three') || lowerDesc.includes('3 ')) {
      childCount = 3;
    }

    // Generate name based on detected intent
    let testName = 'Goal Test';
    if (isCancellation) {
      testName = 'Appointment Cancellation';
    } else if (isConfirmation) {
      testName = 'Appointment Confirmation';
    } else if (isReschedule) {
      testName = 'Appointment Rescheduling';
    } else if (category === 'happy-path') {
      testName = childCount > 1 ? `New Patient ${childCount} Children Booking` : 'New Patient Single Child Booking';
      if (hasInsurance && insuranceProvider) {
        testName += ` with ${insuranceProvider}`;
      }
    } else if (category === 'edge-case') {
      testName = 'Edge Case: ' + (lowerDesc.includes('existing') ? 'Existing Patient Detection' : 'Special Scenario');
    } else {
      testName = 'Error Handling: ' + (lowerDesc.includes('no available') ? 'No Availability' : 'Error Recovery');
    }

    const dynamicField = (fieldType: string): DynamicFieldSpec => ({
      _dynamic: true,
      fieldType,
    });

    // Build children array
    const children: ChildData[] = [];
    for (let i = 0; i < childCount; i++) {
      children.push({
        firstName: dynamicField('firstName'),
        lastName: dynamicField('lastName'),
        dateOfBirth: dynamicField('dateOfBirth'),
        isNewPatient: !lowerDesc.includes('existing'),
        specialNeeds: lowerDesc.includes('special needs') ? 'Special needs noted' : undefined,
      });
    }

    // Build goals based on detected intent (cancellation, confirmation, reschedule) or category
    const goals: ConversationGoal[] = [];

    if (isCancellation) {
      // Cancellation-specific goals
      goals.push(
        { id: 'identify-caller', type: 'data_collection', description: 'Collect caller identity information', requiredFields: ['parent_name', 'parent_phone'], priority: 1, required: true },
        { id: 'locate-appointment', type: 'custom', description: 'System should locate the appointment to cancel', priority: 2, required: true },
        { id: 'cancellation-confirmed', type: 'custom', description: 'Successfully cancel the appointment', priority: 3, required: true },
        { id: 'confirmation-provided', type: 'custom', description: 'Provide cancellation confirmation to caller', priority: 4, required: true },
        { id: 'conversation-ended', type: 'conversation_ended', description: 'Proper goodbye', priority: 10, required: false },
      );
    } else if (isConfirmation) {
      // Confirmation-specific goals
      goals.push(
        { id: 'identify-caller', type: 'data_collection', description: 'Collect caller identity information', requiredFields: ['parent_name', 'parent_phone'], priority: 1, required: true },
        { id: 'locate-appointment', type: 'custom', description: 'System should locate the appointment to confirm', priority: 2, required: true },
        { id: 'confirmation-completed', type: 'custom', description: 'Successfully confirm the appointment', priority: 3, required: true },
        { id: 'details-provided', type: 'custom', description: 'Provide appointment details (date, time, location)', priority: 4, required: true },
        { id: 'conversation-ended', type: 'conversation_ended', description: 'Proper goodbye', priority: 10, required: false },
      );
    } else if (isReschedule) {
      // Reschedule-specific goals
      goals.push(
        { id: 'identify-caller', type: 'data_collection', description: 'Collect caller identity information', requiredFields: ['parent_name', 'parent_phone'], priority: 1, required: true },
        { id: 'locate-appointment', type: 'custom', description: 'System should locate the appointment to reschedule', priority: 2, required: true },
        { id: 'collect-new-preference', type: 'data_collection', description: 'Collect new date/time preference', requiredFields: ['time_preference'], priority: 3, required: true },
        { id: 'reschedule-confirmed', type: 'booking_confirmed', description: 'Successfully reschedule to new time', priority: 4, required: true },
        { id: 'conversation-ended', type: 'conversation_ended', description: 'Proper goodbye', priority: 10, required: false },
      );
    } else if (category === 'happy-path') {
      // Default booking/new patient goals
      goals.push(
        { id: 'collect-parent-info', type: 'data_collection', description: 'Collect parent contact information', requiredFields: ['parent_name', 'parent_phone'], priority: 1, required: true },
        { id: 'collect-child-info', type: 'data_collection', description: 'Collect child patient information', requiredFields: ['child_names', 'child_dob'] as CollectableField[], priority: 2, required: true },
      );
      if (hasInsurance) {
        goals.push({ id: 'collect-insurance', type: 'data_collection', description: 'Collect insurance information', requiredFields: ['insurance'], priority: 3, required: true });
      }
      goals.push(
        { id: 'booking-confirmed', type: 'booking_confirmed', description: 'Successfully complete appointment booking', priority: 10, required: true },
        { id: 'conversation-ended', type: 'conversation_ended', description: 'Proper goodbye', priority: 11, required: false },
      );
    } else if (category === 'edge-case') {
      goals.push(
        { id: 'detect-scenario', type: 'custom', description: 'Detect and handle edge case appropriately', priority: 1, required: true },
        { id: 'appropriate-response', type: 'custom', description: 'Provide appropriate response or escalation', priority: 2, required: true },
      );
    } else {
      goals.push(
        { id: 'error-detected', type: 'error_handled', description: 'System detects error condition', priority: 1, required: true },
        { id: 'graceful-recovery', type: 'custom', description: 'Provide helpful alternative or escalation', priority: 2, required: true },
      );
    }

    // Build constraints based on intent
    const constraints: TestConstraint[] = [
      { type: 'must_not_happen', description: 'No error messages or system errors exposed', severity: 'critical' },
    ];

    if (isCancellation) {
      constraints.push(
        { type: 'must_not_happen', description: 'Should not offer to book new appointment unless requested', severity: 'medium' },
        { type: 'must_happen', description: 'Must confirm cancellation before ending call', severity: 'high' },
        { type: 'max_turns', description: 'Complete cancellation quickly', severity: 'medium', maxTurns: 15 },
      );
    } else if (isConfirmation) {
      constraints.push(
        { type: 'must_happen', description: 'Must read back appointment details', severity: 'high' },
        { type: 'max_turns', description: 'Complete confirmation quickly', severity: 'medium', maxTurns: 12 },
      );
    } else if (isReschedule) {
      constraints.push(
        { type: 'must_happen', description: 'Must confirm new appointment details', severity: 'high' },
        { type: 'max_turns', description: 'Complete reschedule within reasonable turns', severity: 'medium', maxTurns: 20 },
      );
    } else if (category === 'happy-path') {
      constraints.push(
        { type: 'max_turns', description: 'Complete within reasonable turns', severity: 'medium', maxTurns: 25 },
      );
    } else if (category === 'edge-case' || category === 'error-handling') {
      constraints.push(
        { type: 'must_happen', description: 'Offer alternative path or escalation', severity: 'high' },
        { type: 'max_turns', description: 'Handle situation within reasonable turns', severity: 'medium', maxTurns: 15 },
      );
    }

    // Generate initial message based on intent
    let initialMessage = 'Hi, I need help with something';
    if (isCancellation) {
      initialMessage = 'Hi I need to cancel my child\'s upcoming appointment';
    } else if (isConfirmation) {
      initialMessage = 'Hi I\'m calling to confirm my child\'s appointment';
    } else if (isReschedule) {
      initialMessage = 'Hi I need to reschedule my child\'s orthodontic appointment';
    } else if (category === 'happy-path') {
      initialMessage = childCount > 1
        ? 'Hi I need to schedule appointments for my kids'
        : 'Hi I need to schedule an orthodontic appointment for my child';
    }

    const wizardData: WizardFormData = {
      basicInfo: {
        name: testName,
        description: request.description.slice(0, 500),
        category,
        tags,
        initialMessage,
      },
      persona: {
        name: 'Dynamic Test Persona',
        description: `Auto-generated persona for: ${testName}`,
        inventory: {
          parentFirstName: dynamicField('firstName'),
          parentLastName: dynamicField('lastName'),
          parentPhone: dynamicField('phone'),
          parentEmail: dynamicField('email'),
          children,
          hasInsurance,
          insuranceProvider,
          preferredTimeOfDay: 'any',
          previousVisitToOffice: lowerDesc.includes('existing') || lowerDesc.includes('returning'),
          previousOrthoTreatment: lowerDesc.includes('existing') || lowerDesc.includes('previous'),
        },
        traits: {
          verbosity: 'normal',
          providesExtraInfo: true,
          patienceLevel: 'patient',
          techSavviness: 'moderate',
        },
      },
      goals,
      constraints,
      responseConfig: {
        maxTurns: isCancellation ? 15 : isConfirmation ? 12 : isReschedule ? 20 : category === 'happy-path' ? 25 : 15,
        useLlmResponses: true,
        handleUnknownIntents: 'clarify',
      },
    };

    return {
      success: true,
      analysis: {
        detectedIntent,
        cloud9Operations,
        requiredDataFields: requiredFields,
        suggestedCategory: category,
        confidence: 0.85,
      },
      wizardData,
      reasoning: `[Demo Mode] Generated ${goals.length} goals and ${constraints.length} constraints for a ${category} test. Detected ${cloud9Operations.length} Cloud9 operations and ${requiredFields.length} required data fields. In production with an API key, this would use AI for more accurate analysis.`,
      metadata: {
        model: 'demo-mode',
        processingTimeMs: Date.now() - startTime,
      },
    };
  }
}

// Singleton instance
export const goalAnalysisService = new GoalAnalysisService();
