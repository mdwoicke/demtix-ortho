/**
 * Verification script for the booking goal evaluation fixes
 *
 * Tests:
 * 1. appointmentGUID verification
 * 2. False positive prevention in classification
 * 3. PAYLOAD leakage detection
 */

import { GoalEvaluator } from '../src/services/goal-evaluator';
import { CategoryClassifier } from '../src/services/category-classifier';
import type { ConversationTurn } from '../src/tests/test-case';
import type { ProgressState } from '../src/tests/types/progress';
import type { ConversationGoal } from '../src/tests/types/goals';

// Test helper to create minimal progress state
function createProgressState(overrides: Partial<ProgressState> = {}): ProgressState {
  return {
    collectedFields: new Map(),
    pendingFields: [],
    completedGoals: [],
    activeGoals: [],
    failedGoals: [],
    currentFlowState: 'greeting',
    turnNumber: 1,
    lastAgentIntent: 'greeting',
    intentHistory: [],
    bookingConfirmed: false,
    transferInitiated: false,
    startedAt: new Date(),
    lastActivityAt: new Date(),
    issues: [],
    ...overrides,
  };
}

// Test 1: AppointmentGUID verification with valid GUID
function testValidAppointmentGUID() {
  console.log('\n=== Test 1: Valid appointmentGUID ===');

  const evaluator = new GoalEvaluator();
  const goals: ConversationGoal[] = [{
    id: 'booking-confirmed',
    type: 'booking_confirmed',
    description: 'Booking should be confirmed',
    priority: 1,
    required: true,
  }];

  const transcript: ConversationTurn[] = [
    { role: 'user', content: 'I want to schedule an appointment', timestamp: new Date().toISOString() },
    { role: 'assistant', content: 'Your appointment has been scheduled. PAYLOAD: { "appointmentGUID": "abc123-def456-ghi789" }', timestamp: new Date().toISOString() },
  ];

  const progress = createProgressState({ bookingConfirmed: true });

  const result = evaluator.evaluateTest(
    { id: 'test', name: 'Test', description: 'Test case', category: 'happy-path', tags: [], goals, constraints: [], persona: {} as any, initialMessage: '', responseConfig: { maxTurns: 10, useLlmResponses: false, handleUnknownIntents: 'generic' } },
    progress,
    transcript,
    1000
  );

  const bookingGoal = result.goalResults.find(g => g.goalId === 'booking-confirmed');
  console.log('Passed:', bookingGoal?.passed);
  console.log('Message:', bookingGoal?.message);
  console.log('Details:', bookingGoal?.details);

  if (bookingGoal?.passed && bookingGoal?.details?.appointmentGUID) {
    console.log('✓ PASS: Valid appointmentGUID detected');
  } else {
    console.log('✗ FAIL: Should have detected valid appointmentGUID');
  }
}

// Test 2: Null appointmentGUID should fail booking
function testNullAppointmentGUID() {
  console.log('\n=== Test 2: Null appointmentGUID (booking failed) ===');

  const evaluator = new GoalEvaluator();
  const goals: ConversationGoal[] = [{
    id: 'booking-confirmed',
    type: 'booking_confirmed',
    description: 'Booking should be confirmed',
    priority: 1,
    required: true,
  }];

  const transcript: ConversationTurn[] = [
    { role: 'user', content: 'I want to schedule an appointment', timestamp: new Date().toISOString() },
    { role: 'assistant', content: 'Your appointment has been scheduled. PAYLOAD: { "appointmentGUID": null }', timestamp: new Date().toISOString() },
  ];

  // Agent SAID booking confirmed, but PAYLOAD shows null
  const progress = createProgressState({ bookingConfirmed: true });

  const result = evaluator.evaluateTest(
    { id: 'test', name: 'Test', description: 'Test case', category: 'happy-path', tags: [], goals, constraints: [], persona: {} as any, initialMessage: '', responseConfig: { maxTurns: 10, useLlmResponses: false, handleUnknownIntents: 'generic' } },
    progress,
    transcript,
    1000
  );

  const bookingGoal = result.goalResults.find(g => g.goalId === 'booking-confirmed');
  console.log('Passed:', bookingGoal?.passed);
  console.log('Message:', bookingGoal?.message);

  if (!bookingGoal?.passed && bookingGoal?.message.includes('null')) {
    console.log('✓ PASS: Correctly detected null appointmentGUID as failure');
  } else {
    console.log('✗ FAIL: Should have failed due to null appointmentGUID');
  }
}

// Test 3: PAYLOAD leakage detection
function testPayloadLeakage() {
  console.log('\n=== Test 3: PAYLOAD leakage detection ===');

  const evaluator = new GoalEvaluator();
  const goals: ConversationGoal[] = [{
    id: 'booking-confirmed',
    type: 'booking_confirmed',
    description: 'Booking should be confirmed',
    priority: 1,
    required: true,
  }];

  const transcript: ConversationTurn[] = [
    { role: 'user', content: 'I want to schedule an appointment', timestamp: new Date().toISOString() },
    { role: 'assistant', content: 'Your appointment is confirmed! PAYLOAD: { "appointmentGUID": "abc123", "patientGUID": "xyz789" }', timestamp: new Date().toISOString() },
  ];

  const progress = createProgressState({ bookingConfirmed: true });

  const result = evaluator.evaluateTest(
    { id: 'test', name: 'Test', description: 'Test case', category: 'happy-path', tags: [], goals, constraints: [], persona: {} as any, initialMessage: '', responseConfig: { maxTurns: 10, useLlmResponses: false, handleUnknownIntents: 'generic' } },
    progress,
    transcript,
    1000
  );

  const payloadViolation = result.constraintViolations.find(v =>
    v.message.includes('PAYLOAD') || v.message.includes('leakage')
  );

  console.log('Constraint Violations:', result.constraintViolations.length);
  if (payloadViolation) {
    console.log('Violation:', payloadViolation.message);
    console.log('✓ PASS: PAYLOAD leakage detected');
  } else {
    console.log('✗ FAIL: Should have detected PAYLOAD leakage');
  }
}

// Test 4: False positive prevention in classification
async function testFalsePositivePrevention() {
  console.log('\n=== Test 4: False positive prevention ===');

  const classifier = new CategoryClassifier({ useLlm: false });

  // These should NOT be classified as booking_confirmed
  const falsePositives = [
    "Let me verify that information for you...",
    "I'm checking availability now...",
    "One moment while I schedule that for you",
    "Processing your request...",
    "I'll book that appointment for you",
  ];

  // These SHOULD be classified as booking_confirmed
  const truePositives = [
    "Your appointment has been scheduled for Monday at 9am",
    "I have booked you for Tuesday at 2pm",
    "Your appointment is confirmed for next week",
    "You're all set for Friday at 10am",
  ];

  console.log('\nFalse positive checks (should NOT be booking_confirmed):');
  let allFalsePositivesPassed = true;
  for (const text of falsePositives) {
    const result = await classifier.classify(text, [], {} as any);
    const isBooking = result.terminalState === 'booking_confirmed';
    console.log(`  "${text.substring(0, 40)}..."`);
    console.log(`    terminalState: ${result.terminalState}, isBooking: ${isBooking}`);
    if (isBooking) {
      console.log('    ✗ FAIL: Should NOT be booking_confirmed');
      allFalsePositivesPassed = false;
    } else {
      console.log('    ✓ OK');
    }
  }

  console.log('\nTrue positive checks (SHOULD be booking_confirmed):');
  let allTruePositivesPassed = true;
  for (const text of truePositives) {
    const result = await classifier.classify(text, [], {} as any);
    const isBooking = result.terminalState === 'booking_confirmed';
    console.log(`  "${text.substring(0, 40)}..."`);
    console.log(`    terminalState: ${result.terminalState}, isBooking: ${isBooking}`);
    if (!isBooking) {
      console.log('    ✗ FAIL: Should BE booking_confirmed');
      allTruePositivesPassed = false;
    } else {
      console.log('    ✓ OK');
    }
  }

  if (allFalsePositivesPassed && allTruePositivesPassed) {
    console.log('\n✓ PASS: All classification tests passed');
  } else {
    console.log('\n✗ FAIL: Some classification tests failed');
  }
}

// Run all tests
async function main() {
  console.log('========================================');
  console.log('Verification Tests for Booking Goal Fixes');
  console.log('========================================');

  testValidAppointmentGUID();
  testNullAppointmentGUID();
  testPayloadLeakage();
  await testFalsePositivePrevention();

  console.log('\n========================================');
  console.log('Verification complete!');
  console.log('========================================');
}

main().catch(console.error);
