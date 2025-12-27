# FRD Gap Analysis - V3 Implementation

**Analysis Date:** 2025-12-26
**Comparing:** `Chord_FRD.txt` vs `Chord_Cloud9_SystemPrompt_V3_ADVANCED.md`

---

## Executive Summary

After detailed analysis, **14 gaps** were identified between the FRD requirements and the V3 implementation. These are categorized by severity:

| Severity | Count | Description |
|----------|-------|-------------|
| **CRITICAL** | 3 | Missing functionality that breaks core flow |
| **HIGH** | 5 | Important requirements not fully addressed |
| **MEDIUM** | 4 | Nice-to-have features missing |
| **LOW** | 2 | Minor details not included |

---

## CRITICAL GAPS (Must Fix)

### GAP-001: Insurance Lookup Table Missing

**FRD Requirement:**
```
Insurance/Payments accepted
CDH Ortho Allegheny Insurances:
Medicaid:
- Aetna Better Health
- CHIP**
- AmeriHealth Caritas**
- Capital BC Chip
- Gateway
- Geisinger CHIP**
- Geisinger MA
- Health Partners**
- Keystone First**
- Kidz Partners**
- PA Medicaid
```

**V3 Status:** ❌ Missing - No insurance lookup table in prompt

**Impact:** Agent cannot accurately determine in-network vs out-of-network

**Recommended Fix:**
```xml
<insurance_lookup>
  <in_network>
    <provider>Aetna Better Health</provider>
    <provider>CHIP</provider>
    <provider>AmeriHealth Caritas</provider>
    <provider>Capital BC Chip</provider>
    <provider>Gateway</provider>
    <provider>Geisinger CHIP</provider>
    <provider>Geisinger MA</provider>
    <provider>Health Partners</provider>
    <provider>Keystone First</provider>
    <provider>Kidz Partners</provider>
    <provider>PA Medicaid</provider>
  </in_network>
  <action_on_match>Confirm in-network, proceed</action_on_match>
  <action_on_no_match>Disclose out-of-network, ask to proceed</action_on_no_match>
</insurance_lookup>
```

---

### GAP-002: Silence/No-Response Handling Missing

**FRD Requirement:**
```
Fallbacks:
Silence: "I didn't hear a response, If you still need assistance,
please give us a call back, goodbye" - end call / telephonyDisconnectCall
```

**V3 Status:** ❌ Missing - No silence fallback handling

**Impact:** Call hangs indefinitely if caller doesn't respond

**Recommended Fix:**
```xml
<fallback_handlers>
  <silence threshold_seconds="10">
    <response>I didn't hear a response. If you still need assistance, please give us a call back. Goodbye!</response>
    <action>telephonyDisconnectCall</action>
    <delay_seconds>2</delay_seconds>
  </silence>
  <repeated_silence count="2">
    <response>It seems we're having trouble connecting. Please call back when you're ready. Goodbye!</response>
    <action>telephonyDisconnectCall</action>
  </repeated_silence>
</fallback_handlers>
```

---

### GAP-003: Spelling Confirmation Loop Incomplete

**FRD Requirement:**
```
Ask for patients first and last name and ask them to spell it for you
and then you must confirm the spelling
```

**V3 Status:** ⚠️ Partial - Asks for spelling but doesn't emphasize confirmation

**Current V3 Flow:**
```
ALLIE: "Got it, Sarah Johnson. Can you spell that for me?"
USER: "S-A-R-A-H J-O-H-N-S-O-N"
ALLIE: "Perfect." → moves on
```

**Required Flow:**
```
ALLIE: "Got it, Sarah Johnson. Can you spell that for me?"
USER: "S-A-R-A-H J-O-H-N-S-O-N"
ALLIE: "That's S-A-R-A-H, J-O-H-N-S-O-N, correct?"
USER: "Yes"
ALLIE: "Perfect." → moves on
```

**Recommended Fix:** Add rule to TIER 2 CRITICAL:
```xml
<rule id="C6">After caller spells name/email, ALWAYS repeat spelling back for confirmation before proceeding.</rule>
```

---

## HIGH PRIORITY GAPS

### GAP-004: Intent Probing Questions Missing

**FRD Requirement:**
```
Ask probing questions:
"Are you calling for general dentistry or orthodontics?"
"Have any of your children been to any of our offices before?"
```

**V3 Status:** ⚠️ Partial - Asks about previous visits but not dentistry vs ortho

**Impact:** May waste time on non-ortho callers before detecting intent

**Recommended Fix:** Add to ELIGIBILITY state:
```
If intent unclear after greeting:
  Ask: "Are you calling about orthodontics, like braces?"
  If no/general dentistry → TRANSFER with reason "non_ortho"
```

---

### GAP-005: Legal Guardian Court Documentation

**FRD Requirement:**
```
If the legal guardian is not the parent, physical court documentation
must be with them at the time of the visit.
```

**V3 Status:** ❌ Missing - Only mentions "parent or guardian"

**Current V3:**
```
"A parent or guardian must be present. Paperwork will be emailed."
```

**Required:**
```
"A parent or legal guardian must be present. If the guardian is not the
parent, they'll need to bring court documentation to the visit.
Paperwork will be emailed."
```

---

### GAP-006: Paperwork Early Arrival Time

**FRD Requirement:**
```
If the New Patient Paperwork is not completed prior to the appointment,
you must arrive 20-30 minutes early to complete it in office.
```

**V3 Status:** ❌ Missing - Doesn't mention early arrival

**Recommended Fix:** Update CONFIRMATION state response:
```
"Paperwork will be emailed to you. If you can't complete it beforehand,
please arrive twenty to thirty minutes early to fill it out at the office."
```

---

### GAP-007: Insurance Card Reminder

**FRD Requirement:**
```
Ask for the Group # and Member ID if they have it handy, if not that
is fine, either way just remind the caller to bring their card to the appointment
```

**V3 Status:** ❌ Missing - Doesn't collect Group/Member ID or remind about card

**Recommended Fix:** Add to ACCOUNT state flow:
```
After insurance provider collected (if in-network):
  Ask: "Do you have the group number and member ID handy?"
  If yes → collect, then say: "Got it. Just a reminder to bring the card to the appointment."
  If no → say: "That's fine. Just remember to bring the card to the appointment."
```

---

### GAP-008: Hours of Operation Reference

**FRD Requirement:**
```
Hours of Operation:
Every other Monday – Friday 8:30a-4:30p
```

**V3 Status:** ❌ Missing - No hours reference for FAQ handling

**Impact:** Cannot answer "What are your hours?" questions

**Recommended Fix:** Add FAQ section:
```xml
<faq>
  <hours>Every other Monday through Friday, eight thirty AM to four thirty PM</hours>
  <address>2301 East Allegheny Avenue, Suite 300-M, Philadelphia</address>
  <parking>Park in the lot across the building marked Commonwealth Campus</parking>
  <phone>two six seven, five two nine, zero nine nine zero</phone>
</faq>
```

---

## MEDIUM PRIORITY GAPS

### GAP-009: Parking Information Missing

**FRD Requirement:**
```
Parking: They can park in the parking lot across the building
that reads Commonwealth Campus
```

**V3 Status:** ❌ Missing

**Recommended Fix:** Include in address offering:
```
"Would you like the address?"
If yes: "It's 2301 East Allegheny Avenue, Suite 300-M, in Philadelphia.
You can park in the lot across the building marked Commonwealth Campus."
```

---

### GAP-010: Specific Opening Greeting

**FRD Requirement:**
```
Opening Greeting: "Hi, my name is Allie, how may I help you today?"
```

**V3 Current:**
```
"Hi! I'm Allie. What can I help you with?"
```

**Analysis:** V3 version is more voice-optimized (shorter), but deviates from FRD spec.

**Recommendation:** Keep V3 version as it's better for TTS, but document deviation.

---

### GAP-011: Caller ID Confirmation

**FRD Requirement:**
```
Confirm caller id #
Variables: c1mg_variable_caller_id_number = c1mg_variable_caller_id_number
```

**V3 Status:** ⚠️ Partial - Uses phone number but doesn't confirm system caller ID

**Current V3:**
```
ALLIE: "Perfect. And your phone number is 215-555-1234?"
```

**Recommended:** Use system variable if available:
```
If c1mg_variable_caller_id_number exists:
  "I see you're calling from two one five, five five five, one two three four. Is that the best number to reach you?"
Else:
  "What's the best phone number to reach you?"
```

---

### GAP-012: Location URL Reference

**FRD Requirement:**
```
URL: https://childrensdentalhealth.com/locations/philadelphia-allegheny/
```

**V3 Status:** ❌ Missing - Cannot reference if caller asks

**Note:** URLs shouldn't be spoken in voice. Instead:
```
If caller asks for website:
  "You can find more information on our website. Just search for
  Children's Dental Health Philadelphia Allegheny."
```

---

## LOW PRIORITY GAPS

### GAP-013: Multi-Child Variable Naming

**FRD Requirement:**
```
Each patient should be saved in variable child 1, 2, 3, etc…
```

**V3 Status:** ✅ Implemented differently - Uses children array with index

**V3 Implementation:**
```json
"children": [
  { "index": 1, "name": "Emma Johnson", ... },
  { "index": 2, "name": "Jake Johnson", ... }
]
```

**Analysis:** V3 approach is cleaner for JSON. No change needed.

---

### GAP-014: Account Questions Consolidation for Siblings

**FRD Requirement:**
```
You can ask account questions together for the multi patients,
for example is the phone # the same for all patients,
is the email the same for all patients, etc…
```

**V3 Status:** ⚠️ Not explicitly documented

**Recommended:** Add to multi-child exemplar:
```
For multiple children:
  "Is the phone number the same for all the kids?"
  "Should I use the same email for everyone?"
```

---

## Implementation Priority Matrix

| Gap ID | Fix Complexity | Business Impact | Priority Score |
|--------|---------------|-----------------|----------------|
| GAP-001 | Medium | High | **P1** |
| GAP-002 | Low | Critical | **P1** |
| GAP-003 | Low | High | **P1** |
| GAP-004 | Low | Medium | **P2** |
| GAP-005 | Low | High | **P2** |
| GAP-006 | Low | Medium | **P2** |
| GAP-007 | Medium | Medium | **P2** |
| GAP-008 | Low | Medium | **P3** |
| GAP-009 | Low | Low | **P3** |
| GAP-010 | None | Low | **Skip** |
| GAP-011 | Medium | Low | **P3** |
| GAP-012 | Low | Low | **P4** |
| GAP-013 | None | None | **Skip** |
| GAP-014 | Low | Low | **P4** |

---

## Recommended V3.1 Updates

### Immediate (P1) - Add to V3 Prompt:

1. **Insurance lookup table** with in-network list
2. **Silence fallback handler** with specific message
3. **Spelling confirmation rule** in TIER 2

### Next Sprint (P2) - Add to V3 Prompt:

4. **Intent probing** for ortho vs general
5. **Court documentation disclosure** in confirmation
6. **Early arrival time** in paperwork notice
7. **Insurance card reminder** after collection

### Future (P3/P4) - Add to FAQ section:

8. **Hours of operation**
9. **Parking information**
10. **Caller ID confirmation** from system variable
11. **Website reference** (non-URL spoken form)

---

## Updated Character Budget

| Section | Current | After P1 Fixes | After All Fixes |
|---------|---------|----------------|-----------------|
| V3 Prompt | ~17,000 | ~18,500 | ~19,500 |
| Target | <20,000 | <20,000 | <20,000 |
| Status | ✅ | ✅ | ✅ |

---

*Generated by Claude Code - FRD Gap Analysis Session*
