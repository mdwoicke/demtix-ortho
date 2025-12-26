/**
 * Edge Case Test Scenarios
 * Tests for unusual but valid scenarios
 * Updated to match actual Allie IVA conversation flow order
 *
 * Enhanced with semantic expectations for AI-powered evaluation.
 */

import {
  TestCase,
  patterns,
  semanticExpectations as se,
  negativeExpectations as ne,
} from '../test-case';

// Allie IVA specific patterns - matched to actual bot responses
// Bot may respond dynamically based on context - patterns are flexible
const alliePatterns = {
  // Greeting/initial response - accepts ANY relevant engagement with scheduling request
  greeting: /allie|help|how may i|may i have|name|first and last|that's great|new patient|orthodontic|consult|appointment|child|schedule|absolutely|certainly|of course/i,
  askSpelling: /spell|spelling|confirm.*name|correct/i,
  // Bot may ask about children count OR acknowledge if already mentioned
  askChildren: /how many children|scheduling for|one child|two child|three child|confirm/i,
  // Bot may ask about new patient OR acknowledge it was already stated
  askNewPatientConsult: /new patient|consult|first time|never been|orthodontic/i,
  // Bot may ask about previous visits OR skip to next question
  askPreviousVisit: /been to.*office|visited.*before|any of our offices|first time|never been|this office/i,
  askPreviousOrtho: /orthodontic treatment|had braces|ortho.*before|previous.*treatment/i,
  askChildName: /child.*name|name.*child|first.*last name|patient.*name/i,
  transferAgent: /connect.*agent|transfer|live agent|specialist/i,
  existingPatient: /not.*new patient|existing|been.*before|specialist|connect you/i,
};

export const edgeCaseScenarios: TestCase[] = [
  {
    id: 'EDGE-001',
    name: 'Existing Patient - Transfer to Specialist',
    description: 'Existing patient should be transferred to live agent (not new patient consult)',
    category: 'edge-case',
    tags: ['existing-patient', 'transfer'],

    dataRequirements: [],

    steps: [
      {
        id: 'step-1-greeting',
        userMessage: 'Hi I need to schedule an appointment for my child',
        expectedPatterns: [alliePatterns.greeting],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-2-provide-info',
        userMessage: 'My name is John Smith, phone 2155551234',
        expectedPatterns: [alliePatterns.askSpelling],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-3-spell-name',
        userMessage: 'J O H N   S M I T H',
        expectedPatterns: [alliePatterns.askChildren],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-4-one-child',
        userMessage: 'One child',
        expectedPatterns: [alliePatterns.askNewPatientConsult],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-5-confirm-new',
        userMessage: 'Yes a new patient consult',
        expectedPatterns: [alliePatterns.askPreviousVisit],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-6-existing-patient',
        userMessage: 'Actually yes, my child has been to your office before',
        expectedPatterns: [alliePatterns.transferAgent, alliePatterns.existingPatient, /specialist|transfer|connect|not.*new patient/i],
        unexpectedPatterns: [],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
        validator: (response, ctx) => {
          const offersTransfer = /transfer|specialist|connect|agent/i.test(response);
          const recognizesExisting = /been.*before|not.*new patient|existing/i.test(response);

          if (!offersTransfer && !recognizesExisting) {
            return {
              passed: false,
              message: 'Did not recognize existing patient or offer transfer to specialist',
              severity: 'medium',
              recommendation: 'For existing patients, offer transfer to live agent instead of new patient consult flow',
            };
          }

          return { passed: true, message: 'Existing patient handled correctly - offered transfer' };
        },
      },
    ],

    expectations: [
      {
        type: 'custom',
        description: 'Existing patients should be transferred to specialist/live agent',
      },
    ],
  },

  {
    id: 'EDGE-002',
    name: 'Multiple Children - Three Siblings',
    description: 'Handle booking for three siblings in same call',
    category: 'edge-case',
    tags: ['siblings', 'multiple-children'],

    dataRequirements: [],

    steps: [
      {
        id: 'step-1-greeting',
        userMessage: 'I need to schedule orthodontic consults for my three children',
        // Bot may give Allie greeting OR skip to asking for name directly (for multi-child mentions)
        expectedPatterns: [/allie|help|name|may i have|first and last|that's great/i],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-2-provide-info',
        userMessage: 'My name is Mary Johnson, phone 2155559999',
        expectedPatterns: [alliePatterns.askSpelling],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-3-spell-name',
        userMessage: 'M A R Y   J O H N S O N',
        expectedPatterns: [alliePatterns.askChildren],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-4-confirm-three',
        userMessage: 'Three children',
        expectedPatterns: [alliePatterns.askNewPatientConsult],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-5-all-new',
        userMessage: 'Yes all three are new patients',
        expectedPatterns: [alliePatterns.askPreviousVisit],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-6-no-previous',
        userMessage: 'No none of them have been to your office before',
        expectedPatterns: [alliePatterns.askPreviousOrtho],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-7-no-ortho',
        userMessage: 'No none have had braces',
        expectedPatterns: [alliePatterns.askChildName, /first child|child.*name/i],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
    ],

    expectations: [
      {
        type: 'conversation-complete',
        description: 'Should handle multiple sibling booking requests',
      },
    ],
  },

  {
    id: 'EDGE-003',
    name: 'User Changes Mind Mid-Flow',
    description: 'User wants to change number of children mid-conversation',
    category: 'edge-case',
    tags: ['flow-change', 'user-correction'],

    dataRequirements: [],

    steps: [
      {
        id: 'step-1-greeting',
        userMessage: 'I need to schedule appointments for my kids',
        expectedPatterns: [alliePatterns.greeting],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-2-provide-info',
        userMessage: 'Lisa Brown, 2155557777',
        expectedPatterns: [alliePatterns.askSpelling],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-3-spell',
        userMessage: 'L I S A   B R O W N',
        expectedPatterns: [alliePatterns.askChildren],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-4-say-two',
        userMessage: 'Two children',
        expectedPatterns: [alliePatterns.askNewPatientConsult],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-5-change-to-three',
        userMessage: 'Actually wait, I have three children who need appointments, not two',
        expectedPatterns: [/three|3|ok|noted|updated|got it|understand/i],
        unexpectedPatterns: [],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
        validator: (response, ctx) => {
          const acknowledgesChange = /three|3|ok|noted|updated|got it|sure|understand/i.test(response);
          const confused = /what|don't understand|repeat/i.test(response);

          if (confused) {
            return {
              passed: false,
              message: 'Chatbot confused by mid-flow correction',
              severity: 'high',
              recommendation: 'Handle user corrections gracefully - allow changing number of children',
            };
          }

          return {
            passed: acknowledgesChange,
            message: acknowledgesChange ? 'Change acknowledged' : 'Change not explicitly acknowledged but continuing'
          };
        },
      },
    ],

    expectations: [
      {
        type: 'custom',
        description: 'Should handle mid-flow corrections gracefully',
      },
    ],
  },

  {
    id: 'EDGE-004',
    name: 'Previous Orthodontic Treatment',
    description: 'Child has had previous orthodontic treatment elsewhere',
    category: 'edge-case',
    tags: ['previous-treatment', 'ortho-history'],

    dataRequirements: [],

    steps: [
      {
        id: 'step-1-greeting',
        userMessage: 'I need a consult for my daughter',
        // Bot may give Allie greeting OR skip to asking for name directly
        expectedPatterns: [/allie|help|name|may i have|first and last|that's great/i],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-2-provide-info',
        userMessage: 'Susan Miller, 2155553333',
        expectedPatterns: [alliePatterns.askSpelling],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-3-spell',
        userMessage: 'S U S A N   M I L L E R',
        expectedPatterns: [alliePatterns.askChildren],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-4-one-child',
        userMessage: 'One child',
        expectedPatterns: [alliePatterns.askNewPatientConsult],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-5-new-patient',
        userMessage: 'Yes a new patient consult',
        expectedPatterns: [alliePatterns.askPreviousVisit],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-6-no-visit',
        userMessage: 'No she has never been to your office',
        expectedPatterns: [alliePatterns.askPreviousOrtho],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-7-had-braces',
        userMessage: 'Yes she had braces before at a different orthodontist',
        // Bot should acknowledge and continue - may ask for child name, location, insurance, etc.
        expectedPatterns: [/child.*name|name|understand|noted|ok|thank|alleghany|insurance|specialist|transfer/i],
        unexpectedPatterns: [],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
        validator: (response, ctx) => {
          // Bot should either continue with flow OR transfer to specialist for previous ortho cases
          const continues = /child.*name|name|understand|noted|ok|continue|thank|alleghany|insurance|location/i.test(response);
          const transfers = /specialist|transfer|connect|live agent/i.test(response);
          // Check for confusion - but exclude "What is your" type questions which are valid
          const hasConfusedPattern = /don't understand|didn't catch|could you repeat|pardon/i.test(response);
          // "what" alone should not be confused if it's asking a valid question
          const isAskingValidQuestion = /what is your|what kind|what type/i.test(response);
          const confused = hasConfusedPattern && !isAskingValidQuestion;

          if (confused) {
            return {
              passed: false,
              message: 'Did not handle previous orthodontic treatment info properly',
              severity: 'medium',
              recommendation: 'Accept previous treatment info and continue with booking flow',
            };
          }

          return {
            passed: continues || transfers,
            message: transfers ? 'Previous treatment noted, transferred to specialist' : 'Previous treatment noted, continuing flow'
          };
        },
      },
    ],

    expectations: [
      {
        type: 'custom',
        description: 'Should accept and note previous orthodontic treatment',
      },
    ],
  },

  {
    id: 'EDGE-005',
    name: 'Not Orthodontic - General Dentistry',
    description: 'Caller asks about general dentistry instead of orthodontics',
    category: 'edge-case',
    tags: ['wrong-intent', 'general-dentistry'],

    dataRequirements: [],

    steps: [
      {
        id: 'step-1-greeting',
        userMessage: 'Hi I need to schedule a dental cleaning for my child',
        // Bot should clarify this is for orthodontics or transfer to specialist
        expectedPatterns: [/allie|help|orthodontic|transfer|specialist|this line|dental/i],
        unexpectedPatterns: [patterns.error],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
      },
      {
        id: 'step-2-clarify-intent',
        userMessage: 'Its for general dentistry, not orthodontics',
        expectedPatterns: [/orthodontic|general|dentistry|transfer|specialist|assist|agent/i],
        unexpectedPatterns: [],
        semanticExpectations: [se.acknowledge()],
        negativeExpectations: [ne.noErrors()],
        validator: (response, ctx) => {
          const clarifies = /orthodontic|this line|transfer|general dentistry|agent/i.test(response);

          if (!clarifies) {
            return {
              passed: false,
              message: 'Did not clarify this line is for orthodontics only',
              severity: 'medium',
              recommendation: 'Clarify that this line is for orthodontic appointments and offer to transfer',
            };
          }

          return { passed: true, message: 'Clarified intent or offered transfer' };
        },
      },
    ],

    expectations: [
      {
        type: 'custom',
        description: 'Should clarify orthodontic-only service or transfer',
      },
    ],
  },
];
