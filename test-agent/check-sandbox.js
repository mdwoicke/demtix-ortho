const fetch = require('node-fetch');

const CLOUD9 = {
  endpoint: 'https://us-ea1-partnertest.cloud9ortho.com/GetData.ashx',
  clientId: 'c15aa02a-adc1-40ae-a2b5-d2e39173ae56',
  userName: 'IntelepeerTest',
  password: '#!InteleP33rTest!#',
  namespace: 'http://schemas.practica.ws/cloud9/partners/',
  defaultApptTypeGUID: '8fc9d063-ae46-4975-a5ae-734c6efe341a'
};

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

async function callCloud9Raw(procedure, params = {}) {
  const xmlRequest = buildXmlRequest(procedure, params);
  const response = await fetch(CLOUD9.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: xmlRequest,
    timeout: 30000
  });
  return response.text();
}

async function findProviderData() {
  console.log('=== Searching for Provider Data ===\n');

  // Try various APIs that might return provider info
  const apis = [
    { name: 'GetPortalPatientLookup', params: { filter: 'a', lookupByPatient: '1' } },
    { name: 'GetAppointmentListByDate', params: { dtAppointment: '01/01/2026' } },
    { name: 'GetExistingAppts', params: {} }
  ];

  for (const api of apis) {
    console.log(`\n--- ${api.name} ---`);
    try {
      const result = await callCloud9Raw(api.name, api.params);
      console.log('Response snippet:');
      console.log(result.substring(0, 500));

      // Count records
      const recordCount = (result.match(/<Record>/g) || []).length;
      console.log(`\nRecords: ${recordCount}`);

      // Look for provider/ortho related fields
      if (result.includes('Provider') || result.includes('Ortho')) {
        console.log('Contains provider/ortho data!');
        // Extract provider GUID if present
        const provMatch = result.match(/ProviderGUID>([^<]+)</);
        if (provMatch) {
          console.log(`Found ProviderGUID: ${provMatch[1]}`);
        }
      }
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
  }

  // Try to get appointments for a date range to find provider data
  console.log('\n--- GetAppointmentsByDate ---');
  try {
    const result = await callCloud9Raw('GetAppointmentsByDate', {
      dtAppointment: '01/02/2026',
      schdvwGUID: 'e0df6927-bf6e-41fc-840f-f60424539de4'  // From slots
    });
    console.log('Response snippet:');
    console.log(result.substring(0, 800));
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

findProviderData();
