const Database = require('better-sqlite3');
const db = new Database('./data/test-results.db');

// Get tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));

// Get recent findings
const findings = db.prepare("SELECT * FROM findings ORDER BY id DESC LIMIT 10").all();
console.log('\nRecent findings:');
findings.forEach(f => {
  console.log('---');
  console.log('Test:', f.test_id, '| Step:', f.step_id, '| Severity:', f.severity);
  console.log('Description:', f.description);
  console.log('Details:', (f.details || '').substring(0, 800));
});

// Get API calls to see actual responses
const apiCalls = db.prepare("SELECT * FROM api_calls ORDER BY id DESC LIMIT 5").all();
console.log('\nRecent API calls:');
apiCalls.forEach(a => {
  console.log('---');
  console.log('Test:', a.test_id, '| Endpoint:', a.endpoint);
  console.log('Request:', (a.request || '').substring(0, 300));
  console.log('Response:', (a.response || '').substring(0, 800));
});

db.close();
