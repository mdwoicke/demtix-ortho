# Flowise Flow Issues Analysis

**Date:** 2025-12-25
**Analyzed by:** Claude Code
**Test Runs Analyzed:** 15 recent goal test executions

---

## Executive Summary

Analysis of recent E2E test failures reveals several critical issues in the Flowise orthodontic scheduling chatbot flow. The primary issue is **booking confirmations not completing properly**, affecting 8 out of 15 recent tests (53% failure rate on booking-related goals).

---

## Issue #1: "Let Me Check On That" Loop (CRITICAL)

### Description
When users confirm a time slot, the chatbot responds with a holding pattern instead of completing the booking:

> "Let me check on that for you. One moment while I look into this."

This response does NOT trigger the `confirming_booking` intent because it lacks confirmation keywords.

### Evidence
```
[USER]: Yes, that time works
[ASSISTANT]: Let me check on that for you. One moment while I look into this.
```

### Occurrence
- **STUCK_CHECKING pattern:** 6 occurrences in 15 tests
- **DELAYED_RESPONSE pattern:** 7 occurrences in 15 tests

### Root Cause
The Flowise flow appears to enter a "checking" state when:
1. User confirms a time slot
2. The flow attempts to call the scheduling API
3. Instead of returning confirmation, it returns a "checking" message

### Suspected Flow Node Issues
1. **Scheduling Tool Node**: May be returning intermediate status instead of final confirmation
2. **Missing Callback Handler**: No handler for async scheduling completion
3. **Timeout/Race Condition**: API call may timeout before returning success

### Impact
- Tests wait at this state until max turns or timeout
- Booking never completes
- Users would be left hanging in production

---

## Issue #2: Intent Detection for "Successfully Scheduled" (MEDIUM)

### Description
In some cases, the chatbot DOES say "appointments have been successfully scheduled" but the test agent's intent detector fails to recognize this as a terminal booking confirmation.

### Evidence
```
[ASSISTANT]: Wonderful! Your appointments have been successfully scheduled!
I have booked Jake Davis for Wednesday, December 31, 2025 at 7:30 AM...
```

Test still marked as FAILED despite this confirmation message.

### Current Intent Keywords
```typescript
'confirming_booking': [/\b(booked|scheduled|confirmed|appointment.*set)\b/i]
```

### Potential Issues
1. The word "scheduled" IS present and should match
2. May be a timing issue - booking confirmed but conversation continues
3. Intent detected but flow state not properly updated

### Recommendation
Add more verbose booking confirmation patterns:
```typescript
'confirming_booking': [
  /\b(booked|scheduled|confirmed|appointment.*set)\b/i,
  /successfully\s+scheduled/i,
  /appointment.*confirmed/i,
  /see you (on|at)/i,
]
```

---

## Issue #3: Transfer Interrupting Booking Flow (MEDIUM)

### Description
In 3 tests, the chatbot initiated a transfer to a specialist mid-booking flow.

### Evidence
- **TRANSFER_INITIATED pattern:** 3 occurrences

### Triggering Conditions
1. Patient age outside 7-20 range (adult caller saying appointment is "for myself")
2. Non-orthodontic request detected
3. Complex case flagged for specialist

### Example
```
[USER]: Oh, the appointment would be for me - for myself.
[ASSISTANT]: Orthodontic patients at CDH Ortho Alleghany must be between 7 and 20 years old.
I will connect you with a specialist who can assist you further.
```

### Note
This issue was partially fixed by updating the ResponseGenerator to use Opus 4.5 and adding explicit "appointment is for CHILD" instructions. GOAL-HAPPY-003 now runs 14 turns instead of failing at 3 turns.

---

## Issue #4: Flow State Not Persisting (LOW)

### Description
The chatbot sometimes asks for information already provided.

### Evidence
- Tests show 22 turns when 15-17 should suffice
- Some fields marked as "collected" but asked again

### Potential Causes
1. Session state not properly maintained between API calls
2. Flowise memory node not retaining context
3. Tool calls resetting conversation context

---

## Test Results Summary

### Recent Run Analysis (run-2025-12-25-22504371)

| Test ID | Status | Duration | Turns | Failed Goals |
|---------|--------|----------|-------|--------------|
| GOAL-HAPPY-001 | FAIL | 70.3s | 17 | booking-confirmed, conversation-ended |
| GOAL-HAPPY-002 | FAIL | 95.1s | 22 | booking-confirmed |
| GOAL-HAPPY-003 | FAIL | 140.2s | 14 | collect-child-info, booking-confirmed |

### Historical Patterns

| Pattern | Count | % of Tests |
|---------|-------|------------|
| Booking Failures | 8 | 53% |
| STUCK_CHECKING | 6 | 40% |
| DELAYED_RESPONSE | 7 | 47% |
| TRANSFER_INITIATED | 3 | 20% |

---

## Recommended Flowise Flow Fixes

### Priority 1: Fix Booking Completion

1. **Review SetAppointment Tool Node**
   - Ensure it returns immediate confirmation, not "checking" status
   - Add error handling for API timeouts
   - Return booking confirmation message directly

2. **Add Confirmation Response Template**
   ```
   Your appointment has been confirmed for [DATE] at [TIME].
   We'll see you at [LOCATION].
   ```

3. **Remove "Let me check" Intermediate State**
   - This message provides no value and confuses the flow
   - Either show loading state OR show confirmation

### Priority 2: Session State Management

1. **Verify Memory Node Configuration**
   - Check that conversation buffer is properly configured
   - Ensure tool calls don't reset memory

2. **Add State Validation**
   - Before asking for info, check if already collected
   - Use conditional logic to skip redundant questions

### Priority 3: Edge Case Handling

1. **Age Validation Timing**
   - Check patient age BEFORE starting full booking flow
   - Prevents wasted conversation if transfer is needed

2. **Transfer Message Clarity**
   - Include reason for transfer
   - Offer alternative (callback) before hard transfer

---

## Flowise Node Investigation Checklist

- [ ] Review `SetAppointment` tool implementation
- [ ] Check API response handling for scheduling calls
- [ ] Verify memory buffer configuration
- [ ] Test booking flow end-to-end manually
- [ ] Add logging to identify where flow stalls
- [ ] Review conditional routing after time slot selection

---

## Test Agent Improvements Made

### Model Configuration
```typescript
// Intent Detection: Fast
model: 'claude-3-5-haiku-20241022'

// Response Generation: Quality
model: 'claude-opus-4-5-20251101'

// LLM Analysis: Deep
model: 'claude-opus-4-5-20251101'
```

### Prompt Improvements
- Added "CRITICAL RULE" for child appointment clarification
- Added child info to LLM prompt context
- Emphasized parent role in conversation

---

## Next Steps

1. **Immediate**: Manual test of booking flow in Flowise UI to reproduce "Let me check" issue
2. **Short-term**: Add debug logging to Flowise scheduling nodes
3. **Medium-term**: Refactor booking confirmation to return immediately
4. **Long-term**: Add Flowise flow unit tests for booking scenarios

---

## Files Referenced

- `test-agent/src/services/intent-detector.ts` - Intent detection logic
- `test-agent/src/services/progress-tracker.ts` - Flow state tracking
- `test-agent/src/services/goal-evaluator.ts` - Goal evaluation
- `test-agent/src/tests/types/intent.ts` - Intent keywords
- `docs/chord_dso_scheduling-StepwiseSearch.js` - Scheduling tool
