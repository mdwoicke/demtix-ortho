---
name: iva-prompt-tuning
description: Analyze test failures and tune the Flowise IVA prompt to work seamlessly with real users
---

# IVA Prompt Tuning Skill

**Trigger Hints**: "tune prompt", "fix bot", "test failed", "bot behavior", "improve iva", "prompt tuning"

## CRITICAL MINDSET: The Golden Rule

**When a test fails, ask: "Is this how a real user would behave, AND is the bot responding appropriately?"**

- If the BOT is behaving incorrectly → Fix the Flowise prompt
- If the TEST AGENT is unrealistic → Fix the test agent
- If BOTH have issues → Fix the bot FIRST, then the test agent

**The bot serves users, not tests. Never make the test agent "smarter" to work around bot deficiencies.**

---

## Decision Framework

### Step 1: Analyze the Failure

Read the transcript and ask:

| Question | If YES | If NO |
|----------|--------|-------|
| Would a real user say what the test agent said? | Continue | Fix test agent response |
| Did the bot respond appropriately to the user? | Continue | Fix Flowise prompt |
| Did the bot complete the user's request? | Pass | Investigate why not |

### Step 2: Identify Root Cause

| Symptom | Root Cause | Fix Location |
|---------|------------|--------------|
| Bot transfers instead of booking | API failure, slot retry not working, or flow issue | Flowise prompt |
| Bot asks same question twice | Missing acknowledgment rules | Flowise prompt |
| Bot asks for unnecessary details | Over-clarification in prompt | Flowise prompt |
| Bot misunderstands user intent | Unclear instructions in prompt | Flowise prompt |
| Test agent gives wrong response | Intent detection or response template issue | Test agent |
| Test agent responds prematurely | Intent detection priority issue | Test agent |

### Step 3: Apply Fix to Correct Location

```
IF root_cause IN (bot behavior, API handling, conversation flow):
    → Fix Flowise prompt (docs/Chord_Cloud9_SystemPrompt.md)

ELIF root_cause IN (intent detection, response generation):
    → Fix test agent (test-agent/src/*)

ELSE:
    → Investigate further before fixing
```

---

## Common Bot Issues and Fixes

### Issue 1: Bot Transfers Instead of Booking

**Symptoms:**
- Bot says "I want to connect you with a specialist..."
- Booking goal fails
- Conversation ends at transfer

**Root Causes:**
1. Slots API returns 0 results → Bot not following Slot Retry Rule
2. Date calculation error → Past dates cause API failure
3. User gives vague time preference → Bot doesn't know what to search

**Fix in Flowise Prompt:**
```markdown
Add to STEP 18 (Offer Times):

=== HANDLING VAGUE TIME PREFERENCES ===

When user says "morning", "afternoon", "any time":
1. Call slots API with default date range (next 14 days)
2. Filter results by their preference (AM for morning, PM for afternoon)
3. Offer the FIRST available slot matching their preference
4. DO NOT ask for more details - just pick one and offer it

WRONG: "Which morning time would you prefer, 9:30 or 10:00?"
CORRECT: "I have 9:30 AM available on Monday. Would that work?"
```

### Issue 2: Bot Asks for Unnecessary Details

**Symptoms:**
- Bot asks "Which specific time: 9:30, 10:00, or 10:30?"
- User already said "morning works"
- Conversation loops with repeated preferences

**Root Cause:**
Prompt says to ask for preference but then asks again for specifics

**Fix in Flowise Prompt:**
```markdown
Add to STEP 18:

NEVER ask for more specific times after receiving a preference.
When user says "morning", pick the first morning slot and offer it.
When user says "any time", pick the first available slot and offer it.
```

### Issue 3: Bot Doesn't Follow Slot Retry Rule

**Symptoms:**
- Bot transfers after saying "Let me check..."
- No retry attempts visible in logs
- Happens with certain date ranges

**Root Cause:**
Bot not correctly implementing the retry logic

**Fix in Flowise Prompt:**
Strengthen the Slot_Retry_Rule with clearer examples:
```markdown
SLOT RETRY IS MANDATORY. Track attempts:
- Attempt 1: Original date range → 0 slots? → Attempt 2
- Attempt 2: +7 days → 0 slots? → Attempt 3
- Attempt 3: +14 days → 0 slots? → NOW transfer
NEVER skip retry steps. Log each attempt in PAYLOAD.
```

---

## Common Test Agent Issues and Fixes

### Issue 1: Test Agent Responds Before Time Offered

**Symptom:**
- Bot: "Let me check available times..."
- Test Agent: "Yes, that time works" (no time was offered!)

**Root Cause:**
Intent detection classifies "searching" as "offering"

**Fix in Test Agent:**
- Ensure `searching_availability` is checked BEFORE `offering_time_slots`
- Add patterns like "Let me check", "One moment" to searching_availability
- Response for searching should be "Okay, thank you" not "Yes, that works"

### Issue 2: Test Agent Gives Unrealistic Response

**Symptom:**
- Bot asks a reasonable question
- Test agent responds with something no real user would say

**Fix:**
Update the response template or persona to give realistic answers.
But FIRST verify the bot's question is reasonable!

---

## Workflow: Analyzing a Failed Test

```bash
# 1. Get the transcript
cd test-agent && npx ts-node src/index.ts transcript TEST-ID

# 2. Read the conversation and identify:
#    - Where did it go wrong?
#    - Who made the mistake - bot or test agent?
#    - Would a real user behave like the test agent?

# 3. If BOT issue - edit Flowise prompt:
#    - Edit: docs/Chord_Cloud9_SystemPrompt.md
#    - Add/modify rules for the problematic behavior
#    - Update Flowise (user must do this manually)

# 4. If TEST AGENT issue - edit test agent:
#    - Intent detection: test-agent/src/tests/types/intent.ts
#    - Response templates: test-agent/src/services/response-generator.ts
#    - Only fix if test agent is unrealistic
```

---

## Flowise Prompt Tuning Guidelines

### 1. Be Explicit About Expected Behavior

Bad:
```markdown
Ask for time preference and offer available slots.
```

Good:
```markdown
STEP 18a: ASK: "Do you prefer a morning or afternoon appointment?"
STEP 18b: When user responds, call slots API immediately
STEP 18c: Offer the FIRST slot matching their preference:
          "I have 9:30 AM on Monday. Would that work?"
```

### 2. Include Wrong vs Correct Examples

```markdown
WRONG FLOW (causes failures):
  User: "Morning works"
  Agent: "Which morning time - 9:30, 10, or 10:30?"

CORRECT FLOW:
  User: "Morning works"
  Agent: "I have 9:30 AM on Monday. Would that work?"
```

### 3. Handle Edge Cases Explicitly

```markdown
If user repeats preference instead of answering yes/no:
- User: "Morning works" (again)
- DO NOT ask for clarification
- Pick first morning slot and offer it
```

### 4. Define Confirmation Triggers

```markdown
When user says ANY of: yes, yeah, sure, okay, that works, perfect, sounds good
→ IMMEDIATELY proceed to booking
→ DO NOT re-confirm
→ DO NOT ask "should I book this?"
```

---

## Anti-Patterns to Avoid

### 1. DO NOT over-engineer the test agent

Bad approach:
- "The bot is asking weird questions, let me make the test agent handle them"
- "The bot doesn't understand 'morning', let me change the test agent to say '9:00 AM'"

Good approach:
- "The bot should understand 'morning' - let me fix the Flowise prompt"

### 2. DO NOT add complex intent detection logic

Bad approach:
- Adding 50 regex patterns to detect every possible bot response
- Creating complex LLM prompts to "understand" bot quirks

Good approach:
- Fix the bot to give clear, consistent responses
- Keep test agent intent detection simple

### 3. DO NOT make test personas unrealistically specific

Bad approach:
- Persona always says exact times like "January 15th at 9:30 AM"
- Persona provides perfect spelling every time

Good approach:
- Personas say natural things like "morning next week"
- Bot should handle natural user behavior

---

## Files Reference

| Purpose | File Path |
|---------|-----------|
| Flowise System Prompt | `docs/Chord_Cloud9_SystemPrompt.md` |
| Intent Detection | `test-agent/src/tests/types/intent.ts` |
| Response Templates | `test-agent/src/services/response-generator.ts` |
| Goal Test Runner | `test-agent/src/tests/goal-test-runner.ts` |
| Test Personas | `test-agent/src/tests/personas/standard-personas.ts` |
| Intent Detector | `test-agent/src/services/intent-detector.ts` |

---

## Quick Debugging Checklist

When a goal test fails:

- [ ] Read the full transcript
- [ ] Identify the exact turn where things went wrong
- [ ] Ask: "Would a real user say this?" (test agent response)
- [ ] Ask: "Is the bot's response appropriate?" (bot behavior)
- [ ] Determine if bot or test agent needs fixing
- [ ] Fix the Flowise prompt if bot issue
- [ ] Fix test agent ONLY if it's being unrealistic
- [ ] Run tests again to verify fix
- [ ] Commit changes with clear description

---

## Remember

**The goal is a bot that works for REAL users, not a test agent that works around bot issues.**

When in doubt:
1. Read the transcript as if YOU were the user
2. Would you expect the bot to handle your input?
3. If yes, fix the bot. If no, the test might be unrealistic.
