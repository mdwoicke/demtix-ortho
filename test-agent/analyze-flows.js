const Database = require('better-sqlite3');
const db = new Database('./data/test-results.db');

console.log('=== FLOWISE FLOW ANALYSIS ===\n');

// Get recent test results
const results = db.prepare(`
  SELECT g.test_id, g.run_id, g.passed, g.duration_ms, g.turn_count,
         g.summary_text, g.goal_results_json, t.transcript_json
  FROM goal_test_results g
  LEFT JOIN test_results tr ON g.run_id = tr.run_id AND g.test_id = tr.test_id
  LEFT JOIN transcripts t ON tr.id = t.result_id
  ORDER BY g.completed_at DESC
  LIMIT 15
`).all();

console.log('Analyzing', results.length, 'recent test results...\n');

// Track patterns
const bookingFailures = [];
const conversationPatterns = [];
const agentResponses = [];

results.forEach(r => {
  const goals = r.goal_results_json ? JSON.parse(r.goal_results_json) : [];
  const failedGoals = goals.filter(g => !g.passed).map(g => g.goalId);

  if (failedGoals.includes('booking-confirmed')) {
    bookingFailures.push({
      testId: r.test_id,
      runId: r.run_id,
      turns: r.turn_count,
      duration: r.duration_ms
    });
  }

  // Analyze transcript for patterns
  if (r.transcript_json) {
    const transcript = JSON.parse(r.transcript_json);
    const lastTurns = transcript.slice(-6);

    lastTurns.forEach(turn => {
      if (turn.role === 'assistant') {
        // Extract ANSWER portion
        const answerMatch = turn.content.match(/ANSWER:\s*(.*?)(?:\n\nPAYLOAD|$)/s);
        if (answerMatch) {
          agentResponses.push({
            testId: r.test_id,
            response: answerMatch[1].trim().substring(0, 200)
          });
        }
      }
    });

    // Check for specific patterns
    const fullTranscript = transcript.map(t => t.content).join(' ');

    if (fullTranscript.includes('Let me check on that')) {
      conversationPatterns.push({ testId: r.test_id, pattern: 'STUCK_CHECKING' });
    }
    if (fullTranscript.includes('One moment')) {
      conversationPatterns.push({ testId: r.test_id, pattern: 'DELAYED_RESPONSE' });
    }
    if (fullTranscript.includes('connect you with')) {
      conversationPatterns.push({ testId: r.test_id, pattern: 'TRANSFER_INITIATED' });
    }
    if (fullTranscript.includes('appointment has been scheduled') ||
        fullTranscript.includes('appointment is confirmed') ||
        fullTranscript.includes('booked your appointment')) {
      conversationPatterns.push({ testId: r.test_id, pattern: 'BOOKING_CONFIRMED' });
    }
  }
});

console.log('=== BOOKING FAILURES ===');
console.log('Count:', bookingFailures.length);
bookingFailures.forEach(f => {
  console.log(`  ${f.testId} (${f.turns} turns, ${(f.duration/1000).toFixed(1)}s)`);
});

console.log('\n=== CONVERSATION PATTERNS ===');
const patternCounts = {};
conversationPatterns.forEach(p => {
  patternCounts[p.pattern] = (patternCounts[p.pattern] || 0) + 1;
});
Object.entries(patternCounts).forEach(([pattern, count]) => {
  console.log(`  ${pattern}: ${count} occurrences`);
});

console.log('\n=== LAST AGENT RESPONSES (before failure) ===');
const uniqueResponses = [...new Set(agentResponses.map(r => r.response))];
uniqueResponses.slice(0, 10).forEach((resp, i) => {
  console.log(`\n${i+1}. "${resp}..."`);
});

// Analyze specific failed test transcripts in detail
console.log('\n\n=== DETAILED TRANSCRIPT ANALYSIS ===');

const failedTests = results.filter(r => !r.passed && r.transcript_json);
failedTests.slice(0, 3).forEach(r => {
  console.log(`\n--- ${r.test_id} (${r.run_id}) ---`);
  console.log('Summary:', r.summary_text);

  const transcript = JSON.parse(r.transcript_json);
  console.log('\nLast 4 exchanges:');
  transcript.slice(-8).forEach(turn => {
    const role = turn.role.toUpperCase();
    let content = turn.content;
    // Simplify assistant responses
    if (turn.role === 'assistant') {
      const answerMatch = content.match(/ANSWER:\s*(.*?)(?:\n\nPAYLOAD|$)/s);
      content = answerMatch ? answerMatch[1].trim() : content.substring(0, 150);
    }
    console.log(`[${role}]: ${content.substring(0, 200)}`);
  });
});

db.close();
