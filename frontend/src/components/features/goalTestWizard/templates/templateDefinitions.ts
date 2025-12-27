/**
 * Goal Test Template Definitions
 * Pre-built templates for common test scenarios
 */

import type { GoalTestTemplate } from '../../../../types/goalTestWizard.types';

export const GOAL_TEST_TEMPLATES: GoalTestTemplate[] = [
  // Happy Path Templates
  {
    id: 'new-patient-single-child',
    name: 'New Patient - Single Child',
    description: 'Standard flow for scheduling a new patient with one child',
    category: 'happy-path',
    icon: 'calendar',
    tags: ['booking', 'new-patient', 'single-child'],
    defaults: {
      persona: {
        name: 'Standard Parent',
        description: 'Typical new patient parent with one child',
        inventory: {
          parentFirstName: 'Sarah',
          parentLastName: 'Miller',
          parentPhone: '2155551234',
          children: [
            {
              firstName: 'Emma',
              lastName: 'Miller',
              dateOfBirth: '2015-06-15',
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
      goals: [
        {
          id: 'goal-data-collection',
          type: 'data_collection',
          description: 'Collect parent and child information',
          requiredFields: ['parent_name', 'parent_phone', 'child_names', 'child_dob', 'is_new_patient'],
          priority: 1,
          required: true,
        },
        {
          id: 'goal-booking',
          type: 'booking_confirmed',
          description: 'Complete appointment booking',
          priority: 2,
          required: true,
        },
      ],
      constraints: [
        {
          type: 'max_turns',
          description: 'Complete within 20 turns',
          severity: 'medium',
          maxTurns: 20,
        },
        {
          type: 'must_not_happen',
          description: 'No error messages displayed',
          severity: 'high',
        },
      ],
      responseConfig: {
        maxTurns: 25,
        useLlmResponses: true,
        handleUnknownIntents: 'clarify',
      },
      initialMessage: "Hi, I'd like to schedule an appointment for my daughter.",
    },
  },
  {
    id: 'new-patient-multiple-children',
    name: 'New Patient - Multiple Children',
    description: 'Booking flow for a parent with 2-3 children needing appointments',
    category: 'happy-path',
    icon: 'users',
    tags: ['booking', 'new-patient', 'multiple-children'],
    defaults: {
      persona: {
        name: 'Multi-Child Parent',
        description: 'Parent scheduling for multiple children',
        inventory: {
          parentFirstName: 'Michael',
          parentLastName: 'Davis',
          parentPhone: '2155555678',
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
          hasInsurance: true,
          insuranceProvider: 'Blue Cross Blue Shield',
          preferredTimeOfDay: 'afternoon',
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
        {
          id: 'goal-data-collection',
          type: 'data_collection',
          description: 'Collect parent and all children information',
          requiredFields: ['parent_name', 'parent_phone', 'child_count', 'child_names', 'child_dob'],
          priority: 1,
          required: true,
        },
        {
          id: 'goal-booking',
          type: 'booking_confirmed',
          description: 'Complete appointment booking for all children',
          priority: 2,
          required: true,
        },
      ],
      constraints: [
        {
          type: 'max_turns',
          description: 'Complete within 30 turns',
          severity: 'medium',
          maxTurns: 30,
        },
      ],
      responseConfig: {
        maxTurns: 35,
        useLlmResponses: true,
        handleUnknownIntents: 'clarify',
      },
      initialMessage: "Hello, I need to schedule appointments for my two kids.",
    },
  },

  // Edge Case Templates
  {
    id: 'out-of-network-insurance',
    name: 'Out-of-Network Insurance',
    description: 'Handle user with insurance not in network',
    category: 'edge-case',
    icon: 'shield',
    tags: ['insurance', 'out-of-network', 'edge-case'],
    defaults: {
      persona: {
        name: 'Out-of-Network Parent',
        description: 'Parent with insurance not accepted',
        inventory: {
          parentFirstName: 'Jennifer',
          parentLastName: 'Wong',
          parentPhone: '2155559876',
          children: [
            {
              firstName: 'Tyler',
              lastName: 'Wong',
              dateOfBirth: '2013-03-20',
              isNewPatient: true,
            },
          ],
          hasInsurance: true,
          insuranceProvider: 'Random Small Insurance Co',
          preferredTimeOfDay: 'any',
          previousVisitToOffice: false,
          previousOrthoTreatment: false,
        },
        traits: {
          verbosity: 'normal',
          providesExtraInfo: true,
          patienceLevel: 'moderate',
          techSavviness: 'moderate',
        },
      },
      goals: [
        {
          id: 'goal-data-collection',
          type: 'data_collection',
          description: 'Collect all required information',
          requiredFields: ['parent_name', 'parent_phone', 'child_names', 'insurance'],
          priority: 1,
          required: true,
        },
        {
          id: 'goal-booking',
          type: 'booking_confirmed',
          description: 'Complete booking despite insurance issue',
          priority: 2,
          required: true,
        },
      ],
      constraints: [
        {
          type: 'must_happen',
          description: 'Agent must inform about insurance not being in network',
          severity: 'high',
        },
        {
          type: 'must_not_happen',
          description: 'Agent should not refuse to book',
          severity: 'critical',
        },
      ],
      responseConfig: {
        maxTurns: 25,
        useLlmResponses: true,
        handleUnknownIntents: 'clarify',
      },
      initialMessage: "I want to schedule an appointment. I have Random Small Insurance Co.",
    },
  },
  {
    id: 'existing-patient-transfer',
    name: 'Existing Patient Transfer',
    description: 'Existing patient should be transferred to live agent',
    category: 'edge-case',
    icon: 'phone',
    tags: ['transfer', 'existing-patient', 'edge-case'],
    defaults: {
      persona: {
        name: 'Returning Patient',
        description: 'Existing patient who should be transferred',
        inventory: {
          parentFirstName: 'Robert',
          parentLastName: 'Chen',
          parentPhone: '2155559012',
          children: [
            {
              firstName: 'Sophia',
              lastName: 'Chen',
              dateOfBirth: '2013-09-05',
              isNewPatient: false,
            },
          ],
          hasInsurance: true,
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
      goals: [
        {
          id: 'goal-data-collection',
          type: 'data_collection',
          description: 'Identify existing patient status',
          requiredFields: ['parent_name', 'is_new_patient', 'previous_visit'],
          priority: 1,
          required: true,
        },
        {
          id: 'goal-transfer',
          type: 'transfer_initiated',
          description: 'Transfer to live agent for existing patient handling',
          priority: 2,
          required: true,
        },
      ],
      constraints: [
        {
          type: 'max_turns',
          description: 'Transfer should happen within 10 turns',
          severity: 'high',
          maxTurns: 10,
        },
        {
          type: 'must_not_happen',
          description: 'Should not try to book as new patient',
          severity: 'critical',
        },
      ],
      responseConfig: {
        maxTurns: 15,
        useLlmResponses: true,
        handleUnknownIntents: 'clarify',
      },
      initialMessage: "Hi, we've been patients here before and need to schedule a follow-up.",
    },
  },

  // Error Handling Templates
  {
    id: 'api-error-recovery',
    name: 'API Error Recovery',
    description: 'Test graceful handling of API errors',
    category: 'error-handling',
    icon: 'alert',
    tags: ['error', 'api', 'recovery'],
    defaults: {
      persona: {
        name: 'Standard User',
        description: 'Normal user encountering system errors',
        inventory: {
          parentFirstName: 'Test',
          parentLastName: 'User',
          parentPhone: '2155550000',
          children: [
            {
              firstName: 'Child',
              lastName: 'User',
              dateOfBirth: '2014-01-01',
              isNewPatient: true,
            },
          ],
          hasInsurance: false,
          previousVisitToOffice: false,
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
          id: 'goal-error-handled',
          type: 'error_handled',
          description: 'System should handle errors gracefully',
          priority: 1,
          required: true,
        },
        {
          id: 'goal-conversation-ended',
          type: 'conversation_ended',
          description: 'Conversation ends properly with helpful message',
          priority: 2,
          required: true,
        },
      ],
      constraints: [
        {
          type: 'must_not_happen',
          description: 'No internal error messages or stack traces shown',
          severity: 'critical',
        },
        {
          type: 'must_happen',
          description: 'User receives helpful error message',
          severity: 'high',
        },
      ],
      responseConfig: {
        maxTurns: 15,
        useLlmResponses: true,
        handleUnknownIntents: 'generic',
      },
      initialMessage: "I'd like to schedule an appointment.",
    },
  },
  {
    id: 'invalid-input-handling',
    name: 'Invalid Input Handling',
    description: 'Test handling of invalid or malformed user input',
    category: 'error-handling',
    icon: 'x-circle',
    tags: ['error', 'validation', 'input'],
    defaults: {
      persona: {
        name: 'Confused User',
        description: 'User providing invalid or unclear information',
        inventory: {
          parentFirstName: 'Confused',
          parentLastName: 'User',
          parentPhone: 'not-a-phone',
          children: [
            {
              firstName: 'Kid',
              lastName: 'User',
              dateOfBirth: 'invalid-date',
              isNewPatient: true,
            },
          ],
          hasInsurance: false,
        },
        traits: {
          verbosity: 'terse',
          providesExtraInfo: false,
          patienceLevel: 'impatient',
          techSavviness: 'low',
        },
      },
      goals: [
        {
          id: 'goal-clarification',
          type: 'data_collection',
          description: 'Agent should ask for clarification on invalid data',
          requiredFields: ['parent_phone', 'child_dob'],
          priority: 1,
          required: true,
        },
      ],
      constraints: [
        {
          type: 'must_happen',
          description: 'Agent asks for valid phone format',
          severity: 'high',
        },
        {
          type: 'must_not_happen',
          description: 'Agent should not accept invalid data',
          severity: 'critical',
        },
      ],
      responseConfig: {
        maxTurns: 20,
        useLlmResponses: true,
        handleUnknownIntents: 'clarify',
      },
      initialMessage: "I want an appointment. My phone is not-a-phone.",
    },
  },
];

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): GoalTestTemplate[] {
  return GOAL_TEST_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): GoalTestTemplate | undefined {
  return GOAL_TEST_TEMPLATES.find((t) => t.id === id);
}

/**
 * Search templates by name or tags
 */
export function searchTemplates(query: string): GoalTestTemplate[] {
  const lowerQuery = query.toLowerCase();
  return GOAL_TEST_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}
