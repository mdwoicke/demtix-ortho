const fs = require('fs');
const data = JSON.parse(fs.readFileSync('Ortho_Chatflow_latest.json', 'utf8'));

const toolAgent = data.nodes.find(n => n.id === 'toolAgent_0');
const systemMessage = toolAgent.data.inputs.systemMessage;

console.log('=== Deep Template Analysis ===\n');
console.log('SystemMessage length:', systemMessage.length, 'chars\n');

// Find EVERY { character and check what follows it
console.log('=== All { characters and their context ===\n');

let inString = false;
let braceCount = 0;
const issues = [];

for (let i = 0; i < systemMessage.length; i++) {
  const char = systemMessage[i];

  if (char === '{') {
    const next10 = systemMessage.substring(i, i + 40).replace(/\n/g, '\\n');
    const prev10 = systemMessage.substring(Math.max(0, i - 20), i).replace(/\n/g, '\\n');

    // Check if next char is { (double brace - valid template)
    const isDoubleBrace = systemMessage[i + 1] === '{';

    // Check if it looks like a template variable (alphanumeric after {)
    const afterBrace = systemMessage.substring(i + 1, i + 30);
    const varMatch = afterBrace.match(/^([a-zA-Z_$][a-zA-Z0-9_$.-]*)\}/);

    // Check if it's in a JSON context (preceded by : or ,)
    const isJsonContext = /[,:]\s*$/.test(prev10) || /^\s*"/.test(afterBrace);

    if (varMatch && !isDoubleBrace) {
      issues.push({
        position: i,
        type: 'POTENTIAL_TEMPLATE_VAR',
        pattern: '{' + varMatch[1] + '}',
        context: prev10 + ' >>> ' + next10
      });
    }

    braceCount++;
  }

  if (char === '}') {
    braceCount--;
  }
}

console.log('Issues found:', issues.length);
issues.forEach((issue, idx) => {
  console.log('\n' + (idx + 1) + '. ' + issue.type);
  console.log('   Position:', issue.position);
  console.log('   Pattern:', issue.pattern);
  console.log('   Context:', issue.context);
});

// Also look for patterns that might confuse Mustache even if not traditional variables
console.log('\n\n=== Unusual patterns that might confuse template engine ===\n');

// Check for {# or {/ or {> or {^ (Mustache special syntax)
const mustacheSpecial = systemMessage.match(/\{[#\/>\^][a-zA-Z]/g) || [];
console.log('Mustache special ({#, {/, {>, {^):', mustacheSpecial);

// Check for patterns like {something: (could be confused as JS object)
const objectLike = [];
let objMatch;
const objRegex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g;
while ((objMatch = objRegex.exec(systemMessage)) !== null) {
  // Skip if it's clearly in a JSON block (preceded by newline + whitespace typical of JSON)
  const before = systemMessage.substring(Math.max(0, objMatch.index - 5), objMatch.index);
  if (!/^\n\s*$/.test(before)) {
    objectLike.push({
      pattern: objMatch[0],
      pos: objMatch.index,
      context: systemMessage.substring(objMatch.index, objMatch.index + 30).replace(/\n/g, '\\n')
    });
  }
}
console.log('\nObject-like patterns {key::', objectLike.length);
objectLike.slice(0, 10).forEach(p => {
  console.log('  ', p.pattern, 'at', p.pos, ':', p.context);
});

// Look for unbalanced braces in each "block"
console.log('\n\n=== Checking for unbalanced braces ===');
const lines = systemMessage.split('\n');
let totalOpen = 0;
let totalClose = 0;
lines.forEach((line, idx) => {
  const opens = (line.match(/\{/g) || []).length;
  const closes = (line.match(/\}/g) || []).length;
  totalOpen += opens;
  totalClose += closes;
  if (opens !== closes && (opens > 0 || closes > 0)) {
    // Only report if it's a line with braces that are unbalanced
    if (Math.abs(opens - closes) > 3) {
      console.log('Line', idx + 1, ': opens=' + opens + ', closes=' + closes, ':', line.substring(0, 60).replace(/\n/g, '\\n'));
    }
  }
});
console.log('\nTotal: opens=' + totalOpen + ', closes=' + totalClose);
console.log('Balance:', totalOpen - totalClose);

// Check for specific problematic patterns
console.log('\n\n=== Checking for known problematic patterns ===');
const patterns = [
  { name: '{$vars', regex: /\{\$vars[^}]*\}/g },
  { name: '{input}', regex: /\{input\}/g },
  { name: '{question}', regex: /\{question\}/g },
  { name: '{chat_history}', regex: /\{chat_history\}/g },
  { name: '{context}', regex: /\{context\}/g },
  { name: '{human_input}', regex: /\{human_input\}/g },
  { name: '{{...}}', regex: /\{\{[^}]+\}\}/g },
  { name: 'Unescaped single var', regex: /\{[a-zA-Z][a-zA-Z0-9_]*\}(?!\s*[,:\]])/g }
];

patterns.forEach(p => {
  const matches = systemMessage.match(p.regex) || [];
  console.log(p.name + ':', matches.length, matches.length > 0 ? JSON.stringify(matches.slice(0, 5)) : '');
});
