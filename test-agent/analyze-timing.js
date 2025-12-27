const Database = require('better-sqlite3');
const db = new Database('./data/test-results.db');

// Get recent test results with transcript
const results = db.prepare(`
  SELECT g.test_id, g.run_id, g.duration_ms, g.turn_count, t.transcript_json
  FROM goal_test_results g
  LEFT JOIN test_results tr ON g.run_id = tr.run_id AND g.test_id = tr.test_id
  LEFT JOIN transcripts t ON tr.id = t.result_id
  ORDER BY g.completed_at DESC
  LIMIT 2
`).all();

console.log('=== TIMING ANALYSIS ===\n');

results.forEach(r => {
  console.log('Test:', r.test_id);
  console.log('Duration:', (r.duration_ms / 1000).toFixed(1) + 's');
  console.log('Turns:', r.turn_count);
  console.log('Avg per turn:', (r.duration_ms / r.turn_count / 1000).toFixed(2) + 's');

  if (r.transcript_json) {
    const transcript = JSON.parse(r.transcript_json);

    // Analyze response times
    const responseTimes = transcript
      .filter(t => t.role === 'assistant' && t.responseTimeMs)
      .map(t => t.responseTimeMs);

    if (responseTimes.length > 0) {
      const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const max = Math.max(...responseTimes);
      const min = Math.min(...responseTimes);

      console.log('\nFlowise API Response Times:');
      console.log('  Count:', responseTimes.length);
      console.log('  Avg:', (avg / 1000).toFixed(2) + 's');
      console.log('  Min:', (min / 1000).toFixed(2) + 's');
      console.log('  Max:', (max / 1000).toFixed(2) + 's');
      console.log('  Total:', (responseTimes.reduce((a, b) => a + b, 0) / 1000).toFixed(1) + 's');

      // Calculate time not in Flowise
      const flowiseTotal = responseTimes.reduce((a, b) => a + b, 0);
      const overhead = r.duration_ms - flowiseTotal;
      console.log('\nOverhead (Intent Detection + Response Gen):');
      console.log('  Total:', (overhead / 1000).toFixed(1) + 's');
      console.log('  Per turn:', (overhead / r.turn_count / 1000).toFixed(2) + 's');
      console.log('  % of total:', ((overhead / r.duration_ms) * 100).toFixed(1) + '%');
    }
  }

  console.log('\n' + '='.repeat(50) + '\n');
});

db.close();
