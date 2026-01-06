/**
 * Test Cloud9 SetAppointment API DIRECTLY to see raw error messages
 * Bypass Node-RED to understand why booking fails
 */

// Use the SANDBOX config (same as Node-RED uses)
const SANDBOX_CONFIG = {
  endpoint: 'https://us-ea1-partnertest.cloud9ortho.com/GetData.ashx',
  clientId: 'c15aa02a-adc1-40ae-a2b5-d2e39173ae56',
  userName: 'IntelepeerTest',
  password: '#!InteleP33rTest!#',
  namespace: 'http://schemas.practica.ws/cloud9/partners/',
  vendorUserName: 'IntelepeerTest'
};

function escapeXml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;').replace(/"/g, '&quot;');
}

function buildRequest(procedure, params = {}) {
  const paramElements = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`)
    .join('');
  return `<?xml version="1.0" encoding="utf-8"?><GetDataRequest xmlns="${SANDBOX_CONFIG.namespace}"><ClientID>${SANDBOX_CONFIG.clientId}</ClientID><UserName>${SANDBOX_CONFIG.userName}</UserName><Password>${escapeXml(SANDBOX_CONFIG.password)}</Password><Procedure>${procedure}</Procedure><Parameters>${paramElements}</Parameters></GetDataRequest>`;
}

async function testDirectBooking() {
  console.log('='.repeat(60));
  console.log('DIRECT Cloud9 API Test - SetAppointment');
  console.log('='.repeat(60));
  console.log('');

  // First, check if sandbox has ANY slots (it shouldn't based on earlier tests)
  console.log('1. Checking sandbox for slots...');
  const slotsXml = buildRequest('GetOnlineReservations', {
    startDate: '01/13/2026 7:00:00 AM',
    endDate: '02/28/2026 5:00:00 PM',
    morning: 'True',
    afternoon: 'True'
  });

  const slotsResponse = await fetch(SANDBOX_CONFIG.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: slotsXml
  });
  const slotsText = await slotsResponse.text();

  const slotMatch = slotsText.match(/<Record>/g);
  const slotCount = slotMatch ? slotMatch.length : 0;
  console.log(`   Sandbox slots: ${slotCount}`);

  // Now try to book with slot data from production Node-RED
  console.log('\n2. Attempting SetAppointment with production slot data...');

  // Slot data from production Node-RED (which HAS slots)
  const slotFromProdNodeRed = {
    startTime: '2/12/2026 9:15:00 AM',
    scheduleViewGUID: '374e2aaa-1850-43d0-a357-e4f97bddc436',
    scheduleColumnGUID: '1fef5e23-c2f6-4089-8187-c4fd0ec0d844',
    appointmentTypeGUID: '8fc9d063-ae46-4975-a5ae-734c6efe341a',
    minutes: '45'
  };

  // Use a test patient GUID (likely doesn't exist)
  const testPatientGUID = '37dff8a1-9fcb-4c3a-86a9-b8bb81e2f946';

  const bookXml = buildRequest('SetAppointment', {
    PatientGUID: testPatientGUID,
    StartTime: slotFromProdNodeRed.startTime,
    ScheduleViewGUID: slotFromProdNodeRed.scheduleViewGUID,
    ScheduleColumnGUID: slotFromProdNodeRed.scheduleColumnGUID,
    AppointmentTypeGUID: slotFromProdNodeRed.appointmentTypeGUID,
    Minutes: slotFromProdNodeRed.minutes,
    VendorUserName: SANDBOX_CONFIG.vendorUserName
  });

  console.log('\n   Request XML (truncated):');
  console.log('   ' + bookXml.substring(0, 200) + '...');

  const bookResponse = await fetch(SANDBOX_CONFIG.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: bookXml
  });
  const bookText = await bookResponse.text();

  console.log('\n   RAW RESPONSE FROM CLOUD9:');
  console.log('   ' + '-'.repeat(50));
  console.log(bookText);
  console.log('   ' + '-'.repeat(50));

  // Parse for specific error messages
  const statusMatch = bookText.match(/<ResponseStatus>([^<]+)<\/ResponseStatus>/);
  const errorMatch = bookText.match(/<ErrorMessage>([^<]+)<\/ErrorMessage>/);
  const resultMatch = bookText.match(/<Result>([^<]+)<\/Result>/);

  console.log('\n   Parsed values:');
  console.log(`   ResponseStatus: ${statusMatch?.[1] || '(not found)'}`);
  console.log(`   ErrorMessage: ${errorMatch?.[1] || '(not found)'}`);
  console.log(`   Result: ${resultMatch?.[1] || '(not found)'}`);

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('ANALYSIS');
  console.log('='.repeat(60));

  if (slotCount === 0) {
    console.log('\n⚠️  ENVIRONMENT MISMATCH DETECTED:');
    console.log('   - Production Node-RED returns slots from a DIFFERENT Cloud9 environment');
    console.log('   - Sandbox Cloud9 has 0 slots');
    console.log('   - Booking uses slot GUIDs that may not exist in sandbox');
  }

  if (errorMatch?.[1]) {
    console.log(`\n❌ CLOUD9 ERROR: ${errorMatch[1]}`);
  }
}

testDirectBooking().catch(console.error);
