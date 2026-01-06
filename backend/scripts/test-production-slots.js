/**
 * Test PRODUCTION environment for slots
 */

const PROD_CONFIG = {
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

function parseResponse(xmlText) {
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
  return records;
}

async function testProd() {
  console.log('Testing PRODUCTION environment...\n');

  const xml = `<?xml version="1.0" encoding="utf-8"?><GetDataRequest xmlns="${PROD_CONFIG.namespace}"><ClientID>${PROD_CONFIG.clientId}</ClientID><UserName>${PROD_CONFIG.userName}</UserName><Password>${escapeXml(PROD_CONFIG.password)}</Password><Procedure>GetOnlineReservations</Procedure><Parameters><startDate>01/07/2026 7:00:00 AM</startDate><endDate>01/31/2026 5:00:00 PM</endDate><morning>True</morning><afternoon>True</afternoon></Parameters></GetDataRequest>`;

  const response = await fetch(PROD_CONFIG.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    body: xml
  });
  const text = await response.text();
  const records = parseResponse(text);

  console.log('Production slots found:', records.length);
  if (records.length > 0) {
    console.log('\nFirst 10 slots:');
    records.slice(0, 10).forEach((r, i) => {
      console.log(`${i + 1}. ${r.StartTime} - ${r.ScheduleColumnDescription}`);
      console.log(`   ScheduleViewGUID: ${r.ScheduleViewGUID}`);
      console.log(`   ScheduleColumnGUID: ${r.ScheduleColumnGUID}`);
    });

    console.log('\n\nSchedule views with slots:');
    const viewCounts = {};
    records.forEach(r => {
      const key = r.ScheduleViewGUID;
      if (!viewCounts[key]) viewCounts[key] = { count: 0, desc: r.ScheduleViewDescription };
      viewCounts[key].count++;
    });
    Object.entries(viewCounts).forEach(([guid, data]) => {
      console.log(`  ${data.desc || guid}: ${data.count} slots`);
    });
  }
}

testProd().catch(console.error);
