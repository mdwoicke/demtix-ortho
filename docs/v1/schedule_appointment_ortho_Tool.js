/**
 * ============================================================================
 * CHORD SCHEDULING DSO - Appointment Scheduling Tool (Node Red Version)
 * ============================================================================
 * Actions: slots, grouped_slots, book_child, cancel
 *
 * This version calls Node Red endpoints instead of Cloud9 directly.
 * All Cloud9 XML/SOAP logic, stepwise search, and LLM guidance is handled by Node Red.
 * ============================================================================
 */

const fetch = require('node-fetch');

// ============================================================================
// 📝 ACTION CONFIGURATIONS
// ============================================================================

const BASE_URL = 'https://c1-aicoe-nodered-lb.prod.c1conversations.io/FabricWorkflow/api/chord';

const ACTIONS = {
    slots: {
        endpoint: `${BASE_URL}/ortho/getApptSlots`,
        method: 'POST',
        buildBody: (params, uui) => ({
            uui: uui,
            startDate: params.startDate,
            endDate: params.endDate,
            scheduleViewGUIDs: params.scheduleViewGUIDs
        }),
        validate: () => {},
        successLog: (data) => `Found ${data.count || (data.slots ? data.slots.length : 0) || 0} available slots`
    },
    grouped_slots: {
        endpoint: `${BASE_URL}/ortho/getGroupedApptSlots`,
        method: 'POST',
        buildBody: (params, uui) => ({
            uui: uui,
            startDate: params.startDate,
            endDate: params.endDate,
            numberOfPatients: params.numberOfPatients,
            timeWindowMinutes: params.timeWindowMinutes,
            scheduleViewGUIDs: params.scheduleViewGUIDs
        }),
        validate: (params) => {
            if (!params.numberOfPatients) {
                throw new Error("numberOfPatients is required for 'grouped_slots' action");
            }
        },
        successLog: (data) => `Found ${data.totalGroups || (data.groups ? data.groups.length : 0) || 0} grouped slot options`
    },
    book_child: {
        endpoint: `${BASE_URL}/ortho/createAppt`,
        method: 'POST',
        buildBody: (params, uui) => ({
            uui: uui,
            patientGUID: params.patientGUID,
            startTime: params.startTime,
            scheduleViewGUID: params.scheduleViewGUID,
            scheduleColumnGUID: params.scheduleColumnGUID,
            appointmentTypeGUID: params.appointmentTypeGUID,
            minutes: params.minutes,
            childName: params.childName
        }),
        validate: (params) => {
            if (!params.patientGUID) throw new Error("patientGUID is required for 'book_child' action");
            if (!params.startTime) throw new Error("startTime is required for 'book_child' action");
        },
        successLog: () => 'Appointment booked successfully'
    },
    cancel: {
        endpoint: `${BASE_URL}/ortho/cancelAppt`,
        method: 'POST',
        buildBody: (params, uui) => ({
            uui: uui,
            appointmentGUID: params.appointmentGUID
        }),
        validate: (params) => {
            if (!params.appointmentGUID) {
                throw new Error("appointmentGUID is required for 'cancel' action");
            }
        },
        successLog: () => 'Appointment cancelled successfully'
    }
};

// ============================================================================
// 🔐 AUTHENTICATION
// ============================================================================

function getAuthHeader() {
    try {
        const username = "workflowapi";
        const password = "e^@V95&6sAJReTsb5!iq39mIC4HYIV";
        if (username && password) {
            const credentials = Buffer.from(`${username}:${password}`).toString('base64');
            return `Basic ${credentials}`;
        }
    } catch (e) {
        return null;
    }
    return null;
}

// ============================================================================
// 🔍 ERROR DETECTION HELPER
// ============================================================================

function checkForError(data) {
    if (!data || typeof data !== 'object') return null;

    // Pattern 1: { success: false, error: "..." }
    if (data.success === false && !data.llm_guidance) {
        return data.error || data.message || 'Operation failed';
    }

    // Pattern 2: { code: false, error: [...] }
    if (data.code === false) {
        if (Array.isArray(data.error)) {
            return data.error.join(', ');
        }
        return data.error || data.message || 'API returned error';
    }

    // Pattern 3: { error: "..." } without success/code/slots/groups field
    if (data.error && !data.slots && !data.groups && !data.appointmentGUID && !data.llm_guidance) {
        if (Array.isArray(data.error)) {
            return data.error.join(', ');
        }
        return data.error;
    }

    return null;
}

// ============================================================================
// 🔧 PARAMETER CLEANER
// ============================================================================

function cleanParams(params) {
    const cleaned = {};
    for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined && value !== '' &&
            value !== 'NULL' && value !== 'null' && value !== 'None' &&
            value !== 'none' && value !== 'N/A' && value !== 'n/a') {
            cleaned[key] = value;
        }
    }
    return cleaned;
}

// ============================================================================
// 🚀 HTTP REQUEST ENGINE
// ============================================================================

async function executeRequest() {
    const toolName = 'schedule_appointment_ortho';
    const action = $action;
    const timeout = 60000; // Longer timeout for slot searches with retries

    console.log(`[${toolName}] Action: ${action}`);

    // Validate action
    if (!action || !ACTIONS[action]) {
        const validActions = Object.keys(ACTIONS).join(', ');
        throw new Error(`Invalid action '${action}'. Valid actions: ${validActions}`);
    }

    const config = ACTIONS[action];

    // Get UUI with fallback
    let uui;
    if (!$vars || !$vars.c1mg_uui || $vars.c1mg_uui === 'c1mg_uui' || (typeof $vars.c1mg_uui === 'string' && $vars.c1mg_uui.trim() === '')) {
        uui = '765381306-000000000001030525-SR-000-000000000000DAL130-026DE427|333725|421458314VO|2d411063-3769-4618-86d1-925d3578c112|FSV';
    } else {
        uui = $vars.c1mg_uui;
    }

    // Build params object from Flowise variables
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
        appointmentGUID: typeof $appointmentGUID !== 'undefined' ? $appointmentGUID : null,
        childName: typeof $childName !== 'undefined' ? $childName : null
    };
    const params = cleanParams(rawParams);

    try {
        // Validate required params for this action
        config.validate(params);

        const body = config.buildBody(params, uui);
        console.log(`[${toolName}] Endpoint: ${config.method} ${config.endpoint}`);
        console.log(`[${toolName}] Request Body:`, JSON.stringify(body, null, 2));

        const headers = {
            'Content-Type': 'application/json'
        };

        const authHeader = getAuthHeader();
        if (authHeader) {
            headers['Authorization'] = authHeader;
        }

        const options = {
            method: config.method,
            headers: headers,
            body: JSON.stringify(body)
        };

        // Add timeout
        let timeoutId;
        if (typeof AbortController !== 'undefined') {
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), timeout);
            options.signal = controller.signal;
        }

        console.log(`[${toolName}] Making request to Node Red...`);
        const response = await fetch(config.endpoint, options);

        if (timeoutId) clearTimeout(timeoutId);

        console.log(`[${toolName}] Response Status: ${response.status} ${response.statusText}`);

        let data;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        // Check HTTP status
        if (!response.ok) {
            console.error(`[${toolName}] HTTP Error ${response.status}:`, data);
            let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
            if (data) {
                const bodyError = checkForError(typeof data === 'string' ? (() => { try { return JSON.parse(data); } catch(e) { return data; } })() : data);
                if (bodyError) errorMsg = bodyError;
            }
            throw new Error(errorMsg);
        }

        // Parse response if string
        let responseData = data;
        if (typeof data === 'string') {
            try { responseData = JSON.parse(data); } catch (e) { responseData = data; }
        }

        // Check for error patterns in successful HTTP response
        const errorMessage = checkForError(responseData);
        if (errorMessage) {
            console.error(`[${toolName}] API Error:`, responseData);
            throw new Error(errorMessage);
        }

        const successMsg = typeof config.successLog === 'function' ? config.successLog(responseData) : config.successLog;
        console.log(`[${toolName}] ${successMsg}`);

        return JSON.stringify(responseData);

    } catch (error) {
        console.error(`[${toolName}] Error:`, error.message);

        if (error.name === 'AbortError') {
            error.message = `Request timeout after ${timeout}ms`;
        }

        // Check if this is a timeout or network error
        const isTimeout = ['timeout', 'aborted', 'ETIMEDOUT', 'ECONNRESET'].some(e =>
            error.message.toLowerCase().includes(e.toLowerCase()));

        // Return graceful error response with LLM guidance
        const errorResponse = {
            success: false,
            llm_guidance: {
                timestamp: new Date().toISOString(),
                error_type: isTimeout ? 'timeout' : 'api_error',
                voice_response: "I want to connect you with a specialist who can assist you. One moment while I transfer your call.",
                action_required: "transfer_to_agent",
                transfer_reason: isTimeout ? "scheduling_timeout" : "api_failure",
                CRITICAL: "Do NOT mention error, timeout, or system problems to caller. Transfer gracefully.",
                prohibited_responses: [
                    "error", "timeout", "problem", "issue", "failed",
                    "system is down", "technical difficulties", "something went wrong"
                ]
            }
        };

        return JSON.stringify(errorResponse);
    }
}

return executeRequest();
