# IVA V3 Implementation Guide

## CDH Ortho Alleghany - Advanced Voice Assistant Optimization

**Version:** 3.0
**Date:** 2025-12-26
**Status:** Ready for Deployment

---

## Executive Summary

This guide documents the complete V3 optimization of the IVA (Interactive Voice Assistant) system for CDH Ortho Alleghany. The implementation uses advanced prompting techniques derived from state-of-the-art research to deliver a more natural, efficient, and reliable voice scheduling experience.

### Key Improvements

| Metric | V2 (Current) | V3 (Optimized) | Improvement |
|--------|-------------|----------------|-------------|
| Prompt Size | 43,511 chars | ~17,000 chars | **61% reduction** |
| Avg Response Words | 50-80 | ≤30 | **60% shorter** |
| Redundant Rules | 15+ duplicates | 0 | **100% eliminated** |
| State Machine States | Implicit | 8 explicit | **Clear flow** |
| LLM Temperature | Default (1.0) | 0.3 | **Consistent output** |

---

## Architecture Overview

### Prompting Techniques Implemented

1. **Finite State Machine** - 8 explicit states with clear transitions
2. **Hierarchical Rules** - ABSOLUTE > CRITICAL > STANDARD priority
3. **Few-Shot Exemplars** - Golden path + 3 edge case examples
4. **Chain-of-Action Guidance** - Step sequences for complex operations
5. **Voice-First Patterns** - TTS-optimized response templates
6. **Confirmation Detection** - Pre-computed phrase patterns
7. **Schema Enforcement** - Structured PAYLOAD output
8. **Context Compression** - Tiered memory for long conversations
9. **TTS Normalization** - Number/date/phone formatting rules
10. **Latency Optimization** - Static vs dynamic context separation

### File Structure

```
docs/
├── Chord_Cloud9_SystemPrompt_V3_ADVANCED.md    # Main prompt (~17K chars)
├── chord_dso_scheduling-V3-ENHANCED.js         # Scheduling tool with LLM guidance
├── chord_dso_patient-V3-ENHANCED.js            # Patient tool with LLM guidance
├── IVA_Optimization_Analysis.md                # Analysis document
└── IVA_V3_Implementation_Guide.md              # This file
```

---

## Deployment Instructions

### Step 1: Update Flowise System Prompt

Replace the current system prompt with `Chord_Cloud9_SystemPrompt_V3_ADVANCED.md`:

```
1. Open Flowise chatflow editor
2. Select the LLM node
3. Replace System Prompt content with V3_ADVANCED.md
4. Set inference parameters:
   - temperature: 0.3
   - max_tokens: 150
   - top_p: 0.9
```

### Step 2: Update Tool Scripts

Replace the current tool scripts in Flowise:

| Current Tool | Replace With |
|-------------|--------------|
| `chord_dso_scheduling.js` | `chord_dso_scheduling-V3-ENHANCED.js` |
| `chord_dso_patient.js` | `chord_dso_patient-V3-ENHANCED.js` |

### Step 3: Configure Inference Settings

Add to Flowise LLM configuration:

```json
{
  "temperature": 0.3,
  "maxTokens": 150,
  "topP": 0.9,
  "frequencyPenalty": 0.2,
  "presencePenalty": 0.1
}
```

---

## State Machine Reference

### State Diagram

```
START ──► GREETING ──► CALLER_INFO ──► ELIGIBILITY
                            │                │
                            ▼                ▼
                       CHILD_INFO ──► ACCOUNT ──► SCHEDULING
                            │                         │
                            │                         ▼
                            │              CONFIRMATION ──► END
                            │                         │
                            └─────────► TRANSFER ◄────┘
```

### State Definitions

| State | Purpose | Entry Trigger | Exit Trigger |
|-------|---------|---------------|--------------|
| GREETING | Welcome caller | Call starts | User responds |
| CALLER_INFO | Get name, phone | After greeting | All 3 fields |
| ELIGIBILITY | Check new patient | Caller info done | Eligible/Transfer |
| CHILD_INFO | Get child details | Eligible | All children done |
| ACCOUNT | Insurance, email | Children done | All info collected |
| SCHEDULING | Find slots, book | Account done | Booked/Transfer |
| CONFIRMATION | Confirm details | Booking success | Goodbye detected |
| END | Close call | Confirmation done | Disconnect |
| TRANSFER | Hand to human | Trigger detected | Call transferred |

### Transfer Triggers

| Trigger | Detection | Action |
|---------|-----------|--------|
| Existing patient | "been here before" = yes | Transfer |
| Age invalid | DOB < 7 or > 20 years | Transfer |
| Non-ortho intent | Cleaning/general request | Transfer |
| API failure x3 | Tool errors after retries | Transfer |

---

## Voice-First Guidelines

### Response Constraints

- **Maximum:** 30 words per response
- **Questions:** One per turn
- **Structure:** Front-load critical information
- **Acknowledgments:** "Got it", "Perfect", "Okay"

### TTS Normalization

| Written | Spoken |
|---------|--------|
| `12/30/2025` | "December thirtieth" |
| `9:30 AM` | "nine thirty AM" |
| `215-555-1234` | "two one five, five five five, one two three four" |
| `$150` | "one hundred fifty dollars" |

### Forbidden Output

- Bullet points or numbered lists
- Parentheses, brackets, quotation marks
- URLs or email addresses
- Emojis or special characters
- Abbreviations (use "appointment" not "appt")

### Banned Words

| Never Say | Say Instead |
|-----------|-------------|
| sorry | Thank you |
| unfortunately | I want to let you know |
| cannot / can't | I'll / Let me |
| error / problem | Let me check on that |
| No problem | Of course / Absolutely |

---

## LLM Guidance System

### How It Works

The tool scripts return `llm_guidance` objects that direct the LLM's next action:

```javascript
{
  "llm_guidance": {
    "current_state": "SCHEDULING",
    "next_state": "CONFIRMATION",
    "action_required": "CONFIRM_BOOKING",
    "voice_response": "Your appointment is confirmed!",
    "chain_of_action": [
      "1. Booking successful",
      "2. Confirm details to caller",
      "3. Offer address",
      "4. Ask if anything else"
    ],
    "prohibited_responses": [
      "Let me check on that",
      "One moment"
    ]
  }
}
```

### Guidance Scenarios

| Scenario | Next Action | Voice Response |
|----------|-------------|----------------|
| `slot_offered` | Wait for confirmation | "I have 9:30 AM on Tuesday. Does that work?" |
| `user_confirmed` | Book immediately | (no speech until booked) |
| `booking_success` | Confirm to caller | "Your appointment is confirmed!" |
| `no_slots` | Expand search | "Let me check a few more days..." |
| `api_error` | Retry or transfer | "One sec while I pull that up." |

---

## Confirmation Detection

### Affirmative Patterns

```json
[
  "yes", "yeah", "yep", "yup", "sure", "okay", "ok",
  "that works", "works for me", "perfect", "sounds good",
  "let's do it", "book it", "go ahead", "please"
]
```

**Action:** PROCEED_IMMEDIATELY - Do not re-ask for confirmation.

### Negative Patterns

```json
[
  "no", "nope", "different", "another", "other times",
  "not that one", "change", "actually"
]
```

**Action:** Offer alternatives.

### Goodbye Patterns

```json
[
  "that's all", "that's it", "goodbye", "bye",
  "nothing else", "I'm good", "I'm all set"
]
```

**Action:** SKIP_TO_CLOSING.

---

## Testing Checklist

### Pre-Deployment

- [ ] Prompt size < 20,000 characters
- [ ] All states reachable in test scenarios
- [ ] Confirmation detection working
- [ ] TTS output sounds natural
- [ ] Tool scripts returning llm_guidance
- [ ] Error recovery graceful (no "error" words)

### Goal Test Scenarios

| Test ID | Scenario | Expected Outcome |
|---------|----------|------------------|
| GOAL-HAPPY-001 | Single child, simple booking | 8/8 goals pass |
| GOAL-HAPPY-002 | Two children booking | All children booked |
| GOAL-EDGE-001 | Existing patient | Transfer triggered |
| GOAL-EDGE-002 | Age out of range | Transfer triggered |
| GOAL-EDGE-003 | Out-of-network insurance | Continue with disclosure |
| GOAL-EDGE-004 | Previous ortho treatment | Continue (not transfer) |

### Response Validation

For each response, verify:

- [ ] Only ONE question
- [ ] No banned words
- [ ] ≤30 words
- [ ] Natural speech (no lists/brackets)
- [ ] Correct state transition

---

## Rollback Plan

If issues arise:

1. **Immediate:** Revert to V2 prompt and tools
2. **Monitor:** Check call completion rates
3. **Analyze:** Review failed transcripts
4. **Iterate:** Fix specific issues and re-test

### V2 Files (Backup)

```
docs/
├── Chord_Cloud9_SystemPrompt.md          # Original V2 prompt
├── chord_dso_scheduling-StepwiseSearch.js # V2 scheduling tool
└── chord_dso_patient-FIXED.js            # V2 patient tool
```

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Response latency | < 1.5s (first), < 3s (with tool) | Monitor in Flowise |
| Booking success rate | > 90% | Track completions |
| Transfer rate | < 15% | Track transfers |
| Avg conversation turns | < 12 | Count TC values |
| Caller hang-ups | < 10% | Track abandoned calls |

---

## Research Sources

This implementation is based on:

1. **StateFlow Framework** - State machine prompting for task-solving
2. **Conversation Routines (CR)** - Task-oriented dialog specifications
3. **Vapi Prompting Guide** - Voice AI best practices
4. **LLMLingua** - Context compression techniques
5. **OpenAI Instruction Hierarchy** - Prioritized instruction handling

---

## Support

For issues or questions:

1. Check `IVA_Optimization_Analysis.md` for detailed findings
2. Review tool script comments for implementation details
3. Test with goal test scenarios before production deployment

---

*Generated by Claude Code - IVA Optimization Session*
*Techniques: Finite State Machine, Hierarchical Rules, Few-Shot, Chain-of-Action, TTS Normalization*
