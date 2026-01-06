/**
 * Debug script to test GetOnlineReservations directly
 */

// Sandbox Cloud9 API Configuration
const SANDBOX_CONFIG = {
  endpoint: 'https://us-ea1-partnertest.cloud9ortho.com/GetData.ashx',
  clientId: 'c15aa02a-adc1-40ae-a2b5-d2e39173ae56',
  userName: 'IntelepeerTest',
  password: '#!InteleP33rTest!#',
  namespace: 'http://schemas.practica.ws/cloud9/partners/'
};

function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;');
}

function buildRequest(procedure, params = {}) {
  const paramElements = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`)
    .join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<GetDataRequest xmlns="${SANDBOX_CONFIG.namespace}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ClientID>${SANDBOX_CONFIG.clientId}</ClientID>
  <UserName>${SANDBOX_CONFIG.userName}</UserName>
  <Password>${escapeXml(SANDBOX_CONFIG.password)}</Password>
  <Procedure>${procedure}</Procedure>
  <Parameters>${paramElements}</Parameters>
</GetDataRequest>`;
}

function parseResponse(xmlText) {
  const statusMatch = xmlText.match(/<ResponseStatus>([^<]+)<\/ResponseStatus>/);
  const status = statusMatch ? statusMatch[1] : 'Unknown';

  if (status !== 'Success') {
    const errorMatch = xmlText.match(/<ErrorMessage>([^<]+)<\/ErrorMessage>/);
    return { status, records: [], error: errorMatch?.[1] || 'Unknown error' };
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

async function callApi(procedure, params) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Calling: ${procedure}`);
  console.log(`Params:`, JSON.stringify(params, null, 2));

  const xmlRequest = buildRequest(procedure, params);

  const response = await fetch(SANDBOX_CONFIG.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    body: xmlRequest
  });

  const xmlText = await response.text();
  const parsed = parseResponse(xmlText);

  console.log(`Status: ${parsed.status}`);
  console.log(`Records: ${parsed.records.length}`);

  if (parsed.error) {
    console.log(`Error: ${parsed.error}`);
  }

  return parsed;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Cloud9 Sandbox - GetOnlineReservations Debug');
  console.log('='.repeat(60));

  // Step 1: Get chair schedules to find valid schedule view GUIDs
  console.log('\n--- Step 1: Get Chair Schedules ---');
  const chairsResult = await callApi('GetChairSchedules', {});

  if (chairsResult.records.length > 0) {
    console.log('\nFirst 5 schedule views:');
    chairsResult.records.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.schdvwDescription} (${r.locName})`);
      console.log(`     schdvwGUID: ${r.schdvwGUID}`);
      console.log(`     locGUID: ${r.locGUID}`);
    });
  }

  // Step 2: Test GetOnlineReservations with the known test schedule view
  const testScheduleViewGuid = '2544683a-8e79-4b32-a4d4-bf851996bac3';
  const today = new Date();
  const startDate = `${(today.getMonth() + 1).toString().padStart(2, '0')}/${(today.getDate() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
  const endDate14 = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const endDate = `${(endDate14.getMonth() + 1).toString().padStart(2, '0')}/${endDate14.getDate().toString().padStart(2, '0')}/${endDate14.getFullYear()}`;

  console.log('\n--- Step 2: Test GetOnlineReservations ---');
  console.log(`Date range: ${startDate} to ${endDate}`);

  const slotsResult = await callApi('GetOnlineReservations', {
    startDate: `${startDate} 7:00:00 AM`,
    endDate: `${endDate} 5:00:00 PM`,
    schdvwGUIDs: testScheduleViewGuid,
    morning: 'True',
    afternoon: 'True'
  });

  if (slotsResult.records.length > 0) {
    console.log('\nFirst 5 available slots:');
    slotsResult.records.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.StartTime} - ${r.ScheduleColumnDescription} (${r.Minutes} min)`);
    });
  } else {
    console.log('\nNo slots found. Trying without schedule view filter...');

    const slotsResult2 = await callApi('GetOnlineReservations', {
      startDate: `${startDate} 7:00:00 AM`,
      endDate: `${endDate} 5:00:00 PM`,
      morning: 'True',
      afternoon: 'True'
    });

    if (slotsResult2.records.length > 0) {
      console.log('\nSlots found without filter:');
      slotsResult2.records.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.StartTime} - ${r.ScheduleColumnDescription}`);
        console.log(`     schdvwGUID: ${r.ScheduleViewGUID}`);
      });
    }
  }

  // Step 3: Check location to schedule view mapping
  console.log('\n--- Step 3: Location to Schedule View Mapping ---');
  const testLocationGuid = '1070d281-0952-4f01-9a6e-1a2e6926a7db';
  const matchingChairs = chairsResult.records.filter(r => r.locGUID === testLocationGuid);

  console.log(`Location GUID: ${testLocationGuid}`);
  console.log(`Matching schedule views: ${matchingChairs.length}`);

  if (matchingChairs.length > 0) {
    matchingChairs.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.schdvwDescription} - schdvwGUID: ${r.schdvwGUID}`);
    });
  } else {
    console.log('No matching schedule views for this location!');
    console.log('\nAll unique locGUIDs in chair schedules:');
    const uniqueLocGuids = [...new Set(chairsResult.records.map(r => r.locGUID))];
    uniqueLocGuids.forEach((guid, i) => {
      const name = chairsResult.records.find(r => r.locGUID === guid)?.locName;
      console.log(`  ${i + 1}. ${guid} (${name})`);
    });
  }

  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
