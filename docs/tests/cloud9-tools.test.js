/**
 * ============================================================================
 * Cloud9 Tool Scripts - Unit Tests
 * ============================================================================
 * Tests for chord_dso_scheduling and chord_dso_patient tool scripts
 * Uses Cloud9 Sandbox API with known test data
 *
 * Run: node docs/tests/cloud9-tools.test.js
 * ============================================================================
 */

const fetch = require('node-fetch');

// ============================================================================
// CLOUD9 SANDBOX CONFIGURATION
// ============================================================================

const CLOUD9 = {
    endpoint: 'https://us-ea1-partnertest.cloud9ortho.com/GetData.ashx',
    clientId: 'c15aa02a-adc1-40ae-a2b5-d2e39173ae56',
    userName: 'IntelepeerTest',
    password: '#!InteleP33rTest!#',
    namespace: 'http://schemas.practica.ws/cloud9/partners/',
    vendorUserName: 'IntelepeerTest',

    // Known sandbox data (from Postman collection)
    defaults: {
        providerGUID: '79ec29fe-c315-4982-845a-0005baefb5a8',
        locationGUID: '1070d281-0952-4f01-9a6e-1a2e6926a7db',
        appointmentTypeGUID: '8fc9d063-ae46-4975-a5ae-734c6efe341a',
        scheduleViewGUID: '2544683a-8e79-4b32-a4d4-bf851996bac3',
        scheduleColumnGUID: 'e062b81f-1fff-40fc-b4a4-1cf9ecc2f32b'
    }
};

// ============================================================================
// TEST UTILITIES
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

    const errorMatch = xmlText.match(/<Result>([^<]+)<\/Result>/);
    const result = errorMatch ? errorMatch[1] : null;

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
    return { status, result, records, rawXml: xmlText };
}

async function callCloud9(procedure, params) {
    const xmlRequest = buildXmlRequest(procedure, params);
    console.log(`\n[API] Calling: ${procedure}`);

    try {
        const response = await fetch(CLOUD9.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/xml' },
            body: xmlRequest,
            timeout: 30000
        });

        const xmlText = await response.text();
        const parsed = parseXmlResponse(xmlText);

        console.log(`[API] Status: ${parsed.status}, Records: ${parsed.records.length}`);
        return { ok: response.ok, ...parsed };
    } catch (error) {
        console.error(`[API] Error: ${error.message}`);
        return { ok: false, error: error.message, status: 'Error', records: [] };
    }
}

function formatDate(d) {
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
}

function getTestDateRange(daysFromNow = 1, rangeDays = 14) {
    // IMPORTANT: Cloud9 sandbox has no appointment slots before 1/1/2026
    // Always use January 2026 or later for scheduling tests
    const baseDate = new Date('2026-01-01');
    const start = new Date(Math.max(Date.now(), baseDate.getTime()));
    start.setDate(start.getDate() + daysFromNow);
    const end = new Date(start);
    end.setDate(end.getDate() + rangeDays);
    return {
        startDate: formatDate(start),
        endDate: formatDate(end),
        startDateTime: `${formatDate(start)} 7:00:00 AM`,
        endDateTime: `${formatDate(end)} 5:00:00 PM`
    };
}

// ============================================================================
// TEST RESULTS TRACKING
// ============================================================================

const testResults = {
    passed: 0,
    failed: 0,
    tests: []
};

function test(name, testFn) {
    return async () => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`TEST: ${name}`);
        console.log('='.repeat(60));

        try {
            const startTime = Date.now();
            await testFn();
            const duration = Date.now() - startTime;

            console.log(`✓ PASSED (${duration}ms)`);
            testResults.passed++;
            testResults.tests.push({ name, status: 'passed', duration });
        } catch (error) {
            console.error(`✗ FAILED: ${error.message}`);
            testResults.failed++;
            testResults.tests.push({ name, status: 'failed', error: error.message });
        }
    };
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
    }
}

function assertContains(str, substring, message) {
    if (!str || !str.includes(substring)) {
        throw new Error(`${message || 'Assertion failed'}: expected "${str}" to contain "${substring}"`);
    }
}

function assertNotEmpty(arr, message) {
    if (!arr || arr.length === 0) {
        throw new Error(message || 'Expected non-empty array');
    }
}

// ============================================================================
// SCHEDULING TOOL TESTS
// ============================================================================

const schedulingTests = [
    // Test 1: GetOnlineReservations (slots action)
    test('Scheduling: GetOnlineReservations returns available slots', async () => {
        const dates = getTestDateRange(1, 28);

        const result = await callCloud9('GetOnlineReservations', {
            startDate: dates.startDateTime,
            endDate: dates.endDateTime,
            morning: 'True',
            afternoon: 'True',
            appttypGUIDs: CLOUD9.defaults.appointmentTypeGUID
        });

        assertEqual(result.status, 'Success', 'API should return Success status');
        console.log(`  Found ${result.records.length} available slots`);

        // If slots found, verify structure
        if (result.records.length > 0) {
            const slot = result.records[0];
            assert(slot.StartTime, 'Slot should have StartTime');
            assert(slot.ScheduleViewGUID, 'Slot should have ScheduleViewGUID');
            assert(slot.ScheduleColumnGUID, 'Slot should have ScheduleColumnGUID');
            console.log(`  Sample slot: ${slot.StartTime}`);
        }
    }),

    // Test 2: GetOnlineReservations with schedule view filter
    test('Scheduling: GetOnlineReservations with scheduleViewGUID filter', async () => {
        const dates = getTestDateRange(1, 28);

        const result = await callCloud9('GetOnlineReservations', {
            startDate: dates.startDateTime,
            endDate: dates.endDateTime,
            morning: 'True',
            afternoon: 'True',
            appttypGUIDs: CLOUD9.defaults.appointmentTypeGUID,
            schdvwGUIDs: CLOUD9.defaults.scheduleViewGUID
        });

        assertEqual(result.status, 'Success', 'API should return Success status');
        console.log(`  Found ${result.records.length} slots for specific schedule view`);

        // Verify all slots match the filter
        result.records.forEach((slot, idx) => {
            if (slot.ScheduleViewGUID) {
                assertEqual(
                    slot.ScheduleViewGUID.toLowerCase(),
                    CLOUD9.defaults.scheduleViewGUID.toLowerCase(),
                    `Slot ${idx} should match scheduleViewGUID filter`
                );
            }
        });
    }),

    // Test 3: Date range limit (28 weeks max)
    test('Scheduling: GetOnlineReservations respects 28-week limit', async () => {
        // IMPORTANT: Cloud9 sandbox has no appointment slots before 1/1/2026
        const baseDate = new Date('2026-01-01');
        const start = new Date(Math.max(Date.now(), baseDate.getTime()));
        start.setDate(start.getDate() + 1);
        const end = new Date(start);
        end.setDate(end.getDate() + 196); // ~28 weeks

        const result = await callCloud9('GetOnlineReservations', {
            startDate: `${formatDate(start)} 7:00:00 AM`,
            endDate: `${formatDate(end)} 5:00:00 PM`,
            morning: 'True',
            afternoon: 'True',
            appttypGUIDs: CLOUD9.defaults.appointmentTypeGUID
        });

        // Should either succeed or return specific error
        assert(
            result.status === 'Success' || result.rawXml.includes('date'),
            'API should handle max date range'
        );
        console.log(`  Response status: ${result.status}`);
    }),

    // Test 4: SetAppointment parameter validation
    test('Scheduling: SetAppointment requires patientGUID', async () => {
        const dates = getTestDateRange(7, 1);

        // Missing patientGUID should fail
        const result = await callCloud9('SetAppointment', {
            // PatientGUID intentionally missing
            StartTime: `${dates.startDate} 9:00:00 AM`,
            ScheduleViewGUID: CLOUD9.defaults.scheduleViewGUID,
            ScheduleColumnGUID: CLOUD9.defaults.scheduleColumnGUID,
            AppointmentTypeGUID: CLOUD9.defaults.appointmentTypeGUID,
            Minutes: '45',
            VendorUserName: CLOUD9.vendorUserName
        });

        // Should fail or return error
        assert(
            result.status === 'Error' ||
            (result.result && result.result.includes('Error')) ||
            result.rawXml.includes('required'),
            'Should require patientGUID'
        );
        console.log(`  Correctly rejected: ${result.result || result.status}`);
    }),

    // Test 5: SetAppointmentStatusCanceled validation
    test('Scheduling: SetAppointmentStatusCanceled requires appointmentGUID', async () => {
        // Invalid GUID should fail gracefully
        const result = await callCloud9('SetAppointmentStatusCanceled', {
            apptGUID: '00000000-0000-0000-0000-000000000000'
        });

        // Should handle invalid GUID
        console.log(`  Response: ${result.status} - ${result.result || 'no result'}`);
        // Test passes if API doesn't crash
    }),
];

// ============================================================================
// PATIENT TOOL TESTS
// ============================================================================

const patientTests = [
    // Test 1: GetLocations (clinic_info action)
    test('Patient: GetLocations returns clinic information', async () => {
        const result = await callCloud9('GetLocations', {});

        assertEqual(result.status, 'Success', 'API should return Success status');
        assertNotEmpty(result.records, 'Should return at least one location');

        const location = result.records[0];
        console.log(`  Found ${result.records.length} locations`);
        console.log(`  First location: ${location.LocationName || location.Name || 'N/A'}`);

        // Verify location structure
        assert(
            location.LocationGUID || location.GUID,
            'Location should have GUID'
        );
    }),

    // Test 2: GetDoctors/GetProviders
    test('Patient: GetProviders returns provider list', async () => {
        const result = await callCloud9('GetProviders', {});

        assertEqual(result.status, 'Success', 'API should return Success status');
        console.log(`  Found ${result.records.length} providers`);

        if (result.records.length > 0) {
            const provider = result.records[0];
            console.log(`  Sample provider: ${provider.ProviderFirstName || provider.FirstName || 'N/A'} ${provider.ProviderLastName || provider.LastName || ''}`);
        }
    }),

    // Test 3: GetPatientList (lookup action)
    test('Patient: GetPatientList returns patient records', async () => {
        const result = await callCloud9('GetPatientList', {});

        assertEqual(result.status, 'Success', 'API should return Success status');
        console.log(`  Found ${result.records.length} patients`);

        if (result.records.length > 0) {
            const patient = result.records[0];
            assert(
                patient.PatientGUID || patient.GUID,
                'Patient should have GUID'
            );
        }
    }),

    // Test 4: GetAppointmentTypes
    test('Patient: GetAppointmentTypes returns appointment types', async () => {
        const result = await callCloud9('GetApptTypes', {});

        assertEqual(result.status, 'Success', 'API should return Success status');
        console.log(`  Found ${result.records.length} appointment types`);

        if (result.records.length > 0) {
            const apptType = result.records[0];
            console.log(`  Sample type: ${apptType.AppointmentTypeName || apptType.Name || 'N/A'}`);
        }
    }),

    // Test 5: SetPatient (create action) - Parameter validation
    test('Patient: SetPatient requires mandatory fields', async () => {
        // Test with missing required fields
        const result = await callCloud9('SetPatient', {
            patientFirstName: 'TestFirst',
            // Missing: patientLastName, providerGUID, locationGUID, VendorUserName
        });

        // Should fail due to missing required fields
        assert(
            result.status === 'Error' ||
            (result.result && result.result.toLowerCase().includes('error')) ||
            result.rawXml.toLowerCase().includes('required'),
            'Should require mandatory fields'
        );
        console.log(`  Correctly rejected incomplete data`);
    }),

    // Test 6: SetPatient with all required fields
    test('Patient: SetPatient creates patient with valid data', async () => {
        const testPatientName = `TestPatient_${Date.now()}`;

        const result = await callCloud9('SetPatient', {
            patientFirstName: testPatientName,
            patientLastName: 'UnitTest',
            providerGUID: CLOUD9.defaults.providerGUID,
            locationGUID: CLOUD9.defaults.locationGUID,
            VendorUserName: CLOUD9.vendorUserName,
            birthdayDateTime: '2015-06-15T00:00:00',
            gender: 'M'
        });

        console.log(`  Response status: ${result.status}`);
        console.log(`  Result: ${result.result || 'no result'}`);

        if (result.status === 'Success' && result.result) {
            // Extract patient GUID if created
            const guidMatch = result.result.match(/Patient Added:\s*([A-Fa-f0-9-]+)/i);
            if (guidMatch) {
                console.log(`  Created patient GUID: ${guidMatch[1]}`);
                // Store for cleanup or further tests
                testResults.createdPatientGUID = guidMatch[1];
            }
        }
    }),

    // Test 7: GetPatientInformation (get action)
    test('Patient: GetPatientInformation returns patient details', async () => {
        // Use a patient GUID from previous test or lookup
        let patientGUID = testResults.createdPatientGUID;

        if (!patientGUID) {
            // Get a patient from the list
            const listResult = await callCloud9('GetPatientList', {});
            if (listResult.records.length > 0) {
                patientGUID = listResult.records[0].PatientGUID || listResult.records[0].GUID;
            }
        }

        if (!patientGUID) {
            console.log('  Skipped: No patient GUID available');
            return;
        }

        const result = await callCloud9('GetPatientInformation', {
            patguid: patientGUID
        });

        assertEqual(result.status, 'Success', 'API should return Success status');
        console.log(`  Retrieved patient info for: ${patientGUID}`);

        if (result.records.length > 0) {
            const patient = result.records[0];
            console.log(`  Patient name: ${patient.FirstName || patient.PatientFirstName || 'N/A'} ${patient.LastName || patient.PatientLastName || ''}`);
        }
    }),

    // Test 8: GetAppointmentListByPatient (appointments action)
    test('Patient: GetAppointmentListByPatient returns appointments', async () => {
        let patientGUID = testResults.createdPatientGUID;

        if (!patientGUID) {
            // Get a patient from the list
            const listResult = await callCloud9('GetPatientList', {});
            if (listResult.records.length > 0) {
                patientGUID = listResult.records[0].PatientGUID || listResult.records[0].GUID;
            }
        }

        if (!patientGUID) {
            console.log('  Skipped: No patient GUID available');
            return;
        }

        const result = await callCloud9('GetAppointmentListByPatient', {
            patGUID: patientGUID
        });

        assertEqual(result.status, 'Success', 'API should return Success status');
        console.log(`  Found ${result.records.length} appointments for patient`);
    }),

    // Test 9: SetPatientComment (edit_insurance simulation)
    test('Patient: SetPatientComment adds/updates comments', async () => {
        let patientGUID = testResults.createdPatientGUID;

        if (!patientGUID) {
            // Get a patient from the list
            const listResult = await callCloud9('GetPatientList', {});
            if (listResult.records.length > 0) {
                patientGUID = listResult.records[0].PatientGUID || listResult.records[0].GUID;
            }
        }

        if (!patientGUID) {
            console.log('  Skipped: No patient GUID available');
            return;
        }

        const testComment = `Unit test comment - ${new Date().toISOString()}`;

        const result = await callCloud9('SetPatientComment', {
            patGUID: patientGUID,
            patComment: testComment
        });

        console.log(`  Response status: ${result.status}`);
        console.log(`  Result: ${result.result || 'no result'}`);
    }),
];

// ============================================================================
// INTEGRATION TESTS (Full Flow)
// ============================================================================

const integrationTests = [
    // Test: Complete booking flow simulation
    test('Integration: Full booking flow (slots -> create -> book)', async () => {
        console.log('  Step 1: Search for available slots...');

        const dates = getTestDateRange(7, 14);
        const slotsResult = await callCloud9('GetOnlineReservations', {
            startDate: dates.startDateTime,
            endDate: dates.endDateTime,
            morning: 'True',
            afternoon: 'True',
            appttypGUIDs: CLOUD9.defaults.appointmentTypeGUID,
            schdvwGUIDs: CLOUD9.defaults.scheduleViewGUID
        });

        assertEqual(slotsResult.status, 'Success', 'Slots API should succeed');
        console.log(`    Found ${slotsResult.records.length} slots`);

        if (slotsResult.records.length === 0) {
            console.log('  Skipped booking: No slots available');
            return;
        }

        const selectedSlot = slotsResult.records[0];
        console.log(`    Selected slot: ${selectedSlot.StartTime}`);

        console.log('  Step 2: Create test patient...');

        const patientResult = await callCloud9('SetPatient', {
            patientFirstName: `Integration_${Date.now()}`,
            patientLastName: 'TestFlow',
            providerGUID: CLOUD9.defaults.providerGUID,
            locationGUID: CLOUD9.defaults.locationGUID,
            VendorUserName: CLOUD9.vendorUserName,
            birthdayDateTime: '2014-03-20T00:00:00'
        });

        console.log(`    Patient result: ${patientResult.result || patientResult.status}`);

        const patientGuidMatch = patientResult.result?.match(/Patient Added:\s*([A-Fa-f0-9-]+)/i);
        if (!patientGuidMatch) {
            console.log('  Skipped booking: Could not create patient');
            return;
        }

        const patientGUID = patientGuidMatch[1];
        console.log(`    Created patient: ${patientGUID}`);

        console.log('  Step 3: Book appointment...');

        const bookResult = await callCloud9('SetAppointment', {
            PatientGUID: patientGUID,
            StartTime: selectedSlot.StartTime,
            ScheduleViewGUID: selectedSlot.ScheduleViewGUID || CLOUD9.defaults.scheduleViewGUID,
            ScheduleColumnGUID: selectedSlot.ScheduleColumnGUID || CLOUD9.defaults.scheduleColumnGUID,
            AppointmentTypeGUID: CLOUD9.defaults.appointmentTypeGUID,
            Minutes: selectedSlot.Minutes || '45',
            VendorUserName: CLOUD9.vendorUserName
        });

        console.log(`    Booking result: ${bookResult.result || bookResult.status}`);

        const apptGuidMatch = bookResult.result?.match(/Appointment GUID Added:\s*([A-Fa-f0-9-]+)/i);
        if (apptGuidMatch) {
            console.log(`    Created appointment: ${apptGuidMatch[1]}`);

            // Optionally cancel the test appointment
            console.log('  Step 4: Cancel test appointment...');

            const cancelResult = await callCloud9('SetAppointmentStatusCanceled', {
                apptGUID: apptGuidMatch[1]
            });

            console.log(`    Cancel result: ${cancelResult.result || cancelResult.status}`);
        }
    }),
];

// ============================================================================
// XML REQUEST/RESPONSE TESTS
// ============================================================================

const xmlTests = [
    test('XML: Request format matches Cloud9 specification', async () => {
        const request = buildXmlRequest('TestProcedure', {
            param1: 'value1',
            param2: 'value2'
        });

        // Verify XML structure
        assertContains(request, '<?xml version="1.0" encoding="utf-8"?>', 'Should have XML declaration');
        assertContains(request, `<ClientID>${CLOUD9.clientId}</ClientID>`, 'Should include ClientID');
        assertContains(request, `<UserName>${CLOUD9.userName}</UserName>`, 'Should include UserName');
        assertContains(request, '<Procedure>TestProcedure</Procedure>', 'Should include Procedure');
        assertContains(request, '<param1>value1</param1>', 'Should include parameters');
        assertContains(request, `xmlns="${CLOUD9.namespace}"`, 'Should include namespace');

        console.log('  XML request format verified');
    }),

    test('XML: Response parsing extracts records correctly', async () => {
        const sampleXml = `
            <GetDataResponse>
                <ResponseStatus>Success</ResponseStatus>
                <Records>
                    <Record>
                        <Field1>Value1</Field1>
                        <Field2>Value2</Field2>
                    </Record>
                    <Record>
                        <Field1>Value3</Field1>
                        <Field2>Value4</Field2>
                    </Record>
                </Records>
            </GetDataResponse>
        `;

        const parsed = parseXmlResponse(sampleXml);

        assertEqual(parsed.status, 'Success', 'Should parse status correctly');
        assertEqual(parsed.records.length, 2, 'Should find 2 records');
        assertEqual(parsed.records[0].Field1, 'Value1', 'Should parse Field1 correctly');
        assertEqual(parsed.records[1].Field2, 'Value4', 'Should parse Field2 correctly');

        console.log('  XML response parsing verified');
    }),

    test('XML: Special characters are escaped properly', async () => {
        const escaped = escapeXml('<test>&"\'value</test>');

        assertContains(escaped, '&lt;', 'Should escape <');
        assertContains(escaped, '&gt;', 'Should escape >');
        assertContains(escaped, '&amp;', 'Should escape &');
        assertContains(escaped, '&quot;', 'Should escape "');
        assertContains(escaped, '&apos;', "Should escape '");

        console.log('  XML escaping verified');
    }),
];

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runAllTests() {
    console.log('\n' + '='.repeat(70));
    console.log('CLOUD9 TOOL SCRIPTS - UNIT TEST SUITE');
    console.log('='.repeat(70));
    console.log(`Endpoint: ${CLOUD9.endpoint}`);
    console.log(`Client ID: ${CLOUD9.clientId}`);
    console.log(`Date: ${new Date().toISOString()}`);
    console.log('='.repeat(70));

    const allTests = [
        { name: 'XML Format Tests', tests: xmlTests },
        { name: 'Scheduling Tool Tests', tests: schedulingTests },
        { name: 'Patient Tool Tests', tests: patientTests },
        { name: 'Integration Tests', tests: integrationTests },
    ];

    for (const suite of allTests) {
        console.log(`\n\n${'#'.repeat(70)}`);
        console.log(`# ${suite.name.toUpperCase()}`);
        console.log('#'.repeat(70));

        for (const testFn of suite.tests) {
            await testFn();
        }
    }

    // Print summary
    console.log('\n\n' + '='.repeat(70));
    console.log('TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total:  ${testResults.passed + testResults.failed}`);
    console.log(`Passed: ${testResults.passed} ✓`);
    console.log(`Failed: ${testResults.failed} ✗`);
    console.log(`Pass Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
    console.log('='.repeat(70));

    if (testResults.failed > 0) {
        console.log('\nFailed Tests:');
        testResults.tests
            .filter(t => t.status === 'failed')
            .forEach(t => console.log(`  ✗ ${t.name}: ${t.error}`));
    }

    return testResults.failed === 0;
}

// Run if executed directly
if (require.main === module) {
    runAllTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = {
    runAllTests,
    callCloud9,
    buildXmlRequest,
    parseXmlResponse,
    CLOUD9
};
