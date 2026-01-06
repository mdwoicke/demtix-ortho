/**
 * Debug script to test GetOnlineReservations with all schedule views
 */

const SANDBOX_CONFIG = {
  endpoint: 'https://us-ea1-partnertest.cloud9ortho.com/GetData.ashx',
  clientId: 'c15aa02a-adc1-40ae-a2b5-d2e39173ae56',
  userName: 'IntelepeerTest',
  password: '#!InteleP33rTest!#',
  namespace: 'http://schemas.practica.ws/cloud9/partners/'
};

function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;').replace(/"/g, '&quot;');
}

function buildRequest(procedure, params = {}) {
  const paramElements = Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`).join('');
  return `<?xml version="1.0" encoding="utf-8"?><GetDataRequest xmlns="${SANDBOX_CONFIG.namespace}"><ClientID>${SANDBOX_CONFIG.clientId}</ClientID><UserName>${SANDBOX_CONFIG.userName}</UserName><Password>${escapeXml(SANDBOX_CONFIG.password)}</Password><Procedure>${procedure}</Procedure><Parameters>${paramElements}</Parameters></GetDataRequest>`;
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

async function callApi(procedure, params) {
  const response = await fetch(SANDBOX_CONFIG.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    body: buildRequest(procedure, params)
  });
  return parseResponse(await response.text());
}

async function main() {
  console.log('Testing GetOnlineReservations with ALL unique schedule views...\n');

  // Get all chair schedules
  const chairs = await callApi('GetChairSchedules', {});
  const uniqueViews = [...new Set(chairs.records.map(r => r.schdvwGUID))];
  console.log(`Found ${uniqueViews.length} unique schedule views\n`);

  // Date range
  const today = new Date();
  const start = `${(today.getMonth() + 1).toString().padStart(2, '0')}/${(today.getDate() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
  const end14 = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const end = `${(end14.getMonth() + 1).toString().padStart(2, '0')}/${end14.getDate().toString().padStart(2, '0')}/${end14.getFullYear()}`;
  console.log(`Date range: ${start} to ${end}\n`);

  let foundSlots = false;

  // Test each schedule view
  for (const viewGuid of uniqueViews.slice(0, 10)) { // Test first 10
    const viewInfo = chairs.records.find(r => r.schdvwGUID === viewGuid);
    const result = await callApi('GetOnlineReservations', {
      startDate: `${start} 7:00:00 AM`,
      endDate: `${end} 5:00:00 PM`,
      schdvwGUIDs: viewGuid,
      morning: 'True',
      afternoon: 'True'
    });

    if (result.records.length > 0) {
      console.log(`✓ ${viewInfo?.schdvwDescription || viewGuid}: ${result.records.length} slots`);
      console.log(`  Sample: ${result.records[0].StartTime}`);
      foundSlots = true;
    } else {
      console.log(`✗ ${viewInfo?.schdvwDescription || viewGuid}: 0 slots`);
    }
  }

  if (!foundSlots) {
    console.log('\n--- No slots found in any schedule view ---');
    console.log('Possible issues:');
    console.log('1. Schedule templates not configured for online scheduling');
    console.log('2. All slots are blocked or already booked');
    console.log('3. Date range issue (sandbox may have limited date support)');
    console.log('4. Sandbox environment may need configuration update');

    // Try production to compare
    console.log('\n--- Testing PRODUCTION environment ---');
    const PROD_CONFIG = {
      endpoint: 'https://us-ea1-partner.cloud9ortho.com/GetData.ashx',
      clientId: 'b42c51be-2529-4d31-92cb-50fd1a58c084',
      userName: 'Intelepeer',
      password: '$#1Nt-p33R-AwS#$',
      namespace: 'http://schemas.practica.ws/cloud9/partners/'
    };

    // Get production chairs
    const prodChairs = await fetch(PROD_CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body: `<?xml version="1.0" encoding="utf-8"?><GetDataRequest xmlns="${PROD_CONFIG.namespace}"><ClientID>${PROD_CONFIG.clientId}</ClientID><UserName>${PROD_CONFIG.userName}</UserName><Password>${escapeXml(PROD_CONFIG.password)}</Password><Procedure>GetChairSchedules</Procedure><Parameters></Parameters></GetDataRequest>`
    });
    const prodChairsText = await prodChairs.text();
    const prodChairsResult = parseResponse(prodChairsText);

    if (prodChairsResult.records.length > 0) {
      const prodViewGuid = prodChairsResult.records[0].schdvwGUID;
      console.log(`Testing production view: ${prodChairsResult.records[0].schdvwDescription}`);

      const prodSlots = await fetch(PROD_CONFIG.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        body: `<?xml version="1.0" encoding="utf-8"?><GetDataRequest xmlns="${PROD_CONFIG.namespace}"><ClientID>${PROD_CONFIG.clientId}</ClientID><UserName>${PROD_CONFIG.userName}</UserName><Password>${escapeXml(PROD_CONFIG.password)}</Password><Procedure>GetOnlineReservations</Procedure><Parameters><startDate>${start} 7:00:00 AM</startDate><endDate>${end} 5:00:00 PM</endDate><schdvwGUIDs>${prodViewGuid}</schdvwGUIDs><morning>True</morning><afternoon>True</afternoon></Parameters></GetDataRequest>`
      });
      const prodSlotsText = await prodSlots.text();
      const prodSlotsResult = parseResponse(prodSlotsText);

      console.log(`Production slots found: ${prodSlotsResult.records.length}`);
      if (prodSlotsResult.records.length > 0) {
        console.log(`Sample: ${prodSlotsResult.records[0].StartTime} - ${prodSlotsResult.records[0].ScheduleColumnDescription}`);
      }
    }
  }
}

main().catch(console.error);
