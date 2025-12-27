/**
 * chord_dso_patient-V3-ENHANCED.js
 *
 * Enhanced Patient Tool with Advanced LLM Guidance for IVA
 *
 * Features:
 * - Voice-first response templates (TTS-ready)
 * - State machine integration
 * - Chain-of-action guidance
 * - Confirmation detection patterns
 * - Graceful error recovery
 *
 * Architecture: Aligns with Chord_Cloud9_SystemPrompt_V3_ADVANCED.md
 */

const fetch = require('node-fetch');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CLOUD9 = {
    endpoint: 'https://us-ea1-partnertest.cloud9ortho.com/GetData.ashx',
    clientId: 'c15aa02a-adc1-40ae-a2b5-d2e39173ae56',
    userName: 'IntelepeerTest',
    password: '#!InteleP33rTest!#',
    namespace: 'http://schemas.practica.ws/cloud9/partners/',
    vendorUserName: 'IntelepeerTest',
    defaultProviderGUID: '79ec29fe-c315-4982-845a-0005baefb5a8',
    defaultLocationGUID: '1070d281-0952-4f01-9a6e-1a2e6926a7db'
};

const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ESOCKETTIMEDOUT', 'timeout', 'network']
};

// ============================================================================
// VOICE-FIRST RESPONSE TEMPLATES (TTS-Optimized)
// ============================================================================

const VOICE_TEMPLATES = {
    // Patient creation responses
    patientCreated: (firstName, lastName) =>
        `Got it. I have ${firstName} ${lastName} in the system.`,

    patientCreateFailed: () =>
        `I'm having a quick system moment. Let me try that again.`,

    // Lookup responses
    patientFound: (firstName, lastName) =>
        `I found ${firstName} ${lastName} in our records.`,

    noPatientFound: () =>
        `I don't see that patient in our system. Let me create a new record.`,

    multiplePatients: (count) =>
        `I found ${count} patients. Can you help me narrow it down?`,

    // Insurance responses
    insuranceSaved: () =>
        `Got it. I've noted your insurance information.`,

    // Appointment confirmation
    appointmentConfirmed: () =>
        `Your appointment has been confirmed.`,

    // Error recovery
    systemMoment: () =>
        `One sec while I pull that up.`,

    transferNeeded: () =>
        `Let me connect you with a specialist who can help.`
};

// ============================================================================
// CONFIRMATION DETECTION PATTERNS
// ============================================================================

const CONFIRMATION_PATTERNS = {
    affirmative: [
        'yes', 'yeah', 'yep', 'yup', 'sure', 'okay', 'ok',
        'that works', 'works for me', 'perfect', 'sounds good', 'sounds great',
        'let\'s do it', 'book it', 'go ahead', 'please', 'correct', 'right'
    ],
    negative: [
        'no', 'nope', 'different', 'another', 'wrong', 'not right',
        'that\'s not', 'incorrect', 'change', 'actually'
    ],
    goodbye: [
        'that\'s all', 'that\'s it', 'goodbye', 'bye', 'nothing else',
        'we\'re done', 'I\'m good', 'I\'m all set', 'no thanks'
    ]
};

// ============================================================================
// STATE MACHINE INTEGRATION
// ============================================================================

const STATES = {
    GREETING: 'GREETING',
    CALLER_INFO: 'CALLER_INFO',
    ELIGIBILITY: 'ELIGIBILITY',
    CHILD_INFO: 'CHILD_INFO',
    ACCOUNT: 'ACCOUNT',
    SCHEDULING: 'SCHEDULING',
    CONFIRMATION: 'CONFIRMATION',
    END: 'END',
    TRANSFER: 'TRANSFER'
};

// ============================================================================
// LLM GUIDANCE FACTORY
// ============================================================================

function createLlmGuidance(scenario, context = {}) {
    const baseGuidance = {
        confirmation_patterns: CONFIRMATION_PATTERNS,
        max_response_words: 30,
        one_question_rule: true,
        banned_words: ['sorry', 'unfortunately', 'cannot', 'error', 'problem', 'issue', 'failed']
    };

    const scenarios = {
        // Patient created successfully - proceed to booking
        patient_created: {
            current_state: STATES.SCHEDULING,
            next_state: STATES.SCHEDULING,
            action_required: 'BOOK_APPOINTMENT_IMMEDIATELY',
            voice_response: VOICE_TEMPLATES.patientCreated(context.firstName, context.lastName),
            chain_of_action: [
                '1. Patient record created - DO NOT speak yet',
                '2. IMMEDIATELY call chord_dso_scheduling action=book_child',
                '3. Pass patientGUID to booking call',
                '4. After booking confirms, THEN speak to caller',
                '5. Confirm appointment details in one sentence'
            ],
            prohibited_responses: [
                'Let me check on that',
                'One moment while I',
                'I\'m verifying',
                'Let me confirm your information',
                'Would you like me to book?'
            ],
            on_user_confirms: 'ALREADY_CONFIRMED - proceed with booking',
            patientGUID_for_booking: context.patientGUID,
            critical_instruction: 'DO NOT ask for confirmation. User already confirmed time slot. Create patient then book immediately.'
        },

        // Patient creation failed
        patient_create_failed: {
            current_state: STATES.CHILD_INFO,
            next_state: STATES.TRANSFER,
            action_required: 'RETRY_OR_TRANSFER',
            voice_response: VOICE_TEMPLATES.patientCreateFailed(),
            chain_of_action: [
                '1. Log error for debugging',
                '2. If first failure, retry with same parameters',
                '3. If second failure, offer graceful degradation',
                '4. If third failure, transfer to live agent'
            ],
            retry_guidance: {
                max_retries: 3,
                on_max_retries: 'TRANSFER',
                transfer_phrase: VOICE_TEMPLATES.transferNeeded()
            }
        },

        // Patient found in lookup
        patient_found: {
            current_state: STATES.ELIGIBILITY,
            next_state: STATES.TRANSFER,
            action_required: 'CHECK_EXISTING_PATIENT_ELIGIBILITY',
            voice_response: VOICE_TEMPLATES.patientFound(context.firstName, context.lastName),
            chain_of_action: [
                '1. Patient exists in system',
                '2. This is NOT a new patient',
                '3. Transfer for existing patient scheduling'
            ],
            transfer_reason: 'existing_patient',
            critical_instruction: 'Existing patients cannot book new patient consults. Must transfer.'
        },

        // No patient found - create new
        no_patient_found: {
            current_state: STATES.CHILD_INFO,
            next_state: STATES.ACCOUNT,
            action_required: 'CONTINUE_COLLECTION',
            voice_response: VOICE_TEMPLATES.noPatientFound(),
            chain_of_action: [
                '1. Patient not in system - this is good for new patient flow',
                '2. Continue collecting remaining information',
                '3. After all info collected, proceed to scheduling'
            ],
            next_data_needed: ['insurance', 'email', 'special_needs']
        },

        // Clinic info retrieved
        clinic_info: {
            current_state: STATES.ACCOUNT,
            next_state: STATES.SCHEDULING,
            action_required: 'STORE_LOCATION_DATA',
            voice_response: null, // No spoken response needed
            chain_of_action: [
                '1. Store locationGUID for booking',
                '2. Continue with scheduling flow'
            ],
            locationGUID: context.locationGUID,
            locationName: context.locationName
        },

        // Insurance saved
        insurance_saved: {
            current_state: STATES.ACCOUNT,
            next_state: STATES.SCHEDULING,
            action_required: 'CONTINUE_TO_SCHEDULING',
            voice_response: VOICE_TEMPLATES.insuranceSaved(),
            chain_of_action: [
                '1. Insurance noted in patient record',
                '2. Proceed to scheduling'
            ]
        },

        // Appointment confirmed
        appointment_confirmed: {
            current_state: STATES.CONFIRMATION,
            next_state: STATES.END,
            action_required: 'PROVIDE_CONFIRMATION',
            voice_response: VOICE_TEMPLATES.appointmentConfirmed(),
            chain_of_action: [
                '1. Appointment status updated',
                '2. Provide confirmation to caller',
                '3. Ask if anything else needed'
            ]
        }
    };

    return {
        ...baseGuidance,
        ...scenarios[scenario]
    };
}

// ============================================================================
// UTILITY FUNCTIONS
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

function cleanParams(params) {
    const cleaned = {};
    const nullValues = ['NULL', 'null', 'None', 'none', 'N/A', 'n/a', 'undefined'];

    for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined && value !== '' && !nullValues.includes(value)) {
            cleaned[key] = value;
        }
    }
    return cleaned;
}

function formatBirthdayForCloud9(dateStr) {
    if (!dateStr) return null;

    // Handle multiple formats
    // MM/DD/YYYY -> YYYY-MM-DDTHH:MM:SS
    // YYYY-MM-DD -> YYYY-MM-DDTHH:MM:SS

    let year, month, day;

    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length !== 3) return dateStr;
        [month, day, year] = parts;
    } else if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        [year, month, day] = parts;
    } else {
        return dateStr;
    }

    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`;
}

function extractGuidFromResult(result, pattern) {
    if (!result) return null;
    const match = result.match(pattern);
    return match ? match[1] : null;
}

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

// ============================================================================
// API CALL WITH RETRY
// ============================================================================

async function callCloud9WithRetry(procedure, apiParams, attempt = 1) {
    const xmlRequest = buildXmlRequest(procedure, apiParams);
    console.log(`[chord_patient_v3] Calling Cloud9: ${procedure} (attempt ${attempt}/${RETRY_CONFIG.maxRetries})`);

    try {
        const response = await fetch(CLOUD9.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/xml' },
            body: xmlRequest,
            timeout: 45000
        });

        const xmlText = await response.text();
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return parseXmlResponse(xmlText);

    } catch (error) {
        if (attempt < RETRY_CONFIG.maxRetries && isRetryableError(error)) {
            const delay = Math.min(
                RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
                RETRY_CONFIG.maxDelayMs
            );
            console.log(`[chord_patient_v3] Retryable error: ${error.message}. Retrying in ${delay}ms...`);
            await sleep(delay);
            return callCloud9WithRetry(procedure, apiParams, attempt + 1);
        }
        throw error;
    }
}

async function callCloud9(procedure, apiParams) {
    return callCloud9WithRetry(procedure, apiParams, 1);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function executeRequest() {
    const toolName = 'chord_patient_v3';
    const action = $action;
    console.log(`[${toolName}] Action: ${action}`);

    const validActions = ['lookup', 'get', 'create', 'appointments', 'clinic_info', 'edit_insurance', 'confirm_appointment'];
    if (!action || !validActions.includes(action)) {
        return JSON.stringify({
            error: `Invalid action '${action}'. Valid: ${validActions.join(', ')}`,
            llm_guidance: createLlmGuidance('patient_create_failed', {})
        });
    }

    const rawParams = {
        phoneNumber: typeof $phoneNumber !== 'undefined' ? $phoneNumber : null,
        filter: typeof $filter !== 'undefined' ? $filter : null,
        patientGUID: typeof $patientGUID !== 'undefined' ? $patientGUID : null,
        patientFirstName: typeof $patientFirstName !== 'undefined' ? $patientFirstName : null,
        patientLastName: typeof $patientLastName !== 'undefined' ? $patientLastName : null,
        birthdayDateTime: typeof $birthdayDateTime !== 'undefined' ? $birthdayDateTime : null,
        gender: typeof $gender !== 'undefined' ? $gender : null,
        emailAddress: typeof $emailAddress !== 'undefined' ? $emailAddress : null,
        providerGUID: typeof $providerGUID !== 'undefined' ? $providerGUID : null,
        locationGUID: typeof $locationGUID !== 'undefined' ? $locationGUID : null,
        insuranceProvider: typeof $insuranceProvider !== 'undefined' ? $insuranceProvider : null,
        insuranceGroupId: typeof $insuranceGroupId !== 'undefined' ? $insuranceGroupId : null,
        insuranceMemberId: typeof $insuranceMemberId !== 'undefined' ? $insuranceMemberId : null,
        appointmentId: typeof $appointmentId !== 'undefined' ? $appointmentId : null
    };
    const params = cleanParams(rawParams);

    try {
        let result;

        switch (action) {
            // ================================================================
            // LOOKUP - Check if patient exists
            // ================================================================
            case 'lookup': {
                if (!params.phoneNumber && !params.filter) {
                    throw new Error('phoneNumber or filter required');
                }

                const apiParams = {};
                if (params.locationGUID) apiParams.LocGUIDs = params.locationGUID;

                const parsed = await callCloud9('GetPatientList', apiParams);

                const searchPhone = params.phoneNumber ? params.phoneNumber.replace(/\D/g, '') : null;
                const searchName = params.filter ? params.filter.toLowerCase() : null;

                const filtered = parsed.records.filter(p => {
                    const patPhone = (p.PhoneNumber || p.CellPhone || p.HomePhone || '').replace(/\D/g, '');
                    if (searchPhone && patPhone.includes(searchPhone)) return true;
                    if (searchName) {
                        const fullName = `${p.PatientLastName || ''}, ${p.PatientFirstName || ''}`.toLowerCase();
                        const reverseName = `${p.PatientFirstName || ''} ${p.PatientLastName || ''}`.toLowerCase();
                        return fullName.includes(searchName) || reverseName.includes(searchName);
                    }
                    return false;
                });

                const hasMatches = filtered.length > 0;
                const firstMatch = filtered[0] || null;

                result = {
                    patients: filtered,
                    count: filtered.length,
                    llm_guidance: hasMatches
                        ? createLlmGuidance('patient_found', {
                            firstName: firstMatch?.PatientFirstName,
                            lastName: firstMatch?.PatientLastName
                        })
                        : createLlmGuidance('no_patient_found', {})
                };
                break;
            }

            // ================================================================
            // GET - Get patient details by GUID
            // ================================================================
            case 'get': {
                if (!params.patientGUID) throw new Error('patientGUID required');

                const parsed = await callCloud9('GetPatientInformation', { patguid: params.patientGUID });
                const patient = parsed.records[0] || null;

                result = {
                    patient: patient,
                    llm_guidance: patient
                        ? createLlmGuidance('patient_found', {
                            firstName: patient.PatientFirstName,
                            lastName: patient.PatientLastName
                        })
                        : createLlmGuidance('no_patient_found', {})
                };
                break;
            }

            // ================================================================
            // CREATE - Create new patient record
            // ================================================================
            case 'create': {
                if (!params.patientFirstName) throw new Error('patientFirstName required');
                if (!params.patientLastName) throw new Error('patientLastName required');

                const providerGUID = params.providerGUID || CLOUD9.defaultProviderGUID;
                const locationGUID = params.locationGUID || CLOUD9.defaultLocationGUID;

                console.log(`[${toolName}] Using providerGUID: ${providerGUID}`);
                console.log(`[${toolName}] Using locationGUID: ${locationGUID}`);

                const apiParams = {
                    patientFirstName: params.patientFirstName,
                    patientLastName: params.patientLastName,
                    providerGUID: providerGUID,
                    locationGUID: locationGUID,
                    VendorUserName: CLOUD9.vendorUserName
                };

                if (params.birthdayDateTime) apiParams.birthdayDateTime = formatBirthdayForCloud9(params.birthdayDateTime);
                if (params.phoneNumber) apiParams.phoneNumber = params.phoneNumber;
                if (params.emailAddress) apiParams.email = params.emailAddress;
                if (params.gender) apiParams.gender = params.gender;

                const parsed = await callCloud9('SetPatient', apiParams);
                const createResult = parsed.records[0]?.Result || '';
                const patientGUID = extractGuidFromResult(createResult, /Patient Added:\s*([A-Fa-f0-9-]+)/i);
                const patientCreated = createResult.includes('Added');

                result = {
                    success: patientCreated,
                    patientGUID: patientGUID,
                    message: createResult,
                    llm_guidance: patientCreated
                        ? createLlmGuidance('patient_created', {
                            firstName: params.patientFirstName,
                            lastName: params.patientLastName,
                            patientGUID: patientGUID
                        })
                        : createLlmGuidance('patient_create_failed', {})
                };

                console.log(`[${toolName}] Patient created: ${patientGUID}`);
                break;
            }

            // ================================================================
            // APPOINTMENTS - Get patient appointments
            // ================================================================
            case 'appointments': {
                if (!params.patientGUID) throw new Error('patientGUID required');

                const parsed = await callCloud9('GetAppointmentListByPatient', { patGUID: params.patientGUID });

                result = {
                    appointments: parsed.records,
                    count: parsed.records.length,
                    llm_guidance: {
                        current_state: STATES.CONFIRMATION,
                        action_required: 'DISPLAY_APPOINTMENTS',
                        voice_response: parsed.records.length > 0
                            ? `I found ${parsed.records.length} appointment${parsed.records.length > 1 ? 's' : ''} on file.`
                            : `I don't see any upcoming appointments.`
                    }
                };
                break;
            }

            // ================================================================
            // CLINIC_INFO - Get clinic/location information
            // ================================================================
            case 'clinic_info': {
                const parsed = await callCloud9('GetLocations', {});
                const locations = parsed.records;

                let matchedLocation = null;
                if (params.locationGUID) {
                    matchedLocation = locations.find(l =>
                        l.LocationGUID && l.LocationGUID.toLowerCase() === params.locationGUID.toLowerCase()
                    );
                }

                const location = matchedLocation || locations[0] || null;

                result = {
                    success: true,
                    locations: locations,
                    count: locations.length,
                    location: location,
                    matchType: matchedLocation ? 'guid' : 'default',
                    llm_guidance: createLlmGuidance('clinic_info', {
                        locationGUID: location?.LocationGUID,
                        locationName: location?.LocationName
                    })
                };
                break;
            }

            // ================================================================
            // EDIT_INSURANCE - Save insurance information
            // ================================================================
            case 'edit_insurance': {
                if (!params.patientGUID) throw new Error('patientGUID required');

                const insuranceNote = `=== Insurance Information ===\nProvider: ${params.insuranceProvider || 'N/A'}\nGroup ID: ${params.insuranceGroupId || 'N/A'}\nMember ID: ${params.insuranceMemberId || 'N/A'}\nUpdated: ${new Date().toISOString()}`;

                const parsed = await callCloud9('SetPatientComment', {
                    patGUID: params.patientGUID,
                    patComment: insuranceNote
                });

                const updateResult = parsed.records[0]?.Result || 'Insurance info saved';
                const success = !updateResult.toLowerCase().includes('error');

                result = {
                    success: success,
                    message: updateResult,
                    llm_guidance: createLlmGuidance('insurance_saved', {})
                };
                break;
            }

            // ================================================================
            // CONFIRM_APPOINTMENT - Confirm an existing appointment
            // ================================================================
            case 'confirm_appointment': {
                if (!params.appointmentId) throw new Error('appointmentId required');

                const parsed = await callCloud9('SetAppointmentStatusConfirmed', {
                    apptGUID: params.appointmentId
                });

                const confirmResult = parsed.records[0]?.Result || 'Appointment confirmed';
                const success = !confirmResult.toLowerCase().includes('error');

                result = {
                    success: success,
                    message: confirmResult,
                    llm_guidance: createLlmGuidance('appointment_confirmed', {})
                };
                break;
            }
        }

        return JSON.stringify(result);

    } catch (error) {
        console.error(`[${toolName}] Error:`, error.message);

        return JSON.stringify({
            error: `Failed to execute ${action}`,
            message: error.message,
            action: action,
            timestamp: new Date().toISOString(),
            llm_guidance: {
                current_state: STATES.TRANSFER,
                next_state: STATES.TRANSFER,
                action_required: 'HANDLE_ERROR_GRACEFULLY',
                voice_response: VOICE_TEMPLATES.systemMoment(),
                chain_of_action: [
                    '1. Acknowledge brief delay to caller',
                    '2. If network error, retry silently',
                    '3. If repeated failure, transfer to live agent'
                ],
                prohibited_responses: [
                    'There was an error',
                    'Something went wrong',
                    'The system failed'
                ],
                transfer_phrase: VOICE_TEMPLATES.transferNeeded(),
                max_retries_before_transfer: 3
            }
        });
    }
}

return executeRequest();
