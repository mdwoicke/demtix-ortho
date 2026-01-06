/**
 * Test full booking flow to identify where slots "disappear"
 * 1. Get slots
 * 2. Pick a slot
 * 3. Try to book it
 * 4. Analyze why booking fails
 */

const BASE_URL = 'https://c1-aicoe-nodered-lb.prod.c1conversations.io/FabricWorkflow/api/chord';

const AUTH = {
  username: 'workflowapi',
  password: 'e^@V95&6sAJReTsb5!iq39mIC4HYIV'
};

const TEST_UUI = '765381306-000000000001030525-SR-000-000000000000DAL130-026DE427|333725|421458314VO|2d411063-3769-4618-86d1-925d3578c112|FSV';

// Known test patient GUID from sandbox (if exists)
const TEST_PATIENT_GUIDS = [
  '37dff8a1-9fcb-4c3a-86a9-b8bb81e2f946', // Test patient 1
  '00000000-0000-0000-0000-000000000000', // Null GUID
];

async function makeRequest(endpoint, body) {
  const authHeader = 'Basic ' + Buffer.from(`${AUTH.username}:${AUTH.password}`).toString('base64');

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  try {
    return { status: response.status, data: JSON.parse(text) };
  } catch {
    return { status: response.status, data: text };
  }
}

async function testBookingFlow() {
  console.log('='.repeat(60));
  console.log('BOOKING FLOW ANALYSIS - Why do slots disappear?');
  console.log('='.repeat(60));

  // Step 1: Get available slots
  console.log('\n1. FETCHING SLOTS...\n');

  const slotsResult = await makeRequest('/ortho/getApptSlots', {
    uui: TEST_UUI,
    startDate: '01/13/2026',
    endDate: '02/28/2026'
  });

  if (!slotsResult.data.slots || slotsResult.data.slots.length === 0) {
    console.log('No slots returned. Cannot test booking flow.');
    return;
  }

  const slots = slotsResult.data.slots;
  console.log(`Found ${slots.length} slots`);
  console.log('\nFirst 3 slots:');
  slots.slice(0, 3).forEach((slot, i) => {
    console.log(`  ${i + 1}. ${slot.startTime || slot.StartTime} at ${slot.ScheduleViewDescription}`);
  });

  // Step 2: Pick a slot and analyze its data
  const selectedSlot = slots[0];
  console.log('\n\n2. SELECTED SLOT DETAILS:');
  console.log(JSON.stringify(selectedSlot, null, 2));

  // Step 3: Try booking with different scenarios
  console.log('\n\n3. BOOKING ATTEMPTS...\n');

  // Test 3a: Book with missing patientGUID
  console.log('3a. Attempt WITHOUT patientGUID:');
  const result3a = await makeRequest('/ortho/createAppt', {
    uui: TEST_UUI,
    startTime: selectedSlot.startTime || selectedSlot.StartTime,
    scheduleViewGUID: selectedSlot.scheduleViewGUID || selectedSlot.ScheduleViewGUID,
    scheduleColumnGUID: selectedSlot.scheduleColumnGUID || selectedSlot.ScheduleColumnGUID,
    appointmentTypeGUID: selectedSlot.appointmentTypeGUID || selectedSlot.AppointmentTypeGUID,
    minutes: selectedSlot.minutes || selectedSlot.Minutes
  });
  console.log(`  Status: ${result3a.status}`);
  console.log(`  Success: ${result3a.data.success}`);
  console.log(`  Message: ${result3a.data.message || '(empty)'}`);
  if (result3a.data.llm_guidance) {
    console.log(`  Guidance: ${result3a.data.llm_guidance.action_required}`);
  }

  // Test 3b: Book with invalid patientGUID
  console.log('\n3b. Attempt with INVALID patientGUID:');
  const result3b = await makeRequest('/ortho/createAppt', {
    uui: TEST_UUI,
    patientGUID: 'invalid-guid-12345',
    startTime: selectedSlot.startTime || selectedSlot.StartTime,
    scheduleViewGUID: selectedSlot.scheduleViewGUID || selectedSlot.ScheduleViewGUID,
    scheduleColumnGUID: selectedSlot.scheduleColumnGUID || selectedSlot.ScheduleColumnGUID,
    appointmentTypeGUID: selectedSlot.appointmentTypeGUID || selectedSlot.AppointmentTypeGUID,
    minutes: selectedSlot.minutes || selectedSlot.Minutes
  });
  console.log(`  Status: ${result3b.status}`);
  console.log(`  Success: ${result3b.data.success}`);
  console.log(`  Message: ${result3b.data.message || '(empty)'}`);
  if (result3b.data.llm_guidance) {
    console.log(`  Guidance: ${result3b.data.llm_guidance.action_required}`);
  }

  // Test 3c: Check slot availability AGAIN immediately before booking
  console.log('\n3c. RE-CHECKING SLOT AVAILABILITY (same slot):');
  const recheckResult = await makeRequest('/ortho/getApptSlots', {
    uui: TEST_UUI,
    startDate: '01/13/2026',
    endDate: '02/28/2026'
  });

  const stillAvailable = recheckResult.data.slots?.some(s =>
    (s.startTime || s.StartTime) === (selectedSlot.startTime || selectedSlot.StartTime) &&
    (s.scheduleViewGUID || s.ScheduleViewGUID) === (selectedSlot.scheduleViewGUID || selectedSlot.ScheduleViewGUID)
  );
  console.log(`  Slot still available: ${stillAvailable ? 'YES' : 'NO - DISAPPEARED!'}`);

  if (!stillAvailable && recheckResult.data.slots?.length > 0) {
    console.log('\n  ⚠️  THE SLOT DISAPPEARED BETWEEN QUERIES!');
    console.log('  This suggests slots are being consumed/blocked between fetch and book');
  }

  // Step 4: Analyze the pattern
  console.log('\n\n4. ANALYSIS:');
  console.log('─'.repeat(50));

  if (result3a.data.success === false && result3b.data.success === false) {
    console.log('Both booking attempts failed.');
    console.log('');

    if (!result3a.data.message && !result3b.data.message) {
      console.log('FINDING: Booking returns empty message with success=false');
      console.log('This could indicate:');
      console.log('  1. Cloud9 API rejection (slot no longer available)');
      console.log('  2. Validation failure in Node-RED');
      console.log('  3. Patient creation required before booking');
    }
  }
}

testBookingFlow().catch(console.error);
