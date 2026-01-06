/**
 * Export Cloud9 Production Locations to CSV
 *
 * Usage: node backend/scripts/export-locations.js
 */

const fs = require('fs');
const path = require('path');

// Production Cloud9 API Configuration
const PRODUCTION_CONFIG = {
  endpoint: 'https://us-ea1-partner.cloud9ortho.com/GetData.ashx',
  clientId: 'b42c51be-2529-4d31-92cb-50fd1a58c084',
  userName: 'Intelepeer',
  password: '$#1Nt-p33R-AwS#$',
  namespace: 'http://schemas.practica.ws/cloud9/partners/'
};

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;');
}

/**
 * Build XML request for GetLocations
 */
function buildGetLocationsRequest() {
  return `<?xml version="1.0" encoding="utf-8"?>
<GetDataRequest xmlns="${PRODUCTION_CONFIG.namespace}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ClientID>${PRODUCTION_CONFIG.clientId}</ClientID>
  <UserName>${PRODUCTION_CONFIG.userName}</UserName>
  <Password>${escapeXml(PRODUCTION_CONFIG.password)}</Password>
  <Procedure>GetLocations</Procedure>
  <Parameters>
    <showDeleted>False</showDeleted>
  </Parameters>
</GetDataRequest>`;
}

/**
 * Parse XML response and extract records
 */
function parseXmlResponse(xmlText) {
  const statusMatch = xmlText.match(/<ResponseStatus>([^<]+)<\/ResponseStatus>/);
  const status = statusMatch ? statusMatch[1] : 'Unknown';

  if (status === 'Error' || status !== 'Success') {
    const errorMatch = xmlText.match(/<Result>([^<]+)<\/Result>/);
    const errorCodeMatch = xmlText.match(/<ErrorCode>([^<]+)<\/ErrorCode>/);
    const errorMessageMatch = xmlText.match(/<ErrorMessage>([^<]+)<\/ErrorMessage>/);
    throw new Error(errorMatch?.[1] || `${errorCodeMatch?.[1] || ''}: ${errorMessageMatch?.[1] || 'Unknown error'}`);
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

/**
 * Convert records to CSV
 */
function recordsToCsv(records) {
  if (!records.length) return '';

  // Get all unique field names across all records
  const allFields = [...new Set(records.flatMap(r => Object.keys(r)))];

  // Sort fields: put common ones first, then alphabetically
  const priorityFields = ['LocationGUID', 'LocationName', 'LocationCode', 'TimeZone', 'AddressStreet', 'AddressCity', 'AddressState', 'AddressPostalCode', 'PhoneNumber'];
  const sortedFields = [
    ...priorityFields.filter(f => allFields.includes(f)),
    ...allFields.filter(f => !priorityFields.includes(f)).sort()
  ];

  // Build CSV header
  const header = sortedFields.join(',');

  // Build CSV rows
  const rows = records.map(record => {
    return sortedFields.map(field => {
      const value = record[field] || '';
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Cloud9 Production Locations Export');
  console.log('='.repeat(60));
  console.log(`Endpoint: ${PRODUCTION_CONFIG.endpoint}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  try {
    // Build request
    const xmlRequest = buildGetLocationsRequest();
    console.log('Sending request to Cloud9 API...');

    // Make API call
    const response = await fetch(PRODUCTION_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8'
      },
      body: xmlRequest
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xmlText = await response.text();
    console.log(`Response received (${xmlText.length} bytes)`);

    // Parse response
    const { status, records } = parseXmlResponse(xmlText);
    console.log(`Status: ${status}`);
    console.log(`Records found: ${records.length}`);

    if (records.length === 0) {
      console.log('No locations found.');
      return;
    }

    // Show field names
    const allFields = [...new Set(records.flatMap(r => Object.keys(r)))];
    console.log(`\nFields (${allFields.length}): ${allFields.join(', ')}`);

    // Convert to CSV
    const csv = recordsToCsv(records);

    // Write to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputPath = path.join(__dirname, '..', '..', `cloud9_locations_production_${timestamp}.csv`);
    fs.writeFileSync(outputPath, csv, 'utf8');

    console.log(`\nCSV exported to: ${outputPath}`);
    console.log('='.repeat(60));

    // Also print summary table
    console.log('\nLocation Summary:');
    console.log('-'.repeat(60));
    records.forEach((loc, i) => {
      console.log(`${i + 1}. ${loc.LocationName || 'N/A'} (${loc.LocationCode || 'N/A'})`);
      console.log(`   GUID: ${loc.LocationGUID || 'N/A'}`);
      if (loc.AddressCity || loc.AddressState) {
        console.log(`   Location: ${[loc.AddressCity, loc.AddressState].filter(Boolean).join(', ')}`);
      }
    });
    console.log('-'.repeat(60));

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
