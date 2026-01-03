const Database = require('better-sqlite3');
const db = new Database('./data/test-results.db');

// First, check the schema
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE name='goal_test_results'").get();
console.log('Schema:', schema?.sql);

const columns = db.prepare("PRAGMA table_info(goal_test_results)").all();
console.log('\nColumns:', columns.map(c => c.name).join(', '));

const results = db.prepare(`
  SELECT *
  FROM goal_test_results
  ORDER BY id DESC
  LIMIT 3
`).all();

results.forEach((r, i) => {
  console.log('\n' + '='.repeat(60));
  console.log('Test:', r.test_id);
  console.log('Summary:', r.summary_text);

  const goals = JSON.parse(r.goal_results_json || '[]');
  console.log('\nGoal Results:');
  goals.forEach(g => {
    console.log(`  [${g.passed ? 'PASS' : 'FAIL'}] ${g.goalId}: ${g.message}`);
    if (g.details) {
      console.log('    Details:', JSON.stringify(g.details));
    }
  });

  const violations = JSON.parse(r.constraint_violations_json || '[]');
  if (violations.length > 0) {
    console.log('\nConstraint Violations:');
    violations.forEach(v => {
      console.log(`  - ${v.message}`);
      if (v.turnNumber) console.log(`    Turn: ${v.turnNumber}`);
    });
  }
});

db.close();
