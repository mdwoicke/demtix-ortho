/**
 * Verify which Cloud9 environment the production Node-RED is using
 * Compare slot data between direct API calls and Node-RED
 */

const BASE_URL = 'https://c1-aicoe-nodered-lb.prod.c1conversations.io/FabricWorkflow/api/chord';
const AUTH = {
  username: 'workflowapi',
  password: 'e^@V95&6sAJReTsb5!iq39mIC4HYIV'
};

const SANDBOX = {
  endpoint: 'https://us-ea1-partnertest.cloud9ortho.com/GetData.ashx',
  clientId: 'c15aa02a-adc1-40ae-a2b5-d2e39173ae56',
  userName: 'IntelepeerTest',
  password: '#!InteleP33rTest!#',
  namespace: 'http://schemas.practica.ws/cloud9/partners/'
};

const PRODUCTION = {
  endpoint: 'https://us-ea1-partner.cloud9ortho.com/GetData.ashx',
  clientId: 'b42c51be-2529-4d31-92cb-50fd1a58c084',
  userName: 'Intelepeer',
  password: '$#1Nt-p33R-AwS#$',
  namespace: 'http://schemas.practica.ws/cloud9/partners/'
};

function escapeXml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;').replace(/"/g, '&quot;');
}

function buildRequest(config, procedure, params = {}) {
  const paramElements = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`)
    .join('');
  return `<?xml version="1.0" encoding="utf-8"?><GetDataRequest xmlns="${config.namespace}"><ClientID>${config.clientId}</ClientID><UserName>${config.userName}</UserName><Password>${escapeXml(config.password)}</Password><Procedure>${procedure}</Procedure><Parameters>${paramElements}</Parameters></GetDataRequest>`;
}

async function countSlots(xmlText) {
  const matches = xmlText.match(/<Record>/g);
  return matches ? matches.length : 0;
}

async function getFirstSlotGUID(xmlText) {
  const match = xmlText.match(/<ScheduleViewGUID>([^<]+)<\/ScheduleViewGUID>/);
  return match ? match[1] : null;
}

async function verify() {
  console.log('='.repeat(60));
  console.log('ENVIRONMENT VERIFICATION');
  console.log('='.repeat(60));
  console.log('');

  const dateRange = { start: '01/15/2026 7:00:00 AM', end: '01/31/2026 5:00:00 PM' };

  // 1. Query SANDBOX directly
  console.log('1. SANDBOX DIRECT (us-ea1-partnertest.cloud9ortho.com):');
  const sandboxResp = await fetch(SANDBOX.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: buildRequest(SANDBOX, 'GetOnlineReservations', {
      startDate: dateRange.start,
      endDate: dateRange.end,
      morning: 'True',
      afternoon: 'True'
    })
  });
  const sandboxText = await sandboxResp.text();
  const sandboxSlots = await countSlots(sandboxText);
  const sandboxFirstGUID = await getFirstSlotGUID(sandboxText);
  console.log(`   Slots: ${sandboxSlots}`);
  console.log(`   First ScheduleViewGUID: ${sandboxFirstGUID || '(none)'}`);

  // 2. Query PRODUCTION directly
  console.log('\n2. PRODUCTION DIRECT (us-ea1-partner.cloud9ortho.com):');
  const prodResp = await fetch(PRODUCTION.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: buildRequest(PRODUCTION, 'GetOnlineReservations', {
      startDate: dateRange.start,
      endDate: dateRange.end,
      morning: 'True',
      afternoon: 'True'
    })
  });
  const prodText = await prodResp.text();
  const prodSlots = await countSlots(prodText);
  const prodFirstGUID = await getFirstSlotGUID(prodText);
  console.log(`   Slots: ${prodSlots}`);
  console.log(`   First ScheduleViewGUID: ${prodFirstGUID || '(none)'}`);

  // 3. Query via Node-RED
  console.log('\n3. PRODUCTION NODE-RED (c1-aicoe-nodered-lb.prod):');
  const authHeader = 'Basic ' + Buffer.from(`${AUTH.username}:${AUTH.password}`).toString('base64');
  const nodeRedResp = await fetch(`${BASE_URL}/ortho/getApptSlots`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    },
    body: JSON.stringify({
      uui: '765381306-000000000001030525-SR-000-000000000000DAL130-026DE427|333725|421458314VO|2d411063-3769-4618-86d1-925d3578c112|FSV',
      startDate: '01/15/2026',
      endDate: '01/31/2026'
    })
  });
  const nodeRedData = await nodeRedResp.json();
  const nodeRedSlots = nodeRedData.slots?.length || 0;
  const nodeRedFirstGUID = nodeRedData.slots?.[0]?.ScheduleViewGUID || nodeRedData.slots?.[0]?.scheduleViewGUID;
  console.log(`   Slots: ${nodeRedSlots}`);
  console.log(`   First ScheduleViewGUID: ${nodeRedFirstGUID || '(none)'}`);

  // Compare
  console.log('\n' + '='.repeat(60));
  console.log('COMPARISON');
  console.log('='.repeat(60));

  console.log(`
   Source              | Slots | First GUID
   --------------------|-------|------------------------------------------
   Sandbox Direct      | ${String(sandboxSlots).padEnd(5)} | ${sandboxFirstGUID || 'N/A'}
   Production Direct   | ${String(prodSlots).padEnd(5)} | ${prodFirstGUID || 'N/A'}
   Production Node-RED | ${String(nodeRedSlots).padEnd(5)} | ${nodeRedFirstGUID || 'N/A'}
  `);

  // Determine which environment Node-RED is using
  if (nodeRedSlots > 0 && sandboxSlots === 0 && prodSlots > 0) {
    if (nodeRedFirstGUID === prodFirstGUID) {
      console.log('✓ NODE-RED IS USING PRODUCTION CLOUD9 (matching GUIDs)');
    } else {
      console.log('⚠️  NODE-RED IS USING UNKNOWN ENVIRONMENT (different GUIDs)');
      console.log('   This could be a separate test/staging environment');
    }
  } else if (nodeRedSlots === sandboxSlots && sandboxSlots === 0) {
    console.log('✗ NODE-RED IS USING SANDBOX (both have 0 slots)');
  }

  // Root cause summary
  console.log('\n' + '='.repeat(60));
  console.log('ROOT CAUSE SUMMARY');
  console.log('='.repeat(60));
  console.log(`
If slots "disappear when selected", the cause is:

1. Slots ARE returned from Node-RED (${nodeRedSlots} found)
2. User selects a slot
3. Booking fails with: "Patient GUID specified does not exist"
4. System misleadingly says "slot not available"

The REAL issue is the patientGUID validation fails.
Check that the patient is properly created BEFORE booking.
  `);
}

verify().catch(console.error);
