const db = require('better-sqlite3')('./data/test-results.db');

// Get test results for latest run
const results = db.prepare(`SELECT test_id, started_at, completed_at, status, duration_ms FROM test_results WHERE run_id = 'run-2025-12-25-e3aa8693' ORDER BY started_at`).all();

console.log('Test execution order:');
results.forEach(function(r, i) {
    console.log((i+1) + '. ' + r.test_id);
    console.log('   Started: ' + r.started_at);
    console.log('   Duration: ' + r.duration_ms + 'ms');
    console.log('   Status: ' + r.status);
});

// Now get API calls timeline
console.log('');
console.log('Slot search API calls timeline:');
const calls = db.prepare(`SELECT test_id, step_id, timestamp, tool_name, request_payload, response_payload FROM api_calls WHERE run_id = 'run-2025-12-25-e3aa8693' AND tool_name = 'schedule_appointment_dso' ORDER BY timestamp`).all();
calls.forEach(function(c) {
    var req = c.request_payload ? JSON.parse(c.request_payload) : {};
    var respStr = c.response_payload || '{}';
    // Handle double-encoded JSON
    if (respStr.startsWith('"')) {
        respStr = JSON.parse(respStr);
    }
    var resp = typeof respStr === 'string' ? JSON.parse(respStr) : respStr;
    var slots = 'unknown';
    if (typeof resp.count === 'number') {
        slots = resp.count + ' slots';
    } else if (resp.groups) {
        slots = resp.groups.length + ' groups';
    }
    console.log('');
    console.log(c.test_id + ' | ' + c.step_id + ' | ' + req.action + ' | ' + slots);
    console.log('  Request: ' + JSON.stringify(req));
    console.log('  Attempts: ' + (resp.attempts || 'N/A') + ', Expanded: ' + (resp.expanded || false));
    if (resp.searchRange) {
        console.log('  Search range: ' + JSON.stringify(resp.searchRange));
    }
    if (resp.error) {
        console.log('  Error: ' + resp.error);
    }
    if (resp.message) {
        console.log('  Message: ' + resp.message);
    }
});

db.close();
