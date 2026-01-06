/**
 * Debug script to test ALL schedule views for slots
 */

const SANDBOX_CONFIG = {
  endpoint: 'https://us-ea1-partnertest.cloud9ortho.com/GetData.ashx',
  clientId: 'c15aa02a-adc1-40ae-a2b5-d2e39173ae56',
  userName: 'IntelepeerTest',
  password: '#!InteleP33rTest!#',
  namespace: 'http://schemas.practica.ws/cloud9/partners/'
};

function escapeXml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;').replace(/"/g, '&quot;');
}

function parseResponse(xmlText) {
  const statusMatch = xmlText.match(/<ResponseStatus>([^<]+)<\/ResponseStatus>/);
  const status = statusMatch ? statusMatch[1] : 'Unknown';
  const records = [];
  const recordRegex = /<Record>([\s\S]*?)<\/Record>/g;
  let match;
  while ((match = recordRegex.exec(xmlText)) !== null) {
    const record = {};
    const fieldRegex = /<([A-Za-z0-9_]+)>([^<]*)<\/\1>/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(match[1])) !== null) record[fieldMatch[1]] = fieldMatch[2];
    records.push(record);
  }
  return { status, records };
}

function buildRequest(procedure, params = {}) {
  const paramElements = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`)
    .join('');
  return `<?xml version="1.0" encoding="utf-8"?><GetDataRequest xmlns="${SANDBOX_CONFIG.namespace}"><ClientID>${SANDBOX_CONFIG.clientId}</ClientID><UserName>${SANDBOX_CONFIG.userName}</UserName><Password>${escapeXml(SANDBOX_CONFIG.password)}</Password><Procedure>${procedure}</Procedure><Parameters>${paramElements}</Parameters></GetDataRequest>`;
}

async function callApi(procedure, params) {
  const response = await fetch(SANDBOX_CONFIG.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    body: buildRequest(procedure, params)
  });
  return parseResponse(await response.text());
}

async function testAllViews() {
  console.log('Getting ALL schedule views from sandbox...\n');

  // Get chair schedules
  const chairs = await callApi('GetChairSchedules', {});
  const uniqueViews = [...new Set(chairs.records.map(r => r.schdvwGUID))];
  console.log(`Found ${uniqueViews.length} unique schedule view GUIDs\n`);

  let foundAny = false;

  // Test EACH schedule view for slots (extended range: 6 months)
  for (const viewGuid of uniqueViews) {
    const viewInfo = chairs.records.find(r => r.schdvwGUID === viewGuid);

    const result = await callApi('GetOnlineReservations', {
      startDate: '01/13/2026 7:00:00 AM',
      endDate: '07/31/2026 5:00:00 PM',
      schdvwGUIDs: viewGuid,
      morning: 'True',
      afternoon: 'True'
    });

    const status = result.records.length > 0 ? '✓' : '✗';
    console.log(`${status} ${viewInfo?.schdvwDescription || viewGuid}: ${result.records.length} slots`);

    if (result.records.length > 0) {
      foundAny = true;
      console.log(`  First slot: ${result.records[0].StartTime}`);
      console.log(`  Last slot: ${result.records[result.records.length - 1].StartTime}`);
      console.log(`  schdvwGUID: ${viewGuid}`);
    }
  }

  if (!foundAny) {
    console.log('\n\n========================================');
    console.log('⚠️  NO SLOTS FOUND IN ANY SCHEDULE VIEW');
    console.log('========================================');
    console.log('\nThis is the ROOT CAUSE of slot disappearance!');
    console.log('The Cloud9 sandbox has no available appointment slots.');
    console.log('\nPossible fixes:');
    console.log('1. Configure schedule templates in Cloud9 sandbox');
    console.log('2. Switch to using PRODUCTION environment');
    console.log('3. Contact Cloud9 support to reset sandbox slots');
  }
}

testAllViews().catch(console.error);
