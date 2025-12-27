/**
 * Goal Suggestion Service
 * Uses Claude API or CLI to generate AI-powered goal and constraint suggestions for test cases
 */

import { getLLMProvider, LLMProvider } from '../../../shared/services/llm-provider';
import { isClaudeCliEnabled } from '../../../shared/config/llm-config';

// ============================================================================
// TYPES
// ============================================================================

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
export type TestCategory = 'happy-path' | 'edge-case' | 'error-handling';

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

export interface PersonaTraits {
  verbosity?: 'terse' | 'normal' | 'verbose';
  providesExtraInfo?: boolean;
  patienceLevel?: 'patient' | 'moderate' | 'impatient';
  techSavviness?: 'low' | 'moderate' | 'high';
}

export interface SuggestionRequest {
  name: string;
  category: TestCategory;
  description?: string;
  personaTraits?: Partial<PersonaTraits>;
  tags?: string[];
  model?: 'fast' | 'standard' | 'detailed';
  /**
   * Original goal description from Step 0 AI Analyzer.
   * This is the PRIMARY context that should guide all suggestion generation.
   * When present, suggestions MUST align with this original intent.
   */
  originalGoalDescription?: string;
}

export interface SuggestionItem<T> {
  data: T;
  explanation: string;
  confidence: number;
}

export interface SuggestionResponse {
  success: boolean;
  suggestions: {
    goals: SuggestionItem<ConversationGoal>[];
    constraints: SuggestionItem<TestConstraint>[];
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

// ============================================================================
// MODEL CONFIGURATION
// ============================================================================

const MODEL_CONFIG = {
  fast: {
    model: 'claude-opus-4-5-20251101',
    maxTokens: 2048,
    temperature: 0.3,
  },
  standard: {
    model: 'claude-opus-4-5-20251101',
    maxTokens: 4096,
    temperature: 0.3,
  },
  detailed: {
    model: 'claude-opus-4-5-20251101',
    maxTokens: 4096,
    temperature: 0.2,
  },
};

// ============================================================================
// SERVICE
// ============================================================================

export class GoalSuggestionService {
  private llmProvider: LLMProvider;

  constructor() {
    this.llmProvider = getLLMProvider();
    this.logInitialization();
  }

  private async logInitialization(): Promise<void> {
    const mode = isClaudeCliEnabled() ? 'CLI' : 'API';
    const status = await this.llmProvider.checkAvailability();
    if (status.available) {
      console.log(`[GoalSuggestionService] Initialized with ${mode} mode (provider: ${status.provider})`);
    } else {
      console.log(`[GoalSuggestionService] ${mode} mode not available: ${status.error}`);
      console.log('[GoalSuggestionService] AI suggestions will use demo mode');
    }
  }

  /**
   * Check if the service is available
   * Returns true even in demo mode (no API key) to allow demo suggestions
   */
  isAvailable(): boolean {
    // Always available - either with real API or demo mode
    return true;
  }

  /**
   * Check if using real API vs demo mode
   */
  isUsingRealAPI(): boolean {
    return this.llmProvider.isAvailable();
  }

  /**
   * Generate goal and constraint suggestions for a test case
   */
  async generateSuggestions(request: SuggestionRequest): Promise<SuggestionResponse> {
    const startTime = Date.now();

    // Check if LLM is available
    const status = await this.llmProvider.checkAvailability();
    if (!status.available) {
      console.log('[GoalSuggestionService] Using demo mode (LLM not available)');
      // Simulate slight delay for realistic UX
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        success: true,
        suggestions: this.generateDemoSuggestions(request),
        metadata: {
          model: 'demo-mode',
          processingTimeMs: Date.now() - startTime,
        },
      };
    }

    const modelType = request.model || 'standard';
    const modelConfig = MODEL_CONFIG[modelType];
    const prompt = this.buildPrompt(request);

    try {
      const response = await this.llmProvider.execute({
        prompt,
        model: modelConfig.model,
        maxTokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        timeout: 60000, // 1 minute timeout
      });

      if (!response.success) {
        console.error('[GoalSuggestionService] LLM call failed:', response.error);
        return {
          success: true,
          suggestions: this.generateDemoSuggestions(request),
          metadata: {
            model: 'demo-mode-fallback',
            processingTimeMs: Date.now() - startTime,
          },
        };
      }

      const responseText = response.content || '';
      const parsed = this.parseResponse(responseText, request);

      return {
        success: true,
        suggestions: parsed,
        metadata: {
          model: modelConfig.model,
          processingTimeMs: Date.now() - startTime,
          tokensUsed: response.usage ? response.usage.inputTokens + response.usage.outputTokens : undefined,
        },
      };
    } catch (error: any) {
      console.error('[GoalSuggestionService] Error generating suggestions:', error);
      return {
        success: false,
        suggestions: null,
        metadata: {
          model: modelConfig.model,
          processingTimeMs: Date.now() - startTime,
        },
        error: error.message || 'Failed to generate suggestions',
      };
    }
  }

  private buildPrompt(request: SuggestionRequest): string {
    const categoryDescription = {
      'happy-path': 'a successful, typical user journey where everything works as expected',
      'edge-case': 'an unusual but valid scenario that tests boundary conditions',
      'error-handling': 'a scenario where things go wrong and the bot must handle errors gracefully',
    };

    const personaContext = request.personaTraits
      ? `
User Persona Traits:
- Verbosity: ${request.personaTraits.verbosity || 'normal'}
- Provides extra info: ${request.personaTraits.providesExtraInfo ? 'yes' : 'no'}
- Patience level: ${request.personaTraits.patienceLevel || 'moderate'}
- Tech savviness: ${request.personaTraits.techSavviness || 'moderate'}`
      : '';

    const tagsContext = request.tags?.length
      ? `\nTags/Focus Areas: ${request.tags.join(', ')}`
      : '';

    // Build the primary goal context - this is the most important context
    const originalGoalContext = request.originalGoalDescription
      ? `
## CRITICAL: ORIGINAL USER GOAL (HIGHEST PRIORITY)

The user originally described their test goal as:
"${request.originalGoalDescription}"

**YOU MUST generate goals and constraints that align with this original intent.**
- If the user said "cancel appointment", generate goals for CANCELLATION, not booking
- If the user said "confirm appointment", generate goals for CONFIRMATION
- If the user said "reschedule", generate goals for RESCHEDULING
- If the user said "existing patient", generate goals for EXISTING patient scenarios
- Always match the specific action/scenario described in the original goal

DO NOT default to generic "booking" goals unless the original goal explicitly mentions booking/scheduling new appointments.
`
      : '';

    return `You are an expert at designing test cases for an orthodontic appointment scheduling chatbot called "Allie IVA".

The chatbot helps parents schedule orthodontic appointments for their children. It collects information like parent name, phone, child details, and insurance information before helping them find and book an appointment. The chatbot can also help with appointment cancellations, confirmations, rescheduling, and other appointment management tasks.
${originalGoalContext}
## YOUR TASK

Generate appropriate conversation GOALS and CONSTRAINTS for a goal-oriented test case.
${request.originalGoalDescription ? '\n**REMINDER: All suggestions MUST align with the ORIGINAL USER GOAL above.**\n' : ''}
## TEST CASE CONTEXT

**Name:** ${request.name}
**Category:** ${request.category} - ${categoryDescription[request.category]}
${request.description ? `**Description:** ${request.description}` : ''}
${personaContext}
${tagsContext}

## AVAILABLE GOAL TYPES

1. **data_collection** - Bot should collect specific data fields from the user
   - Available fields: parent_name, parent_name_spelling, parent_phone, parent_email, child_count, child_names, child_dob, child_age, is_new_patient, previous_visit, previous_ortho, insurance, special_needs, time_preference, location_preference

2. **booking_confirmed** - Bot successfully books an appointment

3. **transfer_initiated** - Bot transfers user to a live agent

4. **conversation_ended** - Bot properly ends the conversation

5. **error_handled** - Bot handles an error gracefully

6. **custom** - Custom goal with free-form description

## AVAILABLE CONSTRAINT TYPES

1. **must_happen** - Something MUST occur during the conversation
2. **must_not_happen** - Something must NOT occur
3. **max_turns** - Limit the number of conversation turns
4. **max_time** - Limit total conversation time

## RESPONSE FORMAT

Respond with a JSON object in this exact format:
\`\`\`json
{
  "goals": [
    {
      "data": {
        "id": "goal-1",
        "type": "data_collection|booking_confirmed|transfer_initiated|conversation_ended|error_handled|custom",
        "description": "Clear description of the goal",
        "requiredFields": ["field1", "field2"],
        "priority": 1,
        "required": true
      },
      "explanation": "Why this goal is relevant for this test case",
      "confidence": 0.95
    }
  ],
  "constraints": [
    {
      "data": {
        "type": "must_happen|must_not_happen|max_turns|max_time",
        "description": "What must/must not happen",
        "severity": "low|medium|high|critical",
        "maxTurns": 15,
        "maxTimeMs": 60000
      },
      "explanation": "Why this constraint matters",
      "confidence": 0.9
    }
  ],
  "initialMessage": {
    "message": "A natural opening message the test user would say",
    "explanation": "Why this is a good starting message"
  },
  "reasoning": "Overall explanation of why these goals and constraints are appropriate for this test case"
}
\`\`\`

## GUIDELINES

1. For **happy-path** tests:
   - Focus on complete data collection and successful booking
   - Include 3-5 goals covering the full journey
   - Constraints should ensure smooth conversation flow

2. For **edge-case** tests:
   - Focus on specific scenarios (multiple children, out-of-network insurance, etc.)
   - Include 2-4 targeted goals
   - Constraints should verify proper handling of edge conditions

3. For **error-handling** tests:
   - Focus on error recovery and graceful degradation
   - Include goals for error detection and recovery
   - Constraints should prevent infinite loops and ensure proper escalation

4. Always include:
   - At least one primary goal (priority 1, required)
   - At least one constraint
   - An appropriate initial message

Generate suggestions now based on the test case context above.`;
  }

  private parseResponse(responseText: string, request: SuggestionRequest): SuggestionResponse['suggestions'] {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                        responseText.match(/\{[\s\S]*"goals"[\s\S]*\}/);

      if (!jsonMatch) {
        console.error('[GoalSuggestionService] Could not find JSON in response');
        return this.generateFallbackSuggestions(request);
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      // Validate and normalize
      return {
        goals: (parsed.goals || []).map((g: any, index: number) => ({
          data: {
            id: g.data?.id || `goal-${index + 1}`,
            type: g.data?.type || 'custom',
            description: g.data?.description || 'Goal',
            requiredFields: g.data?.requiredFields,
            priority: g.data?.priority ?? (index + 1),
            required: g.data?.required ?? true,
          },
          explanation: g.explanation || '',
          confidence: g.confidence ?? 0.8,
        })),
        constraints: (parsed.constraints || []).map((c: any) => ({
          data: {
            type: c.data?.type || 'must_happen',
            description: c.data?.description || 'Constraint',
            severity: c.data?.severity || 'medium',
            maxTurns: c.data?.maxTurns,
            maxTimeMs: c.data?.maxTimeMs,
          },
          explanation: c.explanation || '',
          confidence: c.confidence ?? 0.8,
        })),
        initialMessage: parsed.initialMessage ? {
          message: parsed.initialMessage.message,
          explanation: parsed.initialMessage.explanation,
        } : undefined,
        reasoning: parsed.reasoning || 'AI-generated suggestions based on test case context.',
      };
    } catch (error) {
      console.error('[GoalSuggestionService] Error parsing response:', error);
      return this.generateFallbackSuggestions(request);
    }
  }

  private generateFallbackSuggestions(request: SuggestionRequest): SuggestionResponse['suggestions'] {
    const goals: SuggestionItem<ConversationGoal>[] = [];
    const constraints: SuggestionItem<TestConstraint>[] = [];

    // Generate category-appropriate fallback suggestions
    if (request.category === 'happy-path') {
      goals.push({
        data: {
          id: 'goal-data-collection',
          type: 'data_collection',
          description: 'Collect all required parent and child information',
          requiredFields: ['parent_name', 'parent_phone', 'child_names', 'child_dob'],
          priority: 1,
          required: true,
        },
        explanation: 'Standard data collection for new patient booking',
        confidence: 0.7,
      });
      goals.push({
        data: {
          id: 'goal-booking',
          type: 'booking_confirmed',
          description: 'Successfully complete appointment booking',
          priority: 2,
          required: true,
        },
        explanation: 'Primary success metric for happy-path test',
        confidence: 0.7,
      });
    } else if (request.category === 'edge-case') {
      goals.push({
        data: {
          id: 'goal-edge-handling',
          type: 'custom',
          description: 'Handle edge case scenario appropriately',
          priority: 1,
          required: true,
        },
        explanation: 'Verify proper handling of edge case',
        confidence: 0.6,
      });
    } else {
      goals.push({
        data: {
          id: 'goal-error-recovery',
          type: 'error_handled',
          description: 'Gracefully handle and recover from error',
          priority: 1,
          required: true,
        },
        explanation: 'Ensure errors are handled gracefully',
        confidence: 0.7,
      });
    }

    constraints.push({
      data: {
        type: 'max_turns',
        description: 'Complete within reasonable number of turns',
        severity: 'medium',
        maxTurns: request.category === 'happy-path' ? 20 : 15,
      },
      explanation: 'Prevent excessively long conversations',
      confidence: 0.8,
    });

    return {
      goals,
      constraints,
      initialMessage: {
        message: 'Hi, I would like to schedule an appointment for my child.',
        explanation: 'Simple, natural opening message',
      },
      reasoning: 'Fallback suggestions generated due to AI parsing error.',
    };
  }

  /**
   * Generate demo suggestions for testing when no API key is available
   */
  private generateDemoSuggestions(request: SuggestionRequest): SuggestionResponse['suggestions'] {
    const goals: SuggestionItem<ConversationGoal>[] = [];
    const constraints: SuggestionItem<TestConstraint>[] = [];

    // Parse the original goal description to determine the intent
    const originalGoal = (request.originalGoalDescription || request.name || '').toLowerCase();

    // Detect specific intents from the original goal
    const isCancellation = originalGoal.includes('cancel');
    const isConfirmation = originalGoal.includes('confirm');
    const isReschedule = originalGoal.includes('reschedule') || originalGoal.includes('change');
    const isExistingPatient = originalGoal.includes('existing') || originalGoal.includes('returning');
    const isNewPatient = originalGoal.includes('new patient') || originalGoal.includes('first time');
    const isBooking = !isCancellation && !isConfirmation && !isReschedule &&
                       (originalGoal.includes('book') || originalGoal.includes('schedule') || originalGoal.includes('appointment'));

    // Generate intent-specific goals based on original goal description
    if (isCancellation) {
      // Cancellation-specific goals
      goals.push(
        {
          data: {
            id: 'goal-identify-appointment',
            type: 'data_collection',
            description: 'Collect information to identify the appointment to cancel',
            requiredFields: ['parent_name', 'parent_phone'],
            priority: 1,
            required: true,
          },
          explanation: 'Need to identify which appointment the caller wants to cancel.',
          confidence: 0.95,
        },
        {
          data: {
            id: 'goal-cancellation-confirmed',
            type: 'custom',
            description: 'Successfully cancel the requested appointment',
            priority: 2,
            required: true,
          },
          explanation: 'The primary success metric for a cancellation test.',
          confidence: 0.98,
        },
        {
          data: {
            id: 'goal-confirmation-message',
            type: 'custom',
            description: 'Provide cancellation confirmation details to the caller',
            priority: 3,
            required: true,
          },
          explanation: 'Caller should receive clear confirmation that the appointment was cancelled.',
          confidence: 0.90,
        }
      );

      constraints.push(
        {
          data: {
            type: 'must_not_happen',
            description: 'Bot should not offer to book a new appointment unless caller requests it',
            severity: 'medium',
          },
          explanation: 'Focus on the cancellation task; don\'t push unwanted services.',
          confidence: 0.88,
        }
      );
    } else if (isConfirmation) {
      // Confirmation-specific goals
      goals.push(
        {
          data: {
            id: 'goal-identify-appointment',
            type: 'data_collection',
            description: 'Collect information to identify the appointment to confirm',
            requiredFields: ['parent_name', 'parent_phone'],
            priority: 1,
            required: true,
          },
          explanation: 'Need to identify which appointment the caller wants to confirm.',
          confidence: 0.95,
        },
        {
          data: {
            id: 'goal-confirmation-completed',
            type: 'custom',
            description: 'Successfully confirm the requested appointment',
            priority: 2,
            required: true,
          },
          explanation: 'The primary success metric for a confirmation test.',
          confidence: 0.98,
        }
      );
    } else if (isReschedule) {
      // Reschedule-specific goals
      goals.push(
        {
          data: {
            id: 'goal-identify-appointment',
            type: 'data_collection',
            description: 'Collect information to identify the appointment to reschedule',
            requiredFields: ['parent_name', 'parent_phone'],
            priority: 1,
            required: true,
          },
          explanation: 'Need to identify which appointment the caller wants to reschedule.',
          confidence: 0.95,
        },
        {
          data: {
            id: 'goal-new-time-preference',
            type: 'data_collection',
            description: 'Collect preferred date/time for rescheduled appointment',
            requiredFields: ['time_preference'],
            priority: 2,
            required: true,
          },
          explanation: 'Need to know when the caller would like the new appointment.',
          confidence: 0.92,
        },
        {
          data: {
            id: 'goal-reschedule-confirmed',
            type: 'booking_confirmed',
            description: 'Successfully reschedule the appointment to new time',
            priority: 3,
            required: true,
          },
          explanation: 'The primary success metric for a reschedule test.',
          confidence: 0.98,
        }
      );
    } else if (request.category === 'happy-path' || isBooking || isNewPatient) {
      // Default booking/new patient goals
      goals.push(
        {
          data: {
            id: 'goal-parent-info',
            type: 'data_collection',
            description: 'Collect parent contact information',
            requiredFields: ['parent_name', 'parent_phone', 'parent_email'],
            priority: 1,
            required: true,
          },
          explanation: 'Parent contact details are essential for appointment confirmation and follow-up communication.',
          confidence: 0.95,
        },
        {
          data: {
            id: 'goal-child-info',
            type: 'data_collection',
            description: 'Collect child patient information',
            requiredFields: ['child_names', 'child_dob', 'is_new_patient'],
            priority: 2,
            required: true,
          },
          explanation: 'Child details are needed for proper patient record creation and appointment scheduling.',
          confidence: 0.92,
        },
        {
          data: {
            id: 'goal-booking',
            type: 'booking_confirmed',
            description: 'Successfully complete the appointment booking',
            priority: 3,
            required: true,
          },
          explanation: 'The primary success metric - user should have a confirmed appointment at the end.',
          confidence: 0.98,
        }
      );

      constraints.push(
        {
          data: {
            type: 'must_not_happen',
            description: 'Bot should not expose internal system errors or technical messages',
            severity: 'high',
          },
          explanation: 'Maintains professional user experience and prevents confusion.',
          confidence: 0.95,
        }
      );
    } else if (request.category === 'edge-case' || isExistingPatient) {
      goals.push(
        {
          data: {
            id: 'goal-edge-handling',
            type: 'custom',
            description: isExistingPatient
              ? 'Detect and handle existing patient appropriately'
              : 'Handle the edge case scenario appropriately',
            priority: 1,
            required: true,
          },
          explanation: 'Verify the bot correctly identifies and handles the unusual scenario.',
          confidence: 0.85,
        },
        {
          data: {
            id: 'goal-graceful-recovery',
            type: 'custom',
            description: 'Provide helpful guidance when edge case is detected',
            priority: 2,
            required: true,
          },
          explanation: 'Even when normal flow cannot continue, user should receive helpful direction.',
          confidence: 0.82,
        }
      );

      constraints.push(
        {
          data: {
            type: 'must_happen',
            description: 'Bot must acknowledge the edge case condition',
            severity: 'high',
          },
          explanation: 'The bot should demonstrate awareness of the unusual situation.',
          confidence: 0.90,
        }
      );
    } else {
      // error-handling
      goals.push(
        {
          data: {
            id: 'goal-error-detection',
            type: 'error_handled',
            description: 'Bot detects and acknowledges the error condition',
            priority: 1,
            required: true,
          },
          explanation: 'First step in error recovery is proper detection and acknowledgment.',
          confidence: 0.92,
        },
        {
          data: {
            id: 'goal-error-recovery',
            type: 'custom',
            description: 'Bot provides alternative path or escalation option',
            priority: 2,
            required: true,
          },
          explanation: 'Users should not be left stranded when errors occur.',
          confidence: 0.88,
        }
      );

      constraints.push(
        {
          data: {
            type: 'must_not_happen',
            description: 'Bot must not enter infinite retry loop',
            severity: 'critical',
          },
          explanation: 'Prevents user frustration and system resource waste.',
          confidence: 0.95,
        },
        {
          data: {
            type: 'must_happen',
            description: 'Bot must offer human escalation option',
            severity: 'high',
          },
          explanation: 'User should always have a path to human assistance when automated flow fails.',
          confidence: 0.90,
        }
      );
    }

    // Add common max_turns constraint if not already added
    if (!constraints.some(c => c.data.type === 'max_turns')) {
      constraints.push({
        data: {
          type: 'max_turns',
          description: 'Complete task within reasonable conversation length',
          severity: 'medium',
          maxTurns: request.category === 'happy-path' ? 25 : 15,
        },
        explanation: 'Ensures efficient conversation flow without excessive back-and-forth.',
        confidence: 0.88,
      });
    }

    // Generate appropriate initial message based on detected intent
    let initialMessage: string;
    if (isCancellation) {
      initialMessage = "Hi, I need to cancel an upcoming appointment.";
    } else if (isConfirmation) {
      initialMessage = "Hi, I'm calling to confirm my child's appointment.";
    } else if (isReschedule) {
      initialMessage = "Hi, I need to reschedule my child's appointment.";
    } else if (isExistingPatient) {
      initialMessage = "Hi, I'm an existing patient and need to schedule a follow-up.";
    } else if (request.category === 'error-handling') {
      initialMessage = "Hi there, I was trying to do something but ran into an issue.";
    } else if (request.category === 'edge-case') {
      initialMessage = "Hello, I have a somewhat unusual situation I need help with.";
    } else {
      initialMessage = "Hi, I'd like to schedule an orthodontist appointment for my child please.";
    }

    // Build the reasoning message
    const intentDescription = isCancellation ? 'cancellation' :
                              isConfirmation ? 'confirmation' :
                              isReschedule ? 'rescheduling' :
                              isExistingPatient ? 'existing patient' :
                              'booking';

    return {
      goals,
      constraints,
      initialMessage: {
        message: initialMessage,
        explanation: `Appropriate opening for a ${intentDescription} test scenario that sets the right context.`,
      },
      reasoning: `[Demo Mode] Generated ${goals.length} goals and ${constraints.length} constraints for a ${intentDescription} test case${request.originalGoalDescription ? ` based on original goal: "${request.originalGoalDescription}"` : ''}. In production with an API key, these would be AI-generated based on the specific test context.`,
    };
  }
}

// Singleton instance
export const goalSuggestionService = new GoalSuggestionService();
