/**
 * Test ALL sandbox locations for slot availability
 * Check GetLocations, then test each location's schedule views for slots
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

async function main() {
  console.log('='.repeat(60));
  console.log('SANDBOX Slot Availability Test - All Locations');
  console.log('='.repeat(60));
  console.log('');

  // Step 1: Get all locations
  console.log('Step 1: Getting all locations...\n');
  const locations = await callApi('GetLocations', {});
  console.log(`Found ${locations.records.length} locations\n`);

  locations.records.forEach((loc, i) => {
    console.log(`${i + 1}. ${loc.locName || 'Unnamed'} (${loc.locCity || ''}, ${loc.locState || ''})`);
    console.log(`   locGUID: ${loc.locGUID}`);
  });

  // Step 2: Get all chair schedules
  console.log('\n\nStep 2: Getting chair schedules (schedule views)...\n');
  const chairs = await callApi('GetChairSchedules', {});
  console.log(`Found ${chairs.records.length} chair schedule entries\n`);

  // Map locations to schedule views
  const locationScheduleMap = {};
  chairs.records.forEach(chair => {
    const locGUID = chair.locGUID;
    if (!locationScheduleMap[locGUID]) {
      locationScheduleMap[locGUID] = {
        locName: chair.locName,
        scheduleViews: []
      };
    }
    if (!locationScheduleMap[locGUID].scheduleViews.includes(chair.schdvwGUID)) {
      locationScheduleMap[locGUID].scheduleViews.push(chair.schdvwGUID);
    }
  });

  console.log('Location -> Schedule View mapping:');
  Object.entries(locationScheduleMap).forEach(([locGUID, data]) => {
    console.log(`  ${data.locName}: ${data.scheduleViews.length} schedule views`);
  });

  // Step 3: Test slots for each location
  console.log('\n\nStep 3: Testing slot availability for each location...\n');
  const dateRanges = [
    { start: '01/13/2026', end: '01/31/2026', desc: 'Jan 13-31, 2026' },
    { start: '02/01/2026', end: '02/28/2026', desc: 'Feb 2026' },
    { start: '03/01/2026', end: '03/31/2026', desc: 'Mar 2026' },
    { start: '06/01/2026', end: '06/30/2026', desc: 'Jun 2026' }
  ];

  let foundAnySlots = false;

  for (const [locGUID, data] of Object.entries(locationScheduleMap)) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Testing: ${data.locName} (${data.scheduleViews.length} views)`);
    console.log(`locGUID: ${locGUID}`);

    // Test with all schedule views for this location
    const schdvwGUIDs = data.scheduleViews.join('|');

    for (const range of dateRanges) {
      const result = await callApi('GetOnlineReservations', {
        startDate: `${range.start} 7:00:00 AM`,
        endDate: `${range.end} 5:00:00 PM`,
        schdvwGUIDs: schdvwGUIDs,
        morning: 'True',
        afternoon: 'True'
      });

      if (result.records.length > 0) {
        console.log(`  ✓ ${range.desc}: ${result.records.length} slots found!`);
        console.log(`    First slot: ${result.records[0].StartTime}`);
        foundAnySlots = true;
        break; // Found slots, no need to check more ranges
      }
    }

    // If no slots found with schedule view filter, try without
    if (!foundAnySlots) {
      const noFilterResult = await callApi('GetOnlineReservations', {
        startDate: '01/13/2026 7:00:00 AM',
        endDate: '12/31/2026 5:00:00 PM',
        morning: 'True',
        afternoon: 'True'
      });

      if (noFilterResult.records.length > 0) {
        console.log(`  ✓ NO FILTER (all year): ${noFilterResult.records.length} slots found!`);
        console.log(`    First slot: ${noFilterResult.records[0].StartTime}`);
        foundAnySlots = true;
      } else {
        console.log(`  ✗ No slots found in any date range`);
      }
    }
  }

  // Step 4: Final test - try without ANY filters
  console.log('\n\n' + '═'.repeat(60));
  console.log('Step 4: Final test - GetOnlineReservations with NO filters');
  console.log('═'.repeat(60) + '\n');

  const globalResult = await callApi('GetOnlineReservations', {
    startDate: '01/13/2026 7:00:00 AM',
    endDate: '12/31/2026 5:00:00 PM',
    morning: 'True',
    afternoon: 'True'
  });

  console.log(`Global search (all locations, Jan-Dec 2026): ${globalResult.records.length} slots`);

  if (globalResult.records.length > 0) {
    console.log('\nSlots found!');
    globalResult.records.slice(0, 10).forEach((slot, i) => {
      console.log(`  ${i + 1}. ${slot.StartTime} - ${slot.ScheduleViewDescription} - ${slot.ScheduleColumnDescription}`);
    });
  }

  // Summary
  console.log('\n\n' + '═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  if (foundAnySlots || globalResult.records.length > 0) {
    console.log('✓ SLOTS EXIST - Some availability found');
  } else {
    console.log('✗ NO SLOTS IN SANDBOX - All schedule views return 0 slots');
    console.log('\nRoot cause: Cloud9 sandbox has no appointment slots configured');
    console.log('This explains "slots disappear" - they never existed in the first place');
    console.log('\nPossible LLM hallucination or stale cached data causing phantom offers');
  }
}

main().catch(console.error);
