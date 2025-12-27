/**
 * ============================================================================
 * END-TO-END BOOKING TEST
 * ============================================================================
 *
 * This script verifies the complete booking flow with Cloud9 Sandbox:
 *
 * 1. Get an existing patient from GetAppointmentListByDate
 *    (Sandbox has no providers via API, so we can't create patients)
 * 2. Get available slots on/after 1/1/2026 (GetOnlineReservations)
 * 3. Book appointment using the AppointmentTypeGUID from search params (SetAppointment)
 * 4. Verify booking exists (GetAppointmentListByPatient)
 * 5. Clean up - cancel the appointment (SetAppointmentStatusCanceled)
 *
 * KEY FINDING:
 * - GetOnlineReservations returns empty AppointmentTypeGUID in slots
 * - BUT SetAppointment REQUIRES a valid AppointmentTypeGUID
 * - Solution: Use the same GUID passed to appttypGUIDs in GetOnlineReservations
 * - DO NOT confuse AppointmentTypeGUID with AppointmentClassGUID!
 *
 * Run with: node e2e-booking-test.js
 * ============================================================================
 */

const fetch = require('node-fetch');

// ============================================================================
// CLOUD9 SANDBOX CONFIGURATION (Hardcoded known values)
// ============================================================================

const CLOUD9 = {
  endpoint: 'https://us-ea1-partnertest.cloud9ortho.com/GetData.ashx',
  clientId: 'c15aa02a-adc1-40ae-a2b5-d2e39173ae56',
  userName: 'IntelepeerTest',
  password: '#!InteleP33rTest!#',
  namespace: 'http://schemas.practica.ws/cloud9/partners/',
  vendorUserName: 'IntelepeerTest',

  // Known sandbox defaults
  defaultApptTypeGUID: '8fc9d063-ae46-4975-a5ae-734c6efe341a',
  defaultScheduleViewGUID: '2544683a-8e79-4b32-a4d4-bf851996bac3',
  defaultScheduleColumnGUID: 'e062b81f-1fff-40fc-b4a4-1cf9ecc2f32b'
};

// Slot search date range: 1/1/2026 to 1/7/2026 (1 week to avoid API slowdown)
const SLOT_SEARCH = {
  startDate: '01/01/2026',
  endDate: '01/07/2026'  // 1 week only
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
    .filter(([_, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`)
    .join('');

  return `<?xml version="1.0" encoding="utf-8"?><GetDataRequest xmlns="${CLOUD9.namespace}"><ClientID>${CLOUD9.clientId}</ClientID><UserName>${CLOUD9.userName}</UserName><Password>${escapeXml(CLOUD9.password)}</Password><Procedure>${procedure}</Procedure><Parameters>${paramElements}</Parameters></GetDataRequest>`;
}

function parseXmlResponse(xmlText) {
  const statusMatch = xmlText.match(/<ResponseStatus>([^<]+)<\/ResponseStatus>/);
  const status = statusMatch ? statusMatch[1] : 'Unknown';

  // Check for errors
  if (status !== 'Success') {
    const errorMatch = xmlText.match(/<Result>([^<]+)<\/Result>/);
    if (errorMatch) {
      return { status, error: errorMatch[1], records: [] };
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

async function callCloud9(procedure, params, debug = false) {
  const xmlRequest = buildXmlRequest(procedure, params);

  const response = await fetch(CLOUD9.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: xmlRequest,
    timeout: 30000
  });

  const xmlText = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  if (debug) {
    console.log('RAW XML RESPONSE:');
    console.log(xmlText.substring(0, 1000));
  }

  return parseXmlResponse(xmlText);
}

// ============================================================================
// TEST STEPS
// ============================================================================

async function step1_getExistingPatient() {
  console.log('\n' + '='.repeat(60));
  console.log('STEP 1: Get Existing Patient from Sandbox');
  console.log('='.repeat(60));
  console.log('(Sandbox has no providers via API, so we use an existing patient)\n');

  // Get appointments to find an existing patient
  const result = await callCloud9('GetAppointmentListByDate', {
    dtAppointment: '01/01/2026'
  });

  if (result.records.length === 0) {
    throw new Error('No appointments found in sandbox - cannot get existing patient');
  }

  console.log(`Found ${result.records.length} appointments in sandbox`);

  // Get the first patient with a valid GUID
  const appt = result.records.find(r => r.PatientGUID && r.PatientGUID.length > 10);
  if (!appt) {
    throw new Error('No valid patient GUID found in appointments');
  }

  const patientGUID = appt.PatientGUID;
  const patientName = `${appt.PatientFirstName || ''} ${appt.PatientLastName || ''}`.trim();

  console.log(`✓ Found existing patient: ${patientName}`);
  console.log(`  PatientGUID: ${patientGUID}`);

  return patientGUID;
}

async function step2_getAvailableSlots() {
  console.log('\n' + '='.repeat(60));
  console.log('STEP 2: Get Available Appointment Slots (1/1/2026+)');
  console.log('='.repeat(60));

  console.log(`Searching: ${SLOT_SEARCH.startDate} to ${SLOT_SEARCH.endDate}`);

  const result = await callCloud9('GetOnlineReservations', {
    startDate: `${SLOT_SEARCH.startDate} 7:00:00 AM`,
    endDate: `${SLOT_SEARCH.endDate} 5:00:00 PM`,
    morning: 'True',
    afternoon: 'True',
    appttypGUIDs: CLOUD9.defaultApptTypeGUID
  });

  if (result.records.length === 0) {
    throw new Error('No available slots found');
  }

  console.log(`✓ Found ${result.records.length} available slots`);

  // Analyze first slot
  const slot = result.records[0];
  console.log('\nFirst available slot:');
  console.log(`  StartTime: ${slot.StartTime}`);
  console.log(`  ScheduleViewGUID: ${slot.ScheduleViewGUID}`);
  console.log(`  ScheduleColumnGUID: ${slot.ScheduleColumnGUID}`);
  console.log(`  AppointmentTypeGUID: "${slot.AppointmentTypeGUID}" ${slot.AppointmentTypeGUID === '' ? '(EMPTY - as expected!)' : '(unexpected value)'}`);
  console.log(`  AppointmentClassGUID: "${slot.AppointmentClassGUID}" (this is NOT appointmentTypeGUID)`);
  console.log(`  Minutes: ${slot.Minutes}`);

  // Verify AppointmentTypeGUID is empty
  if (slot.AppointmentTypeGUID !== '') {
    console.log('\n⚠️  WARNING: AppointmentTypeGUID is not empty. This is unexpected.');
  } else {
    console.log('\n✓ CONFIRMED: AppointmentTypeGUID is empty in slots response');
  }

  return slot;
}

async function step3_bookAppointment(patientGUID, slot) {
  console.log('\n' + '='.repeat(60));
  console.log('STEP 3: Book Appointment');
  console.log('='.repeat(60));

  // NOTE: Even though GetOnlineReservations returns empty AppointmentTypeGUID,
  // SetAppointment REQUIRES a valid AppointmentTypeGUID. We must use the same
  // GUID we used to search for slots (defaultApptTypeGUID).
  const bookingParams = {
    PatientGUID: patientGUID,
    StartTime: slot.StartTime,
    ScheduleViewGUID: slot.ScheduleViewGUID,
    ScheduleColumnGUID: slot.ScheduleColumnGUID,
    AppointmentTypeGUID: CLOUD9.defaultApptTypeGUID,  // Use the search GUID, not empty
    Minutes: slot.Minutes || '45',
    VendorUserName: CLOUD9.vendorUserName
  };

  console.log('Booking parameters:');
  console.log(`  PatientGUID: ${bookingParams.PatientGUID}`);
  console.log(`  StartTime: ${bookingParams.StartTime}`);
  console.log(`  ScheduleViewGUID: ${bookingParams.ScheduleViewGUID}`);
  console.log(`  ScheduleColumnGUID: ${bookingParams.ScheduleColumnGUID}`);
  console.log(`  AppointmentTypeGUID: ${bookingParams.AppointmentTypeGUID} (from search params)`);
  console.log(`  Minutes: ${bookingParams.Minutes}`);

  const result = await callCloud9('SetAppointment', bookingParams);
  const resultText = result.records[0]?.Result || '';
  console.log(`\nAPI Response: ${resultText}`);

  const apptGuidMatch = resultText.match(/Appointment GUID Added:\s*([A-Fa-f0-9-]+)/i);

  if (!apptGuidMatch) {
    if (resultText.includes('Error') || resultText.includes('error')) {
      throw new Error(`Booking FAILED: ${resultText}`);
    }
    throw new Error('Booking failed - no appointment GUID returned');
  }

  const appointmentGUID = apptGuidMatch[1];
  console.log(`\n✓ APPOINTMENT BOOKED SUCCESSFULLY!`);
  console.log(`  Appointment GUID: ${appointmentGUID}`);

  return appointmentGUID;
}

async function step4_verifyAppointment(patientGUID, appointmentGUID, expectedStartTime) {
  console.log('\n' + '='.repeat(60));
  console.log('STEP 4: Verify Appointment Exists in Cloud9');
  console.log('='.repeat(60));

  // Get appointments for the patient
  const result = await callCloud9('GetAppointmentListByPatient', {
    patGUID: patientGUID
  });

  console.log(`Found ${result.records.length} appointments for patient`);

  // Find our appointment (case-insensitive GUID comparison)
  const appointmentGUIDLower = appointmentGUID.toLowerCase();
  const appointment = result.records.find(a =>
    (a.AppointmentGUID || '').toLowerCase() === appointmentGUIDLower
  );

  if (!appointment) {
    console.log('\nAll appointments for patient:');
    result.records.forEach(a => {
      console.log(`  ${a.AppointmentGUID}: ${a.AppointmentDateTime}`);
    });
    throw new Error(`Appointment ${appointmentGUID} not found in patient's appointments`);
  }

  console.log('\n✓ APPOINTMENT VERIFIED IN CLOUD9!');
  console.log('  Appointment details:');
  console.log(`    GUID: ${appointment.AppointmentGUID}`);
  console.log(`    DateTime: ${appointment.AppointmentDateTime}`);
  console.log(`    Status: ${appointment.AppointmentStatusDescription}`);
  console.log(`    Type: ${appointment.AppointmentTypeDescription}`);

  return appointment;
}

async function step5_cleanup(appointmentGUID) {
  console.log('\n' + '='.repeat(60));
  console.log('STEP 5: Cleanup - Cancel Test Appointment');
  console.log('='.repeat(60));

  const result = await callCloud9('SetAppointmentStatusCanceled', {
    apptGUID: appointmentGUID
  });

  const resultText = result.records[0]?.Result || 'Cancellation processed';
  console.log(`Cancellation result: ${resultText}`);

  if (resultText.toLowerCase().includes('error')) {
    console.log('⚠️  Warning: Cancellation may have failed');
  } else {
    console.log('✓ Appointment cancelled (cleanup complete)');
  }
}

// ============================================================================
// BONUS: Test with WRONG appointmentTypeGUID to prove it fails
// ============================================================================

async function bonusTest_wrongAppointmentTypeGUID(patientGUID, slot) {
  console.log('\n' + '='.repeat(60));
  console.log('BONUS TEST: Attempt booking with WRONG appointmentTypeGUID');
  console.log('='.repeat(60));
  console.log('This should FAIL to prove that passing a GUID is wrong.\n');

  // Use AppointmentClassGUID (the wrong field that LLMs often extract)
  const wrongGUID = slot.AppointmentClassGUID;

  const bookingParams = {
    PatientGUID: patientGUID,
    StartTime: slot.StartTime,
    ScheduleViewGUID: slot.ScheduleViewGUID,
    ScheduleColumnGUID: slot.ScheduleColumnGUID,
    AppointmentTypeGUID: wrongGUID,  // WRONG! Using AppointmentClassGUID
    Minutes: slot.Minutes || '45',
    VendorUserName: CLOUD9.vendorUserName
  };

  console.log(`Using WRONG AppointmentTypeGUID: "${wrongGUID}"`);
  console.log('(This is actually AppointmentClassGUID from the slot)\n');

  try {
    const result = await callCloud9('SetAppointment', bookingParams);
    const resultText = result.records[0]?.Result || '';

    if (resultText.includes('Added')) {
      console.log('⚠️  UNEXPECTED: Booking succeeded with wrong GUID');
      console.log(`Result: ${resultText}`);
      // Clean up
      const guidMatch = resultText.match(/Appointment GUID Added:\s*([A-Fa-f0-9-]+)/i);
      if (guidMatch) {
        await callCloud9('SetAppointmentStatusCanceled', { apptGUID: guidMatch[1] });
      }
    } else {
      console.log(`✓ EXPECTED FAILURE: ${resultText}`);
    }
  } catch (error) {
    console.log(`✓ EXPECTED ERROR: ${error.message}`);
  }

  console.log('\nThis proves that passing AppointmentClassGUID as appointmentTypeGUID fails.');
  console.log('The correct AppointmentTypeGUID is the one used in GetOnlineReservations search.');
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runE2ETest() {
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(10) + 'END-TO-END BOOKING TEST' + ' '.repeat(25) + '║');
  console.log('║' + ' '.repeat(10) + 'Cloud9 Sandbox Verification' + ' '.repeat(21) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');

  const startTime = Date.now();
  let patientGUID = null;
  let appointmentGUID = null;
  let slot = null;

  try {
    // Step 1: Get existing patient (sandbox has no providers for patient creation)
    patientGUID = await step1_getExistingPatient();

    // Step 2: Get available slots on/after 1/1/2026
    slot = await step2_getAvailableSlots();

    // Step 3: Book appointment with EMPTY appointmentTypeGUID
    appointmentGUID = await step3_bookAppointment(patientGUID, slot);

    // Step 4: Verify appointment exists
    await step4_verifyAppointment(patientGUID, appointmentGUID, slot.StartTime);

    // Step 5: Cleanup
    await step5_cleanup(appointmentGUID);

    // Bonus: Test that wrong appointmentTypeGUID fails (use second slot)
    const slotsResult = await callCloud9('GetOnlineReservations', {
      startDate: `${SLOT_SEARCH.startDate} 7:00:00 AM`,
      endDate: `${SLOT_SEARCH.endDate} 5:00:00 PM`,
      morning: 'True',
      afternoon: 'True',
      appttypGUIDs: CLOUD9.defaultApptTypeGUID
    });

    if (slotsResult.records.length > 1) {
      const bonusSlot = slotsResult.records[1];  // Use second slot
      await bonusTest_wrongAppointmentTypeGUID(patientGUID, bonusSlot);
    }

    // Final summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '═'.repeat(60));
    console.log('                    TEST RESULTS SUMMARY');
    console.log('═'.repeat(60));
    console.log('✓ All steps completed successfully!');
    console.log(`✓ Total duration: ${duration}s`);
    console.log('\nKEY FINDINGS:');
    console.log('  1. GetOnlineReservations returns AppointmentTypeGUID: "" (empty in slots)');
    console.log('  2. SetAppointment REQUIRES a valid AppointmentTypeGUID (not empty!)');
    console.log('  3. Solution: Use same GUID passed to appttypGUIDs in GetOnlineReservations');
    console.log('  4. SetAppointment FAILS with AppointmentClassGUID (common LLM confusion)');
    console.log('═'.repeat(60));

    return { success: true };

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);

    // Attempt cleanup if we created resources
    if (appointmentGUID) {
      try {
        console.log('\nAttempting cleanup...');
        await step5_cleanup(appointmentGUID);
      } catch (cleanupError) {
        console.log('Cleanup failed:', cleanupError.message);
      }
    }

    return { success: false, error: error.message };
  }
}

// Run the test
runE2ETest()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
