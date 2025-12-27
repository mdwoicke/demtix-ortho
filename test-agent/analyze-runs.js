const db = require('better-sqlite3')('./data/test-results.db');

// Get all recent test runs
const runs = db.prepare(`SELECT run_id, started_at FROM test_runs ORDER BY started_at DESC LIMIT 10`).all();

console.log('HAPPY-001 slot search results across runs:');
console.log('');

runs.forEach(function(run) {
    var calls = db.prepare(`SELECT response_payload FROM api_calls WHERE run_id = ? AND test_id = 'HAPPY-001' AND tool_name = 'schedule_appointment_dso'`).all(run.run_id);

    if (calls.length > 0) {
        var respStr = calls[0].response_payload || '{}';
        if (respStr.startsWith('"')) respStr = JSON.parse(respStr);
        var resp = typeof respStr === 'string' ? JSON.parse(respStr) : respStr;

        var slots = 'N/A';
        if (typeof resp.count === 'number') {
            slots = resp.count;
        } else if (resp.error) {
            slots = 'ERROR: ' + resp.error;
        }
        console.log(run.run_id + ' | ' + slots + ' slots');
    }
});

db.close();
