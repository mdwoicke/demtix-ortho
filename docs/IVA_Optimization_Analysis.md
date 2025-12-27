# IVA Optimization Analysis - Chord Cloud9 Scheduling Agent

**Analysis Date:** 2025-12-26
**Analyst:** Claude Code
**System:** CDH Ortho Alleghany Voice Scheduling Agent

---

## Executive Summary

The current system prompt is **1,468 lines / 43,511 characters** - this is excessively long for optimal LLM performance in real-time IVA scenarios. Key areas for optimization include:

1. **Prompt length reduction** - Condense rules, eliminate redundancy
2. **State machine clarity** - Simplify flow logic
3. **Voice-first language** - Optimize for spoken interaction
4. **LLM cognitive load** - Reduce rules the LLM must track simultaneously

---

## Current State Analysis

### Strengths (Keep These)

| Feature | Why It Works |
|---------|--------------|
| `<One_Question_Rule>` | Prevents cognitive overload for callers |
| `<Positive_Language_Rule>` | Maintains professional brand voice |
| LLM guidance in tool responses | Directs agent state transitions |
| Stepwise slot expansion | Prevents premature transfers |
| Retry logic with backoff | Handles network issues gracefully |
| Auto date correction | Prevents past-date booking failures |

### Issues Identified

#### 1. Prompt Length (CRITICAL)
- **43,511 characters** exceeds recommended 20K for real-time IVA
- Causes inconsistent behavior and slower responses
- Many rules stated 3-4 times in different sections

#### 2. Redundant Rules
```
Example: "Use JSON null" appears in:
- <Null_Value_Rule> (line 68-72)
- <payload_rules> item 6 (line 1457)
- Multiple PAYLOAD examples throughout
```

#### 3. Robotic Prescribed Phrases
```
Current: "Hi, my name is Allie, how may I help you today?"
Issue: "How may I help you" sounds scripted

Optimized: "Hi! I'm Allie. What can I help you with?"
Benefit: More natural, 30% shorter
```

#### 4. Verbose Examples
- 10+ PAYLOAD examples with identical structure
- Could consolidate to 2-3 exemplars

#### 5. Conflicting Instructions
```
<phase3_children_count> says:
"CRITICAL: You MUST ALWAYS ask this question, even if caller already mentioned"

<Multi_Info_Acknowledgment_Rule> says:
"Do NOT re-ask for information already provided"
```

---

## Optimization Recommendations

### Priority 1: CRITICAL (Implement Immediately)

#### 1.1 Reduce Prompt to Under 25K Characters

**Action:** Create condensed version focusing on:
- State machine (10 states max)
- Rule summary table (not verbose sections)
- 2-3 key examples (not 10+)

**Target:** 20,000-25,000 characters

#### 1.2 Consolidate Redundant Rules

| Current Location | Consolidate To |
|-----------------|----------------|
| `<Null_Value_Rule>`, `<payload_rules>` | Single `<data_format>` section |
| Multiple "NEVER say sorry" instances | Single `<banned_words>` list |
| Date calculation in 3 places | Single `<date_rules>` section |

#### 1.3 Remove Conflicting Instructions

**Resolution:** Prioritize not re-asking over always asking:
```
RULE: Ask for child count ONLY IF not mentioned in opener.
If mentioned: "Thank you, I have [N] children. Let me confirm..."
```

### Priority 2: HIGH (Next Sprint)

#### 2.1 Optimize Confirmation Detection

**Current Issue:** Agent asks "Would you like to book?" after user says "Yes that works"

**Root Cause:** LLM doesn't recognize all confirmation variants

**Solution:** Add to tool response `llm_guidance`:
```json
{
  "confirmation_triggers": ["yes", "yeah", "sure", "okay", "perfect", "sounds good", "let's do", "book it", "that works"],
  "on_trigger": "SKIP_CONFIRMATION_QUESTION"
}
```

#### 2.2 Voice-First Language Updates

| Current (Written Style) | Optimized (Voice Style) |
|------------------------|------------------------|
| "May I have your first and last name please?" | "What's your name?" |
| "Could you please spell your first and last name for me to make sure I have it correct?" | "Can you spell that for me?" |
| "I want to let you know that [X] is not in-network" | "[X] isn't in-network, just so you know" |
| "Is there anything else I can help you with today?" | "Anything else?" |

#### 2.3 Simplify PAYLOAD Structure

**Current:** 50+ fields, many redundant

**Proposed Minimal PAYLOAD:**
```json
{
  "TC": "number",
  "current_datetime": "ISO timestamp",
  "caller": { "name": "", "phone": "", "email": "" },
  "children": [
    { "name": "", "dob": "", "patientGUID": "", "appointmentGUID": "", "slot": {} }
  ],
  "insurance": { "provider": "", "status": "" },
  "state": "GREETING|CALLER_INFO|ELIGIBILITY|SCHEDULING|CONFIRMATION|CLOSING"
}
```

### Priority 3: MEDIUM (Future Enhancement)

#### 3.1 Add Speech Acknowledgment Tokens

**Purpose:** Sound more natural in voice

| When | Add |
|------|-----|
| After name received | "Got it." |
| After confirmation | "Perfect." |
| Before action | "Okay," |
| Processing | "One sec..." |

#### 3.2 Improve Error Recovery

**Current:** Transfer on first API failure after retry

**Enhancement:** Add graceful degradation:
```
If slots API fails:
1. "I'm having a quick system moment. Can you hang on for just a sec?"
2. Retry with backoff
3. If still fails after 3 attempts THEN transfer
```

#### 3.3 Add Interruption Handling

**IVA-Specific:** Handle caller interruptions mid-sentence
```
If barge-in detected:
- Stop current speech
- Listen for new input
- Acknowledge: "Sorry, go ahead"
- Process new input
```

---

## Tool Script Optimizations

### chord_dso_scheduling

#### Current Strengths
- Stepwise date expansion works well
- LLM guidance included in responses
- Network retry with exponential backoff

#### Recommended Changes

1. **Add confirmation detection to `llm_guidance`:**
```javascript
llm_guidance: {
  // ... existing ...
  confirmation_phrases: ["yes", "yeah", "sure", "perfect", "sounds good", "that works"],
  on_confirmation: "IMMEDIATELY_BOOK",
  never_re_confirm: true
}
```

2. **Simplify slot response:**
```javascript
// Instead of returning all slot fields
return {
  available_slots: [
    { time: "9:30 AM", day: "Monday", date: "12/30/2025" }
  ],
  // Include ONLY what LLM needs to speak
  llm_speak: "I have 9:30 AM on Monday, December 30th"
}
```

### chord_dso_patient

#### Current Strengths
- Default provider/location values prevent failures
- LLM guidance for next action

#### Recommended Changes

1. **Add validation guidance:**
```javascript
if (!result.patientGUID) {
  llm_guidance.fallback_action = "ask_caller_to_repeat_name";
}
```

2. **Include phonetic name for voice:**
```javascript
return {
  patientGUID: "...",
  llm_speak: `Created patient record for ${firstName} ${lastName}`
}
```

---

## Recommended State Machine (Simplified)

```
INIT --> CALLER_INFO --> CHILD_COUNT --> ELIGIBILITY
                              |
                              v
                         CHILD_INFO --> ACCOUNT --> SCHEDULING
                              |                          |
                              v                          v
                         [loop for               CONFIRMATION
                          each child]                   |
                              |                          v
                              +------------------> CLOSING --> END

TRANSFER_TRIGGERS:
- Existing patient detected
- Age out of range (< 7 or > 20)
- Non-ortho intent
- API failure after 3 retries
```

**10 States Total** (vs current 25+ steps)

---

## Implementation Checklist

### Phase 1 (Week 1-2)
- [ ] Create condensed prompt (<25K chars)
- [ ] Remove duplicate rules
- [ ] Resolve conflicting instructions
- [ ] Test with existing goal tests

### Phase 2 (Week 3-4)
- [ ] Update voice-first language
- [ ] Simplify PAYLOAD structure
- [ ] Add confirmation detection to tools
- [ ] Run full test suite

### Phase 3 (Week 5-6)
- [ ] Add speech acknowledgment tokens
- [ ] Improve error recovery
- [ ] Add interruption handling
- [ ] A/B test against current version

---

## Metrics to Track

| Metric | Current Baseline | Target |
|--------|-----------------|--------|
| Avg conversation turns | ~15-18 | <12 |
| Booking success rate | TBD | >90% |
| Transfer rate (API issues) | TBD | <5% |
| Prompt response latency | TBD | <2s |
| "Re-ask" incidents | TBD | 0 |
| Caller hang-ups | TBD | <10% |

---

## Files Modified/Created

### This Analysis
- `docs/IVA_Optimization_Analysis.md` (this file)

### Related Files
- `docs/Chord_Cloud9_SystemPrompt.md` - Current full prompt
- `docs/Chord_Cloud9_SystemPrompt_OPTIMIZED.md` - State machine version (partial)
- `docs/chord_dso_scheduling-StepwiseSearch.js` - Scheduling tool
- `docs/chord_dso_patient-FIXED.js` - Patient tool

---

*Generated by Claude Code during goal test optimization session*
