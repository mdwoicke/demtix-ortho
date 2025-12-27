/**
 * ============================================================================
 * CHORD SCHEDULING - Cloud9 Direct API Integration
 * ============================================================================
 * Calls Cloud9 XML APIs directly (no Node-RED intermediary)
 *
 * Actions:
 *   - slots: Get available appointment slots (GetOnlineReservations)
 *   - grouped_slots: Get slots for siblings (GetOnlineReservations + grouping)
 *   - book_child: Create appointment (SetAppointment)
 *   - cancel: Cancel appointment (SetAppointmentStatusCanceled)
 *
 * UPDATED: Stepwise date expansion - if no slots found, automatically
 *          expands search range by 10 days and retries (max 3 attempts)
 * ============================================================================
 */

const fetch = require('node-fetch');

// ============================================================================
// CLOUD9 API CONFIGURATION (Sandbox)
// ============================================================================

const CLOUD9 = {
    endpoint: 'https://us-ea1-partnertest.cloud9ortho.com/GetData.ashx',
    clientId: 'c15aa02a-adc1-40ae-a2b5-d2e39173ae56',
    userName: 'IntelepeerTest',
    password: '#!InteleP33rTest!#',
    namespace: 'http://schemas.practica.ws/cloud9/partners/',
    vendorUserName: 'IntelepeerTest',
    // ONLY hardcoded value - required for SetAppointment but not returned in slot data
    defaultApptTypeGUID: '8fc9d063-ae46-4975-a5ae-734c6efe341a'
    // NOTE: scheduleViewGUID and scheduleColumnGUID MUST come from live slot data
    // If missing, caller should be transferred to a live agent
};

// ============================================================================
// STEPWISE SEARCH CONFIGURATION
// ============================================================================

const STEPWISE_CONFIG = {
    maxAttempts: 3,           // Maximum number of search attempts
    expansionDays: 10,        // Days to add to endDate on each retry
    maxRangeDays: 196         // Cloud9 API limit: ~28 weeks from start
};

// ============================================================================
// RETRY CONFIGURATION (Network timeout handling)
// ============================================================================

const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ESOCKETTIMEDOUT', 'timeout', 'network']
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(error) {
    const errorMsg = (error.message || '').toLowerCase();
    const errorCode = error.code || '';
    return RETRY_CONFIG.retryableErrors.some(e =>
        errorMsg.includes(e.toLowerCase()) || errorCode.includes(e)
    );
}

async function callCloud9WithRetry(procedure, apiParams, attempt = 1) {
    const xmlRequest = buildXmlRequest(procedure, apiParams);
    console.log(`[chord_scheduling] Calling Cloud9: ${procedure} (attempt ${attempt}/${RETRY_CONFIG.maxRetries})`);

    try {
        const response = await fetch(CLOUD9.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/xml' },
            body: xmlRequest,
            timeout: 45000  // Increased timeout to 45 seconds
        });
        const xmlText = await response.text();
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return parseXmlResponse(xmlText);
    } catch (error) {
        // Check if we should retry
        if (attempt < RETRY_CONFIG.maxRetries && isRetryableError(error)) {
            const delay = Math.min(
                RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
                RETRY_CONFIG.maxDelayMs
            );
            console.log(`[chord_scheduling] Retryable error: ${error.message}. Retrying in ${delay}ms...`);
            await sleep(delay);
            return callCloud9WithRetry(procedure, apiParams, attempt + 1);
        }
        // Not retryable or max retries reached
        throw error;
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

    return `<?xml version="1.0" encoding="utf-8"?><GetDataRequest xmlns="${CLOUD9.namespace}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><ClientID>${CLOUD9.clientId}</ClientID><UserName>${CLOUD9.userName}</UserName><Password>${escapeXml(CLOUD9.password)}</Password><Procedure>${procedure}</Procedure><Parameters>${paramElements}</Parameters></GetDataRequest>`;
}

function parseXmlResponse(xmlText) {
    const statusMatch = xmlText.match(/<ResponseStatus>([^<]+)<\/ResponseStatus>/);
    const status = statusMatch ? statusMatch[1] : 'Unknown';

    if (status === 'Error' || status !== 'Success') {
        const errorMatch = xmlText.match(/<Result>([^<]+)<\/Result>/);
        if (errorMatch && (errorMatch[1].includes('Error') || errorMatch[1].includes('error'))) {
            throw new Error(errorMatch[1]);
        }
    }

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
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
}

function parseDate(dateStr) {
    // Parse MM/DD/YYYY format
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

function getDynamicDateRange() {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + 1);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 14);

    return {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
    };
}

function parseDateOrDefault(dateStr, isStart) {
    if (dateStr && dateStr.trim() !== '') {
        if (dateStr.includes(':')) return dateStr;
        return isStart ? `${dateStr} 7:00:00 AM` : `${dateStr} 5:00:00 PM`;
    }
    const dynamic = getDynamicDateRange();
    const date = isStart ? dynamic.startDate : dynamic.endDate;
    return isStart ? `${date} 7:00:00 AM` : `${date} 5:00:00 PM`;
}

function getDaysBetween(startDateStr, endDateStr) {
    const start = parseDate(startDateStr);
    const end = parseDate(endDateStr);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

function validateAndCorrectDates(startDateStr, endDateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let correctedStart = startDateStr;
    let correctedEnd = endDateStr;
    let wasDateCorrected = false;
    let correctionMessage = null;

    // Check if startDate is in the past
    if (startDateStr) {
        const startDate = parseDate(startDateStr);
        startDate.setHours(0, 0, 0, 0);

        if (startDate < today) {
            correctedStart = formatDate(tomorrow);
            wasDateCorrected = true;
            correctionMessage = `Requested date ${startDateStr} is in the past. Searching from ${correctedStart} instead.`;
            console.log(`[DATE VALIDATION] ${correctionMessage}`);
        }
    }

    // Check if endDate is before corrected startDate
    if (endDateStr && correctedStart) {
        const endDate = parseDate(endDateStr);
        const startDate = parseDate(correctedStart);

        if (endDate <= startDate) {
            // Set endDate to startDate + 14 days
            const newEnd = new Date(startDate);
            newEnd.setDate(newEnd.getDate() + 14);
            correctedEnd = formatDate(newEnd);
            wasDateCorrected = true;
        }
    }

    return {
        startDate: correctedStart,
        endDate: correctedEnd,
        wasDateCorrected,
        correctionMessage,
        currentDate: formatDate(today)
    };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function cleanParams(params) {
    const cleaned = {};
    for (const [key, value] of Object.entries(params)) {
        // Skip null/undefined
        if (value === null || value === undefined) continue;

        // For strings, check if empty or placeholder value
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed === '' ||
                trimmed.toUpperCase() === 'NULL' ||
                trimmed.toUpperCase() === 'NONE' ||
                trimmed.toUpperCase() === 'N/A' ||
                trimmed.toUpperCase() === 'UNDEFINED') {
                continue;
            }
        }

        cleaned[key] = value;
    }
    return cleaned;
}

function extractGuidFromResult(result, pattern) {
    if (!result) return null;
    const match = result.match(pattern);
    return match ? match[1] : null;
}

// ============================================================================
// GROUP SLOTS POST-PROCESSING
// ============================================================================

function groupConsecutiveSlots(slots, numberOfPatients, timeWindowMinutes) {
    if (!slots || slots.length === 0) return [];

    const duration = timeWindowMinutes || (numberOfPatients >= 3 ? 45 : 30);
    const sorted = [...slots].sort((a, b) => new Date(a.StartTime) - new Date(b.StartTime));
    const groups = [];

    for (let i = 0; i <= sorted.length - numberOfPatients; i++) {
        const group = [sorted[i]];
        let lastEnd = new Date(sorted[i].StartTime);
        lastEnd.setMinutes(lastEnd.getMinutes() + parseInt(sorted[i].Minutes || 30));

        for (let j = i + 1; j < sorted.length && group.length < numberOfPatients; j++) {
            const nextStart = new Date(sorted[j].StartTime);
            const gapMinutes = (nextStart - lastEnd) / 60000;

            if (gapMinutes >= 0 && gapMinutes <= 15 &&
                sorted[j].ScheduleViewGUID === sorted[i].ScheduleViewGUID) {
                group.push(sorted[j]);
                lastEnd = new Date(sorted[j].StartTime);
                lastEnd.setMinutes(lastEnd.getMinutes() + parseInt(sorted[j].Minutes || 30));
            }
        }

        if (group.length >= numberOfPatients) {
            groups.push({
                slots: group.slice(0, numberOfPatients),
                startTime: group[0].StartTime,
                scheduleViewGUID: group[0].ScheduleViewGUID,
                locationGUID: group[0].LocationGUID
            });
        }
    }
    return groups;
}

// ============================================================================
// STEPWISE SLOT SEARCH - Core new functionality
// ============================================================================

async function searchSlotsWithExpansion(startDate, endDate, scheduleViewGUIDs, toolName) {
    let currentEndDate = endDate;
    let attempt = 0;
    let lastError = null;
    const searchHistory = [];

    while (attempt < STEPWISE_CONFIG.maxAttempts) {
        attempt++;

        // Check if we've exceeded the max range
        const rangeDays = getDaysBetween(startDate, currentEndDate);
        if (rangeDays > STEPWISE_CONFIG.maxRangeDays) {
            console.log(`[${toolName}] Max range exceeded (${rangeDays} days > ${STEPWISE_CONFIG.maxRangeDays}). Stopping.`);
            break;
        }

        console.log(`[${toolName}] Attempt ${attempt}/${STEPWISE_CONFIG.maxAttempts}: Searching ${startDate} to ${currentEndDate}`);

        const apiParams = {
            startDate: parseDateOrDefault(startDate, true),
            endDate: parseDateOrDefault(currentEndDate, false),
            morning: 'True',
            afternoon: 'True',
            appttypGUIDs: CLOUD9.defaultApptTypeGUID
        };
        if (scheduleViewGUIDs) apiParams.schdvwGUIDs = scheduleViewGUIDs;

        try {
            // Use retry-enabled API call for network resilience
            const parsed = await callCloud9WithRetry('GetOnlineReservations', apiParams);

            searchHistory.push({
                attempt,
                startDate,
                endDate: currentEndDate,
                slotsFound: parsed.records.length
            });

            console.log(`[${toolName}] Attempt ${attempt}: Found ${parsed.records.length} slots`);

            // SUCCESS: Found slots, return them
            if (parsed.records.length > 0) {
                return {
                    success: true,
                    records: parsed.records,
                    searchRange: { startDate, endDate: currentEndDate },
                    attempts: attempt,
                    expanded: attempt > 1,
                    searchHistory
                };
            }

            // NO SLOTS: Expand the date range and retry
            console.log(`[${toolName}] No slots found. Expanding endDate by ${STEPWISE_CONFIG.expansionDays} days...`);
            currentEndDate = addDays(currentEndDate, STEPWISE_CONFIG.expansionDays);

        } catch (error) {
            console.error(`[${toolName}] Attempt ${attempt} error:`, error.message);
            lastError = error;

            searchHistory.push({
                attempt,
                startDate,
                endDate: currentEndDate,
                error: error.message
            });

            // On error, don't expand - this is likely an API issue, not a date issue
            break;
        }
    }

    // All attempts exhausted or error occurred
    return {
        success: false,
        records: [],
        searchRange: { startDate, endDate: currentEndDate },
        attempts: attempt,
        expanded: attempt > 1,
        searchHistory,
        error: lastError ? lastError.message : 'No slots found after all attempts'
    };
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function executeRequest() {
    const toolName = 'chord_dso_scheduling';
    const action = $action;

    console.log(`[${toolName}] Action: ${action}`);

    const validActions = ['slots', 'grouped_slots', 'book_child', 'cancel'];
    if (!action || !validActions.includes(action)) {
        throw new Error(`Invalid action '${action}'. Valid: ${validActions.join(', ')}`);
    }

    const rawParams = {
        startDate: typeof $startDate !== 'undefined' ? $startDate : null,
        endDate: typeof $endDate !== 'undefined' ? $endDate : null,
        scheduleViewGUIDs: typeof $scheduleViewGUIDs !== 'undefined' ? $scheduleViewGUIDs : null,
        numberOfPatients: typeof $numberOfPatients !== 'undefined' ? $numberOfPatients : null,
        timeWindowMinutes: typeof $timeWindowMinutes !== 'undefined' ? $timeWindowMinutes : null,
        patientGUID: typeof $patientGUID !== 'undefined' ? $patientGUID : null,
        startTime: typeof $startTime !== 'undefined' ? $startTime : null,
        scheduleViewGUID: typeof $scheduleViewGUID !== 'undefined' ? $scheduleViewGUID : null,
        scheduleColumnGUID: typeof $scheduleColumnGUID !== 'undefined' ? $scheduleColumnGUID : null,
        appointmentTypeGUID: typeof $appointmentTypeGUID !== 'undefined' ? $appointmentTypeGUID : null,
        minutes: typeof $minutes !== 'undefined' ? $minutes : null,
        providerGUID: typeof $providerGUID !== 'undefined' ? $providerGUID : null,
        locationGUID: typeof $locationGUID !== 'undefined' ? $locationGUID : null,
        appointmentGUID: typeof $appointmentGUID !== 'undefined' ? $appointmentGUID : null
    };
    const params = cleanParams(rawParams);

    try {
        switch (action) {
            case 'slots':
            case 'grouped_slots': {
                const dynamicDates = getDynamicDateRange();
                const requestedStart = params.startDate || dynamicDates.startDate;
                const requestedEnd = params.endDate || dynamicDates.endDate;

                // VALIDATE AND AUTO-CORRECT PAST DATES
                const dateValidation = validateAndCorrectDates(requestedStart, requestedEnd);
                const searchStartDate = dateValidation.startDate || dynamicDates.startDate;
                const searchEndDate = dateValidation.endDate || dynamicDates.endDate;

                console.log(`[${toolName}] Current date: ${dateValidation.currentDate}`);
                console.log(`[${toolName}] Requested: ${requestedStart} to ${requestedEnd}`);
                console.log(`[${toolName}] Searching: ${searchStartDate} to ${searchEndDate}`);
                if (dateValidation.wasDateCorrected) {
                    console.log(`[${toolName}] Date was corrected: ${dateValidation.correctionMessage}`);
                }

                // For grouped_slots, default to 2 patients if not provided (common sibling scenario)
                if (action === 'grouped_slots' && !params.numberOfPatients) {
                    params.numberOfPatients = 2;
                    console.log(`[${toolName}] numberOfPatients not provided, defaulting to 2`);
                }

                // Use stepwise expansion search
                const searchResult = await searchSlotsWithExpansion(
                    searchStartDate,
                    searchEndDate,
                    params.scheduleViewGUIDs,
                    toolName
                );

                if (action === 'slots') {
                    let message = searchResult.expanded
                        ? `Found ${searchResult.records.length} slots after expanding search to ${searchResult.searchRange.endDate}`
                        : `Found ${searchResult.records.length} slots`;
                    if (dateValidation.wasDateCorrected) {
                        message = `${dateValidation.correctionMessage} ${message}`;
                    }

                    // LLM Guidance: Help agent understand next action
                    const llmGuidance = {
                        current_state: "OFFER_SLOTS",
                        next_action: searchResult.records.length > 0
                            ? "offer_time_to_caller"
                            : (searchResult.attempts < 3 ? "expand_date_range" : "transfer_to_agent"),
                        instructions: searchResult.records.length > 0
                            ? "Present the first available slot to caller with day name and time. Wait for confirmation. On YES, immediately call book_child."
                            : "No slots found. Say 'Let me check a few more dates' and retry with expanded endDate.",
                        on_user_confirms: "IMMEDIATELY call chord_dso_patient action=create, then schedule_appointment_dso action=book_child. Do NOT say 'Let me check'.",
                        prohibited_responses: ["Let me check on that", "One moment while I look into this"]
                    };

                    return JSON.stringify({
                        slots: searchResult.records,
                        count: searchResult.records.length,
                        searchRange: searchResult.searchRange,
                        attempts: searchResult.attempts,
                        expanded: searchResult.expanded,
                        currentDate: dateValidation.currentDate,
                        dateWasCorrected: dateValidation.wasDateCorrected,
                        message: message,
                        llm_guidance: llmGuidance
                    });
                } else {
                    // grouped_slots
                    const groups = groupConsecutiveSlots(
                        searchResult.records,
                        parseInt(params.numberOfPatients),
                        params.timeWindowMinutes ? parseInt(params.timeWindowMinutes) : null
                    );
                    let message = searchResult.expanded
                        ? `Found ${groups.length} grouped options after expanding search to ${searchResult.searchRange.endDate}`
                        : `Found ${groups.length} grouped options`;
                    if (dateValidation.wasDateCorrected) {
                        message = `${dateValidation.correctionMessage} ${message}`;
                    }

                    // LLM Guidance for grouped slots
                    const llmGuidance = {
                        current_state: "OFFER_SLOTS",
                        next_action: groups.length > 0
                            ? "offer_grouped_times_to_caller"
                            : (searchResult.attempts < 3 ? "expand_date_range" : "transfer_to_agent"),
                        instructions: groups.length > 0
                            ? "Present consecutive slots for all children. State each child's time individually."
                            : "No grouped slots found. Say 'Let me check a few more dates' and retry.",
                        on_user_confirms: "IMMEDIATELY call chord_dso_patient action=create for EACH child, then book_child for EACH. Do NOT say 'Let me check'.",
                        prohibited_responses: ["Let me check on that", "One moment while I look into this"]
                    };

                    return JSON.stringify({
                        groups: groups,
                        count: groups.length,
                        numberOfPatients: params.numberOfPatients,
                        searchRange: searchResult.searchRange,
                        attempts: searchResult.attempts,
                        expanded: searchResult.expanded,
                        currentDate: dateValidation.currentDate,
                        dateWasCorrected: dateValidation.wasDateCorrected,
                        message: message,
                        llm_guidance: llmGuidance
                    });
                }
            }

            case 'book_child': {
                if (!params.patientGUID) throw new Error('patientGUID required');
                if (!params.startTime) throw new Error('startTime required (MM/DD/YYYY HH:MM AM)');

                // CRITICAL: scheduleViewGUID and scheduleColumnGUID MUST come from live slot data
                // These values are returned by GetOnlineReservations and must be extracted by LLM
                // If missing, we cannot proceed - transfer caller to live agent
                if (!params.scheduleViewGUID || !params.scheduleColumnGUID) {
                    console.log(`[${toolName}] MISSING REQUIRED DATA from slots response`);
                    console.log(`  scheduleViewGUID: ${params.scheduleViewGUID || 'MISSING'}`);
                    console.log(`  scheduleColumnGUID: ${params.scheduleColumnGUID || 'MISSING'}`);

                    return JSON.stringify({
                        success: false,
                        transfer_to_agent: true,
                        reason: 'missing_slot_data',
                        message: 'Unable to complete booking - required scheduling data is missing from slot response.',
                        llm_guidance: {
                            current_state: "TRANSFER_TO_AGENT",
                            next_action: "transfer_caller_to_live_agent",
                            required_response: "I apologize, but I'm having trouble completing your booking. Let me transfer you to one of our team members who can help you right away.",
                            transfer_reason: "Missing scheduleViewGUID or scheduleColumnGUID from slot data"
                        }
                    });
                }

                const scheduleViewGUID = params.scheduleViewGUID;
                const scheduleColumnGUID = params.scheduleColumnGUID;

                // AppointmentTypeGUID is the ONLY hardcoded value
                // SetAppointment requires it but GetOnlineReservations returns empty
                const appointmentTypeGUID = CLOUD9.defaultApptTypeGUID;

                if (params.appointmentTypeGUID && params.appointmentTypeGUID !== CLOUD9.defaultApptTypeGUID) {
                    console.log(`[${toolName}] WARNING: Ignoring LLM-provided appointmentTypeGUID "${params.appointmentTypeGUID}"`);
                    console.log(`[${toolName}] Using defaultApptTypeGUID: ${appointmentTypeGUID}`);
                }

                console.log(`[${toolName}] book_child with parameters:`);
                console.log(`  scheduleViewGUID: ${scheduleViewGUID} (from live slot data)`);
                console.log(`  scheduleColumnGUID: ${scheduleColumnGUID} (from live slot data)`);
                console.log(`  appointmentTypeGUID: ${appointmentTypeGUID} (hardcoded - only exception)`);

                const apiParams = {
                    PatientGUID: params.patientGUID,
                    StartTime: params.startTime,
                    ScheduleViewGUID: scheduleViewGUID,
                    ScheduleColumnGUID: scheduleColumnGUID,
                    AppointmentTypeGUID: appointmentTypeGUID,
                    Minutes: String(params.minutes || 45),
                    VendorUserName: CLOUD9.vendorUserName
                };

                // Use retry-enabled API call for network resilience
                const parsed = await callCloud9WithRetry('SetAppointment', apiParams);
                const apptResult = parsed.records[0]?.Result || '';
                const apptGUID = extractGuidFromResult(apptResult, /Appointment GUID Added:\s*([A-Fa-f0-9-]+)/i);
                const bookingSuccess = apptResult.includes('Added');

                // LLM Guidance: Direct agent to CONFIRM_BOOKING state
                const llmGuidance = {
                    current_state: bookingSuccess ? "CONFIRM_BOOKING" : "BOOKING_FAILED",
                    next_action: bookingSuccess
                        ? "confirm_booking_to_caller"
                        : "retry_or_offer_alternative",
                    required_response: bookingSuccess
                        ? "IMMEDIATELY confirm: 'Your appointment has been scheduled for [date] at [time].' MUST include 'scheduled' or 'booked' or 'confirmed' keyword."
                        : "Apologize briefly, offer to try another time slot. Do NOT say 'Let me check'.",
                    prohibited_responses: ["Let me check on that", "One moment while I look into this", "I'm verifying"],
                    booking_confirmed: bookingSuccess
                };

                return JSON.stringify({
                    success: bookingSuccess,
                    appointmentGUID: apptGUID,
                    message: apptResult,
                    llm_guidance: llmGuidance
                });
            }

            case 'cancel': {
                if (!params.appointmentGUID) throw new Error('appointmentGUID required');

                // Use retry-enabled API call for network resilience
                const parsed = await callCloud9WithRetry('SetAppointmentStatusCanceled', {
                    apptGUID: params.appointmentGUID
                });
                const cancelResult = parsed.records[0]?.Result || 'Cancellation processed';

                return JSON.stringify({
                    success: !cancelResult.toLowerCase().includes('error'),
                    message: cancelResult
                });
            }
        }

    } catch (error) {
        console.error(`[${toolName}] Error:`, error.message);

        // Check if this is a network/API failure that requires transfer to live agent
        const isNetworkError = isRetryableError(error) ||
            error.message.includes('timeout') ||
            error.message.includes('ETIMEDOUT') ||
            error.message.includes('ECONNRESET') ||
            error.message.includes('ENOTFOUND');

        if (isNetworkError) {
            return JSON.stringify({
                error: `Failed to execute ${action}`,
                message: error.message,
                transfer_to_agent: true,
                reason: 'api_failure',
                llm_guidance: {
                    current_state: "TRANSFER_TO_AGENT",
                    next_action: "transfer_caller_to_live_agent",
                    required_response: "I apologize, but I'm experiencing technical difficulties connecting to our scheduling system. Let me transfer you to one of our team members who can help you right away.",
                    transfer_reason: `API connection failed: ${error.message}`
                },
                action: action,
                timestamp: new Date().toISOString()
            });
        }

        return JSON.stringify({
            error: `Failed to execute ${action}`,
            message: error.message,
            action: action,
            timestamp: new Date().toISOString()
        });
    }
}

return executeRequest();
