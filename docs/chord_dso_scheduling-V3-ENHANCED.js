/**
 * ============================================================================
 * CHORD SCHEDULING V3 - Enhanced with Advanced LLM Guidance
 * ============================================================================
 *
 * PROMPTING TECHNIQUES USED:
 * 1. State Machine Integration - Returns next_state for prompt to use
 * 2. Chain-of-Action Guidance - Explicit action sequences
 * 3. Confirmation Detection - Pre-computed confirmation phrases
 * 4. Voice-First Responses - TTS-ready spoken text
 * 5. Prohibited Response Filtering - Explicit "never say" list
 *
 * ============================================================================
 */

const fetch = require('node-fetch');

// ============================================================================
// CLOUD9 API CONFIGURATION
// ============================================================================

const CLOUD9 = {
    endpoint: 'https://us-ea1-partnertest.cloud9ortho.com/GetData.ashx',
    clientId: 'c15aa02a-adc1-40ae-a2b5-d2e39173ae56',
    userName: 'IntelepeerTest',
    password: '#!InteleP33rTest!#',
    namespace: 'http://schemas.practica.ws/cloud9/partners/',
    vendorUserName: 'IntelepeerTest',
    defaultApptTypeGUID: '8fc9d063-ae46-4975-a5ae-734c6efe341a'
};

// ============================================================================
// STEPWISE SEARCH CONFIG
// ============================================================================

const STEPWISE_CONFIG = {
    maxAttempts: 2,           // Reduced from 3 to fit within timeout budget
    expansionDays: 10,
    maxRangeDays: 196,
    requestTimeoutMs: 25000   // 25s per request (allows 2 attempts within 60s budget)
};

// ============================================================================
// VOICE-FIRST RESPONSE TEMPLATES
// ============================================================================

const VOICE_TEMPLATES = {
    slotOffer: (time, day, date) =>
        `I have ${time} available on ${day}. Would that work?`,

    slotOfferMultiple: (slots) => {
        const first = slots[0];
        return `I have ${first.time} on ${first.day}. Does that work?`;
    },

    noSlotsExpanding: "Let me check a few more dates.",

    bookingConfirmed: (childName, day, date, time) =>
        `Your appointment is confirmed! ${childName}, ${day} ${date} at ${time}.`,

    transferOnFailure: "I want to connect you with a specialist who can assist you."
};

// ============================================================================
// CONFIRMATION DETECTION PATTERNS
// ============================================================================

const CONFIRMATION_PATTERNS = {
    affirmative: [
        'yes', 'yeah', 'yep', 'yup', 'sure', 'okay', 'ok', 'alright',
        'that works', 'works for me', 'perfect', 'sounds good', 'sounds great',
        'let\'s do it', 'let\'s do that', 'book it', 'go ahead', 'please',
        'that one', 'the first one', 'i\'ll take it', 'that\'s fine'
    ],
    negative: [
        'no', 'nope', 'not that', 'different', 'another', 'other times',
        'what else', 'anything else', 'later', 'earlier'
    ],
    goodbye: [
        'that\'s all', 'that\'s it', 'no thanks', 'i\'m good', 'i\'m all set',
        'goodbye', 'bye', 'nothing else', 'we\'re done', 'i\'m done'
    ]
};

// ============================================================================
// LLM GUIDANCE FACTORY
// ============================================================================

function createLlmGuidance(scenario, context = {}) {
    const baseGuidance = {
        timestamp: new Date().toISOString(),
        confirmation_triggers: CONFIRMATION_PATTERNS.affirmative,
        goodbye_triggers: CONFIRMATION_PATTERNS.goodbye,
        prohibited_responses: [
            "Let me check on that",
            "One moment while I look into this",
            "I'm verifying",
            "Would you like me to book this?",  // Never re-confirm after YES
            "Should I schedule this?",           // Never re-confirm after YES
            "sorry", "unfortunately", "error", "problem"
        ]
    };

    switch (scenario) {
        case 'slots_found':
            return {
                ...baseGuidance,
                current_state: "SCHEDULING",
                next_state: "SCHEDULING",
                action_required: "offer_time_to_caller",
                voice_response: VOICE_TEMPLATES.slotOffer(
                    context.firstSlot?.time,
                    context.firstSlot?.day,
                    context.firstSlot?.date
                ),
                chain_of_action: [
                    "1. Speak the time offer to caller",
                    "2. Wait for response",
                    "3. If affirmative → call chord_dso_patient action=create",
                    "4. Then IMMEDIATELY call book_child with patientGUID",
                    "5. Confirm booking to caller"
                ],
                on_user_confirms: {
                    action: "PROCEED_TO_BOOKING",
                    do_not_say: "Would you like to book?",
                    do_say: "Perfect! Let me get that booked."
                },
                on_user_declines: {
                    action: "OFFER_ALTERNATIVE",
                    do_say: "No problem. How about [next slot]?"
                }
            };

        case 'slots_not_found':
            return {
                ...baseGuidance,
                current_state: "SCHEDULING",
                next_state: context.attempts < 3 ? "SCHEDULING" : "TRANSFER",
                action_required: context.attempts < 3 ? "expand_and_retry" : "transfer_to_agent",
                voice_response: context.attempts < 3
                    ? VOICE_TEMPLATES.noSlotsExpanding
                    : VOICE_TEMPLATES.transferOnFailure,
                chain_of_action: context.attempts < 3 ? [
                    "1. Say: 'Let me check a few more dates.'",
                    "2. Call slots again with expanded endDate (+10 days)",
                    "3. Offer new slots if found"
                ] : [
                    "1. Say transfer phrase",
                    "2. Include transfer payload",
                    "3. Do NOT offer alternatives"
                ]
            };

        case 'booking_success':
            return {
                ...baseGuidance,
                current_state: "CONFIRMATION",
                next_state: "CONFIRMATION",
                action_required: "confirm_booking_to_caller",
                voice_response: VOICE_TEMPLATES.bookingConfirmed(
                    context.childName,
                    context.day,
                    context.date,
                    context.time
                ),
                required_keywords: ["scheduled", "booked", "confirmed", "all set"],
                chain_of_action: [
                    "1. Confirm booking with enthusiasm",
                    "2. State child name, day, date, time, location",
                    "3. Ask 'Would you like the address?'",
                    "4. Mention legal guardian requirement",
                    "5. Ask 'Anything else?'"
                ],
                never_do: [
                    "Ask for re-confirmation",
                    "Say 'Let me verify'",
                    "Delay the confirmation"
                ]
            };

        case 'booking_failed':
            return {
                ...baseGuidance,
                current_state: "SCHEDULING",
                next_state: context.canRetry ? "SCHEDULING" : "TRANSFER",
                action_required: context.canRetry ? "offer_alternative_slot" : "transfer_to_agent",
                voice_response: context.canRetry
                    ? "That time isn't available. How about [alternative]?"
                    : VOICE_TEMPLATES.transferOnFailure,
                chain_of_action: context.canRetry ? [
                    "1. Apologize briefly (without 'sorry')",
                    "2. Offer next available slot",
                    "3. Wait for response"
                ] : [
                    "1. Say transfer phrase",
                    "2. Include all collected data in transfer",
                    "3. End interaction"
                ]
            };

        case 'missing_slot_data':
            return {
                ...baseGuidance,
                current_state: "TRANSFER",
                next_state: "TRANSFER",
                action_required: "transfer_to_agent",
                transfer_reason: "missing_scheduling_data",
                voice_response: VOICE_TEMPLATES.transferOnFailure,
                chain_of_action: [
                    "1. Do NOT attempt to book",
                    "2. Say transfer phrase",
                    "3. Include all collected data"
                ]
            };

        default:
            return baseGuidance;
    }
}

// ============================================================================
// XML UTILITIES
// ============================================================================

function escapeXml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[<>&'"]/g, c => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
    }[c]));
}

function buildXmlRequest(procedure, params = {}) {
    const paramElements = Object.entries(params)
        .filter(([_, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`)
        .join('');

    return `<?xml version="1.0" encoding="utf-8"?><GetDataRequest xmlns="${CLOUD9.namespace}"><ClientID>${CLOUD9.clientId}</ClientID><UserName>${CLOUD9.userName}</UserName><Password>${escapeXml(CLOUD9.password)}</Password><Procedure>${procedure}</Procedure><Parameters>${paramElements}</Parameters></GetDataRequest>`;
}

function parseXmlResponse(xmlText) {
    const statusMatch = xmlText.match(/<ResponseStatus>([^<]+)<\/ResponseStatus>/);
    const status = statusMatch ? statusMatch[1] : 'Unknown';

    const records = [];
    const recordRegex = /<Record>([\s\S]*?)<\/Record>/g;
    let match;
    while ((match = recordRegex.exec(xmlText)) !== null) {
        const record = {};
        const fieldRegex = /<([A-Za-z0-9_]+)>([^<]*)<\/\1>/g;
        let fieldMatch;
        while ((fieldMatch = fieldRegex.exec(match[1])) !== null) {
            record[fieldMatch[1]] = fieldMatch[2];
        }
        records.push(record);
    }
    return { status, records };
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

function formatDate(d) {
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${month}/${day}/${d.getFullYear()}`;
}

function parseDate(dateStr) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
    }
    return new Date(dateStr);
}

function addDays(dateStr, days) {
    const date = parseDate(dateStr);
    date.setDate(date.getDate() + days);
    return formatDate(date);
}

function getDayName(dateStr) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[parseDate(dateStr).getDay()];
}

function formatSlotForVoice(slot) {
    const date = slot.StartTime.split(' ')[0];
    const time = slot.StartTime.split(' ').slice(1).join(' ');
    return {
        time: time,
        date: date,
        day: getDayName(date),
        raw: slot
    };
}

function validateAndCorrectDates(startDateStr, endDateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let correctedStart = startDateStr;
    let wasDateCorrected = false;

    if (startDateStr) {
        const startDate = parseDate(startDateStr);
        startDate.setHours(0, 0, 0, 0);
        if (startDate < today) {
            correctedStart = formatDate(tomorrow);
            wasDateCorrected = true;
        }
    }

    let correctedEnd = endDateStr;
    if (endDateStr && correctedStart) {
        const endDate = parseDate(endDateStr);
        const startDate = parseDate(correctedStart);
        if (endDate <= startDate) {
            const newEnd = new Date(startDate);
            newEnd.setDate(newEnd.getDate() + 14);
            correctedEnd = formatDate(newEnd);
        }
    }

    return { startDate: correctedStart, endDate: correctedEnd, wasDateCorrected };
}

// ============================================================================
// API CALL WITH RETRY
// ============================================================================

async function callCloud9WithRetry(procedure, apiParams, attempt = 1) {
    const xmlRequest = buildXmlRequest(procedure, apiParams);
    const maxAttempts = 2;  // Allow 2 attempts max to stay within timeout budget
    console.log(`[chord_scheduling_v3] ${procedure} attempt ${attempt}/${maxAttempts}`);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), STEPWISE_CONFIG.requestTimeoutMs);

        const response = await fetch(CLOUD9.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/xml' },
            body: xmlRequest,
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const xmlText = await response.text();
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return parseXmlResponse(xmlText);
    } catch (error) {
        const isRetryable = ['ETIMEDOUT', 'ECONNRESET', 'timeout', 'aborted', 'abort'].some(e =>
            error.message.toLowerCase().includes(e.toLowerCase()));

        if (attempt < maxAttempts && isRetryable) {
            console.log(`[chord_scheduling_v3] Retrying ${procedure} after ${1000 * attempt}ms`);
            await new Promise(r => setTimeout(r, 1000 * attempt));
            return callCloud9WithRetry(procedure, apiParams, attempt + 1);
        }

        // Return graceful error instead of throwing
        console.error(`[chord_scheduling_v3] ${procedure} failed after ${attempt} attempts: ${error.message}`);
        throw error;
    }
}

// ============================================================================
// STEPWISE SLOT SEARCH
// ============================================================================

async function searchSlotsWithExpansion(startDate, endDate) {
    let currentEndDate = endDate;
    let attempt = 0;
    let lastError = null;

    while (attempt < STEPWISE_CONFIG.maxAttempts) {
        attempt++;
        console.log(`[chord_scheduling_v3] Slot search attempt ${attempt}: ${startDate} to ${currentEndDate}`);

        try {
            const parsed = await callCloud9WithRetry('GetOnlineReservations', {
                startDate: `${startDate} 7:00:00 AM`,
                endDate: `${currentEndDate} 5:00:00 PM`,
                morning: 'True',
                afternoon: 'True',
                appttypGUIDs: CLOUD9.defaultApptTypeGUID
            });

            if (parsed.records.length > 0) {
                return {
                    success: true,
                    records: parsed.records,
                    attempts: attempt,
                    expanded: attempt > 1,
                    searchRange: { startDate, endDate: currentEndDate }
                };
            }

            // Expand and retry if no slots found
            currentEndDate = addDays(currentEndDate, STEPWISE_CONFIG.expansionDays);
        } catch (error) {
            lastError = error;
            console.error(`[chord_scheduling_v3] Slot search error on attempt ${attempt}: ${error.message}`);

            // On any error, return immediately with transfer guidance
            // (callCloud9WithRetry already handles retries internally)
            const isTimeout = ['timeout', 'aborted', 'ETIMEDOUT', 'ECONNRESET'].some(e =>
                error.message.toLowerCase().includes(e.toLowerCase()));

            return {
                success: false,
                records: [],
                attempts: attempt,
                errorType: isTimeout ? 'timeout' : 'api_error',
                // Note: error message NOT included to prevent LLM from exposing it
                shouldTransfer: true
            };
        }
    }

    return {
        success: false,
        records: [],
        attempts: attempt,
        shouldTransfer: attempt >= STEPWISE_CONFIG.maxAttempts
    };
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function executeRequest() {
    const action = $action;
    console.log(`[chord_scheduling_v3] Action: ${action}`);

    const params = {};
    ['startDate', 'endDate', 'scheduleViewGUIDs', 'numberOfPatients', 'timeWindowMinutes',
     'patientGUID', 'startTime', 'scheduleViewGUID', 'scheduleColumnGUID',
     'appointmentTypeGUID', 'minutes', 'providerGUID', 'locationGUID', 'appointmentGUID'
    ].forEach(p => {
        const val = eval(`typeof $${p} !== 'undefined' ? $${p} : null`);
        if (val && val !== 'null' && val !== 'NULL' && val !== '') params[p] = val;
    });

    try {
        switch (action) {
            case 'slots':
            case 'grouped_slots': {
                const dates = validateAndCorrectDates(
                    params.startDate || formatDate(new Date(Date.now() + 86400000)),
                    params.endDate || formatDate(new Date(Date.now() + 15 * 86400000))
                );

                const result = await searchSlotsWithExpansion(dates.startDate, dates.endDate);

                if (result.success && result.records.length > 0) {
                    // Format slots for voice
                    const voiceSlots = result.records.slice(0, 5).map(formatSlotForVoice);
                    const firstSlot = voiceSlots[0];

                    return JSON.stringify({
                        slots: result.records,
                        count: result.records.length,
                        voiceSlots: voiceSlots,
                        searchRange: result.searchRange,
                        attempts: result.attempts,
                        expanded: result.expanded,
                        llm_guidance: createLlmGuidance('slots_found', { firstSlot })
                    });
                } else if (result.shouldTransfer || result.errorType) {
                    // Error occurred - guide LLM to transfer gracefully
                    return JSON.stringify({
                        slots: [],
                        count: 0,
                        attempts: result.attempts,
                        llm_guidance: {
                            ...createLlmGuidance('slots_not_found', { attempts: STEPWISE_CONFIG.maxAttempts }),
                            action_required: "transfer_to_agent",
                            voice_response: "I want to connect you with a specialist who can assist you. One moment while I transfer your call.",
                            transfer_reason: result.errorType || "no_slots_after_retries",
                            // CRITICAL: Prevent LLM from mentioning the error
                            CRITICAL: "Do NOT mention error, timeout, or technical problems. Transfer gracefully without explanation.",
                            prohibited_responses: [
                                "error", "timeout", "problem", "issue", "technical",
                                "system", "down", "difficulties", "went wrong"
                            ]
                        }
                    });
                } else {
                    // No slots found but no error - offer to check more dates
                    return JSON.stringify({
                        slots: [],
                        count: 0,
                        attempts: result.attempts,
                        llm_guidance: createLlmGuidance('slots_not_found', {
                            attempts: result.attempts
                        })
                    });
                }
            }

            case 'book_child': {
                if (!params.patientGUID) throw new Error('patientGUID required');
                if (!params.startTime) throw new Error('startTime required');

                // Validate required slot data
                if (!params.scheduleViewGUID || !params.scheduleColumnGUID) {
                    return JSON.stringify({
                        success: false,
                        llm_guidance: createLlmGuidance('missing_slot_data')
                    });
                }

                const parsed = await callCloud9WithRetry('SetAppointment', {
                    PatientGUID: params.patientGUID,
                    StartTime: params.startTime,
                    ScheduleViewGUID: params.scheduleViewGUID,
                    ScheduleColumnGUID: params.scheduleColumnGUID,
                    AppointmentTypeGUID: CLOUD9.defaultApptTypeGUID,
                    Minutes: String(params.minutes || 45),
                    VendorUserName: CLOUD9.vendorUserName
                });

                const result = parsed.records[0]?.Result || '';
                const apptGUID = result.match(/Appointment GUID Added:\s*([A-Fa-f0-9-]+)/i)?.[1];
                const success = result.includes('Added');

                // Parse appointment details for voice
                const timeParts = params.startTime.split(' ');
                const date = timeParts[0];
                const time = timeParts.slice(1).join(' ');

                return JSON.stringify({
                    success: success,
                    appointmentGUID: apptGUID,
                    message: result,
                    llm_guidance: createLlmGuidance(success ? 'booking_success' : 'booking_failed', {
                        childName: params.childName || 'your child',
                        date: date,
                        time: time,
                        day: getDayName(date),
                        canRetry: !success
                    })
                });
            }

            case 'cancel': {
                if (!params.appointmentGUID) throw new Error('appointmentGUID required');
                const parsed = await callCloud9WithRetry('SetAppointmentStatusCanceled', {
                    apptGUID: params.appointmentGUID
                });
                return JSON.stringify({
                    success: !parsed.records[0]?.Result?.toLowerCase().includes('error'),
                    message: parsed.records[0]?.Result || 'Cancelled'
                });
            }

            default:
                throw new Error(`Invalid action: ${action}`);
        }
    } catch (error) {
        console.error(`[chord_scheduling_v3] Error:`, error.message);

        // Determine if this was a timeout/network error
        const isTimeout = ['timeout', 'aborted', 'ETIMEDOUT', 'ECONNRESET'].some(e =>
            error.message.toLowerCase().includes(e.toLowerCase()));

        // Return graceful guidance - NEVER expose raw error to caller
        return JSON.stringify({
            success: false,
            // Do NOT include raw error message - LLM should not expose this
            llm_guidance: {
                ...createLlmGuidance('booking_failed', { canRetry: false }),
                error_type: isTimeout ? 'timeout' : 'api_error',
                // Critical: Instruct LLM to handle gracefully
                voice_response: "I want to connect you with a specialist who can assist you. One moment while I transfer your call.",
                action_required: "transfer_to_agent",
                transfer_reason: isTimeout ? "scheduling_timeout" : "api_failure",
                // Explicit instruction to prevent error output
                CRITICAL: "Do NOT mention error, timeout, or system problems to caller. Transfer gracefully.",
                prohibited_responses: [
                    "error", "timeout", "problem", "issue", "failed",
                    "system is down", "technical difficulties", "something went wrong"
                ]
            }
        });
    }
}

return executeRequest();
