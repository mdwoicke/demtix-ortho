# IVR Prompt Optimization Guide

Best practices for creating optimized prompts for Interactive Voice Response (IVR) and Voice AI applications.

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [XML-Structured Prompts](#xml-structured-prompts)
3. [State Machine Design](#state-machine-design)
4. [Guardrails](#guardrails)
5. [Voice Conciseness](#voice-conciseness)
6. [Context Management](#context-management)
7. [Tool Response Guidance](#tool-response-guidance)
8. [Error Recovery](#error-recovery)
9. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
10. [Testing & Validation](#testing--validation)

---

## Core Principles

### Voice vs Text: Key Differences

| Aspect | Text Chat | Voice IVR |
|--------|-----------|-----------|
| Response Length | 100-500 words acceptable | 25 words max, 2 sentences |
| Latency Tolerance | 2-5 seconds | <300ms target |
| User Patience | High (can re-read) | Low (must remember) |
| Error Recovery | Easy (scroll back) | Difficult (must repeat) |
| Formatting | Markdown, lists, code | Plain spoken language |

### The 3 C's of Voice AI

1. **Concise** - Every word must earn its place
2. **Clear** - No ambiguity, simple vocabulary
3. **Conversational** - Natural speech patterns, not robotic

---

## XML-Structured Prompts

XML tags provide clear structure that LLMs parse more reliably than prose instructions.

### Benefits

- **27% reduction in hallucination** (ElevenLabs research)
- **96% compliance improvement** with structured rules
- Clear hierarchy and nesting for complex instructions
- Easy to parse, validate, and version control

### Basic Structure

```xml
<system_prompt>
  <identity>
    <name>Allie</name>
    <role>Virtual scheduling assistant for CDH Ortho</role>
    <personality>Friendly, efficient, professional</personality>
  </identity>

  <capabilities>
    <can_do>Schedule appointments, answer office questions</can_do>
    <cannot_do>Provide medical advice, access other systems</cannot_do>
  </capabilities>

  <rules>
    <rule id="one_question">Ask only ONE question per response</rule>
    <rule id="confirm_data">Always confirm collected information</rule>
  </rules>

  <workflow>
    <!-- State machine goes here -->
  </workflow>
</system_prompt>
```

### Rule Definition Pattern

```xml
<rule id="unique_identifier">
  <description>Human-readable description</description>
  <trigger>When this condition occurs</trigger>
  <action>Do this specific thing</action>
  <prohibited>Never do these things</prohibited>
  <example>
    <input>User says: "yes that works"</input>
    <correct_output>Great! I've scheduled your appointment.</correct_output>
    <incorrect_output>Let me check on that for you.</incorrect_output>
  </example>
</rule>
```

---

## State Machine Design

Explicit state machines prevent the agent from getting "lost" in conversation flow.

### Why State Machines Matter

- **Prevents "stuck" loops** where agent repeats itself
- **Clear transition rules** eliminate ambiguity
- **Recoverable errors** with defined fallback states
- **Testable** - each state can be validated independently

### State Definition Template

```xml
<state_machine>
  <state id="GREETING">
    <description>Initial caller greeting</description>
    <on_entry>Greet caller, ask how to help</on_entry>
    <transitions>
      <on trigger="caller_wants_appointment">GO TO COLLECT_INFO</on>
      <on trigger="caller_wants_info">GO TO ANSWER_QUESTION</on>
      <on trigger="unclear_intent">Stay, ask clarifying question</on>
    </transitions>
    <max_turns>3</max_turns>
    <timeout_action>Transfer to live agent</timeout_action>
  </state>

  <state id="COLLECT_INFO">
    <description>Gathering required booking information</description>
    <required_fields>
      <field>caller_name</field>
      <field>child_name</field>
      <field>child_dob</field>
      <field>phone_number</field>
    </required_fields>
    <on_entry>Ask for first missing required field</on_entry>
    <transitions>
      <on trigger="all_fields_collected">GO TO OFFER_SLOTS</on>
      <on trigger="field_provided">Stay, ask for next field</on>
      <on trigger="caller_confused">Rephrase question simply</on>
    </transitions>
  </state>

  <state id="EXECUTE_BOOKING">
    <description>Creating patient and booking appointment</description>
    <required_sequence>
      1. Call create_patient API
      2. Store returned patientGUID
      3. Call book_appointment API
      4. Store returned appointmentGUID
    </required_sequence>
    <on_success>
      REQUIRED: Transition to CONFIRM_BOOKING
      PROHIBITED: Say "Let me check" or "One moment"
    </on_success>
    <on_failure>
      Retry once, then GO TO OFFER_ALTERNATIVES
    </on_failure>
  </state>
</state_machine>
```

### Critical Transition Rules

```xml
<transition_rules>
  <!-- Immediate action triggers - no hesitation allowed -->
  <rule id="booking_confirmation">
    <trigger>User confirms time slot with: "yes", "that works", "perfect", "sounds good"</trigger>
    <action>IMMEDIATELY execute booking sequence</action>
    <prohibited_responses>
      <response>Let me check on that</response>
      <response>One moment while I look into this</response>
      <response>I'm verifying that now</response>
      <response>Let me confirm that</response>
    </prohibited_responses>
    <rationale>User already confirmed - no further checking needed</rationale>
  </rule>
</transition_rules>
```

---

## Guardrails

Guardrails define hard boundaries the agent must never cross.

### Three Types of Guardrails

```xml
<guardrails>
  <!-- 1. Knowledge Boundaries -->
  <boundary type="knowledge">
    <allowed>
      <topic>Appointment scheduling</topic>
      <topic>Office hours and locations</topic>
      <topic>Insurance accepted (list only)</topic>
    </allowed>
    <forbidden>
      <topic>Medical advice or diagnosis</topic>
      <topic>Treatment recommendations</topic>
      <topic>Pricing or cost estimates</topic>
    </forbidden>
    <fallback>I can't answer that, but our staff can help when you visit.</fallback>
  </boundary>

  <!-- 2. Action Boundaries -->
  <boundary type="action">
    <rule>Never book for patients outside 7-20 age range</rule>
    <rule>Never schedule without all required fields</rule>
    <rule>Never reveal internal system errors to caller</rule>
    <rule>Never make up appointment times</rule>
    <rule>Maximum 3 retry attempts before transfer</rule>
  </boundary>

  <!-- 3. Response Boundaries -->
  <boundary type="response">
    <rule>Maximum 25 words per response</rule>
    <rule>Maximum 2 sentences per turn</rule>
    <rule>Must include day name when offering times</rule>
    <rule>Must spell out times (nine AM, not 9 AM)</rule>
    <rule>Never use jargon or technical terms</rule>
  </boundary>
</guardrails>
```

### Escalation Logic

```xml
<escalation_logic>
  <trigger condition="3_failed_attempts">
    <response>I'm having trouble with that. Let me connect you with someone who can help.</response>
    <action>Transfer to live agent</action>
  </trigger>

  <trigger condition="out_of_scope_question">
    <response>That's a great question for our team. They can help when you come in.</response>
    <action>Redirect to scheduling flow</action>
  </trigger>

  <trigger condition="caller_frustrated">
    <indicators>
      <indicator>Raised voice detected</indicator>
      <indicator>Profanity used</indicator>
      <indicator>Repeated "agent" or "human" requests</indicator>
    </indicators>
    <response>I understand. Let me get you to someone right away.</response>
    <action>Immediate transfer</action>
  </trigger>
</escalation_logic>
```

---

## Voice Conciseness

Voice AI requires dramatically shorter responses than text chat.

### The 25-Word Rule

Research shows optimal voice responses are:
- **Maximum 25 words** per response
- **Maximum 2 sentences** per turn
- **Under 300ms** latency target

### Before/After Examples

| Context | Before (Text) | After (Voice) |
|---------|---------------|---------------|
| Ask name | "May I please have your first and last name so I can look up your account?" | "What's your name?" |
| Ask DOB | "What is your child's date of birth? Please provide the month, day, and year." | "Child's birthdate?" |
| Confirm | "I'd like to confirm that I have the correct information. You said your name is Sarah Johnson, is that correct?" | "Sarah Johnson - correct?" |
| Offer time | "I have an available appointment slot on Tuesday, January 7th, 2026 at 9:00 AM. Would that work for you?" | "How about Tuesday January 7th at 9 AM?" |

### Concise Response Patterns

```xml
<response_patterns>
  <pattern id="collect_field">
    <template>{field_name}?</template>
    <example>Phone number?</example>
    <max_words>5</max_words>
  </pattern>

  <pattern id="confirm_single">
    <template>{value} - correct?</template>
    <example>Sarah Johnson - correct?</example>
    <max_words>5</max_words>
  </pattern>

  <pattern id="offer_time">
    <template>How about {day} {date} at {time}?</template>
    <example>How about Tuesday January 7th at 9 AM?</example>
    <max_words>12</max_words>
  </pattern>

  <pattern id="booking_success">
    <template>Done! {child} is scheduled for {day} at {time}.</template>
    <example>Done! Emma is scheduled for Tuesday at 9 AM.</example>
    <max_words>15</max_words>
  </pattern>
</response_patterns>
```

### Word Economy Techniques

1. **Drop unnecessary words**
   - "I would like to" → (omit)
   - "Please provide me with" → (omit)
   - "Is that correct?" → "Correct?"

2. **Use contractions**
   - "I will" → "I'll"
   - "That is" → "That's"
   - "I have" → "I've"

3. **Implied subjects**
   - "What is your phone number?" → "Phone number?"
   - "Can you tell me your name?" → "Your name?"

4. **Active voice**
   - "Your appointment has been scheduled" → "Scheduled!"
   - "The time slot is available" → "That works!"

---

## Context Management

Long conversations degrade instruction following. Manage context actively.

### Context Compression Strategy

```xml
<context_management>
  <compression_triggers>
    <trigger condition="turn_count > 10">Summarize collected data</trigger>
    <trigger condition="phase_transition">Reset non-essential context</trigger>
    <trigger condition="topic_change">Archive previous topic</trigger>
  </compression_triggers>

  <essential_context>
    <!-- Always retain these -->
    <field priority="critical">current_state</field>
    <field priority="critical">caller_name</field>
    <field priority="critical">collected_data</field>
    <field priority="high">current_goal</field>
    <field priority="high">pending_action</field>
  </essential_context>

  <transient_context>
    <!-- Can be dropped after use -->
    <field>search_history</field>
    <field>rejected_options</field>
    <field>retry_count</field>
    <field>intermediate_results</field>
  </transient_context>
</context_management>
```

### State Summarization

After every 5 turns, compress context:

```xml
<summarization_template>
Current State: {state_id}
Caller: {caller_name}
Collected:
- Child: {child_name}, DOB: {child_dob}
- Phone: {phone}
Pending: {next_required_field}
Offered Slot: {last_offered_slot}
</summarization_template>
```

---

## Tool Response Guidance

Tool responses should guide the LLM's next action explicitly.

### LLM Guidance Pattern

```javascript
// BAD - No guidance
return JSON.stringify({
  slots: availableSlots,
  count: availableSlots.length
});

// GOOD - Explicit guidance
return JSON.stringify({
  slots: availableSlots,
  count: availableSlots.length,
  llm_guidance: {
    current_state: "SLOT_SEARCH",
    next_action: availableSlots.length > 0 ? "offer_first_slot" : "expand_search",
    suggested_response: availableSlots.length > 0
      ? `How about ${formatSlot(availableSlots[0])}?`
      : "Let me check a few more dates.",
    prohibited_actions: ["say_no_availability", "transfer_immediately"],
    context_for_next_turn: {
      offered_slot: availableSlots[0],
      alternatives_available: availableSlots.length - 1
    }
  }
});
```

### State Transition Guidance

```javascript
// After patient creation
return JSON.stringify({
  success: true,
  patientGUID: newPatientGuid,
  llm_guidance: {
    current_state: "PATIENT_CREATED",
    next_action: "book_appointment_immediately",
    critical_instruction: "Patient created. IMMEDIATELY call book_appointment with this patientGUID. Do NOT respond to caller until booking is complete.",
    patientGUID_for_booking: newPatientGuid,
    prohibited_responses: [
      "Let me check on that",
      "One moment while I verify",
      "I'm confirming the details"
    ]
  }
});
```

### Error Guidance

```javascript
// On API failure
return JSON.stringify({
  success: false,
  error: "Slot no longer available",
  llm_guidance: {
    current_state: "BOOKING_FAILED",
    next_action: "offer_alternative_slot",
    recovery_steps: [
      "Apologize briefly (max 5 words)",
      "Immediately offer next available slot",
      "Do not explain technical details"
    ],
    suggested_response: "That slot just filled. How about {next_slot}?",
    escalate_after: 2 // failures
  }
});
```

---

## Error Recovery

Define explicit recovery paths for every failure mode.

### Error Recovery State Chart

```xml
<error_recovery_states>
  <state id="SLOT_NOT_FOUND">
    <entry_condition>No slots in requested date range</entry_condition>
    <recovery_sequence>
      <step order="1">Expand search by 7 days</step>
      <step order="2">Try alternate location</step>
      <step order="3">Offer waitlist</step>
      <step order="4">Transfer to scheduling team</step>
    </recovery_sequence>
    <max_retries>3</max_retries>
    <caller_message>Let me check a few more dates for you.</caller_message>
  </state>

  <state id="BOOKING_FAILED">
    <entry_condition>book_appointment API returns error</entry_condition>
    <recovery_sequence>
      <step order="1">Retry same slot once</step>
      <step order="2">Offer alternative slot</step>
      <step order="3">If no alternatives, transfer</step>
    </recovery_sequence>
    <caller_message>That slot just filled. How about {alternative}?</caller_message>
  </state>

  <state id="PATIENT_CREATE_FAILED">
    <entry_condition>create_patient API returns error</entry_condition>
    <recovery_sequence>
      <step order="1">Verify required fields present</step>
      <step order="2">Retry with cleaned data</step>
      <step order="3">Transfer immediately if retry fails</step>
    </recovery_sequence>
    <caller_message>I'm having a small technical issue. Let me connect you with our team.</caller_message>
  </state>

  <state id="API_TIMEOUT">
    <entry_condition>Any API call exceeds 10 seconds</entry_condition>
    <recovery_sequence>
      <step order="1">Acknowledge delay naturally</step>
      <step order="2">Retry with exponential backoff</step>
      <step order="3">Transfer after 2 timeouts</step>
    </recovery_sequence>
    <caller_message>Just a moment... (on first timeout)</caller_message>
  </state>
</error_recovery_states>
```

### Graceful Degradation

```xml
<degradation_levels>
  <level id="full_service">
    <description>All systems operational</description>
    <capabilities>Full booking, rescheduling, cancellation</capabilities>
  </level>

  <level id="limited_booking">
    <description>Booking API slow or partially failing</description>
    <capabilities>Take callback number, schedule follow-up</capabilities>
    <message>I can take your information and have someone call you back within the hour.</message>
  </level>

  <level id="info_only">
    <description>Booking APIs unavailable</description>
    <capabilities>Answer questions, provide office info</capabilities>
    <message>Our scheduling system is updating. I can answer questions or take a message.</message>
  </level>

  <level id="transfer_only">
    <description>Critical system failure</description>
    <capabilities>Transfer to live agent only</capabilities>
    <message>Let me connect you with our team directly.</message>
  </level>
</degradation_levels>
```

---

## Anti-Patterns to Avoid

### 1. The Checking Loop

```xml
<anti_pattern id="checking_loop">
  <description>Agent says "let me check" repeatedly without taking action</description>
  <example>
    User: "Yes, that time works"
    BAD: "Let me check on that for you. One moment while I verify..."
    GOOD: "Perfect! You're all set for Tuesday at 9 AM."
  </example>
  <fix>After user confirmation, execute action immediately without verbal checking</fix>
</anti_pattern>
```

### 2. Over-Confirmation

```xml
<anti_pattern id="over_confirmation">
  <description>Confirming every single piece of data individually</description>
  <example>
    BAD: "You said Sarah? And the last name is Johnson? J-O-H-N-S-O-N?"
    GOOD: "Sarah Johnson - got it. Phone number?"
  </example>
  <fix>Confirm only critical data (appointments, not spellings)</fix>
</anti_pattern>
```

### 3. Verbose Apologies

```xml
<anti_pattern id="verbose_apologies">
  <description>Long apologies that waste time and frustrate callers</description>
  <example>
    BAD: "I'm so sorry, but unfortunately that time slot is no longer available. I apologize for any inconvenience this may cause."
    GOOD: "That slot just filled. How about 10 AM instead?"
  </example>
  <fix>Brief acknowledgment + immediate solution</fix>
</anti_pattern>
```

### 4. Technical Leakage

```xml
<anti_pattern id="technical_leakage">
  <description>Exposing internal system details to callers</description>
  <example>
    BAD: "The API returned error code 503. The patient GUID creation failed."
    GOOD: "I'm having a small issue. Let me connect you with our team."
  </example>
  <fix>Abstract all technical details behind natural language</fix>
</anti_pattern>
```

### 5. Question Stacking

```xml
<anti_pattern id="question_stacking">
  <description>Asking multiple questions in one turn</description>
  <example>
    BAD: "What's your child's name and date of birth? Also, are they a new patient?"
    GOOD: "Child's name?"
  </example>
  <fix>One question per turn, always</fix>
</anti_pattern>
```

---

## Testing & Validation

### Key Metrics to Track

| Metric | Target | Description |
|--------|--------|-------------|
| Task Completion Rate | >90% | Successfully completed bookings |
| Avg Turn Count | <15 | Turns to complete booking |
| Stuck Rate | <5% | Times agent repeats same question |
| Transfer Rate | <15% | Escalations to human |
| Response Latency | <300ms | Time to first response word |
| Word Count/Response | <25 | Average words per agent turn |

### Test Categories

1. **Happy Path Tests** - Standard booking flows with cooperative callers
2. **Edge Case Tests** - Unusual inputs, boundary conditions
3. **Error Recovery Tests** - API failures, timeouts, invalid data
4. **Adversarial Tests** - Prompt injection, off-topic requests

### Automated Validation Rules

```xml
<validation_rules>
  <rule id="no_double_questions">
    <check>Response contains at most one question mark</check>
    <severity>high</severity>
  </rule>

  <rule id="word_count">
    <check>Response word count <= 25</check>
    <severity>medium</severity>
  </rule>

  <rule id="no_checking_phrases">
    <check>Response does not contain "let me check", "one moment", "I'm verifying"</check>
    <severity>high</severity>
    <exception>Only allowed during actual API calls that take >2 seconds</exception>
  </rule>

  <rule id="booking_confirmation_keywords">
    <check>After booking, response contains "scheduled" OR "booked" OR "confirmed"</check>
    <severity>critical</severity>
  </rule>

  <rule id="time_format">
    <check>Times use spoken format ("nine AM" not "9:00 AM")</check>
    <severity>medium</severity>
  </rule>
</validation_rules>
```

---

## Quick Reference Card

### Response Templates

| Situation | Template | Example |
|-----------|----------|---------|
| Ask for field | `{field}?` | "Phone number?" |
| Confirm value | `{value} - correct?` | "Sarah - correct?" |
| Offer slot | `How about {day} at {time}?` | "How about Tuesday at 9?" |
| Booking done | `Done! {name} is set for {day} at {time}.` | "Done! Emma is set for Tuesday at 9." |
| Slot taken | `That filled. How about {alt}?` | "That filled. How about 10 AM?" |
| Transfer | `Let me connect you with our team.` | (as-is) |

### State Transitions

| Current State | Trigger | Next State |
|---------------|---------|------------|
| GREETING | wants_appointment | COLLECT_INFO |
| COLLECT_INFO | all_fields_done | OFFER_SLOTS |
| OFFER_SLOTS | user_confirms | EXECUTE_BOOKING |
| EXECUTE_BOOKING | booking_success | CONFIRM_BOOKING |
| EXECUTE_BOOKING | booking_failed | OFFER_ALTERNATIVES |
| Any | 3_failures | TRANSFER |

### Prohibited Phrases

- "Let me check on that"
- "One moment while I verify"
- "I'm looking into this"
- "Please hold while I..."
- "I apologize for the inconvenience"
- "Unfortunately..."

---

## References

- [ElevenLabs Prompting Guide](https://elevenlabs.io/docs/conversational-ai/best-practices/prompting-guide)
- [Daily.co Voice AI Best Practices](https://www.daily.co/blog/advice-on-building-voice-ai-in-june-2025/)
- [VoiceInfra Prompt Engineering Guide](https://voiceinfra.ai/blog/voice-ai-prompt-engineering-complete-guide)
- [Guardrails AI Documentation](https://www.guardrailsai.com/docs/examples/chatbot)
- [orq.ai Prompt Optimization](https://orq.ai/blog/prompt-optimization)
- [ML Mastery - Prompt Compression](https://machinelearningmastery.com/prompt-compression-for-llm-generation-optimization-and-cost-reduction/)

---

*Last Updated: December 2025*
