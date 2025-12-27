const fs = require('fs');
const data = JSON.parse(fs.readFileSync('Ortho_Chatflow_latest.json', 'utf8'));

console.log('=== Checking ALL string fields in the chatflow ===\n');

function findAllStrings(obj, path = '') {
  const results = [];
  if (typeof obj === 'string' && obj.includes('{')) {
    // Check if it has single braces that look like variables
    const matches = obj.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g) || [];
    if (matches.length > 0) {
      // Check if any match is NOT inside {{ }}
      const hasUnescaped = matches.some(m => {
        const idx = obj.indexOf(m);
        const before = obj.substring(Math.max(0, idx - 1), idx);
        const after = obj.substring(idx + m.length, idx + m.length + 1);
        return before !== '{' && after !== '}';
      });
      if (hasUnescaped) {
        results.push({ path, matches, content: obj.substring(0, 300) });
      }
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      results.push(...findAllStrings(item, path + '[' + idx + ']'));
    });
  } else if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      results.push(...findAllStrings(obj[key], path ? path + '.' + key : key));
    }
  }
  return results;
}

const issues = findAllStrings(data);
console.log('Found', issues.length, 'strings with potential template-like patterns:\n');
issues.forEach((i, idx) => {
  console.log((idx + 1) + '. Path:', i.path);
  console.log('   Matches:', i.matches);
  console.log('   Content:', i.content.replace(/\n/g, '\\n').substring(0, 200));
  console.log('');
});

// Also check for any edge cases - lone } without {
console.log('\n=== Checking for lone } characters ===\n');
function findLoneCloseBraces(obj, path = '') {
  const results = [];
  if (typeof obj === 'string') {
    // Check if there's a } without a preceding { on the same "level"
    let depth = 0;
    for (let i = 0; i < obj.length; i++) {
      if (obj[i] === '{') depth++;
      if (obj[i] === '}') {
        if (depth === 0) {
          const context = obj.substring(Math.max(0, i - 20), Math.min(obj.length, i + 20));
          results.push({ path, pos: i, context: context.replace(/\n/g, '\\n') });
        } else {
          depth--;
        }
      }
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      results.push(...findLoneCloseBraces(item, path + '[' + idx + ']'));
    });
  } else if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      results.push(...findLoneCloseBraces(obj[key], path ? path + '.' + key : key));
    }
  }
  return results;
}

const loneIssues = findLoneCloseBraces(data);
console.log('Found', loneIssues.length, 'lone } characters');
loneIssues.slice(0, 20).forEach((i, idx) => {
  console.log((idx + 1) + '. Path:', i.path);
  console.log('   Position:', i.pos);
  console.log('   Context:', i.context);
  console.log('');
});
