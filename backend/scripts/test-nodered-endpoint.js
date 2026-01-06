/**
 * Test the ACTUAL Node-RED endpoint that Flowise calls
 * This is what the LLM scheduling tool actually hits
 */

const BASE_URL = 'https://c1-aicoe-nodered-lb.prod.c1conversations.io/FabricWorkflow/api/chord';

// Auth credentials from the Flowise tool
const AUTH = {
  username: 'workflowapi',
  password: 'e^@V95&6sAJReTsb5!iq39mIC4HYIV'
};

async function testNodeRedEndpoint() {
  console.log('='.repeat(60));
  console.log('Testing PRODUCTION Node-RED Endpoints');
  console.log('(This is what Flowise/LLM actually calls)');
  console.log('='.repeat(60));
  console.log('');

  const authHeader = 'Basic ' + Buffer.from(`${AUTH.username}:${AUTH.password}`).toString('base64');

  // Test getApptSlots
  console.log('1. Testing /ortho/getApptSlots...\n');

  const slotsBody = {
    uui: '765381306-000000000001030525-SR-000-000000000000DAL130-026DE427|333725|421458314VO|2d411063-3769-4618-86d1-925d3578c112|FSV',
    startDate: '01/13/2026',
    endDate: '01/31/2026'
  };

  console.log('Request body:', JSON.stringify(slotsBody, null, 2));

  try {
    const response = await fetch(`${BASE_URL}/ortho/getApptSlots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(slotsBody)
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    console.log(`\nResponse status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2).substring(0, 2000));

    if (data.slots && data.slots.length > 0) {
      console.log(`\n✓ SLOTS FOUND: ${data.slots.length}`);
      console.log('First slot:', data.slots[0]);
    } else if (data.count === 0 || (data.slots && data.slots.length === 0)) {
      console.log('\n✗ NO SLOTS returned from Node-RED');
    }

    // If slots found, test booking with first slot
    if (data.slots && data.slots.length > 0) {
      const slot = data.slots[0];
      console.log('\n\n2. Testing /ortho/createAppt with first slot...\n');

      const bookBody = {
        uui: slotsBody.uui,
        patientGUID: 'TEST-PATIENT-GUID', // Fake - just testing validation
        startTime: slot.startTime || slot.StartTime,
        scheduleViewGUID: slot.scheduleViewGUID || slot.ScheduleViewGUID,
        scheduleColumnGUID: slot.scheduleColumnGUID || slot.ScheduleColumnGUID,
        appointmentTypeGUID: slot.appointmentTypeGUID || slot.AppointmentTypeGUID || '8fc9d063-ae46-4975-a5ae-734c6efe341a',
        minutes: slot.minutes || slot.Minutes || 45
      };

      console.log('Book request:', JSON.stringify(bookBody, null, 2));

      const bookResponse = await fetch(`${BASE_URL}/ortho/createAppt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(bookBody)
      });

      const bookText = await bookResponse.text();
      let bookData;
      try {
        bookData = JSON.parse(bookText);
      } catch {
        bookData = bookText;
      }

      console.log(`\nBook response status: ${bookResponse.status}`);
      console.log('Book response:', JSON.stringify(bookData, null, 2).substring(0, 1000));
    }

  } catch (error) {
    console.log('Error:', error.message);
  }

  // Test with different date ranges
  console.log('\n\n3. Testing extended date ranges...\n');

  const dateRanges = [
    { start: '01/07/2026', end: '01/20/2026' },
    { start: '02/01/2026', end: '02/28/2026' },
    { start: '03/01/2026', end: '03/31/2026' }
  ];

  for (const range of dateRanges) {
    try {
      const response = await fetch(`${BASE_URL}/ortho/getApptSlots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          uui: slotsBody.uui,
          startDate: range.start,
          endDate: range.end
        })
      });

      const data = await response.json();
      const slotCount = data.slots?.length || data.count || 0;
      console.log(`  ${range.start} - ${range.end}: ${slotCount} slots`);

      if (slotCount > 0 && data.slots) {
        console.log(`    First: ${data.slots[0].startTime || data.slots[0].StartTime}`);
      }
    } catch (e) {
      console.log(`  ${range.start} - ${range.end}: Error - ${e.message}`);
    }
  }
}

testNodeRedEndpoint().catch(console.error);
