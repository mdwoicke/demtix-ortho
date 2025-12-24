/**
 * ============================================================================
 * DIAGNOSTIC SCRIPT - Direct Tool Testing
 * ============================================================================
 * Tests Cloud9 API and Flowise tools directly to identify where failures occur
 *
 * Run: node diagnostic-tools.js
 * ============================================================================
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
    defaultLocationGUID: '1070d281-0952-4f01-9a6e-1a2e6926a7db',
    defaultApptTypeGUID: '8fc9d063-ae46-4975-a5ae-734c6efe341a'
};

const FLOWISE = {
    endpoint: 'https://app.c1elly.ai/api/v1/prediction/5f1fa57c-e6fd-463c-ac6e-c73fd5fb578b'
};

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
    return { status, records, raw: xmlText };
}

// ============================================================================
// DIRECT CLOUD9 API TESTS
// ============================================================================

async function testCloud9Direct(procedure, params, description) {
    console.log(`\n  Testing: ${description}`);
    console.log(`  Procedure: ${procedure}`);

    try {
        const xmlRequest = buildXmlRequest(procedure, params);
        const startTime = Date.now();

        const response = await fetch(CLOUD9.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/xml' },
            body: xmlRequest,
            timeout: 30000
        });

        const duration = Date.now() - startTime;
        const xmlText = await response.text();
        const parsed = parseXmlResponse(xmlText);

        if (parsed.status === 'Success') {
            console.log(`  ✅ SUCCESS (${duration}ms) - ${parsed.records.length} records`);
            return { success: true, data: parsed, duration };
        } else {
            console.log(`  ❌ FAILED - Status: ${parsed.status}`);
            console.log(`  Raw response: ${xmlText.substring(0, 500)}`);
            return { success: false, error: parsed.status, raw: xmlText };
        }
    } catch (error) {
        console.log(`  ❌ ERROR: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// FLOWISE CHATFLOW TEST
// ============================================================================

async function testFlowiseChatflow(message) {
    console.log(`\n  Testing Flowise with: "${message.substring(0, 50)}..."`);

    try {
        const startTime = Date.now();
        const response = await fetch(FLOWISE.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: message,
                overrideConfig: {
                    sessionId: `diag-${Date.now()}`
                }
            }),
            timeout: 60000
        });

        const duration = Date.now() - startTime;
        const data = await response.json();

        console.log(`  Response time: ${duration}ms`);
        console.log(`  Answer: ${(data.text || data.answer || 'No answer').substring(0, 200)}`);

        // Check if payload contains tool results
        if (data.json) {
            const payload = typeof data.json === 'string' ? JSON.parse(data.json) : data.json;
            console.log(`  Payload keys: ${Object.keys(payload).join(', ')}`);

            if (payload.Child1_patientGUID) {
                console.log(`  ✅ Patient GUID found: ${payload.Child1_patientGUID}`);
            }
            if (payload.telephonyTransferCall) {
                console.log(`  ⚠️  Transfer triggered: ${payload.telephonyTransferCall.reason}`);
            }
        }

        return { success: true, data, duration };
    } catch (error) {
        console.log(`  ❌ ERROR: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// DIAGNOSTIC TEST SUITE
// ============================================================================

async function runDiagnostics() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  DIAGNOSTIC TOOL TEST SUITE                                  ║');
    console.log('║  Testing Cloud9 API and Flowise Tools                        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    const results = {
        cloud9: {},
        flowise: {},
        summary: { passed: 0, failed: 0 }
    };

    // ========================================================================
    // SECTION 1: Direct Cloud9 API Tests
    // ========================================================================
    console.log('\n' + '═'.repeat(60));
    console.log('SECTION 1: Direct Cloud9 API Tests');
    console.log('═'.repeat(60));

    // Test 1.1: GetLocations
    results.cloud9.getLocations = await testCloud9Direct(
        'GetLocations',
        {},
        'Get all locations'
    );

    // Test 1.2: GetProviders (may return empty in sandbox)
    results.cloud9.getProviders = await testCloud9Direct(
        'GetProviders',
        {},
        'Get all providers'
    );

    // Test 1.3: GetOnlineReservations (Slots)
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const formatDate = (d) => {
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${month}/${day}/${d.getFullYear()}`;
    };

    results.cloud9.getSlots = await testCloud9Direct(
        'GetOnlineReservations',
        {
            startDate: `${formatDate(today)} 7:00:00 AM`,
            endDate: `${formatDate(nextWeek)} 5:00:00 PM`,
            morning: 'True',
            afternoon: 'True',
            appttypGUIDs: CLOUD9.defaultApptTypeGUID
        },
        `Get available slots (${formatDate(today)} - ${formatDate(nextWeek)})`
    );

    // Test 1.4: SetPatient (Create test patient)
    const testPatientName = `TestDiag_${Date.now()}`;
    results.cloud9.createPatient = await testCloud9Direct(
        'SetPatient',
        {
            patientFirstName: 'DiagTest',
            patientLastName: testPatientName,
            providerGUID: CLOUD9.defaultProviderGUID,
            locationGUID: CLOUD9.defaultLocationGUID,
            VendorUserName: CLOUD9.vendorUserName,
            birthdayDateTime: '2015-01-15T00:00:00'
        },
        'Create test patient'
    );

    // Extract patient GUID if created
    let testPatientGUID = null;
    if (results.cloud9.createPatient.success && results.cloud9.createPatient.data.records[0]) {
        const result = results.cloud9.createPatient.data.records[0].Result || '';
        const match = result.match(/Patient Added:\s*([A-Fa-f0-9-]+)/i);
        if (match) {
            testPatientGUID = match[1];
            console.log(`  📋 Created patient GUID: ${testPatientGUID}`);
        }
    }

    // Test 1.5: SetAppointment (if we have patient and slots)
    if (testPatientGUID && results.cloud9.getSlots.success && results.cloud9.getSlots.data.records.length > 0) {
        const slot = results.cloud9.getSlots.data.records[0];
        console.log(`\n  Using slot: ${slot.StartTime} at ${slot.ScheduleViewGUID}`);

        results.cloud9.createAppointment = await testCloud9Direct(
            'SetAppointment',
            {
                PatientGUID: testPatientGUID,
                StartTime: slot.StartTime,
                ScheduleViewGUID: slot.ScheduleViewGUID,
                ScheduleColumnGUID: slot.ScheduleColumnGUID,
                AppointmentTypeGUID: slot.AppointmentTypeGUID || CLOUD9.defaultApptTypeGUID,
                Minutes: slot.Minutes || '30',
                VendorUserName: CLOUD9.vendorUserName
            },
            'Create test appointment'
        );
    } else {
        console.log('\n  ⏭️  Skipping appointment creation (no patient or slots)');
        results.cloud9.createAppointment = { skipped: true };
    }

    // ========================================================================
    // SECTION 2: Flowise Chatflow Tests
    // ========================================================================
    console.log('\n' + '═'.repeat(60));
    console.log('SECTION 2: Flowise Chatflow Integration Tests');
    console.log('═'.repeat(60));

    // Test 2.1: Basic greeting
    results.flowise.greeting = await testFlowiseChatflow(
        'Hi, I need to schedule an appointment for my child'
    );

    // Test 2.2: Provide info and trigger patient lookup/creation
    results.flowise.patientFlow = await testFlowiseChatflow(
        'My name is Test Parent, phone 2155550000. My child is Test Child, born January 1, 2015. We have Keystone First insurance. I need a morning appointment.'
    );

    // ========================================================================
    // SECTION 3: Summary
    // ========================================================================
    console.log('\n' + '═'.repeat(60));
    console.log('DIAGNOSTIC SUMMARY');
    console.log('═'.repeat(60));

    console.log('\n📊 Cloud9 Direct API Results:');
    console.log('─'.repeat(40));

    const cloud9Tests = [
        { name: 'GetLocations', result: results.cloud9.getLocations },
        { name: 'GetProviders', result: results.cloud9.getProviders },
        { name: 'GetOnlineReservations (Slots)', result: results.cloud9.getSlots },
        { name: 'SetPatient (Create)', result: results.cloud9.createPatient },
        { name: 'SetAppointment (Book)', result: results.cloud9.createAppointment }
    ];

    for (const test of cloud9Tests) {
        if (test.result.skipped) {
            console.log(`  ⏭️  ${test.name}: SKIPPED`);
        } else if (test.result.success) {
            console.log(`  ✅ ${test.name}: PASSED (${test.result.duration}ms)`);
            results.summary.passed++;
        } else {
            console.log(`  ❌ ${test.name}: FAILED - ${test.result.error}`);
            results.summary.failed++;
        }
    }

    console.log('\n📊 Flowise Integration Results:');
    console.log('─'.repeat(40));

    if (results.flowise.greeting.success) {
        console.log(`  ✅ Greeting flow: Connected (${results.flowise.greeting.duration}ms)`);
        results.summary.passed++;
    } else {
        console.log(`  ❌ Greeting flow: FAILED`);
        results.summary.failed++;
    }

    if (results.flowise.patientFlow.success) {
        console.log(`  ✅ Patient flow: Connected (${results.flowise.patientFlow.duration}ms)`);
        results.summary.passed++;
    } else {
        console.log(`  ❌ Patient flow: FAILED`);
        results.summary.failed++;
    }

    // ========================================================================
    // SECTION 4: Diagnosis
    // ========================================================================
    console.log('\n' + '═'.repeat(60));
    console.log('DIAGNOSIS');
    console.log('═'.repeat(60));

    const issues = [];

    // Check slots availability
    if (results.cloud9.getSlots.success) {
        const slotCount = results.cloud9.getSlots.data.records.length;
        if (slotCount === 0) {
            issues.push('⚠️  NO SLOTS AVAILABLE in sandbox for the next 7 days');
            issues.push('   → This explains why booking fails - there are no appointment slots');
            issues.push('   → The sandbox may need slot configuration for current dates');
        } else {
            console.log(`\n✅ ${slotCount} appointment slots available in sandbox`);
        }
    } else {
        issues.push('❌ Cannot retrieve slots from Cloud9 API');
    }

    // Check patient creation
    if (!results.cloud9.createPatient.success) {
        issues.push('❌ Patient creation failed via direct API');
        issues.push(`   → Error: ${results.cloud9.createPatient.error}`);
    } else {
        console.log('✅ Patient creation works via direct API');
    }

    // Check appointment creation
    if (results.cloud9.createAppointment.skipped) {
        issues.push('⏭️  Appointment creation was skipped (no patient or slots)');
    } else if (results.cloud9.createAppointment.success) {
        console.log('✅ Appointment creation works via direct API');
    } else {
        issues.push('❌ Appointment creation failed via direct API');
    }

    if (issues.length > 0) {
        console.log('\n🔍 Issues Found:');
        issues.forEach(issue => console.log(`  ${issue}`));
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`Total: ${results.summary.passed} passed, ${results.summary.failed} failed`);
    console.log('═'.repeat(60));

    return results;
}

// ============================================================================
// RUN DIAGNOSTICS
// ============================================================================

runDiagnostics()
    .then(results => {
        console.log('\n✅ Diagnostics complete');
        process.exit(results.summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
        console.error('\n❌ Diagnostic script error:', error);
        process.exit(1);
    });
